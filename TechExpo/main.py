"""
PSIT CampusVision AI — Smart Campus Monitoring System
FastAPI Backend Application
Tech Expo 2026 Edition
"""

import time
import threading
import csv
import io
import cv2
import numpy as np
from typing import Dict, List, Optional
from pydantic import BaseModel
from fastapi import FastAPI, Form, Request, Response, UploadFile, File, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse, StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import database as db
from ai_state import ai_state_manager
from face_engine import FaceRecognizer

app = FastAPI(
    title="PSIT CampusVision AI",
    description="AI-powered smart campus monitoring system using YOLO and CCTV feeds.",
    version="2.0.0"
)

# Mount static files and templates
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# =====================================================================
# 1. AUTHENTICATION & DEMO USERS
# =====================================================================
users = {
    "PSIT001": {
        "password": "12345",
        "name": "Prof. R. K. Mishra",
        "role": "admin",
        "dept": "Dean Academics & Surveillance"
    },
    "PSIT002": {
        "password": "12345",
        "name": "Dr. Ananya Sharma",
        "role": "faculty",
        "dept": "Computer Science & Engineering"
    }
}

# =====================================================================
# 2. IN-MEMORY DATA STORES (CAMPUS STATE)
# =====================================================================

# Backward-compatible single room state (used by detect.py)
current_occupancy = {
    "room": "A-101",
    "persons": 0,
    "capacity": 60
}

# Campus Classrooms Data Store
rooms_db: Dict[str, dict] = {
    "A-101": {
        "room": "A-101",
        "capacity": 60,
        "persons": 0,
        "faculty": "Dr. Ananya Sharma",
        "subject": "CS-601: Computer Vision & AI",
        "is_live_feed": True
    },
    "A-102": {
        "room": "A-102",
        "capacity": 60,
        "persons": 42,
        "faculty": "Prof. Amit Verma",
        "subject": "CS-402: Data Structures",
        "is_live_feed": False
    },
    "B-201": {
        "room": "B-201",
        "capacity": 50,
        "persons": 0,
        "faculty": "Free Slot",
        "subject": "Unallocated Period",
        "is_live_feed": False
    },
    "AI-Lab": {
        "room": "AI-Lab",
        "capacity": 40,
        "persons": 36,
        "faculty": "Dr. Priya Saxena",
        "subject": "IT-702: Deep Learning Lab",
        "is_live_feed": False
    },
    "Auditorium": {
        "room": "Auditorium",
        "capacity": 250,
        "persons": 115,
        "faculty": "Dean Office",
        "subject": "Tech Expo Seminar",
        "is_live_feed": False
    }
}

# Corridor Footfall & Safety Data
corridors_db = [
    {
        "id": "C-1",
        "name": "Academic Block A — 1st Floor",
        "zone": "North Wing",
        "count": 8,
        "threshold": 30,
        "status": "Normal"
    },
    {
        "id": "C-2",
        "name": "Central Campus Admin Corridor",
        "zone": "Main Lobby",
        "count": 22,
        "threshold": 35,
        "status": "Moderate"
    }
]

# Demo Faculty Timetable
timetable_db = [
    {
        "id": "TT-101",
        "faculty": "Dr. Ananya Sharma",
        "subject": "CS-601: Computer Vision & AI",
        "room": "A-101",
        "time_slot": "10:00 AM - 11:00 AM",
        "expected_strength": 55
    },
    {
        "id": "TT-102",
        "faculty": "Prof. Amit Verma",
        "subject": "CS-402: Data Structures",
        "room": "A-102",
        "time_slot": "10:00 AM - 11:00 AM",
        "expected_strength": 45
    },
    {
        "id": "TT-103",
        "faculty": "Prof. S. K. Singh",
        "subject": "CS-503: Database Management",
        "room": "B-201",
        "time_slot": "11:15 AM - 12:15 PM",
        "expected_strength": 48
    },
    {
        "id": "TT-104",
        "faculty": "Dr. Priya Saxena",
        "subject": "IT-702: Deep Learning Lab",
        "room": "AI-Lab",
        "time_slot": "10:00 AM - 01:00 PM",
        "expected_strength": 38
    }
]

