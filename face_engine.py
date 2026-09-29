import os
import cv2
import torch
import numpy as np
from facenet_pytorch import MTCNN, InceptionResnetV1
from PIL import Image
import database

class FaceRecognizer:
    def __init__(self, known_faces_dir="known_faces", threshold=0.8):
        self.known_faces_dir = known_faces_dir
        self.threshold = threshold
        
        # Determine device (MPS for Apple Silicon, CUDA for NVIDIA, CPU fallback)
        if torch.backends.mps.is_available():
            self.resnet_device = torch.device('mps')
            self.mtcnn_device = torch.device('cpu')  # Fix: MTCNN adaptive pool crashes on MPS
            print("[Face Engine] Face detection device: CPU")
            print("[Face Engine] Face embedding device: MPS")
        elif torch.cuda.is_available():
            self.resnet_device = torch.device('cuda')
            self.mtcnn_device = torch.device('cuda')
            print("[Face Engine] Face detection device: CUDA")
            print("[Face Engine] Face embedding device: CUDA")
        else:
            self.resnet_device = torch.device('cpu')
            self.mtcnn_device = torch.device('cpu')
            print("[Face Engine] Face detection device: CPU")
            print("[Face Engine] Face embedding device: CPU")
            
        # Initialize MTCNN for face detection on mtcnn_device
        self.mtcnn = MTCNN(keep_all=True, device=self.mtcnn_device)
        
        # Initialize InceptionResnetV1 for face embeddings on resnet_device
        self.resnet = InceptionResnetV1(pretrained='vggface2').eval().to(self.resnet_device)
        
        self.known_embeddings = []
        self.known_names = []
        self.known_student_ids = []
        
    def reload_known_faces(self):
        """Clears current embeddings and reloads them dynamically."""
        self.known_embeddings = []
        self.known_names = []
        self.known_student_ids = []
        self.load_known_faces()
        
    def load_known_faces(self):
        print(f"[Face Engine] Loading known faces from {self.known_faces_dir}...")
        if not os.path.exists(self.known_faces_dir):
            os.makedirs(self.known_faces_dir, exist_ok=True)
            print(f"[Face Engine] Created '{self.known_faces_dir}' folder. Add images to it.")
            print(f"[Face Engine] Known faces loaded: {len(self.known_names)}")
            return

        valid_exts = {".jpg", ".jpeg", ".png"}
        
        for filename in os.listdir(self.known_faces_dir):
            ext = os.path.splitext(filename)[1].lower()
            if ext not in valid_exts:
                continue
                
            filepath = os.path.join(self.known_faces_dir, filename)
            base_name = os.path.splitext(filename)[0]
            
            # Fetch from DB to get actual name
            student = database.get_student_by_id(base_name)
            if student:
                actual_name = student['name']
                actual_id = student['student_id']
            else:
                # Legacy fallback
                actual_name = base_name
                actual_id = "UNKNOWN_ID"
            
            try:
                # MTCNN expects PIL images or numpy arrays in RGB
                img = Image.open(filepath).convert('RGB')
                
                # Get cropped faces (returns tensor on mtcnn_device, which is CPU)
                faces = self.mtcnn(img)
                if faces is not None and len(faces) > 0:
                    # Take the first face if multiple
                    face_tensor = faces[0].unsqueeze(0).to(self.resnet_device)
                    embedding = self.resnet(face_tensor).detach().cpu().numpy()[0]
                    
                    self.known_embeddings.append(embedding)
                    self.known_names.append(actual_name)
                    self.known_student_ids.append(actual_id)
                    print(f"  -> Loaded {actual_name} ({actual_id})")
                else:
                    print(f"  -> Warning: No face detected in {filename}")
            except Exception as e:
                print(f"  -> Error loading {filename}: {e}")
                
        if len(self.known_embeddings) > 0:
            self.known_embeddings = np.array(self.known_embeddings)
            
        print(f"[Face Engine] Known faces loaded: {len(self.known_names)}")

    def recognize_faces(self, frame_bgr):
        """
        Takes a BGR frame from cv2, returns a list of dictionaries with bounding box and name.
        """
        # Convert BGR to RGB for MTCNN
        frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        img_pil = Image.fromarray(frame_rgb)
        
        results = {
            "faces": [],
            "recognized_count": 0,
            "unknown_count": 0
        }
        
        # Detect faces (boxes are [x1, y1, x2, y2])
        boxes, _ = self.mtcnn.detect(img_pil)
        
        if boxes is None:
            return results
            
        # Get embeddings for detected faces
        # MTCNN can directly return cropped tensors
        face_tensors = self.mtcnn(img_pil)
        
        if face_tensors is None:
            return results
            
        # Move tensors to the correct device for the ResNet model
        face_tensors = face_tensors.to(self.resnet_device)
        embeddings = self.resnet(face_tensors).detach().cpu().numpy()
        
        for i, box in enumerate(boxes):
            x1, y1, x2, y2 = [int(b) for b in box]
            best_name = "Unknown"
            best_student_id = "UNKNOWN_ID"
            
            confidence = 0.0
            if len(self.known_embeddings) > 0:
                # Calculate distances (L2 distance is standard for facenet)
                diff = self.known_embeddings - embeddings[i]
                distances = np.linalg.norm(diff, axis=1)
                
                min_idx = np.argmin(distances)
                min_dist = distances[min_idx]
                
                if min_dist <= self.threshold:
                    best_name = self.known_names[min_idx]
                    best_student_id = self.known_student_ids[min_idx]
                
                confidence = float(max(0.0, 1.0 - (min_dist / 1.5)))
                    
            results["faces"].append({
                "box": [x1, y1, x2, y2],
                "name": best_name,
                "student_id": best_student_id,
                "confidence": round(confidence, 2),
                "status": "recognized" if best_name != "Unknown" else "unknown"
            })
            
            if best_name == "Unknown":
                results["unknown_count"] += 1
            else:
                results["recognized_count"] += 1
                
        return results
