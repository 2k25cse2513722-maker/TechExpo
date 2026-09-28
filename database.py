"""
PSIT CampusVision AI — SQLite Database Layer
Handles persistent storage for Users, Classrooms, Corridors, Timetable, and Audit Logs.
"""

import sqlite3
import os
import time
from typing import Dict, List, Optional, Any

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "campusvision.db")

def get_connection() -> sqlite3.Connection:
    """Return a thread-safe connection to the SQLite database."""
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initialize database tables and seed initial demo data if empty."""
    conn = get_connection()
    cursor = conn.cursor()

    # 1. Users Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        college_id TEXT PRIMARY KEY,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        dept TEXT,
        created_at TEXT
    )
    """)

    # 2. Rooms Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS rooms (
        room TEXT PRIMARY KEY,
        capacity INTEGER NOT NULL,
        persons INTEGER NOT NULL DEFAULT 0,
        faculty TEXT,
        subject TEXT,
        is_live_feed INTEGER DEFAULT 0
    )
    """)

    # 3. Corridors Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS corridors (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        zone TEXT,
        count INTEGER DEFAULT 0,
        threshold INTEGER DEFAULT 30,
        status TEXT DEFAULT 'Normal'
    )
    """)

    # 4. Timetable Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS timetable (
        id TEXT PRIMARY KEY,
        faculty TEXT NOT NULL,
        subject TEXT NOT NULL,
        room TEXT NOT NULL,
        time_slot TEXT NOT NULL,
        expected_strength INTEGER NOT NULL
    )
    """)

    # 5. Occupancy Logs Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS occupancy_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT,
        room TEXT,
        persons INTEGER,
        capacity INTEGER,
        status TEXT,
        faculty TEXT,
        subject TEXT
    )
    """)

    # 6. Dismissed Alerts Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS dismissed_alerts (
        alert_id TEXT PRIMARY KEY,
        dismissed_at TEXT
    )
    """)

    # 7. Students Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        photo_path TEXT,
        created_at TEXT,
        active INTEGER DEFAULT 1
    )
    """)

    # 8. Attendance Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id TEXT NOT NULL,
        date TEXT NOT NULL,
        first_seen TEXT NOT NULL,
        last_seen TEXT NOT NULL,
        status TEXT NOT NULL
    )
    """)

    conn.commit()

    # Seed Initial Data if empty
    # Check users
    cursor.execute("SELECT COUNT(*) FROM users")
    if cursor.fetchone()[0] == 0:
        now = time.strftime("%Y-%m-%d %H:%M:%S")
        initial_users = [
            ("PSIT001", "12345", "Prof. R. K. Mishra", "admin", "Dean Academics & Surveillance", now),
            ("PSIT002", "12345", "Dr. Ananya Sharma", "faculty", "Computer Science & Engineering", now)
        ]
        cursor.executemany("INSERT INTO users VALUES (?, ?, ?, ?, ?, ?)", initial_users)

    # Check rooms
    cursor.execute("SELECT COUNT(*) FROM rooms")
    if cursor.fetchone()[0] == 0:
        initial_rooms = [
            ("A-101", 60, 0, "Dr. Ananya Sharma", "CS-601: Computer Vision & AI", 1),
            ("A-102", 60, 42, "Prof. Amit Verma", "CS-402: Data Structures", 0),
            ("B-201", 50, 0, "Free Slot", "Unallocated Period", 0),
            ("AI-Lab", 40, 36, "Dr. Priya Saxena", "IT-702: Deep Learning Lab", 0),
            ("Auditorium", 250, 115, "Dean Office", "Tech Expo Seminar", 0)
        ]
        cursor.executemany("INSERT INTO rooms VALUES (?, ?, ?, ?, ?, ?)", initial_rooms)

    # Check corridors
    cursor.execute("SELECT COUNT(*) FROM corridors")
    if cursor.fetchone()[0] == 0:
        initial_corridors = [
            ("C-1", "Academic Block A — 1st Floor", "North Wing", 8, 30, "Normal"),
            ("C-2", "Central Campus Admin Corridor", "Main Lobby", 22, 35, "Moderate")
        ]
        cursor.executemany("INSERT INTO corridors VALUES (?, ?, ?, ?, ?, ?)", initial_corridors)

    # Check timetable
    cursor.execute("SELECT COUNT(*) FROM timetable")
    if cursor.fetchone()[0] == 0:
        initial_tt = [
            ("TT-101", "Dr. Ananya Sharma", "CS-601: Computer Vision & AI", "A-101", "10:00 AM - 11:00 AM", 55),
            ("TT-102", "Prof. Amit Verma", "CS-402: Data Structures", "A-102", "10:00 AM - 11:00 AM", 45),
            ("TT-103", "Prof. S. K. Singh", "CS-503: Database Management", "B-201", "11:15 AM - 12:15 PM", 48),
            ("TT-104", "Dr. Priya Saxena", "IT-702: Deep Learning Lab", "AI-Lab", "10:00 AM - 01:00 PM", 38)
        ]
        cursor.executemany("INSERT INTO timetable VALUES (?, ?, ?, ?, ?, ?)", initial_tt)

    # Check logs
    cursor.execute("SELECT COUNT(*) FROM occupancy_logs")
    if cursor.fetchone()[0] == 0:
        initial_logs = [
            ("2026-09-22 09:15:00", "A-101", 45, 60, "Normal", "Dr. Ananya Sharma", "CS-601: Computer Vision & AI"),
            ("2026-09-22 09:30:00", "A-102", 42, 60, "Normal", "Prof. Amit Verma", "CS-402: Data Structures"),
            ("2026-09-22 10:00:00", "AI-Lab", 36, 40, "Normal", "Dr. Priya Saxena", "IT-702: Deep Learning Lab")
        ]
        cursor.executemany("""
            INSERT INTO occupancy_logs (timestamp, room, persons, capacity, status, faculty, subject)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, initial_logs)

    conn.commit()
    conn.close()