# Shared latest frame buffer for live web video streaming
latest_camera_frame: Optional[bytes] = None
latest_frame_time: float = 0.0

# =====================================================================
# 3. HELPER FUNCTIONS
# =====================================================================

def calculate_room_status(persons: int, capacity: int) -> str:
    """Classify occupancy into Empty, Normal, or Full."""
    if persons == 0:
        return "Empty"
    elif persons >= capacity:
        return "Full"
    return "Normal"

def get_current_user(request: Request) -> Optional[dict]:
    """Retrieve logged-in user from database via session cookie."""
    college_id = request.cookies.get("session_user")
    if college_id:
        user = db.get_user_by_id(college_id)
        if user:
            return user
    return None

# =====================================================================
# OCCUPANCY LOGS & AUDIT TRAIL
# =====================================================================
last_logged_time: Dict[str, float] = {}

def record_occupancy_log(room_name: str, count: int):
    """Record an occupancy snapshot periodically to SQLite."""
    now = time.time()
    if room_name in last_logged_time and (now - last_logged_time[room_name] < 20.0):
        return
    last_logged_time[room_name] = now

    room_info = db.get_room_by_id(room_name) or {}
    cap = room_info.get("capacity", 60)
    status = calculate_room_status(count, cap)

    db.add_occupancy_log(
        room=room_name,
        persons=count,
        capacity=cap,
        status=status,
        faculty=room_info.get("faculty", "Unassigned"),
        subject=room_info.get("subject", "General Lecture")
    )

# =====================================================================
# AUTOMATED ALERT ENGINE
# =====================================================================

def evaluate_campus_alerts() -> List[dict]:
    """Dynamically evaluate campus safety and timetable anomalies from SQLite."""
    alerts = []
    dismissed = db.get_dismissed_alert_ids()
    rooms = {r["room"]: r for r in db.get_all_rooms()}
    timetable = db.get_all_timetable()
    corridors = db.get_all_corridors()

    # 1. Overcrowding Check
    for room_id, r in rooms.items():
        if r["persons"] > r["capacity"]:
            alert_id = f"OVERCROWD-{room_id}"
            if alert_id not in dismissed:
                alerts.append({
                    "id": alert_id,
                    "severity": "HIGH",
                    "title": f"Overcrowding Hazard: {r['room']}",
                    "message": f"Detected {r['persons']} students, exceeding capacity limit of {r['capacity']} seats.",
                    "zone": r["room"],
                    "timestamp": time.strftime("%H:%M:%S")
                })

    # 2. Timetable Class Check (Room empty during scheduled lecture)
    for tt in timetable:
        room_name = tt["room"]
        room_info = rooms.get(room_name, {"persons": 0})
        if room_info["persons"] == 0:
            alert_id = f"EMPTY-{tt['id']}"
            if alert_id not in dismissed:
                alerts.append({
                    "id": alert_id,
                    "severity": "WARNING",
                    "title": f"Scheduled Class Missing: {room_name}",
                    "message": f"{tt['subject']} ({tt['faculty']}) scheduled for {tt['time_slot']}, but room is empty.",
                    "zone": room_name,
                    "timestamp": time.strftime("%H:%M:%S")
                })

    # 3. Corridor Crowd Density Hazard Check
    for c in corridors:
        if c["count"] >= c["threshold"]:
            alert_id = f"CORRIDOR-{c['id']}"
            if alert_id not in dismissed:
                alerts.append({
                    "id": alert_id,
                    "severity": "HIGH" if c["count"] > c["threshold"] * 1.2 else "WARNING",
                    "title": f"Corridor Congestion: {c['name']}",
                    "message": f"Crowd density at {c['count']} persons (Safety limit: {c['threshold']}).",
                    "zone": c["name"],
                    "timestamp": time.strftime("%H:%M:%S")
                })

    return alerts

