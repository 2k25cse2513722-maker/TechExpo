# 🏫 PSIT CampusVision AI — Smart Campus Monitoring System

**College:** Pranveer Singh Institute of Technology (PSIT), Kanpur  
**Event:** PSIT College Tech Expo 2026  
**Tech Stack:** Python 3, FastAPI, OpenCV, YOLOv11 (Ultralytics), HTML5, CSS3, Modern JavaScript  

---

## 📌 Project Overview
**CampusVision AI** is an intelligent campus surveillance and occupancy monitoring system. By connecting authorized CCTV camera feeds with real-time **YOLOv11 Computer Vision models**, CampusVision AI automates student headcount, tracks room capacity limits, monitors corridor crowd density, and cross-checks classroom occupancy against the daily faculty timetable.

---

## 🚀 Key Features
1. **Classroom-Wise Student/Person Counting**:
   - Uses pre-trained lightweight **YOLOv11 Nano** model.
   - Detects persons in real time with high frame rates.
   - Privacy-preserving: Counts human silhouettes without facial recognition or identity tracking.
2. **Real-Time Occupancy & Capacity Tracking**:
   - Dynamic capacity progress bars (Green < 70%, Amber 70–90%, Red > 90%).
   - Automatic classification: **Empty**, **Normal**, and **Full**.
3. **Multi-Classroom Campus Overview**:
   - Tracks Room A-101 (Live YOLO Camera), Room A-102, Room B-201, AI Lab, and Auditorium.
4. **Corridor Crowd Density Monitoring**:
   - Monitors transit hallways (Block A 1st Floor, Central Admin Corridor) to prevent congestion hazards.
5. **Faculty Timetable Live Verification**:
   - Compares real-time detection counts with the scheduled timetable.
   - Automatically detects:
     - ✅ *Verified: Class in Session*
     - ⚠️ *Alert: Room Empty (Lecture Scheduled)*
     - ⚠️ *Warning: Overcrowded*
     - ℹ️ *Notice: Low Attendance*
6. **Role-Based Authentication**:
   - **Admin Access (`PSIT001`)**: Complete campus surveillance overview, all rooms, corridors, and system metrics.
   - **Faculty Access (`PSIT002`)**: Departmental schedule, lecture allocation, and assigned room telemetry.
7. **Live Web Camera Feed**:
   - Stream live YOLO annotated video directly into the browser dashboard via `/video_feed`.

---

## 🔑 Demo Credentials

| Role | College ID | Password | Access Level |
| :--- | :--- | :--- | :--- |
| **Admin** (Dean Surveillance) | `PSIT001` | `12345` | Full Campus Control |
| **Faculty** (CSE Dept) | `PSIT002` | `12345` | Faculty Schedule & Rooms |

---

## 📁 Project Structure

```text
Techexpo/
├── camera.py             # Basic webcam test script
├── detect.py             # YOLOv11 detection engine (sends live counts to backend)
├── main.py               # FastAPI backend with multi-room state, timetable & APIs
├── run_app.py            # One-click launcher for Tech Expo demo
├── yolo11n.pt            # Pre-trained YOLOv11 model weights
├── README.md             # Project documentation
├── templates/
│   ├── login.html        # Glassmorphism login page with PSIT branding
│   └── dashboard.html    # Full-featured live dashboard
└── static/
    ├── css/styles.css    # Dark cyber theme design system
    ├── js/dashboard.js   # Dynamic real-time auto-polling engine (2s interval)
    └── images/
        └── psit-logo.svg # Official PSIT CampusVision emblem
```

---

## ⚡ Quick Start Guide (For Tech Expo Presentation)

### Option A: One-Click Launch (Recommended)
```bash
python run_app.py
```
*This starts the FastAPI server and automatically opens `http://127.0.0.1:8000` in your web browser.*

### Option B: Manual Launch
1. **Start the FastAPI Backend:**
   ```bash
   uvicorn main:app --reload
   ```
   Open `http://127.0.0.1:8000` in your browser.

2. **Start the YOLO Camera Detector (in a separate terminal):**
   ```bash
   python detect.py
   ```
   *Your live webcam feed will detect persons, draw bounding boxes, and update the Room A-101 count on the dashboard in real-time!*


                    CAMERA
                    │
                    ▼
             ┌─────────────┐
             │    YOLO     │
             │ Person      │
             │ Detection   │
             └──────┬──────┘
                    │
              People Count
                    │
                    ▼
             ┌─────────────┐
             │    MTCNN    │
             │ Face Detect │
             └──────┬──────┘
                    │
                    ▼
          ┌──────────────────┐
          │   FaceNet /      │
          │ InceptionResNet  │
          └────────┬─────────┘
                   │
             Face Embedding
                   │
                   ▼
            Known Faces
                   │
          ┌────────┴────────┐
          ▼                 ▼
      RECOGNIZED          UNKNOWN
          │
          ▼
       STUDENT
          │
          ▼
      ATTENDANCE
          │
          ▼
       DATABASE
          │
          ▼
       DASHBOARD








                            detect.py
                         ↓
                     Camera
                         ↓
                  Person detection
                         ↓
                 ┌───────┴────────┐
                 ↓                ↓
          Person/Head count   Face detection
                 ↓                ↓
          Total students    Face recognition
                                  ↓
                           Student identity
                                  ↓
                            Attendance logic
                                  ↓
                       /occupancy/update
                       /attendance/update
                                  ↓
                               SQLite
                                  ↓
                             Dashboard