# =====================================================================
# USER CRUD FUNCTIONS
# =====================================================================

def get_user_by_id(college_id: str) -> Optional[dict]:
    """Retrieve user record by College ID."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE college_id = ?", (college_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def create_user(college_id: str, password: str, name: str, role: str, dept: str) -> bool:
    """Create a new user account. Returns True if successful, False if already exists."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        now = time.strftime("%Y-%m-%d %H:%M:%S")
        cursor.execute(
            "INSERT INTO users (college_id, password, name, role, dept, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (college_id, password, name, role, dept, now)
        )
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False
    finally:
        conn.close()

def update_user_password(college_id: str, new_password: str) -> bool:
    """Update password for an existing user account."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET password = ? WHERE college_id = ?", (new_password, college_id))
    rows_affected = cursor.rowcount
    conn.commit()
    conn.close()
    return rows_affected > 0

# =====================================================================
# ROOMS CRUD FUNCTIONS
# =====================================================================

def get_all_rooms() -> List[dict]:
    """Retrieve all monitored classrooms."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM rooms")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_room_by_id(room_name: str) -> Optional[dict]:
    """Retrieve room record by name (e.g. A-101)."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM rooms WHERE room = ?", (room_name,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def update_room_persons(room_name: str, persons: int):
    """Update current occupancy of a room."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE rooms SET persons = ? WHERE room = ?", (persons, room_name))
    if cursor.rowcount == 0:
        cursor.execute(
            "INSERT INTO rooms (room, capacity, persons, faculty, subject, is_live_feed) VALUES (?, ?, ?, ?, ?, ?)",
            (room_name, 60, persons, "Unassigned", "General Lecture", 1 if room_name == "A-101" else 0)
        )
    conn.commit()
    conn.close()

def update_room_metadata(room_name: str, capacity: int, faculty: str, subject: str):
    """Update capacity and lecture assignment for a room."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE rooms SET capacity = ?, faculty = ?, subject = ? WHERE room = ?",
        (capacity, faculty, subject, room_name)
    )
    conn.commit()
    conn.close()

# =====================================================================
# CORRIDORS CRUD FUNCTIONS
# =====================================================================

def get_all_corridors() -> List[dict]:
    """Retrieve all corridor zones."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM corridors")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def update_corridor_count(corridor_id: str, count: int):
    """Update corridor people count and status."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT threshold FROM corridors WHERE id = ?", (corridor_id,))
    row = cursor.fetchone()
    if row:
        threshold = row[0]
        status = "Normal"
        if count >= threshold * 1.2:
            status = "High Congestion"
        elif count >= threshold * 0.8:
            status = "Moderate"
        cursor.execute("UPDATE corridors SET count = ?, status = ? WHERE id = ?", (count, status, corridor_id))
        conn.commit()
    conn.close()

# =====================================================================
# TIMETABLE CRUD FUNCTIONS
# =====================================================================

def get_all_timetable() -> List[dict]:
    """Retrieve all scheduled lectures."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM timetable")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_room_timetable(room_name: str) -> List[dict]:
    """Retrieve timetable specifically for one room."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM timetable WHERE room = ?", (room_name,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def add_timetable_entry(faculty: str, subject: str, room: str, time_slot: str, expected_strength: int) -> dict:
    """Add a new lecture to the timetable."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM timetable")
    count = cursor.fetchone()[0]
    tt_id = f"TT-{count + 101}"

    cursor.execute(
        "INSERT INTO timetable (id, faculty, subject, room, time_slot, expected_strength) VALUES (?, ?, ?, ?, ?, ?)",
        (tt_id, faculty, subject, room, time_slot, expected_strength)
    )
    # Also update assigned room's current faculty and subject
    cursor.execute(
        "UPDATE rooms SET faculty = ?, subject = ? WHERE room = ?",
        (faculty, subject, room)
    )
    conn.commit()
    conn.close()
    return {
        "id": tt_id,
        "faculty": faculty,
        "subject": subject,
        "room": room,
        "time_slot": time_slot,
        "expected_strength": expected_strength
    }