# =====================================================================
# 4. WEB VIEW ROUTES (HTML)
# =====================================================================

@app.get("/", response_class=HTMLResponse)
def login_page(request: Request, error: Optional[str] = None, success: Optional[str] = None):
    """Serve portal page (Login, Register, Password Reset)."""
    user = get_current_user(request)
    if user:
        return RedirectResponse(url="/dashboard", status_code=303)
    return templates.TemplateResponse(
        request=request,
        name="login.html",
        context={"error": error, "success": success}
    )

@app.post("/login", response_class=HTMLResponse)
def login(
    request: Request,
    response: Response,
    college_id: str = Form(...),
    password: str = Form(...)
):
    """Authenticate user against SQLite database and redirect to dashboard."""
    user = db.get_user_by_id(college_id.strip())

    if user and user["password"] == password:
        redirect = RedirectResponse(url="/dashboard", status_code=303)
        redirect.set_cookie(
            key="session_user",
            value=college_id.strip(),
            httponly=True,
            samesite="lax"
        )
        return redirect

    return templates.TemplateResponse(
        request=request,
        name="login.html",
        context={"error": "Invalid College ID or Password. If you don't have an account, click 'Register ID'.", "success": None},
        status_code=401
    )

@app.post("/register", response_class=HTMLResponse)
def register(
    request: Request,
    college_id: str = Form(...),
    name: str = Form(...),
    dept: str = Form(...),
    role: str = Form(...),
    password: str = Form(...)
):
    """Register a new user directly into the SQLite database."""
    created = db.create_user(college_id.strip(), password.strip(), name.strip(), role.strip(), dept.strip())

    if not created:
        return templates.TemplateResponse(
            request=request,
            name="login.html",
            context={"error": f"College ID '{college_id}' is already registered. Please sign in or use another ID.", "success": None},
            status_code=400
        )

    # Automatically log the newly registered user in
    redirect = RedirectResponse(url="/dashboard", status_code=303)
    redirect.set_cookie(
        key="session_user",
        value=college_id.strip(),
        httponly=True,
        samesite="lax"
    )
    return redirect

@app.post("/reset-password", response_class=HTMLResponse)
def reset_password(
    request: Request,
    college_id: str = Form(...),
    new_password: str = Form(...)
):
    """Reset password for an existing user account in SQLite."""
    updated = db.update_user_password(college_id.strip(), new_password.strip())
    if updated:
        return templates.TemplateResponse(
            request=request,
            name="login.html",
            context={"error": None, "success": f"Password reset successfully for {college_id}! Please sign in with your new password."},
            status_code=200
        )
    return templates.TemplateResponse(
        request=request,
        name="login.html",
        context={"error": f"College ID '{college_id}' not found in database.", "success": None},
        status_code=404
    )

@app.get("/logout")
def logout():
    """Log out user by clearing cookie."""
    redirect = RedirectResponse(url="/", status_code=303)
    redirect.delete_cookie("session_user")
    return redirect

@app.get("/dashboard", response_class=HTMLResponse)
def dashboard(request: Request):
    """Render modern CampusVision AI dashboard."""
    user = get_current_user(request)
    if not user:
        return RedirectResponse(url="/", status_code=303)

    return templates.TemplateResponse(
        request=request,
        name="dashboard.html",
        context={"user": user}
    )

# =====================================================================
# 5. REST APIS FOR DASHBOARD
# =====================================================================

@app.get("/api/campus-summary")
def campus_summary():
    """Summary metrics across all monitored rooms and corridors from SQLite."""
    rooms = db.get_all_rooms()
    corridors = db.get_all_corridors()

    room_persons = sum(r["persons"] for r in rooms)
    corridor_persons = sum(c["count"] for c in corridors)
    active_rooms = sum(1 for r in rooms if r["persons"] > 0)
    empty_rooms = sum(1 for r in rooms if r["persons"] == 0)

    return {
        "total_persons_detected": room_persons + corridor_persons,
        "active_classrooms": active_rooms,
        "empty_classrooms": empty_rooms,
        "corridor_total": corridor_persons,
        "monitored_rooms_count": len(rooms)
    }

