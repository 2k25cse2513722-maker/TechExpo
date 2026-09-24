// dashboard.js

document.addEventListener("DOMContentLoaded", () => {
    // Initial fetch
    fetchDashboardData();
    // Start polling every 2 seconds
    setInterval(fetchDashboardData, 2000);
    
    // Live clock
    setInterval(() => {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-US', { hour12: false });
        const clockEl = document.getElementById("liveClock");
        if(clockEl) clockEl.innerText = timeStr;
    }, 1000);
});

async function fetchDashboardData() {
    try {
        // 1. Fetch Camera Status
        const camRes = await fetch('/api/camera/status');
        const camData = await camRes.json();
        updateCameraUI(camData);

        // 2. Fetch Campus Summary
        const summaryRes = await fetch('/api/campus-summary');
        const summaryData = await summaryRes.json();
        
        const kpiTotal = document.getElementById('kpiTotalPeople');
        const kpiRooms = document.getElementById('kpiActiveRooms');
        if(kpiRooms) kpiRooms.innerText = summaryData.active_classrooms;

        // 3. Fetch Real AI Detections
        const aiRes = await fetch('/api/ai/detections');
        const aiData = await aiRes.json();
        updateAIDetections(aiData);

        // 4. Fetch Rooms (for Occupancy Bars)
        const roomsRes = await fetch('/api/rooms');
        const roomsData = await roomsRes.json();
        updateOccupancyList(roomsData);

        // 4. Fetch Timetable (for Current Class)
        const ttRes = await fetch('/api/timetable');
        const ttData = await ttRes.json();
        updateCurrentClass(ttData);

        // 5. Fetch Attendance
        fetchAttendance();

        // The elegant empty states in HTML handle the rest.
        if(telFaces) telFaces.innerText = "0";
        // The elegant empty states in HTML handle the rest.

    } catch (e) {
        console.warn("Dashboard sync warning:", e);
    }
}

// ----------------------------------------------------
// UI UPDATE FUNCTIONS
// ----------------------------------------------------

function updateCameraUI(cam) {
    const btnStart = document.getElementById("btnStartCamera");
    const btnStop = document.getElementById("btnStopCamera");
    const placeholder = document.getElementById("cameraPlaceholder");
    const streamImg = document.getElementById("cctvStreamImg");
    const sysCamStatus = document.getElementById("sysCamStatus");
    const telFps = document.getElementById("telFps");
    
    const camStatusTexts = document.querySelectorAll(".camera-status-text");

    // Prevent overriding loading states
    if (btnStart && btnStart.innerText.includes("Starting")) return;
    if (btnStop && btnStop.innerText.includes("Stopping")) return;

    if (cam.is_running) {
        camStatusTexts.forEach(el => {
            el.innerText = "● CAMERA LIVE";
            el.style.color = "var(--accent-green)";
        });
        
        if (sysCamStatus) {
            sysCamStatus.innerText = "LIVE";
            sysCamStatus.className = "s-val text-green";
        }
        
        if (btnStart) btnStart.style.display = "none";
        if (btnStop) btnStop.style.display = "block";
        
        if (placeholder) placeholder.style.display = "none";
        if (streamImg) {
            streamImg.style.display = "block";
            if (!streamImg.src.includes("/video_feed")) {
                streamImg.src = "/video_feed?" + new Date().getTime(); // force reload
            }
        }
        
        document.querySelectorAll('.live-dot-container').forEach(el => el.style.display = 'flex');
        
        const yoloInd = document.querySelector('.yolo-ind');
        if(yoloInd) yoloInd.classList.add('active');
        
    } else {
        camStatusTexts.forEach(el => {
            el.innerText = "CAMERA OFFLINE";
            el.style.color = "var(--text-muted)";
        });
        
        if (sysCamStatus) {
            sysCamStatus.innerText = "OFFLINE";
            sysCamStatus.className = "s-val";
        }
        
        if (btnStart) btnStart.style.display = "block";
        if (btnStop) btnStop.style.display = "none";
        
        if (placeholder) placeholder.style.display = "flex";
        if (streamImg) {
            streamImg.style.display = "none";
            streamImg.src = "";
        }
        
        document.querySelectorAll('.live-dot-container').forEach(el => el.style.display = 'none');
        
        const yoloInd = document.querySelector('.yolo-ind');
        if(yoloInd) yoloInd.classList.remove('active');
    }

    if (typeof window.update3DViz === "function") {
        window.update3DViz(cam.is_running);
    }
}