def delete_timetable_entry(tt_id: str) -> bool:
    """Delete a lecture from the timetable."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM timetable WHERE id = ?", (tt_id,))
    rows = cursor.rowcount
    conn.commit()
    conn.close()
    return rows > 0

# =====================================================================
# OCCUPANCY AUDIT LOGS CRUD FUNCTIONS
# =====================================================================

def add_occupancy_log(room: str, persons: int, capacity: int, status: str, faculty: str, subject: str):
    """Insert a historical audit snapshot into the database."""
    conn = get_connection()
    cursor = conn.cursor()
    now = time.strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute("""
        INSERT INTO occupancy_logs (timestamp, room, persons, capacity, status, faculty, subject)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (now, room, persons, capacity, status, faculty, subject))
    conn.commit()
    conn.close()

def get_recent_logs(limit: int = 200) -> List[dict]:
    """Retrieve recent occupancy logs."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM occupancy_logs ORDER BY id DESC LIMIT ?", (limit,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in reversed(rows)]

def get_room_logs(room_name: str, limit: int = 15) -> List[dict]:
    """Retrieve historical logs for a specific room."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM occupancy_logs WHERE room = ? ORDER BY id DESC LIMIT ?", (room_name, limit))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in reversed(rows)]

# =====================================================================
# ALERTS & DISMISSALS
# =====================================================================

def dismiss_alert_in_db(alert_id: str):
    """Mark an alert as dismissed."""
    conn = get_connection()
    cursor = conn.cursor()
    now = time.strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute("INSERT OR REPLACE INTO dismissed_alerts (alert_id, dismissed_at) VALUES (?, ?)", (alert_id, now))
    conn.commit()
    conn.close()

def get_dismissed_alert_ids() -> set:
    """Get all dismissed alert IDs."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT alert_id FROM dismissed_alerts")
    rows = cursor.fetchall()
    conn.close()
    return {r[0] for r in rows}

# =====================================================================
# STUDENT ENROLLMENT CRUD FUNCTIONS
# =====================================================================

def add_student(student_id: str, name: str, photo_path: str) -> bool:
    """Add a new student to the database."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        now = time.strftime("%Y-%m-%d %H:%M:%S")
        cursor.execute(
            "INSERT INTO students (student_id, name, photo_path, created_at, active) VALUES (?, ?, ?, ?, ?)",
            (student_id, name, photo_path, now, 1)
        )
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False
    finally:
        conn.close()

def get_students() -> List[dict]:
    """Retrieve all active students."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM students WHERE active = 1 ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_student_by_id(student_id: str) -> Optional[dict]:
    """Retrieve student by student_id."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM students WHERE student_id = ? AND active = 1", (student_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def delete_student(student_id: str) -> bool:
    """Delete a student by student_id."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM students WHERE student_id = ?", (student_id,))
    rows = cursor.rowcount
    conn.commit()
    conn.close()
    return rows > 0

# =====================================================================
# ATTENDANCE CRUD FUNCTIONS
# =====================================================================

def mark_attendance(student_id: str):
    """Mark attendance for a student (creates or updates last_seen)."""
    conn = get_connection()
    cursor = conn.cursor()
    
    today = time.strftime("%Y-%m-%d")
    now = time.strftime("%H:%M:%S")
    
    cursor.execute("SELECT * FROM attendance WHERE student_id = ? AND date = ?", (student_id, today))
    row = cursor.fetchone()
    
    if row:
        cursor.execute(
            "UPDATE attendance SET last_seen = ? WHERE id = ?",
            (now, row['id'])
        )
    else:
        cursor.execute(
            "INSERT INTO attendance (student_id, date, first_seen, last_seen, status) VALUES (?, ?, ?, ?, ?)",
            (student_id, today, now, now, "Present")
        )
        
    conn.commit()
    conn.close()

def get_today_attendance() -> List[dict]:
    """Retrieve today's attendance logs."""
    conn = get_connection()
    cursor = conn.cursor()
    today = time.strftime("%Y-%m-%d")
    
    cursor.execute("""
        SELECT a.*, s.name 
        FROM attendance a 
        JOIN students s ON a.student_id = s.student_id 
        WHERE a.date = ?
        ORDER BY a.first_seen DESC
    """, (today,))
    
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

# Initialize on module import
init_db()