@app.get("/api/rooms")
def list_rooms():
    """Return all classrooms with occupancy, capacity, and status from SQLite."""
    rooms = db.get_all_rooms()
    result = []
    for r in rooms:
        status = calculate_room_status(r["persons"], r["capacity"])
        result.append({
            **r,
            "status": status,
            "occupancy_rate": round((r["persons"] / r["capacity"]) * 100, 1)
        })
    return result

@app.get("/api/rooms/{room_name}")
def get_room_details(room_name: str):
    """Return full room telemetry, assigned timetable, and historical audit logs from SQLite."""
    room = db.get_room_by_id(room_name)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    status = calculate_room_status(room["persons"], room["capacity"])
    tt = db.get_room_timetable(room_name)
    logs = db.get_room_logs(room_name, limit=10)

    return {
        "room": room,
        "status": status,
        "occupancy_rate": round((room["persons"] / room["capacity"]) * 100, 1),
        "timetable": tt,
        "logs": logs
    }

class RoomUpdateModel(BaseModel):
    capacity: int
    faculty: str
    subject: str

@app.post("/api/rooms/{room_name}/update")
def update_room(room_name: str, data: RoomUpdateModel):
    """Update room metadata and capacity in SQLite database."""
    db.update_room_metadata(room_name, data.capacity, data.faculty, data.subject)
    return {"success": True, "message": f"Room {room_name} updated successfully"}

@app.get("/api/corridors")
def list_corridors():
    """Return corridor people flow and congestion levels from SQLite."""
    return db.get_all_corridors()

@app.get("/api/timetable")
def timetable_verification():
    """
    Cross-checks scheduled timetable against live YOLO occupancy detections.
    Identifies discrepancies like Empty Room during class, or Unscheduled gathering.
    """
    timetable = db.get_all_timetable()
    rooms_map = {r["room"]: r for r in db.get_all_rooms()}
    verified_list = []

    for entry in timetable:
        room_name = entry["room"]
        room_data = rooms_map.get(room_name, {"persons": 0, "capacity": 60})
        detected_count = room_data["persons"]
        expected = entry["expected_strength"]

        if detected_count == 0:
            verification_status = "Alert: Room Empty (Lecture Scheduled)"
        elif detected_count > room_data["capacity"]:
            verification_status = "Warning: Overcrowded"
        elif detected_count >= (0.5 * expected):
            verification_status = "Verified: Class in Session"
        else:
            verification_status = "Notice: Low Attendance"

        verified_list.append({
            **entry,
            "actual_detected": detected_count,
            "verification_status": verification_status
        })

    return verified_list

# =====================================================================
# ALERTS & NOTIFICATIONS APIS
# =====================================================================

@app.get("/api/alerts")
def get_campus_alerts():
    """Return live active alerts generated by the anomaly engine."""
    return evaluate_campus_alerts()

@app.post("/api/alerts/dismiss")
def dismiss_campus_alert(alert_id: str = Form(...)):
    """Dismiss an active alert by ID in SQLite."""
    db.dismiss_alert_in_db(alert_id)
    return {"success": True, "dismissed_id": alert_id}

# =====================================================================
# AUDIT & ATTENDANCE REPORTS APIS
# =====================================================================

@app.get("/api/reports/logs")
def get_occupancy_logs():
    """Return historical audit snapshots from SQLite."""
    return db.get_recent_logs(limit=50)

