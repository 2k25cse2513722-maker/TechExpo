import os
import sys
import time

# Ensure workspace in path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import app, camera_detector, get_campus_video_path, CAMPUS_VIDEO_PATHS
from ai_state import ai_state_manager
import database as db

def run_tests():
    print("=" * 60)
    print("CAMPUSVISION AI - DUAL MODE VERIFICATION TEST SUITE")
    print("=" * 60)

    # 1. Verify Recorded MP4 file
    print("\n[TEST 1] Verifying MP4 Video File Access...")
    video_path = get_campus_video_path()
    print(f"  Target Video Path: {video_path}")
    assert video_path is not None, f"Video not found in paths: {CAMPUS_VIDEO_PATHS}"
    assert os.path.exists(video_path), "Video file does not exist on disk"
    import cv2
    cap = cv2.VideoCapture(video_path)
    assert cap.isOpened(), "cv2 could not open video file"
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    ret, frame = cap.read()
    cap.release()
    assert ret and frame is not None, "Failed to read first frame from video"
    print(f"  -> SUCCESS: Video opened! Frames={frame_count}, FPS={fps:.1f}, Frame shape={frame.shape}")

    # 2. Test Recorded Video Mode in CampusCameraDetector
    print("\n[TEST 2] Testing Recorded Video Mode (YOLOv11 Person Detection)...")
    success, msg = camera_detector.start(mode="video")
    print(f"  Start video result: success={success}, msg='{msg}'")
    assert success, f"Failed to start video mode: {msg}"
    assert camera_detector.is_running, "Detector should be running"
    assert camera_detector.source_mode == "video", "Source mode should be 'video'"

    # Wait for worker thread to process frames (allowing for YOLO model load/warmup)
    print("  Waiting for YOLO inference on recorded video...")
    detected_count = 0
    for _ in range(12):
        time.sleep(0.5)
        state = ai_state_manager.get_state()
        detected_count = state.get("people_count", 0)
        if detected_count > 0:
            break

    state = ai_state_manager.get_state()
    detection_fps = state.get("fps", 0.0)
    source_mode = state.get("source_mode")
    print(f"  Detected Persons (YOLO): {detected_count}")
    print(f"  Detection FPS: {detection_fps}")
    print(f"  AI State Source Mode: {source_mode}")
    assert detected_count > 0, "YOLO should have detected persons in campus_demo.mp4"
    assert detection_fps > 0, "FPS should be greater than 0"
    assert source_mode == "video", "Source mode should match 'video'"
    print("  -> SUCCESS: YOLOv11 person detection active on recorded video!")

    # 3. Test API Status & Occupancy sync
    print("\n[TEST 3] Verifying Backend Sync & Room A-101 Occupancy...")
    from main import get_camera_status, occupancy
    cam_status = get_camera_status()
    print(f"  /api/camera/status: {cam_status}")
    assert cam_status["is_running"] is True
    assert cam_status["source_mode"] == "video"
    assert cam_status["latest_count"] == detected_count

    occ = occupancy()
    print(f"  /occupancy: {occ}")
    assert occ["room"] == "A-101"
    assert occ["persons"] == detected_count
    print("  -> SUCCESS: Room A-101 occupancy synced with detected person count!")

    # 4. Test Switching to Camera Mode
    print("\n[TEST 4] Testing Source Switch to Live Camera...")
    cam_success, cam_msg = camera_detector.start(mode="camera")
    print(f"  Switch to camera result: success={cam_success}, msg='{cam_msg}'")
    if cam_success:
        time.sleep(1.0)
        cam_state = ai_state_manager.get_state()
        print(f"  Live camera active! People count: {cam_state.get('people_count')}, Source: {cam_state.get('source_mode')}")
        assert camera_detector.source_mode == "camera"
    else:
        print(f"  Live camera hardware not available in this environment: {cam_msg} (Handled gracefully without crashing!)")

    # 5. Test Switching Back to Recorded Video (Rapid switching check)
    print("\n[TEST 5] Testing Repeated Switching Back to Recorded Video...")
    success2, msg2 = camera_detector.start(mode="video")
    print(f"  Switch back to video result: success={success2}, msg='{msg2}'")
    assert success2, f"Failed to switch back to video: {msg2}"
    time.sleep(1.5)
    state2 = ai_state_manager.get_state()
    print(f"  Video resumed! Persons: {state2.get('people_count')}, Source: {state2.get('source_mode')}")
    assert state2.get("people_count", 0) > 0
    assert state2.get("source_mode") == "video"
    print("  -> SUCCESS: Mode switching back and forth works repeatedly!")

    # 6. Test Stop Detection
    print("\n[TEST 6] Testing Stop Detection & Resource Release...")
    stop_success, stop_msg = camera_detector.stop()
    print(f"  Stop result: success={stop_success}, msg='{stop_msg}'")
    assert stop_success
    assert not camera_detector.is_running
    assert camera_detector.camera is None, "Camera object should be released"
    print("  -> SUCCESS: Detection stopped and resources cleanly released!")

    # 7. Test Existing APIs (Digital Twin, Diagnostics, Occupancy, Attendance)
    print("\n[TEST 7] Testing Existing APIs & Database Integrity with TestClient...")
    from fastapi.testclient import TestClient
    client = TestClient(app)

    res_twin = client.get("/api/campus/digital-twin")
    assert res_twin.status_code == 200
    twin_data = res_twin.json()
    assert len(twin_data["rooms"]) >= 5, "All 5 existing rooms should be present in digital twin"
    assert len(twin_data["corridors"]) >= 2, "Corridors should be present in digital twin"
    print(f"  Digital Twin API OK: {len(twin_data['rooms'])} rooms, {len(twin_data['corridors'])} corridors")

    res_diag = client.get("/api/system/diagnostics")
    assert res_diag.status_code == 200
    diag = res_diag.json()
    assert diag["status"] == "online"
    print(f"  Diagnostics API OK: status={diag['status']}, DB tables={len(diag['db_stats'])}")

    res_occ = client.get("/occupancy")
    assert res_occ.status_code == 200
    print(f"  Occupancy API OK: {res_occ.json()}")

    res_att = client.get("/api/attendance")
    assert res_att.status_code == 200
    print(f"  Attendance API OK: records={len(res_att.json()['records'])}")

    print("  -> SUCCESS: All existing APIs and DB tables remain fully functional!")

    print("\n" + "=" * 60)
    print("ALL TESTS PASSED SUCCESSFULLY! (7/7)")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()
