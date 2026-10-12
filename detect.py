from ultralytics import YOLO
import cv2
import requests
import os
import sys

# Append current directory to path so face_engine can be imported
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from face_engine import FaceRecognizer

# Configuration
FACE_RECOGNITION_THRESHOLD = 0.8
KNOWN_FACES_DIR = "known_faces"

# YOLO model load
model = YOLO("yolo11n.pt")

# Initialize Face Engine
print("Initializing Face Engine...")
face_recognizer = FaceRecognizer(known_faces_dir=KNOWN_FACES_DIR, threshold=FACE_RECOGNITION_THRESHOLD)
face_recognizer.load_known_faces()

import argparse

# Parse command line source options
parser = argparse.ArgumentParser(description="CampusVision AI Detection Engine")
parser.add_argument("--source", choices=["camera", "video"], default="camera", help="Detection source (camera or video)")
parser.add_argument("--video-path", default=None, help="Custom path to video file")
args = parser.parse_args()

CAMPUS_VIDEO_PATHS = [
    r"C:\Users\anant\Videos\Captures\campus_demo.mp4.mp4",
    "/mnt/c/Users/anant/Videos/Captures/campus_demo.mp4.mp4",
]

def resolve_video_path(custom=None):
    if custom and os.path.exists(custom):
        return custom
    for p in CAMPUS_VIDEO_PATHS:
        if os.path.exists(p):
            return p
    return None

is_video = (args.source == "video")
video_file = None

if is_video:
    video_file = resolve_video_path(args.video_path)
    if not video_file:
        print(f"Error: Recorded video file not found at: {CAMPUS_VIDEO_PATHS[0]}")
        sys.exit(1)
    print(f"Opening recorded video: {video_file}")
    camera = cv2.VideoCapture(video_file)
else:
    print("Opening live camera (webcam)...")
    camera = cv2.VideoCapture(0)

if not camera.isOpened():
    print(f"Error: Could not open {args.source}. Please verify connection/permissions.")
    sys.exit(1)

# API ko har 10 frames mein data bhejenge
frame_number = 0

while True:

    success, frame = camera.read()

    if not success:
        if is_video:
            # Replay video seamlessly
            camera.set(cv2.CAP_PROP_POS_FRAMES, 0)
            success, frame = camera.read()
        if not success:
            print("Video stream ended or camera disconnected.")
            break

    # Frame number increase
    frame_number += 1

    # YOLO detection
    results = model(frame, verbose=False)

    # Original frame par YOLO boxes
    annotated_frame = results[0].plot()

    # Person count
    person_count = 0
    for box in results[0].boxes:
        class_id = int(box.cls[0])
        if class_id == 0:  # Person ka class ID = 0
            person_count += 1

    # Face Recognition
    face_results = face_recognizer.recognize_faces(frame)
    faces = face_results["faces"]
    recognized_count = face_results["recognized_count"]
    unknown_count = face_results["unknown_count"]
    total_faces = len(faces)

    # Draw Face Boxes
    for face in faces:
        x1, y1, x2, y2 = face["box"]
        name = face["name"]
        
        # Green for recognized, Red for unknown
        color = (0, 255, 0) if name != "Unknown" else (0, 0, 255)
        
        cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), color, 2)
        cv2.putText(annotated_frame, name, (x1, max(y1 - 10, 0)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)

    # Print logs
    if frame_number % 10 == 0:
        print(f"--- Frame {frame_number} ---")
        print(f"People detected (YOLO): {person_count}")
        print(f"Faces detected: {total_faces}")
        print(f"Recognized: {recognized_count}")
        print(f"Unknown: {unknown_count}")
        print("-" * 20)

        # Har 10 frames mein backend ko count aur frame bhejo
        try:
            requests.post(
                "http://127.0.0.1:8000/occupancy/update",
                json={
                    "room": "A-101",
                    "persons": person_count
                },
                timeout=0.5
            )

            # Web dashboard stream ke liye annotated frame upload karo
            _, img_encoded = cv2.imencode('.jpg', annotated_frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
            requests.post(
                "http://127.0.0.1:8000/camera/frame",
                files={"file": ("frame.jpg", img_encoded.tobytes(), "image/jpeg")},
                timeout=0.5
            )
        except requests.RequestException:
            pass # Keep terminal clean if backend is not running

    # Screen par count show karo
    y_offset = 40
    cv2.putText(annotated_frame, f"Persons (YOLO): {person_count}", (20, y_offset), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)
    cv2.putText(annotated_frame, f"Faces Recognized: {recognized_count}", (20, y_offset + 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
    cv2.putText(annotated_frame, f"Faces Unknown: {unknown_count}", (20, y_offset + 60), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)

    # Window show
    cv2.imshow("Smart Campus AI", annotated_frame)

    # Q press karke exit
    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

camera.release()
cv2.destroyAllWindows()