@app.get("/api/reports/export-csv")
def export_attendance_csv():
    """Generate and download full campus occupancy & attendance audit CSV report from SQLite."""
    logs = db.get_recent_logs(limit=500)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Timestamp",
        "Campus Zone / Classroom",
        "Students Detected",
        "Capacity",
        "Occupancy %",
        "Status",
        "Assigned Faculty",
        "Scheduled Subject"
    ])

    for log in logs:
        cap = log.get("capacity", 60)
        pct = round((log.get("persons", 0) / cap) * 100, 1)
        writer.writerow([
            log.get("timestamp", ""),
            log.get("room", ""),
            log.get("persons", 0),
            cap,
            f"{pct}%",
            log.get("status", "Normal"),
            log.get("faculty", "N/A"),
            log.get("subject", "N/A")
        ])

    output.seek(0)
    filename = f"PSIT_CampusVision_Report_{time.strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

# =====================================================================
# TIMETABLE MANAGEMENT APIS
# =====================================================================

class TimetableNewEntry(BaseModel):
    faculty: str
    subject: str
    room: str
    time_slot: str
    expected_strength: int

@app.post("/api/timetable/add")
def add_timetable_entry(entry: TimetableNewEntry):
    """Add a new lecture schedule to the college timetable in SQLite."""
    item = db.add_timetable_entry(
        faculty=entry.faculty,
        subject=entry.subject,
        room=entry.room,
        time_slot=entry.time_slot,
        expected_strength=entry.expected_strength
    )
    return {"success": True, "message": "Lecture added successfully", "entry": item}

@app.post("/api/timetable/delete/{tt_id}")
def delete_timetable_entry(tt_id: str):
    """Remove a lecture from schedule in SQLite."""
    success = db.delete_timetable_entry(tt_id)
    return {"success": success}

# =====================================================================
# USER PROFILE & ROLE-BASED ACCESS
# =====================================================================

@app.get("/api/user/profile")
def get_user_profile(request: Request):
    """Return authenticated profile and faculty-specific timetable assignments."""
    user = get_current_user(request)
    if not user:
        return {"authenticated": False}

    all_tt = db.get_all_timetable()
    faculty_classes = [tt for tt in all_tt if tt["faculty"] == user.get("name")]
    return {
        "authenticated": True,
        "user": user,
        "assigned_classes": faculty_classes
    }

# =====================================================================
# 6. DETECTION SYNCHRONIZATION APIS (BACKWARD COMPATIBLE)
# =====================================================================

class OccupancyUpdate(BaseModel):
    room: str
    persons: int

@app.post("/occupancy/update")
def update_occupancy(data: OccupancyUpdate):
    """
    Receives detection updates from detect.py.
    Fully backward-compatible with original code and synced to SQLite.
    """
    current_occupancy["room"] = data.room
    current_occupancy["persons"] = data.persons

    # Update in SQLite
    db.update_room_persons(data.room, data.persons)

    # Record periodic history snapshot
    record_occupancy_log(data.room, data.persons)

    return {
        "message": "Occupancy updated successfully",
        "room": data.room,
        "persons": data.persons
    }

@app.get("/occupancy")
def occupancy():
    """Original backward-compatible single room endpoint."""
    persons = current_occupancy["persons"]
    capacity = current_occupancy["capacity"]
    status = calculate_room_status(persons, capacity)

    return {
        "room": current_occupancy["room"],
        "persons": persons,
        "capacity": capacity,
        "status": status
    }

# =====================================================================
# 7. INTEGRATED YOLO CAMERA ENGINE & LIVE VIDEO STREAMING
# =====================================================================

