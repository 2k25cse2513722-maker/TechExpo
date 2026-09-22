from ultralytics import YOLO
import cv2
import requests

# YOLO model load
model = YOLO("yolo11n.pt")

# Camera start
camera = cv2.VideoCapture(0)

# API ko har 10 frames mein data bhejenge
frame_number = 0

while True:

    success, frame = camera.read()

    if not success:
        print("Camera nahi chal raha")
        break

    # Frame number increase
    frame_number += 1

    # YOLO detection
    results = model(frame)

    # Original frame par boxes
    annotated_frame = results[0].plot()

    # Person count
    person_count = 0

    for box in results[0].boxes:

        # Class ID
        class_id = int(box.cls[0])

        # Person ka class ID = 0
        if class_id == 0:
            person_count += 1

    # Har 10 frames mein backend ko count aur frame bhejo
    if frame_number % 10 == 0:

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

            print(f"Backend updated: {person_count} persons in Room A-101")

        except requests.RequestException:
            print("Backend se connection nahi ho raha (Start main.py first)")

    # Screen par count show karo
    cv2.putText(
        annotated_frame,
        f"Persons: {person_count}",
        (20, 40),
        cv2.FONT_HERSHEY_SIMPLEX,
        1,
        (0, 255, 0),
        2
    )

    # Window show
    cv2.imshow("Smart Campus AI", annotated_frame)

    # Q press karke exit
    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

camera.release()
cv2.destroyAllWindows()