function updateAIDetections(ai) {
    const kpiTotal = document.getElementById('kpiTotalPeople');
    const telPeople = document.getElementById('telPeople');
    const kpiRec = document.getElementById('kpiRecognized');
    const kpiUnk = document.getElementById('kpiUnknown');
    const telFaces = document.getElementById('telFaces');
    const telFps = document.getElementById('telFps');
    const badgeRec = document.getElementById('badgeRecognized');
    const badgeUnk = document.getElementById('badgeUnknown');
    const listRec = document.getElementById('recognizedList');
    const listUnk = document.getElementById('unknownList');

    if (ai.camera_active) {
        if(kpiTotal) kpiTotal.innerText = ai.people_count;
        if(telPeople) telPeople.innerText = ai.people_count;
        if(kpiRec) kpiRec.innerText = ai.recognized_count;
        if(kpiUnk) kpiUnk.innerText = ai.unknown_count;
        if(telFaces) telFaces.innerText = ai.face_count;
        if(telFps) telFps.innerText = ai.fps > 0 ? ai.fps : "--";
        if(badgeRec) badgeRec.innerText = ai.recognized_count;
        if(badgeUnk) badgeUnk.innerText = ai.unknown_count;
        
        // Render recognized faces
        let htmlRec = '';
        let htmlUnk = '';
        
        if(ai.detections && ai.detections.length > 0) {
            ai.detections.forEach(face => {
                const confPercent = Math.round((face.confidence || 0) * 100);
                if(face.status === "recognized") {
                    htmlRec += `
                    <div class="det-item">
                        <div class="det-avatar">${face.name.charAt(0)}</div>
                        <div class="det-info">
                            <div class="det-name">${face.name}</div>
                            <div class="det-meta">Match: ${confPercent}%</div>
                        </div>
                    </div>`;
                } else {
                    htmlUnk += `
                    <div class="det-item">
                        <div class="det-avatar">?</div>
                        <div class="det-info">
                            <div class="det-name">Unknown</div>
                            <div class="det-meta text-amber">Confidence: ${confPercent}%</div>
                        </div>
                    </div>`;
                }
            });
        }
        
        if(listRec) {
            listRec.innerHTML = htmlRec || `
            <div class="elegant-empty-state small">
                <div class="empty-icon">⚲</div>
                <div class="empty-title">NO ACTIVE DETECTIONS</div>
            </div>`;
        }
        
        if(listUnk) {
            listUnk.innerHTML = htmlUnk || `
            <div class="elegant-empty-state small">
                <div class="empty-title">NO ACTIVE DETECTIONS</div>
            </div>`;
        }
    } else {
        if(kpiTotal) kpiTotal.innerText = "0";
        if(telPeople) telPeople.innerText = "--";
        if(kpiRec) kpiRec.innerText = "0";
        if(kpiUnk) kpiUnk.innerText = "0";
        if(telFaces) telFaces.innerText = "--";
        if(telFps) telFps.innerText = "--";
        if(badgeRec) badgeRec.innerText = "0";
        if(badgeUnk) badgeUnk.innerText = "0";
        
        if(listRec) {
            listRec.innerHTML = `
            <div class="elegant-empty-state small">
                <div class="empty-icon">⚲</div>
                <div class="empty-title">NO ACTIVE DETECTIONS</div>
                <div class="empty-desc">Waiting for camera input...</div>
            </div>`;
        }
        if(listUnk) {
            listUnk.innerHTML = `
            <div class="elegant-empty-state small">
                <div class="empty-title">NO ACTIVE DETECTIONS</div>
            </div>`;
        }
    }
    
    // Pass AI stats to 3D visualization if available
    if (typeof window.updateAI3D === "function") {
        window.updateAI3D(ai.face_count, ai.recognized_count);
    }
}

async function startCamera() {
    const btnStart = document.getElementById("btnStartCamera");
    if (btnStart) btnStart.innerText = "◌ Starting...";
    try {
        const res = await fetch('/api/camera/start', { method: 'POST' });
        const data = await res.json();
        if (!data.success) alert("Unable to start camera. Detail: " + data.message);
    } catch (e) {
        alert("Unable to start camera.");
    } finally {
        if (btnStart) btnStart.innerText = "▶ START CAMERA";
        fetchDashboardData();
    }
}

async function stopCamera() {
    const btnStop = document.getElementById("btnStopCamera");
    if (btnStop) btnStop.innerText = "◌ Stopping...";
    try {
        await fetch('/api/camera/stop', { method: 'POST' });
    } catch (e) {
        console.error("Camera stop request failed.");
    } finally {
        if (btnStop) btnStop.innerText = "■ STOP CAMERA";
        fetchDashboardData();
    }
}

// ==========================================
// STUDENTS & ATTENDANCE
// ==========================================

function openAddStudentModal() {
    document.getElementById('addStudentModal').style.display = 'flex';
}

function closeAddStudentModal() {
    document.getElementById('addStudentModal').style.display = 'none';
    document.getElementById('enrollmentForm').reset();
}

