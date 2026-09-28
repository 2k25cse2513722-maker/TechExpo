"""
PSIT CampusVision AI — Easy Tech Expo Launcher
Run this script to start the backend server and open the web dashboard.
"""

import os
import sys
import time
import webbrowser
import subprocess

def print_banner():
    print(r"""
============================================================
      ____  _____ _____ _____   ____                                
     |  _ \| ____|_   _|_   _| | __ )  ___   __ _ _ __ ___   ___  
     | |_) |  _|   | |   | |   |  _ \ / _ \ / _` | '__/ _ \ / _ \ 
     |  __/| |___  | |   | |   | |_) | (_) | (_| | | | (_) |  __/ 
     |_|   |_____| |_|   |_|   |____/ \___/ \__,_|_|  \___/ \___| 
                                                                    
         PSIT CAMPUSVISION AI - SMART CAMPUS MONITORING
============================================================
    * College: Pranveer Singh Institute of Technology (PSIT)
    * Tech: FastAPI | OpenCV | YOLOv11 | HTML5 | CSS3 | JS
    * Demo Credentials:
        - Admin:   PSIT001  (Password: 12345)
        - Faculty: PSIT002  (Password: 12345)
============================================================
    """)

def main():
    print_banner()
    print("[1/2] Starting FastAPI Backend on http://127.0.0.1:8000 ...")

    # Automatically open browser after a short delay
    def open_browser():
        time.sleep(1.5)
        webbrowser.open("http://127.0.0.1:8000")
        print("[*] Dashboard opened in your default web browser.")
        print("[*] To launch YOLO camera detector in another terminal, run: python detect.py")

    import threading
    threading.Thread(target=open_browser, daemon=True).start()

    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)

if __name__ == "__main__":
    main()
