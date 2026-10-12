import threading
import time
import copy

class AIState:
    def __init__(self):
        self.lock = threading.Lock()
        self._reset()

    def _reset(self):
        self.state = {
            "people_count": 0,
            "face_count": 0,
            "recognized_count": 0,
            "unknown_count": 0,
            "detections": [],
            "fps": 0.0,
            "camera_active": False,
            "timestamp": time.time()
        }

    def reset_detection_state(self):
        with self.lock:
            self._reset()

    def set_camera_active(self, active: bool):
        with self.lock:
            if not active:
                self._reset()
            else:
                self.state["camera_active"] = True
                self.state["timestamp"] = time.time()

    def update_state(self, people_count: int, face_count: int, recognized_count: int, unknown_count: int, detections: list, fps: float):
        with self.lock:
            self.state["people_count"] = people_count
            self.state["face_count"] = face_count
            self.state["recognized_count"] = recognized_count
            self.state["unknown_count"] = unknown_count
            self.state["detections"] = detections
            self.state["fps"] = round(fps, 1)
            self.state["timestamp"] = time.time()

    def get_state(self):
        with self.lock:
            return copy.deepcopy(self.state)

# Singleton instance
ai_state_manager = AIState()