async function submitEnrollment(e) {
    e.preventDefault();
    const btn = document.getElementById('btnEnrollSubmit');
    const originalText = btn.innerText;
    btn.innerText = "Enrolling...";
    btn.disabled = true;

    try {
        const formData = new FormData();
        formData.append('name', document.getElementById('studentName').value);
        formData.append('student_id', document.getElementById('studentId').value);
        formData.append('photo', document.getElementById('studentPhoto').files[0]);

        const res = await fetch('/api/students', { method: 'POST', body: formData });
        const data = await res.json();

        if (res.ok) {
            alert("STUDENT ENROLLED SUCCESSFULLY");
            closeAddStudentModal();
            fetchStudents();
        } else {
            alert(data.detail || "Error enrolling student");
        }
    } catch (err) {
        alert("An error occurred during enrollment.");
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

async function fetchStudents() {
    try {
        const res = await fetch('/api/students');
        const students = await res.json();
        const tbody = document.querySelector('#studentsTable tbody');
        if (!tbody) return;

        if (students.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 2rem;">No students enrolled</td></tr>`;
            return;
        }

        tbody.innerHTML = students.map(s => `
            <tr>
                <td><div class="det-avatar" style="width:32px;height:32px;font-size:0.8rem;">${s.name.charAt(0)}</div></td>
                <td>${s.name}</td>
                <td style="color: var(--brand-blue);">${s.student_id}</td>
                <td><span class="sys-tag">Enrolled</span></td>
                <td>
                    <button class="btn-danger" style="padding: 4px 8px; font-size: 0.75rem;" onclick="deleteStudent('${s.student_id}')">Delete</button>
                </td>
            </tr>
        `).join('');
    } catch (e) {
        console.error("Error fetching students", e);
    }
}

async function deleteStudent(studentId) {
    if (!confirm(`Are you sure you want to delete ${studentId}?`)) return;
    try {
        const res = await fetch(`/api/students/${studentId}`, { method: 'DELETE' });
        if (res.ok) {
            fetchStudents();
        } else {
            alert("Failed to delete student.");
        }
    } catch (e) {
        alert("Error deleting student.");
    }
}

async function fetchAttendance() {
    try {
        const [attRes, stdRes] = await Promise.all([
            fetch('/api/attendance'),
            fetch('/api/students')
        ]);
        const attData = await attRes.json();
        const students = await stdRes.json();
        
        const records = attData.records;
        const totalStudents = students.length;
        const presentCount = records.length;
        const pct = totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0;
        
        const kpiPct = document.getElementById('kpiAttendancePct');
        const kpiPCount = document.getElementById('kpiPresentCount');
        const kpiTCount = document.getElementById('kpiTotalStudents');
        
        if(kpiPct) kpiPct.innerText = pct + "%";
        if(kpiPCount) kpiPCount.innerText = presentCount;
        if(kpiTCount) kpiTCount.innerText = totalStudents;
        
        const tbody = document.querySelector('#attendanceTable tbody');
        if (!tbody) return;

        if (records.length === 0) {
            tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-muted); padding: 2rem;">No attendance recorded today</td></tr>`;
            return;
        }

        tbody.innerHTML = records.map(r => `
            <tr>
                <td>${r.name}</td>
                <td style="color: var(--brand-blue);">${r.student_id}</td>
                <td><span class="sys-tag" style="background: rgba(16, 185, 129, 0.2); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3);">PRESENT</span></td>
            </tr>
        `).join('');
    } catch (e) {
        console.error("Error fetching attendance", e);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    fetchStudents();
});

function updateOccupancyList(rooms) {
    const listEl = document.getElementById('occupancyList');
    if(!listEl) return;
    
    if (!rooms || rooms.length === 0) {
        listEl.innerHTML = `<div class="elegant-empty-state small">No monitored rooms found.</div>`;
        return;
    }
    
    let html = '';
    rooms.forEach(room => {
        let barClass = '';
        if (room.occupancy_rate > 90) barClass = 'full';
        else if (room.occupancy_rate > 70) barClass = 'warning';
        
        html += `
        <div class="occ-row">
            <div class="occ-header">
                <span class="occ-room">${room.room}</span>
                <span class="occ-stats">${room.persons} / ${room.capacity} (${room.occupancy_rate}%)</span>
            </div>
            <div class="occ-bar-bg">
                <div class="occ-bar-fill ${barClass}" style="width: ${Math.min(room.occupancy_rate, 100)}%;"></div>
            </div>
        </div>`;
    });
    listEl.innerHTML = html;
}

function updateCurrentClass(timetableData) {
    const infoEl = document.getElementById('currentClassInfo');
    if(!infoEl) return;
    
    if (!timetableData || timetableData.length === 0) {
        infoEl.innerHTML = `<div class="elegant-empty-state small">No scheduled classes at this time.</div>`;
        return;
    }
    
    const cls = timetableData[0];
    infoEl.innerHTML = `
        <div class="info-row"><span class="info-label">ROOM</span><span class="info-val">${cls.room}</span></div>
        <div class="info-row"><span class="info-label">SUBJECT</span><span class="info-val">${cls.subject}</span></div>
        <div class="info-row"><span class="info-label">FACULTY</span><span class="info-val">${cls.faculty}</span></div>
        <div class="info-row"><span class="info-label">TIME</span><span class="info-val">${cls.time_start} - ${cls.time_end}</span></div>
        <div class="info-row"><span class="info-label">STATUS</span><span class="info-val text-cyan">${cls.verification_status || 'Scheduled'}</span></div>
    `;
}