class CampusCameraDetector:
    """
    Background Camera Engine that directly captures frames from webcam/CCTV,
    executes YOLOv11 person detection, calculates real-time room occupancy,
    and publishes annotated video frames to the web dashboard.
    """
    def __init__(self, model_path="yolo11n.pt", camera_index=0):
        self.model_path = model_path
        self.camera_index = camera_index
        self.camera = None
        self.model = None
        self.face_recognizer = None
        self.is_running = False
        self.thread = None
        self.lock = threading.Lock()
        self.latest_count = 0
        self.status_message = "Camera Standby (Click 'Start AI Camera' to activate)"
    def load_model(self):
        if self.model is None:
            try:
                from ultralytics import YOLO
                print("[CampusVision AI] Loading YOLOv11 Nano model...")
                self.model = YOLO(self.model_path)
                print("[CampusVision AI] YOLO model ready.")
            except Exception as e:
                print(f"[CampusVision AI] Model loading error: {e}")
                self.model = None
        if self.face_recognizer is None:
            try:
                print("[CampusVision AI] Loading FaceRecognizer...")
                self.face_recognizer = FaceRecognizer(known_faces_dir="known_faces", threshold=0.8)
                self.face_recognizer.load_known_faces()
                print("[CampusVision AI] FaceRecognizer ready.")
            except Exception as e:
                print(f"[CampusVision AI] FaceRecognizer loading error: {e}")
                self.face_recognizer = None
    def start(self, camera_index: Optional[int] = None):
        with self.lock:
            if self.is_running:
                return True, "Camera is already running"

            if camera_index is not None:
                self.camera_index = camera_index

            self.load_model()

            try:
                self.camera = cv2.VideoCapture(self.camera_index)
                if not self.camera.isOpened():
                    self.camera = None
                    self.status_message = f"Camera device {self.camera_index} not available"
                    return False, self.status_message

                self.is_running = True
                ai_state_manager.set_camera_active(True)
                self.status_message = "Camera Active (YOLOv11 Detection Running)"
                self.thread = threading.Thread(target=self._worker_loop, daemon=True)
                self.thread.start()
                print(f"[CampusVision AI] Camera {self.camera_index} detection loop started.")
                return True, "Camera detection started successfully"

            except Exception as e:
                self.is_running = False
                if self.camera:
                    self.camera.release()
                    self.camera = None
                self.status_message = f"Failed to start camera: {str(e)}"
                return False, self.status_message

    def stop(self):
        with self.lock:
            if not self.is_running:
                return True, "Camera is already stopped"

            self.is_running = False
            ai_state_manager.set_camera_active(False)
            if self.camera:
                self.camera.release()
                self.camera = None
            self.status_message = "Camera Stopped (Standby)"
            print("[CampusVision AI] Camera detection loop stopped.")
            return True, "Camera detection stopped successfully"

    def _worker_loop(self):
        global latest_camera_frame, latest_frame_time
        frame_idx = 0
        import time as time_mod
        prev_time = time_mod.time()
        fps_list = []

        while self.is_running:
            if not self.camera or not self.camera.isOpened():
                break

            success, frame = self.camera.read()
            if not success:
                time.sleep(0.04)
                continue

            frame_idx += 1
            person_count = 0
            face_count = 0
            recognized_count = 0
            unknown_count = 0
            detections = []
            annotated_frame = frame

            if self.model:
                try:
                    # Run YOLO person detection
                    results = self.model(frame, verbose=False)
                    annotated_frame = results[0].plot()

                    # Count persons (Class 0)
                    for box in results[0].boxes:
                        if int(box.cls[0]) == 0:
                            person_count += 1
                except Exception as e:
                    annotated_frame = frame

            if self.face_recognizer and frame_idx % 3 == 0:
                try:
                    face_results = self.face_recognizer.recognize_faces(frame)
                    faces = face_results["faces"]
                    recognized_count = face_results["recognized_count"]
                    unknown_count = face_results["unknown_count"]
                    face_count = len(faces)
                    detections = faces
                except Exception as e:
                    print(f"Face recognition error: {e}")
            else:
                last_state = ai_state_manager.get_state()
                face_count = last_state.get("face_count", 0)
                recognized_count = last_state.get("recognized_count", 0)
                unknown_count = last_state.get("unknown_count", 0)
                detections = last_state.get("detections", [])
                
            for face in detections:
                x1, y1, x2, y2 = face["box"]
                name = face["name"]
                
                if face["status"] == "recognized":
                    db.mark_attendance(face["student_id"])
                    
                color = (0, 255, 0) if name != "Unknown" else (0, 0, 255)
                cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), color, 2)
                cv2.putText(annotated_frame, name, (x1, max(y1 - 10, 0)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)

            curr_time = time_mod.time()
            fps = 1.0 / (curr_time - prev_time) if curr_time > prev_time else 30.0
            prev_time = curr_time
            fps_list.append(fps)
            if len(fps_list) > 10:
                fps_list.pop(0)
            avg_fps = sum(fps_list) / len(fps_list)

            ai_state_manager.update_state(person_count, face_count, recognized_count, unknown_count, detections, avg_fps)
            self.latest_count = person_count

            # Auto-sync with Room A-101 and Campus State
            current_occupancy["room"] = "A-101"
            current_occupancy["persons"] = person_count
            if "A-101" in rooms_db:
                rooms_db["A-101"]["persons"] = person_count

            # Record periodic history snapshot
            record_occupancy_log("A-101", person_count)

            # Add modern PSIT CCTV overlay banner
            h, w, _ = annotated_frame.shape
            ts = time.strftime("%Y-%m-%d %H:%M:%S")
            cv2.rectangle(annotated_frame, (0, 0), (w, 38), (15, 23, 42), -1)
            cv2.putText(
                annotated_frame,
                f"PSIT CCTV LIVE | Room A-101 | {ts}",
                (14, 25),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.55,
                (0, 225, 255),
                1,
                cv2.LINE_AA
            )
            cv2.putText(
                annotated_frame,
                f"STUDENTS: {person_count}",
                (max(w - 200, 20), 25),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.65,
                (0, 255, 120),
                2,
                cv2.LINE_AA
            )

            # Compress for web stream
            ret, buffer = cv2.imencode('.jpg', annotated_frame, [cv2.IMWRITE_JPEG_QUALITY, 72])
            if ret:
                latest_camera_frame = buffer.tobytes()
                latest_frame_time = time.time()

            time.sleep(0.03)  # ~30 FPS

        if self.camera:
            self.camera.release()
            self.camera = None

camera_detector = CampusCameraDetector()

@app.get("/api/camera/status")
def get_camera_status():
    """Check whether integrated camera detector is active."""
    return {
        "is_running": camera_detector.is_running,
        "latest_count": camera_detector.latest_count,
        "room": "A-101",
        "status_message": camera_detector.status_message
    }

@app.post("/api/camera/start")
def start_camera():
    """Start integrated camera and YOLO detection."""
    success, msg = camera_detector.start()
    return {
        "success": success,
        "message": msg,
        "is_running": camera_detector.is_running
    }

@app.post("/api/camera/stop")
def stop_camera():
    """Stop integrated camera and release hardware."""
    success, msg = camera_detector.stop()
    return {
        "success": success,
        "message": msg,
        "is_running": camera_detector.is_running
    }

# =====================================================================
# STUDENT & ATTENDANCE API
# =====================================================================

@app.post("/api/students")
async def enroll_student(
    name: str = Form(...),
    student_id: str = Form(...),
    photo: UploadFile = File(...)
):
    """Enroll a new student."""
    if photo.content_type not in ["image/jpeg", "image/png", "image/webp"]:
        raise HTTPException(status_code=400, detail="Invalid image format. Only JPEG/PNG/WEBP allowed.")
        
    # Check duplicate
    if db.get_student_by_id(student_id):
        raise HTTPException(status_code=400, detail="Student ID already exists.")
        
    contents = await photo.read()
    
    # Validate exactly one face using MTCNN
    try:
        from PIL import Image
        import io
        img = Image.open(io.BytesIO(contents)).convert('RGB')
        # We can use the existing MTCNN if camera_detector has it loaded
        # However, to avoid thread collisions, we can use a fresh MTCNN or just the one in camera_detector if locked
        if camera_detector.face_recognizer:
            faces = camera_detector.face_recognizer.mtcnn(img)
            if faces is None or len(faces) == 0:
                raise HTTPException(status_code=400, detail="No face detected. Please upload a clear face photo.")
            if len(faces) > 1:
                raise HTTPException(status_code=400, detail="Multiple faces detected. Please upload a photo containing only the student.")
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=400, detail=f"Error validating image: {str(e)}")
        
    import os
    os.makedirs("known_faces", exist_ok=True)
    ext = os.path.splitext(photo.filename)[1]
    if not ext: ext = ".jpg"
    safe_filename = f"{student_id}{ext}"
    filepath = os.path.join("known_faces", safe_filename)
    
    with open(filepath, "wb") as f:
        f.write(contents)
        
    # Save to DB
    success = db.add_student(student_id, name, filepath)
    if not success:
        os.remove(filepath)
        raise HTTPException(status_code=500, detail="Failed to insert into database.")
        
    # Reload engine
    if camera_detector.face_recognizer:
        camera_detector.face_recognizer.reload_known_faces()
        
    return {"success": True, "message": "Student enrolled successfully"}

@app.get("/api/students")
def get_students():
    return db.get_students()

@app.delete("/api/students/{student_id}")
def delete_student(student_id: str):
    student = db.get_student_by_id(student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")
        
    if student['photo_path']:
        import os
        try:
            if os.path.exists(student['photo_path']):
                os.remove(student['photo_path'])
        except Exception:
            pass
            
    db.delete_student(student_id)
    if camera_detector.face_recognizer:
        camera_detector.face_recognizer.reload_known_faces()
    return {"success": True}

@app.get("/api/attendance")
def get_attendance():
    records = db.get_today_attendance()
    return {"records": records}

@app.post("/camera/frame")
async def receive_camera_frame(file: UploadFile = File(...)):
    """Receives annotated JPEG frames uploaded from external detect.py script."""
    global latest_camera_frame, latest_frame_time
    contents = await file.read()
    latest_camera_frame = contents
    latest_frame_time = time.time()
    return {"status": "ok"}

def generate_video_stream():
    """Generates MJPEG multipart stream. Uses live camera feed or standby test card."""
    global latest_camera_frame, latest_frame_time

    while True:
        # Check if live frame received within the last 3.0 seconds
        if latest_camera_frame and (time.time() - latest_frame_time < 3.0):
            frame_bytes = latest_camera_frame
        else:
            # Generate a cyber standby test frame for Tech Expo display
            canvas = np.zeros((360, 640, 3), dtype=np.uint8)
            canvas[:, :] = (18, 24, 38)

            ts = time.strftime("%Y-%m-%d %H:%M:%S")
            cv2.rectangle(canvas, (10, 10), (630, 350), (60, 100, 200), 1)

            cv2.putText(canvas, "PSIT CCTV NETWORK - ROOM A-101 [AUTHORIZED FEED]", (24, 40),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 255, 255), 1)
            cv2.putText(canvas, f"TIMESTAMP: {ts}", (24, 70),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.45, (180, 180, 180), 1)
            cv2.putText(canvas, "AI MODEL: YOLOv11 Nano | DETECTOR READY", (24, 100),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 255, 120), 1)

            scan_y = int((time.time() * 90) % 200) + 120
            cv2.line(canvas, (30, scan_y), (610, scan_y), (100, 200, 255), 1)

            cv2.putText(canvas, "STATUS: STANDBY (CLICK 'START AI CAMERA' ON DASHBOARD)", (24, 250),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.45, (200, 200, 200), 1)

            persons = current_occupancy.get("persons", 0)
            cv2.putText(canvas, f"CURRENT OCCUPANCY: {persons} STUDENTS DETECTED", (24, 320),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255, 255, 255), 2)

            _, buffer = cv2.imencode('.jpg', canvas)
            frame_bytes = buffer.tobytes()

        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
        time.sleep(0.04)  # ~25 FPS

@app.get("/video_feed")
def video_feed():
    """Video streaming route for web browsers."""
    return StreamingResponse(
        generate_video_stream(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )

@app.get("/api/ai/detections")
def get_ai_detections():
    """Return real-time YOLO and FaceNet AI state."""
    return ai_state_manager.get_state()