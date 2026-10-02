/**
 * CampusVision AI — Unified Command Center Controller
 * Tech Expo 2026 Edition
 * Complete real-time interactive frontend logic with SQLite persistence & zero mock data.
 */

// =====================================================================
// GLOBAL APPLICATION STATE
// =====================================================================
let currentActiveSection = 'dashboard';
let globalRoomsData = [];
let globalCorridorsData = [];
let globalTimetableData = [];
let globalAlertsData = [];
let globalAttendanceData = [];
let globalStudentsData = [];
let globalOccupancyLogsData = [];
let globalDigitalTwinData = null;
let globalInsightsData = [];
let isEmergencyModeActive = false;
let currentLiveCampusView = 'twin';

// Safe Demo Mode State (for TechExpo presentation)
let isDemoModeActive = false;
let demoOverrides = {
    rooms: {
        "A-101": 42,
        "A-102": 31,
        "B-201": 0,
        "AI-Lab": 36,
        "Auditorium": 115
    },
    corridors: {
        "C-1": 18,
        "C-2": 22
    },
    cameraOffline: "C-2"
};

let activeClassroomFilter = 'all';
let activeAttendanceFilter = 'all';

let browserCameraStream = null;
let browserCameraInterval = null;

// =====================================================================
// INITIALIZATION
// =====================================================================
document.addEventListener("DOMContentLoaded", () => {
    // Set default date for attendance date picker
    const datePicker = document.getElementById('attendanceDateFilter');
    if (datePicker) {
        const todayStr = new Date().toISOString().split('T')[0];
        datePicker.value = todayStr;
    }

    // 1. Setup Hash Routing & History
    initRouting();

    // 2. Setup Modals (Keyboard & Outside Click)
    initModals();

    // 3. Initial Telemetry Load
    fetchDashboardData(true);

    // 4. Background Polling (Every 2.5 seconds)
    setInterval(() => {
        fetchDashboardData(false);
    }, 2500);

    // 5. Live Digital Clock
    setInterval(updateLiveClock, 1000);
    updateLiveClock();

    // 6. Setup Accessible Clickable Cards (Enter/Space Keys)
    setupKeyboardInteractions();
});

// =====================================================================
// 1. ROUTING & SECTION NAVIGATION
// =====================================================================
function initRouting() {
    // Sidebar nav click handlers
    document.querySelectorAll('.nav-item[data-nav]').forEach(link => {
        link.addEventListener('click', (e) => {
            const section = link.getAttribute('data-nav');
            if (section) {
                e.preventDefault();
                navigateToSection(section);
            }
        });
    });

    // Browser back/forward navigation support
    window.addEventListener('hashchange', () => {
        const hash = window.location.hash.replace('#', '') || 'dashboard';
        showSection(hash, false);
    });

    // Initial hash routing on page load
    const initialHash = window.location.hash.replace('#', '') || 'dashboard';
    showSection(initialHash, false);
}

function navigateToSection(sectionId, filterParam = null) {
    if (filterParam) {
        if (sectionId === 'classrooms') {
            activeClassroomFilter = filterParam;
        } else if (sectionId === 'attendance') {
            activeAttendanceFilter = filterParam;
        }
    }

    if (window.location.hash !== `#${sectionId}`) {
        window.location.hash = `#${sectionId}`;
    } else {
        showSection(sectionId, true);
    }
}

function showSection(sectionId, isDirectCall = true) {
    let targetView = null;
    if (sectionId === 'digital-twin') {
        sectionId = 'dashboard';
        targetView = 'twin';
    } else if (sectionId === 'heatmap') {
        sectionId = 'dashboard';
        targetView = 'heatmap';
    } else if (sectionId === 'emergency') {
        sectionId = 'dashboard';
        targetView = 'emergency';
    }

    const validSections = [
        'dashboard',
        'classrooms',
        'attendance',
        'camera',
        'corridors',
        'timetable',
        'alerts',
        'students',
        'reports',
        'settings'
    ];

    if (!validSections.includes(sectionId)) {
        sectionId = 'dashboard';
    }

    currentActiveSection = sectionId;

    // Update section visibility
    document.querySelectorAll('.dashboard-section').forEach(sec => {
        sec.classList.remove('active');
    });

    const targetSec = document.getElementById(`section-${sectionId}`);
    if (targetSec) {
        targetSec.classList.add('active');
    }

    // Update sidebar active classes
    const navKey = targetView ? (targetView === 'twin' ? 'digital-twin' : targetView) : sectionId;
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-nav') === navKey || item.getAttribute('data-nav') === sectionId) {
            item.classList.add('active');
        }
    });

    // Update breadcrumb
    updateBreadcrumb(targetView ? (targetView === 'twin' ? 'digital-twin' : targetView) : sectionId);

    // Close mobile sidebar if open
    toggleMobileSidebar(false);

    if (targetView) {
        switchLiveCampusView(targetView);
        scrollToLiveCampusHub();
    }

    // Trigger section-specific immediate loads
    if (sectionId === 'classrooms') {
        renderClassroomsGrid();
    } else if (sectionId === 'attendance') {
        fetchAttendancePortalData();
    } else if (sectionId === 'corridors') {
        renderCorridorsGrid();
    } else if (sectionId === 'timetable') {
        fetchTimetableData();
    } else if (sectionId === 'alerts') {
        fetchAlertsData();
    } else if (sectionId === 'students') {
        fetchStudents();
    } else if (sectionId === 'reports') {
        fetchOccupancyLogs();
    } else if (sectionId === 'settings') {
        fetchUserProfile();
        fetchSystemDiagnostics();
    }
}

function scrollToLiveCampusHub() {
    setTimeout(() => {
        const hub = document.getElementById('liveCampusHub');
        if (hub) {
            hub.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, 120);
}

function updateBreadcrumb(sectionId) {
    const crumbParent = document.getElementById('crumbParent');
    const crumbCurrent = document.getElementById('crumbCurrent');
    if (!crumbCurrent) return;

    const titles = {
        'dashboard': 'Dashboard Overview',
        'digital-twin': 'Campus Digital Twin (3D)',
        'heatmap': 'Smart Campus Heatmap',
        'emergency': 'Emergency / Evacuation Mode',
        'classrooms': 'Classroom Monitoring',
        'attendance': 'Attendance Portal',
        'camera': 'Live AI Camera Feed',
        'corridors': 'Corridor Footfall Safety',
        'timetable': 'Faculty Timetable Verification',
        'alerts': 'Campus Safety Alerts',
        'students': 'Students Directory',
        'reports': 'Audit Logs & CSV Export',
        'settings': 'System Diagnostics & Settings'
    };

    if (crumbParent) {
        crumbParent.innerText = sectionId === 'dashboard' ? 'Campus Overview' : 'Intelligence';
    }
    crumbCurrent.innerText = titles[sectionId] || 'Command Center';
}

function toggleMobileSidebar(forceState = null) {
    const sidebar = document.getElementById('appSidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (!sidebar) return;

    if (forceState !== null) {
        if (forceState) {
            sidebar.classList.add('mobile-open');
            if (backdrop) backdrop.classList.add('mobile-open');
        } else {
            sidebar.classList.remove('mobile-open');
            if (backdrop) backdrop.classList.remove('mobile-open');
        }
    } else {
        sidebar.classList.toggle('mobile-open');
        if (backdrop) backdrop.classList.toggle('mobile-open');
    }
}

function updateLiveClock() {
    const clockEl = document.getElementById("liveClock");
    if (!clockEl) return;
    const now = new Date();
    clockEl.innerText = now.toLocaleTimeString('en-US', { hour12: false });
}

// =====================================================================
// 2. UNIVERSAL DYNAMIC MODAL ENGINE
// =====================================================================
function initModals() {
    // Backdrop click to close universal modal
    const universalModal = document.getElementById('universalModal');
    if (universalModal) {
        universalModal.addEventListener('click', (e) => {
            if (e.target === universalModal) {
                closeUniversalModal();
            }
        });
    }

    // Escape key listener for all modals
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeUniversalModal();
            closeAddStudentModal();
            closeEditStudentModal();
            closeAddTimetableModal();
        }
    });
}

function openUniversalModal({ title, badge = null, bodyHtml, footerHtml = null }) {
    const modal = document.getElementById('universalModal');
    const titleEl = document.getElementById('modalTitle');
    const badgeEl = document.getElementById('modalBadge');
    const bodyEl = document.getElementById('modalBody');
    const footerEl = document.getElementById('modalFooter');

    if (!modal || !titleEl || !bodyEl) return;

    titleEl.innerText = title;

    if (badge && badgeEl) {
        badgeEl.innerText = badge;
        badgeEl.style.display = 'inline-block';
    } else if (badgeEl) {
        badgeEl.style.display = 'none';
    }

    bodyEl.innerHTML = bodyHtml;

    if (footerHtml && footerEl) {
        footerEl.innerHTML = footerHtml;
        footerEl.style.display = 'flex';
    } else if (footerEl) {
        footerEl.innerHTML = '';
        footerEl.style.display = 'none';
    }

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeUniversalModal() {
    const modal = document.getElementById('universalModal');
    if (modal) {
        modal.style.display = 'none';
    }
    document.body.style.overflow = '';
}

function showModalLoading(title = "Loading Details...") {
    openUniversalModal({
        title: title,
        bodyHtml: `
            <div class="elegant-empty-state">
                <div class="empty-icon">◌</div>
                <div class="empty-title">FETCHING REAL-TIME DATA</div>
                <div class="empty-desc">Connecting to campus database...</div>
            </div>
        `
    });
}

function showModalError(title, errorMsg, retryCallback = null) {
    const footerHtml = retryCallback
        ? `<button class="btn-primary" onclick="${retryCallback}()">Retry</button>
           <button class="btn-secondary" onclick="closeUniversalModal()">Close</button>`
        : `<button class="btn-secondary" onclick="closeUniversalModal()">Close</button>`;

    openUniversalModal({
        title: title,
        badge: "ERROR",
        bodyHtml: `
            <div class="elegant-empty-state">
                <div class="empty-icon text-red">⚠️</div>
                <div class="empty-title">UNABLE TO LOAD TELEMETRY</div>
                <div class="empty-desc">${errorMsg}</div>
            </div>
        `,
        footerHtml: footerHtml
    });
}

// =====================================================================
// 3. MASTER DATA FETCHING (ISOLATED PER API)
// =====================================================================
async function fetchDashboardData(isManual = false) {
    // 1. Campus Summary
    try {
        const res = await fetch('/api/campus-summary');
        if (res.ok) {
            const data = await res.json();
            updateSummaryUI(data);
        }
    } catch (e) {
        console.warn("Summary API warning:", e);
    }

    // 2. Camera Status
    try {
        const camRes = await fetch('/api/camera/status');
        if (camRes.ok) {
            const camData = await camRes.json();
            updateCameraUI(camData);
        }
    } catch (e) {
        console.warn("Camera status API warning:", e);
    }

    // 3. AI Detections
    try {
        const aiRes = await fetch('/api/ai/detections');
        if (aiRes.ok) {
            const aiData = await aiRes.json();
            updateAIDetections(aiData);
        }
    } catch (e) {
        console.warn("AI detections API warning:", e);
    }

    // 4. Classrooms List
    try {
        const roomsRes = await fetch('/api/rooms');
        if (roomsRes.ok) {
            globalRoomsData = await roomsRes.json();
            updateOccupancyList(globalRoomsData);
            if (currentActiveSection === 'classrooms' || isManual) {
                renderClassroomsGrid();
            }
        }
    } catch (e) {
        console.warn("Rooms API warning:", e);
    }

    // 5. Corridors List
    try {
        const corrRes = await fetch('/api/corridors');
        if (corrRes.ok) {
            globalCorridorsData = await corrRes.json();
            updateCorridorsSummary(globalCorridorsData);
            if (currentActiveSection === 'corridors' || isManual) {
                renderCorridorsGrid();
            }
        }
    } catch (e) {
        console.warn("Corridors API warning:", e);
    }

    // 6. Timetable
    try {
        const ttRes = await fetch('/api/timetable');
        if (ttRes.ok) {
            globalTimetableData = await ttRes.json();
            updateCurrentClass(globalTimetableData);
            if (currentActiveSection === 'timetable' || isManual) {
                renderTimetableTable(globalTimetableData);
            }
        }
    } catch (e) {
        console.warn("Timetable API warning:", e);
    }

    // 7. Active Alerts
    try {
        const alertsRes = await fetch('/api/alerts');
        if (alertsRes.ok) {
            globalAlertsData = await alertsRes.json();
            updateAlertsUI(globalAlertsData);
        }
    } catch (e) {
        console.warn("Alerts API warning:", e);
    }

    // 8. Attendance Overview
    try {
        const attRes = await fetch('/api/attendance');
        if (attRes.ok) {
            const attData = await attRes.json();
            updateAttendanceKPIs(attData);
            if (currentActiveSection === 'attendance' && !isManual) {
                // Background refresh only if date filter is today
                const selectedDate = document.getElementById('attendanceDateFilter')?.value;
                const todayStr = new Date().toISOString().split('T')[0];
                if (selectedDate === todayStr) {
                    globalAttendanceData = attData.records || [];
                    renderAttendancePortalTable();
                }
            }
        }
    } catch (e) {
        console.warn("Attendance summary API warning:", e);
    }

    // 9. Digital Twin & Emergency Telemetry
    try {
        const twinRes = await fetch('/api/campus/digital-twin');
        if (twinRes.ok) {
            let twinData = await twinRes.json();
            if (isDemoModeActive) {
                twinData = applyDemoOverridesToTwinData(twinData);
            }
            globalDigitalTwinData = twinData;
            updateCampusTwinAndLiveHub(twinData);
        }
    } catch (e) {
        console.warn("Digital Twin API warning:", e);
    }

    // 10. Campus Insights Telemetry
    try {
        const insRes = await fetch('/api/campus/insights');
        if (insRes.ok) {
            let insData = await insRes.json();
            if (isDemoModeActive) {
                insData = generateDemoInsights(insData);
            }
            globalInsightsData = insData;
            renderCampusInsights(insData);
        }
    } catch (e) {
        console.warn("Campus Insights API warning:", e);
    }
}

// =====================================================================
// 4. DASHBOARD UI UPDATES
// =====================================================================
function updateSummaryUI(summary) {
    const kpiTotal = document.getElementById('kpiTotalPeople');
    const kpiActive = document.getElementById('kpiActiveRooms');
    const kpiEmpty = document.getElementById('kpiEmptyRooms');
    const sidebarRooms = document.getElementById('sidebarRoomsCount');
    const badgeRoomCount = document.getElementById('badgeRoomCount');

    if (kpiTotal) kpiTotal.innerText = summary.total_persons_detected ?? 0;
    if (kpiActive) kpiActive.innerText = summary.active_classrooms ?? 0;
    if (kpiEmpty) kpiEmpty.innerText = summary.empty_classrooms ?? 0;
    if (sidebarRooms) sidebarRooms.innerText = summary.monitored_rooms_count ?? 0;
    if (badgeRoomCount) badgeRoomCount.innerText = `${summary.monitored_rooms_count ?? 0} Monitored Rooms`;
}

function updateCorridorsSummary(corridors) {
    const totalCorr = corridors.reduce((acc, c) => acc + (c.count || 0), 0);
    const kpiCorr = document.getElementById('kpiCorridorPeople');
    if (kpiCorr) kpiCorr.innerText = totalCorr;
}

function updateAlertsUI(alerts) {
    const kpiAlerts = document.getElementById('kpiActiveAlerts');
    const kpiSubtitle = document.getElementById('kpiAlertsSubtitle');
    const sidebarAlerts = document.getElementById('sidebarAlertsCount');
    const alertsBadge = document.getElementById('alertsTotalBadge');

    const count = alerts.length;

    if (kpiAlerts) kpiAlerts.innerText = count;
    if (sidebarAlerts) {
        sidebarAlerts.innerText = count;
        sidebarAlerts.style.display = count > 0 ? 'inline-block' : 'none';
    }
    if (alertsBadge) alertsBadge.innerText = `${count} Active`;

    if (kpiSubtitle) {
        if (count === 0) {
            kpiSubtitle.innerText = 'NO HAZARDS';
            kpiSubtitle.className = 'kpi-viz text-green';
        } else {
            kpiSubtitle.innerText = `${count} ANOMALIES FLAGGED`;
            kpiSubtitle.className = 'kpi-viz text-red';
        }
    }

    if (currentActiveSection === 'alerts') {
        renderAlertsFeed(alerts);
    }
}

function updateAttendanceKPIs(attData) {
    const total = attData.total_students ?? 0;
    const present = attData.present_count ?? 0;
    const absent = attData.absent_count ?? 0;
    const pct = attData.attendance_percentage ?? 0;

    const kpiPct = document.getElementById('kpiAttendancePct');
    const kpiPresent = document.getElementById('kpiPresentCount');
    const kpiTotal = document.getElementById('kpiTotalStudents');
    const kpiAbsent = document.getElementById('kpiAbsentCount');
    const kpiEnrolled = document.getElementById('kpiEnrolledStudents');
    const sidebarStudents = document.getElementById('sidebarStudentsCount');

    if (kpiPct) kpiPct.innerText = `${pct}%`;
    if (kpiPresent) kpiPresent.innerText = present;
    if (kpiTotal) kpiTotal.innerText = total;
    if (kpiAbsent) kpiAbsent.innerText = absent;
    if (kpiEnrolled) kpiEnrolled.innerText = total;
    if (sidebarStudents) sidebarStudents.innerText = total;

    // Attendance portal KPIs
    const pTotal = document.getElementById('attPortalTotalStudents');
    const pPresent = document.getElementById('attPortalPresent');
    const pAbsent = document.getElementById('attPortalAbsent');
    const pRate = document.getElementById('attPortalRate');

    if (pTotal) pTotal.innerText = total;
    if (pPresent) pPresent.innerText = present;
    if (pAbsent) pAbsent.innerText = absent;
    if (pRate) pRate.innerText = `${pct}%`;
}

function updateCameraUI(cam) {
    const btnStart = document.getElementById("btnStartCamera");
    const btnStop = document.getElementById("btnStopCamera");
    const btnSecStart = document.getElementById("btnCameraSecStart");
    const btnSecStop = document.getElementById("btnCameraSecStop");

    const placeholder = document.getElementById("cameraPlaceholder");
    const expPlaceholder = document.getElementById("cameraExpandedPlaceholder");
    const streamImg = document.getElementById("cctvStreamImg");
    const expStreamImg = document.getElementById("cctvExpandedStreamImg");

    const sysCamStatus = document.getElementById("sysCamStatus");
    const sidebarCamDot = document.getElementById("sidebarCamDot");
    const camStatusTexts = document.querySelectorAll(".camera-status-text");
    const liveIndicators = document.querySelectorAll(".camera-live-indicator, .live-dot-container");

    const isRunning = cam.is_running || Boolean(browserCameraStream);

    if (isRunning) {
        camStatusTexts.forEach(el => {
            el.innerText = "● CAMERA LIVE";
            el.style.color = "var(--accent-green)";
        });

        if (sysCamStatus) {
            sysCamStatus.innerText = "ONLINE";
            sysCamStatus.className = "s-val text-green";
        }
        if (sidebarCamDot) sidebarCamDot.style.display = "inline-block";

        if (btnStart) btnStart.style.display = "none";
        if (btnStop) btnStop.style.display = "inline-flex";
        if (btnSecStart) btnSecStart.style.display = "none";
        if (btnSecStop) btnSecStop.style.display = "inline-flex";

        if (placeholder) placeholder.style.display = "none";
        if (expPlaceholder) expPlaceholder.style.display = "none";

        // Feed image source
        const feedUrl = "/video_feed?" + new Date().getTime();
        if (streamImg && !browserCameraStream) {
            streamImg.style.display = "block";
            if (!streamImg.src.includes("/video_feed")) streamImg.src = feedUrl;
        }
        if (expStreamImg && !browserCameraStream) {
            expStreamImg.style.display = "block";
            if (!expStreamImg.src.includes("/video_feed")) expStreamImg.src = feedUrl;
        }

        liveIndicators.forEach(el => el.style.display = 'inline-flex');

        const yoloInd = document.querySelector('.yolo-ind');
        if (yoloInd) yoloInd.classList.add('active');
    } else {
        camStatusTexts.forEach(el => {
            el.innerText = "● CAMERA OFFLINE";
            el.style.color = "var(--text-dim)";
        });

        if (sysCamStatus) {
            sysCamStatus.innerText = "OFFLINE";
            sysCamStatus.className = "s-val text-dim";
        }
        if (sidebarCamDot) sidebarCamDot.style.display = "none";

        if (btnStart) btnStart.style.display = "inline-flex";
        if (btnStop) btnStop.style.display = "none";
        if (btnSecStart) btnSecStart.style.display = "inline-flex";
        if (btnSecStop) btnSecStop.style.display = "none";

        if (placeholder) placeholder.style.display = "flex";
        if (expPlaceholder) expPlaceholder.style.display = "flex";

        if (streamImg) {
            streamImg.style.display = "none";
            streamImg.src = "";
        }
        if (expStreamImg) {
            expStreamImg.style.display = "none";
            expStreamImg.src = "";
        }

        liveIndicators.forEach(el => el.style.display = 'none');

        const yoloInd = document.querySelector('.yolo-ind');
        if (yoloInd) yoloInd.classList.remove('active');
    }

    if (typeof window.update3DViz === "function") {
        window.update3DViz(isRunning);
    }
}

function updateAIDetections(ai) {
    const kpiRec = document.getElementById('kpiRecognized');
    const kpiUnk = document.getElementById('kpiUnknown');
    const telFaces = document.getElementById('telFaces');
    const telPeople = document.getElementById('telPeople');
    const telFps = document.getElementById('telFps');
    const badgeRec = document.getElementById('badgeRecognized');
    const badgeUnk = document.getElementById('badgeUnknown');
    const listRec = document.getElementById('recognizedList');
    const listUnk = document.getElementById('unknownList');

    const camSecPeople = document.getElementById('camSecPeople');
    const camSecFaces = document.getElementById('camSecFaces');
    const camSecFps = document.getElementById('camSecFps');
    const camSecRecList = document.getElementById('camSecRecognizedList');
    const camSecUnkList = document.getElementById('camSecUnknownList');

    const pCount = ai.people_count ?? 0;
    const fCount = ai.face_count ?? 0;
    const rCount = ai.recognized_count ?? 0;
    const uCount = ai.unknown_count ?? 0;
    const fpsVal = ai.fps && ai.fps > 0 ? ai.fps.toFixed(1) : "--";

    if (telPeople) telPeople.innerText = pCount;
    if (telFaces) telFaces.innerText = fCount;
    if (telFps) telFps.innerText = fpsVal;
    if (badgeRec) badgeRec.innerText = rCount;
    if (badgeUnk) badgeUnk.innerText = uCount;
    if (kpiRec) kpiRec.innerText = rCount;
    if (kpiUnk) kpiUnk.innerText = uCount;

    if (camSecPeople) camSecPeople.innerText = pCount;
    if (camSecFaces) camSecFaces.innerText = fCount;
    if (camSecFps) camSecFps.innerText = fpsVal;

    // Render detected faces
    let htmlRec = '';
    let htmlUnk = '';

    if (ai.detections && ai.detections.length > 0) {
        ai.detections.forEach(face => {
            const conf = Math.round((face.confidence || 0.85) * 100);
            if (face.status === "recognized") {
                htmlRec += `
                <div class="det-item">
                    <div class="det-avatar">${face.name.charAt(0)}</div>
                    <div class="det-info">
                        <div class="det-name">${face.name}</div>
                        <div class="det-meta">Match: ${conf}% &bull; ${face.student_id || 'Student'}</div>
                    </div>
                </div>`;
            } else {
                htmlUnk += `
                <div class="det-item">
                    <div class="det-avatar" style="background: var(--accent-amber);">?</div>
                    <div class="det-info">
                        <div class="det-name">Unknown Person</div>
                        <div class="det-meta text-amber">Confidence: ${conf}%</div>
                    </div>
                </div>`;
            }
        });
    }

    const emptyRecHtml = `
        <div class="elegant-empty-state small">
            <div class="empty-icon">⚲</div>
            <div class="empty-title">NO ACTIVE DETECTIONS</div>
        </div>`;
    const emptyUnkHtml = `
        <div class="elegant-empty-state small">
            <div class="empty-title">NO UNKNOWN PERSONS</div>
        </div>`;

    if (listRec) listRec.innerHTML = htmlRec || emptyRecHtml;
    if (listUnk) listUnk.innerHTML = htmlUnk || emptyUnkHtml;
    if (camSecRecList) camSecRecList.innerHTML = htmlRec || emptyRecHtml;
    if (camSecUnkList) camSecUnkList.innerHTML = htmlUnk || emptyUnkHtml;

    if (typeof window.updateAI3D === "function") {
        window.updateAI3D(fCount, rCount);
    }
}

function updateOccupancyList(rooms) {
    const listEl = document.getElementById('occupancyList');
    if (!listEl) return;

    if (!rooms || rooms.length === 0) {
        listEl.innerHTML = `<div class="elegant-empty-state small">No monitored rooms found.</div>`;
        return;
    }

    let html = '';
    rooms.slice(0, 5).forEach(room => {
        let barClass = '';
        if (room.occupancy_rate > 90) barClass = 'full';
        else if (room.occupancy_rate > 70) barClass = 'warning';

        html += `
        <div class="occ-row" onclick="viewClassroomDetails('${room.room}')" title="Click to view details for ${room.room}" tabindex="0" role="button">
            <div class="occ-header">
                <span class="occ-room">${room.room} ${room.is_live_feed ? '📹' : ''}</span>
                <span class="occ-stats">${room.persons} / ${room.capacity} (${room.occupancy_rate}%)</span>
            </div>
            <div class="occ-bar-bg">
                <div class="occ-bar-fill ${barClass}" style="width: ${Math.min(room.occupancy_rate, 100)}%;"></div>
            </div>
        </div>`;
    });
    listEl.innerHTML = html;
}

function updateCurrentClass(timetable) {
    const infoEl = document.getElementById('currentClassInfo');
    if (!infoEl) return;

    if (!timetable || timetable.length === 0) {
        infoEl.innerHTML = `<div class="elegant-empty-state small">No scheduled lectures at this time.</div>`;
        return;
    }

    const cls = timetable[0];
    infoEl.innerHTML = `
        <div class="info-row"><span class="info-label">ROOM</span><span class="info-val">${cls.room}</span></div>
        <div class="info-row"><span class="info-label">SUBJECT</span><span class="info-val">${cls.subject}</span></div>
        <div class="info-row"><span class="info-label">FACULTY</span><span class="info-val">${cls.faculty}</span></div>
        <div class="info-row"><span class="info-label">TIME</span><span class="info-val">${cls.time_slot}</span></div>
        <div class="info-row"><span class="info-label">VERIFICATION</span><span class="info-val text-cyan">${cls.verification_status || 'Scheduled'}</span></div>
    `;
}

// =====================================================================
// 5. CLASSROOM MONITORING SECTION & MODALS
// =====================================================================
function setClassroomFilter(filterType) {
    activeClassroomFilter = filterType;
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.getAttribute('data-filter') === filterType) {
            tab.classList.add('active');
        }
    });
    renderClassroomsGrid();
}

function filterClassroomsUI() {
    renderClassroomsGrid();
}

function renderClassroomsGrid() {
    const grid = document.getElementById('classroomsGrid');
    if (!grid) return;

    const searchVal = (document.getElementById('classroomSearchInput')?.value || '').toLowerCase().trim();

    // Calculate filter counts
    const allCount = globalRoomsData.length;
    const occCount = globalRoomsData.filter(r => r.persons > 0).length;
    const emptyCount = globalRoomsData.filter(r => r.persons === 0).length;
    const highCount = globalRoomsData.filter(r => r.occupancy_rate >= 80).length;

    const elAll = document.getElementById('countFilterAll');
    const elOcc = document.getElementById('countFilterOccupied');
    const elEmpty = document.getElementById('countFilterEmpty');
    const elHigh = document.getElementById('countFilterHigh');

    if (elAll) elAll.innerText = allCount;
    if (elOcc) elOcc.innerText = occCount;
    if (elEmpty) elEmpty.innerText = emptyCount;
    if (elHigh) elHigh.innerText = highCount;

    let filtered = globalRoomsData.filter(r => {
        // Tab filter
        if (activeClassroomFilter === 'occupied' && r.persons === 0) return false;
        if (activeClassroomFilter === 'empty' && r.persons > 0) return false;
        if (activeClassroomFilter === 'high' && r.occupancy_rate < 80) return false;

        // Search filter
        if (searchVal) {
            const matchesRoom = r.room.toLowerCase().includes(searchVal);
            const matchesFaculty = (r.faculty || '').toLowerCase().includes(searchVal);
            const matchesSubject = (r.subject || '').toLowerCase().includes(searchVal);
            if (!matchesRoom && !matchesFaculty && !matchesSubject) return false;
        }

        return true;
    });

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div class="col-12" style="grid-column: 1 / -1;">
                <div class="elegant-empty-state">
                    <div class="empty-icon">🔍</div>
                    <div class="empty-title">NO CLASSROOMS MATCHING FILTER</div>
                    <div class="empty-desc">Try resetting your search query or tab filters.</div>
                </div>
            </div>
        `;
        return;
    }

    grid.innerHTML = filtered.map(r => {
        let statusClass = 'status-normal';
        if (r.status === 'Empty') statusClass = 'status-empty';
        else if (r.status === 'Full' || r.occupancy_rate > 90) statusClass = 'status-full';
        else if (r.occupancy_rate > 70) statusClass = 'status-warning';

        return `
        <div class="classroom-card">
            <div>
                <div class="classroom-card-header">
                    <div class="classroom-room-name">
                        ${r.room}
                        ${r.is_live_feed ? '<span class="camera-badge-icon">📹 LIVE CCTV</span>' : ''}
                    </div>
                    <span class="status-pill ${statusClass}">${r.status}</span>
                </div>

                <div class="classroom-card-body">
                    <div class="classroom-occupancy-metric">
                        <span class="occ-large-val">${r.persons}</span>
                        <span class="occ-cap-val">/ ${r.capacity} Seats (${r.occupancy_rate}%)</span>
                    </div>
                    <div class="occ-bar-bg">
                        <div class="occ-bar-fill ${r.occupancy_rate > 90 ? 'full' : (r.occupancy_rate > 70 ? 'warning' : '')}" 
                             style="width: ${Math.min(r.occupancy_rate, 100)}%;"></div>
                    </div>

                    <div class="classroom-meta-row">
                        <div class="meta-item"><span>FACULTY:</span> <strong>${r.faculty || 'Unassigned'}</strong></div>
                        <div class="meta-item"><span>SUBJECT:</span> <strong>${r.subject || 'Free Period'}</strong></div>
                    </div>
                </div>
            </div>

            <div class="classroom-card-actions">
                <button class="btn-primary" onclick="viewClassroomDetails('${r.room}')">VIEW DETAILS</button>
                ${r.is_live_feed 
                    ? `<button class="btn-secondary" onclick="navigateToSection('camera')">LIVE FEED</button>` 
                    : `<button class="btn-outline" onclick="openEditRoomModal('${r.room}', ${r.capacity}, '${escapeQuotes(r.faculty)}', '${escapeQuotes(r.subject)}')">EDIT INFO</button>`}
            </div>
        </div>
        `;
    }).join('');
}

async function viewClassroomDetails(roomName) {
    showModalLoading(`Classroom Telemetry: ${roomName}`);

    try {
        const res = await fetch(`/api/rooms/${encodeURIComponent(roomName)}`);
        if (!res.ok) throw new Error("Failed to fetch room telemetry");
        const data = await res.json();

        const room = data.room;
        const timetable = data.timetable || [];
        const logs = data.logs || [];

        let statusClass = 'status-normal';
        if (data.status === 'Empty') statusClass = 'status-empty';
        else if (data.status === 'Full') statusClass = 'status-full';

        let ttHtml = '<p class="text-dim text-center p-4">No scheduled lectures for this room today.</p>';
        if (timetable.length > 0) {
            ttHtml = `
            <table class="data-table mt-2">
                <thead><tr><th>Time</th><th>Subject</th><th>Faculty</th><th>Expected</th></tr></thead>
                <tbody>
                    ${timetable.map(t => `
                        <tr>
                            <td>${t.time_slot}</td>
                            <td><strong>${t.subject}</strong></td>
                            <td>${t.faculty}</td>
                            <td>${t.expected_strength}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>`;
        }

        let logsHtml = '<p class="text-dim text-center p-4">No audit logs recorded recently.</p>';
        if (logs.length > 0) {
            logsHtml = `
            <table class="data-table mt-2">
                <thead><tr><th>Time</th><th>Count</th><th>Occupancy</th><th>Status</th></tr></thead>
                <tbody>
                    ${logs.slice(0, 5).map(l => `
                        <tr>
                            <td>${l.timestamp}</td>
                            <td>${l.persons} / ${l.capacity}</td>
                            <td>${Math.round((l.persons / l.capacity) * 100)}%</td>
                            <td><span class="status-pill status-${l.status.toLowerCase()}">${l.status}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>`;
        }

        const bodyHtml = `
            <div class="room-modal-details">
                <div class="room-detail-hero">
                    <div class="info-row"><span class="info-label">Room:</span><span class="info-val"><strong>${room.room}</strong></span></div>
                    <div class="info-row"><span class="info-label">Current Occupancy:</span><span class="info-val"><strong>${room.persons}</strong></span></div>
                    <div class="info-row"><span class="info-label">Capacity:</span><span class="info-val">${room.capacity} Seats</span></div>
                    <div class="info-row"><span class="info-label">Occupancy:</span><span class="info-val"><strong>${data.occupancy_rate}%</strong> (${data.status})</span></div>
                    <div class="info-row"><span class="info-label">Camera Status:</span><span class="info-val text-green">${room.is_live_feed ? 'ONLINE (Hardware CCTV-01)' : 'ONLINE (Network Stream)'}</span></div>
                    <div class="info-row"><span class="info-label">Faculty:</span><span class="info-val">${room.faculty || 'Unassigned'}</span></div>
                    <div class="info-row"><span class="info-label">Scheduled Class:</span><span class="info-val">${room.subject || 'None'}</span></div>
                    <div class="info-row"><span class="info-label">Attendance:</span><span class="info-val text-cyan">${room.persons > 0 ? `${room.persons} Students Present` : 'No Active Headcount'}</span></div>
                </div>

                <div class="mt-4">
                    <h3 class="section-title">SCHEDULED TIMETABLE</h3>
                    ${ttHtml}
                </div>

                <div class="mt-4">
                    <h3 class="section-title">RECENT OCCUPANCY LOGS</h3>
                    ${logsHtml}
                </div>
            </div>
        `;

        const footerHtml = `
            <button class="btn-primary" onclick="closeUniversalModal(); navigateToSection('camera');">View Camera</button>
            <button class="btn-secondary" onclick="closeUniversalModal(); navigateToSection('reports');">View Analytics</button>
            <button class="btn-outline" onclick="openEditRoomModal('${room.room}', ${room.capacity}, '${escapeQuotes(room.faculty)}', '${escapeQuotes(room.subject)}')">Edit Info</button>
            <button class="btn-secondary" onclick="closeUniversalModal()">Close</button>
        `;

        openUniversalModal({
            title: `ROOM DETAILS — ${room.room}`,
            badge: data.status,
            bodyHtml: bodyHtml,
            footerHtml: footerHtml
        });

    } catch (err) {
        showModalError("Classroom Details Error", err.message, () => viewClassroomDetails(roomName));
    }
}

function openEditRoomModal(roomName, capacity, faculty, subject) {
    const bodyHtml = `
        <form id="editRoomForm" onsubmit="submitRoomUpdate(event, '${roomName}')">
            <div class="form-group">
                <label>Room Name</label>
                <input type="text" class="form-input" value="${roomName}" disabled>
            </div>
            <div class="form-group mt-4">
                <label>Seating Capacity</label>
                <input type="number" id="editRoomCapacity" class="form-input" required min="1" max="500" value="${capacity}">
            </div>
            <div class="form-group mt-4">
                <label>Assigned Faculty</label>
                <input type="text" id="editRoomFaculty" class="form-input" required value="${faculty}">
            </div>
            <div class="form-group mt-4">
                <label>Scheduled Subject</label>
                <input type="text" id="editRoomSubject" class="form-input" required value="${subject}">
            </div>
            <div class="form-actions mt-6" style="display: flex; gap: 10px; justify-content: flex-end;">
                <button type="button" class="btn-secondary" onclick="closeUniversalModal()">Cancel</button>
                <button type="submit" class="btn-primary" id="btnSaveRoom">Save Changes</button>
            </div>
        </form>
    `;

    openUniversalModal({
        title: `Edit Metadata — ${roomName}`,
        badge: "CONFIG",
        bodyHtml: bodyHtml
    });
}

async function submitRoomUpdate(e, roomName) {
    e.preventDefault();
    const btn = document.getElementById('btnSaveRoom');
    if (btn) {
        btn.innerText = "Saving...";
        btn.disabled = true;
    }

    const payload = {
        capacity: parseInt(document.getElementById('editRoomCapacity').value, 10),
        faculty: document.getElementById('editRoomFaculty').value.trim(),
        subject: document.getElementById('editRoomSubject').value.trim()
    };

    try {
        const res = await fetch(`/api/rooms/${encodeURIComponent(roomName)}/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Failed to update room");
        alert(`Room ${roomName} updated successfully.`);
        closeUniversalModal();
        fetchDashboardData(true);
    } catch (err) {
        alert("Error saving room changes: " + err.message);
    } finally {
        if (btn) {
            btn.innerText = "Save Changes";
            btn.disabled = false;
        }
    }
}

// =====================================================================
// 6. ATTENDANCE PORTAL MODULE
// =====================================================================
async function fetchAttendancePortalData(isManual = false) {
    const dateInput = document.getElementById('attendanceDateFilter');
    const selectedDate = dateInput?.value || new Date().toISOString().split('T')[0];
    const dateDisplay = document.getElementById('attendanceCurrentDateDisplay');
    if (dateDisplay) dateDisplay.innerText = selectedDate;

    try {
        const res = await fetch(`/api/attendance?date=${encodeURIComponent(selectedDate)}`);
        if (!res.ok) throw new Error("Failed to fetch attendance data");
        const data = await res.json();

        globalAttendanceData = data.records || [];
        updateAttendanceKPIs(data);
        renderAttendancePortalTable();
    } catch (err) {
        console.error("Attendance Portal error:", err);
        const tbody = document.getElementById('attendancePortalTableBody');
        if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="text-center p-4 text-red">Failed to load attendance: ${err.message}</td></tr>`;
    }
}

function setAttendanceFilter(filterType) {
    activeAttendanceFilter = filterType;
    document.querySelectorAll('#section-attendance .filter-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.getAttribute('data-filter') === filterType) {
            tab.classList.add('active');
        }
    });
    renderAttendancePortalTable();
}

function filterAttendanceUI() {
    renderAttendancePortalTable();
}

function renderAttendancePortalTable() {
    const tbody = document.getElementById('attendancePortalTableBody');
    if (!tbody) return;

    const searchVal = (document.getElementById('attendanceSearchInput')?.value || '').toLowerCase().trim();

    // Filter counts
    const totalCount = globalAttendanceData.length;
    const presentCount = globalAttendanceData.filter(r => r.status === 'Present').length;
    const absentCount = totalCount - presentCount;

    const elAll = document.getElementById('attFilterAllCount');
    const elPres = document.getElementById('attFilterPresentCount');
    const elAbs = document.getElementById('attFilterAbsentCount');

    if (elAll) elAll.innerText = totalCount;
    if (elPres) elPres.innerText = presentCount;
    if (elAbs) elAbs.innerText = absentCount;

    let filtered = globalAttendanceData.filter(r => {
        if (activeAttendanceFilter === 'present' && r.status !== 'Present') return false;
        if (activeAttendanceFilter === 'absent' && r.status !== 'Absent') return false;

        if (searchVal) {
            const matchName = r.name.toLowerCase().includes(searchVal);
            const matchId = r.student_id.toLowerCase().includes(searchVal);
            if (!matchName && !matchId) return false;
        }
        return true;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center p-4 text-dim">No attendance records matching filter criteria.</td></tr>`;
        return;
    }

    const selectedDate = document.getElementById('attendanceDateFilter')?.value || new Date().toISOString().split('T')[0];

    tbody.innerHTML = filtered.map(r => {
        const isPresent = r.status === 'Present';
        return `
        <tr>
            <td>
                <div class="det-avatar" style="width: 30px; height: 30px; font-size: 0.8rem; background: ${isPresent ? 'var(--accent-cyan)' : 'var(--bg-elevated)'};">
                    ${r.name.charAt(0)}
                </div>
            </td>
            <td><strong>${r.name}</strong></td>
            <td><span class="sys-tag" style="color: var(--accent-cyan); font-family: monospace;">${r.student_id}</span></td>
            <td>${r.date || selectedDate}</td>
            <td><strong style="font-family: monospace;">${r.first_seen || '-'}</strong></td>
            <td><strong style="font-family: monospace;">${r.last_seen || '-'}</strong></td>
            <td>
                <span class="status-pill ${isPresent ? 'status-normal' : 'status-empty'}">
                    ${r.status}
                </span>
            </td>
            <td>
                <button class="btn-xs ${isPresent ? 'btn-danger' : 'btn-primary'}" 
                        onclick="toggleAttendance('${r.student_id}', '${r.date || selectedDate}', '${isPresent ? 'Absent' : 'Present'}')">
                    ${isPresent ? 'Mark Absent' : 'Mark Present'}
                </button>
            </td>
        </tr>
        `;
    }).join('');
}

async function toggleAttendance(studentId, dateStr, newStatus) {
    try {
        const res = await fetch('/api/attendance/mark', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                student_id: studentId,
                date: dateStr,
                status: newStatus
            })
        });

        if (res.ok) {
            fetchAttendancePortalData();
            fetchDashboardData();
        } else {
            alert("Failed to update attendance status.");
        }
    } catch (err) {
        alert("Error updating attendance: " + err.message);
    }
}

// =====================================================================
// 7. CORRIDOR MONITORING SECTION
// =====================================================================
function renderCorridorsGrid() {
    const grid = document.getElementById('corridorsGrid');
    if (!grid) return;

    if (!globalCorridorsData || globalCorridorsData.length === 0) {
        grid.innerHTML = `
            <div class="col-12">
                <div class="elegant-empty-state">
                    <div class="empty-icon">🚶</div>
                    <div class="empty-title">NO MONITORED CORRIDORS</div>
                    <div class="empty-desc">Corridor data will stream automatically when available.</div>
                </div>
            </div>
        `;
        return;
    }

    grid.innerHTML = globalCorridorsData.map(c => {
        const pct = Math.round((c.count / c.threshold) * 100);
        let statusClass = 'status-normal';
        if (c.status === 'Moderate' || pct > 70) statusClass = 'status-warning';
        if (c.status === 'Congested' || pct >= 100) statusClass = 'status-full';

        return `
        <div class="corridor-card" onclick="viewCorridorDetails('${c.id}')" tabindex="0" role="button">
            <div>
                <div class="classroom-card-header">
                    <div class="classroom-room-name">${c.name}</div>
                    <span class="status-pill ${statusClass}">${c.status}</span>
                </div>

                <div class="classroom-card-body">
                    <div class="classroom-occupancy-metric">
                        <span class="occ-large-val">${c.count}</span>
                        <span class="occ-cap-val">/ ${c.threshold} Safety Limit (${pct}%)</span>
                    </div>
                    <div class="occ-bar-bg">
                        <div class="occ-bar-fill ${pct >= 100 ? 'full' : (pct > 70 ? 'warning' : '')}" 
                             style="width: ${Math.min(pct, 100)}%;"></div>
                    </div>
                    <div class="classroom-meta-row">
                        <div class="meta-item"><span>CAMPUS ZONE:</span> <strong>${c.zone}</strong></div>
                        <div class="meta-item"><span>CAMERA SENSOR:</span> <strong>Corridor AI Lens</strong></div>
                    </div>
                </div>
            </div>

            <div class="classroom-card-actions">
                <button class="btn-primary" onclick="event.stopPropagation(); viewCorridorDetails('${c.id}')">VIEW TELEMETRY</button>
            </div>
        </div>
        `;
    }).join('');
}

function viewCorridorDetails(corridorId) {
    const corridor = globalCorridorsData.find(c => c.id === corridorId);
    if (!corridor) return;

    const pct = Math.round((corridor.count / corridor.threshold) * 100);

    const bodyHtml = `
        <div class="corridor-modal-details">
            <div class="info-row"><span class="info-label">CORRIDOR NAME</span><span class="info-val">${corridor.name}</span></div>
            <div class="info-row"><span class="info-label">CAMPUS ZONE</span><span class="info-val">${corridor.zone}</span></div>
            <div class="info-row"><span class="info-label">CURRENT DENSITY</span><span class="info-val">${corridor.count} Persons</span></div>
            <div class="info-row"><span class="info-label">SAFETY THRESHOLD</span><span class="info-val">${corridor.threshold} Persons</span></div>
            <div class="info-row"><span class="info-label">CAPACITY USAGE</span><span class="info-val">${pct}%</span></div>
            <div class="info-row"><span class="info-label">SAFETY STATUS</span><span class="info-val"><span class="status-pill status-${corridor.status.toLowerCase()}">${corridor.status}</span></span></div>
            
            <div class="mt-4">
                <h3 class="section-title">CROWD DENSITY PROGRESSION</h3>
                <div class="occ-bar-bg" style="height: 10px; border-radius: 5px;">
                    <div class="occ-bar-fill ${pct >= 100 ? 'full' : (pct > 70 ? 'warning' : '')}" style="width: ${Math.min(pct, 100)}%;"></div>
                </div>
                <p class="text-dim mt-2" style="font-size: 11px;">When footfall exceeds ${corridor.threshold} persons, automatic overcrowding warnings trigger across the campus safety dashboard.</p>
            </div>
        </div>
    `;

    openUniversalModal({
        title: `Corridor Flow — ${corridor.name}`,
        badge: corridor.status,
        bodyHtml: bodyHtml,
        footerHtml: `<button class="btn-secondary" onclick="closeUniversalModal()">Close</button>`
    });
}

// =====================================================================
// 8. FACULTY TIMETABLE SECTION
// =====================================================================
async function fetchTimetableData() {
    try {
        const res = await fetch('/api/timetable');
        if (res.ok) {
            globalTimetableData = await res.json();
            renderTimetableTable(globalTimetableData);
        }
    } catch (e) {
        console.warn("Timetable fetch error:", e);
    }
}

function renderTimetableTable(timetable) {
    const tbody = document.getElementById('timetableTableBody');
    if (!tbody) return;

    if (!timetable || timetable.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center p-4 text-dim">No scheduled lectures for today.</td></tr>`;
        return;
    }

    tbody.innerHTML = timetable.map(t => {
        let statusBadge = 'status-normal';
        if (t.verification_status.includes('Empty')) statusBadge = 'status-full';
        else if (t.verification_status.includes('Warning')) statusBadge = 'status-warning';
        else if (t.verification_status.includes('Notice')) statusBadge = 'status-empty';

        return `
        <tr class="clickable-row" onclick="viewTimetableDetails('${t.id}')">
            <td><strong style="font-family: monospace;">${t.time_slot}</strong></td>
            <td><span class="sys-tag">${t.room}</span></td>
            <td><strong>${t.subject}</strong></td>
            <td>${t.faculty}</td>
            <td>${t.expected_strength}</td>
            <td><strong class="text-cyan">${t.actual_detected ?? 0}</strong></td>
            <td><span class="status-pill ${statusBadge}">${t.verification_status}</span></td>
            <td>
                <button class="btn-xs btn-outline" onclick="event.stopPropagation(); viewTimetableDetails('${t.id}')">View</button>
                <button class="btn-xs btn-danger" onclick="event.stopPropagation(); deleteTimetableEntry('${t.id}')">Delete</button>
            </td>
        </tr>
        `;
    }).join('');
}

function viewTimetableDetails(ttId) {
    const entry = globalTimetableData.find(t => t.id === ttId);
    if (!entry) return;

    const bodyHtml = `
        <div class="timetable-modal-details">
            <div class="info-row"><span class="info-label">SCHEDULE ID</span><span class="info-val">${entry.id}</span></div>
            <div class="info-row"><span class="info-label">FACULTY</span><span class="info-val">${entry.faculty}</span></div>
            <div class="info-row"><span class="info-label">SUBJECT</span><span class="info-val">${entry.subject}</span></div>
            <div class="info-row"><span class="info-label">ROOM</span><span class="info-val">${entry.room}</span></div>
            <div class="info-row"><span class="info-label">TIME SLOT</span><span class="info-val">${entry.time_slot}</span></div>
            <div class="info-row"><span class="info-label">EXPECTED STRENGTH</span><span class="info-val">${entry.expected_strength} Students</span></div>
            <div class="info-row"><span class="info-label">LIVE YOLO DETECTIONS</span><span class="info-val text-cyan">${entry.actual_detected ?? 0} Students Present</span></div>
            <div class="info-row"><span class="info-label">VERIFICATION AUDIT</span><span class="info-val text-green">${entry.verification_status}</span></div>
        </div>
    `;

    openUniversalModal({
        title: `Lecture Verification — ${entry.subject}`,
        badge: entry.room,
        bodyHtml: bodyHtml,
        footerHtml: `
            <button class="btn-secondary" onclick="closeUniversalModal()">Close</button>
            <button class="btn-primary" onclick="closeUniversalModal(); viewClassroomDetails('${entry.room}')">Inspect Room</button>
        `
    });
}

function openAddTimetableModal() {
    const modal = document.getElementById('addTimetableModal');
    if (modal) modal.style.display = 'flex';
}

function closeAddTimetableModal() {
    const modal = document.getElementById('addTimetableModal');
    if (modal) modal.style.display = 'none';
    const form = document.getElementById('timetableForm');
    if (form) form.reset();
}

async function submitTimetableEntry(e) {
    e.preventDefault();
    const btn = document.getElementById('btnTimetableSubmit');
    if (btn) {
        btn.innerText = "Adding...";
        btn.disabled = true;
    }

    const payload = {
        faculty: document.getElementById('ttFaculty').value.trim(),
        subject: document.getElementById('ttSubject').value.trim(),
        room: document.getElementById('ttRoom').value,
        time_slot: document.getElementById('ttTimeSlot').value.trim(),
        expected_strength: parseInt(document.getElementById('ttExpected').value, 10)
    };

    try {
        const res = await fetch('/api/timetable/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Failed to add timetable entry");
        alert("Lecture added to timetable successfully.");
        closeAddTimetableModal();
        fetchTimetableData();
    } catch (err) {
        alert("Error adding lecture: " + err.message);
    } finally {
        if (btn) {
            btn.innerText = "ADD LECTURE";
            btn.disabled = false;
        }
    }
}

async function deleteTimetableEntry(ttId) {
    if (!confirm(`Are you sure you want to remove lecture ${ttId}?`)) return;

    try {
        const res = await fetch(`/api/timetable/delete/${encodeURIComponent(ttId)}`, {
            method: 'POST'
        });
        if (res.ok) {
            fetchTimetableData();
        } else {
            alert("Failed to delete timetable entry.");
        }
    } catch (err) {
        alert("Error deleting lecture: " + err.message);
    }
}

// =====================================================================
// 9. CAMPUS ALERTS SECTION
// =====================================================================
async function fetchAlertsData() {
    try {
        const res = await fetch('/api/alerts');
        if (res.ok) {
            globalAlertsData = await res.json();
            renderAlertsFeed(globalAlertsData);
        }
    } catch (e) {
        console.warn("Alerts fetch error:", e);
    }
}

function renderAlertsFeed(alerts) {
    const feed = document.getElementById('alertsFeedContainer');
    if (!feed) return;

    if (!alerts || alerts.length === 0) {
        feed.innerHTML = `
            <div class="elegant-empty-state">
                <div class="empty-icon text-green">✅</div>
                <div class="empty-title">ALL CAMPUS ZONES CLEAR</div>
                <div class="empty-desc">No overcrowding, schedule discrepancies, or corridor hazards detected.</div>
            </div>
        `;
        return;
    }

    feed.innerHTML = alerts.map(a => `
        <div class="alert-feed-item severity-${a.severity}" onclick="viewAlertDetails('${a.id}')">
            <div class="alert-item-left">
                <div class="alert-item-title">${a.title}</div>
                <div class="alert-item-msg">${a.message}</div>
                <div class="alert-item-meta">
                    <span>ZONE: <strong>${a.zone}</strong></span>
                    <span>DETECTED: <strong>${a.timestamp}</strong></span>
                    <span>SEVERITY: <strong class="${a.severity === 'HIGH' ? 'text-red' : 'text-amber'}">${a.severity}</strong></span>
                </div>
            </div>
            <div class="alert-item-actions">
                <button class="btn-xs btn-danger" onclick="event.stopPropagation(); dismissAlert('${a.id}')">DISMISS</button>
            </div>
        </div>
    `).join('');
}

function viewAlertDetails(alertId) {
    const alertItem = globalAlertsData.find(a => a.id === alertId);
    if (!alertItem) return;

    const bodyHtml = `
        <div class="alert-modal-details">
            <div class="info-row"><span class="info-label">ALERT ID</span><span class="info-val">${alertItem.id}</span></div>
            <div class="info-row"><span class="info-label">TITLE</span><span class="info-val">${alertItem.title}</span></div>
            <div class="info-row"><span class="info-label">SEVERITY</span><span class="info-val"><strong class="${alertItem.severity === 'HIGH' ? 'text-red' : 'text-amber'}">${alertItem.severity}</strong></span></div>
            <div class="info-row"><span class="info-label">CAMPUS ZONE</span><span class="info-val">${alertItem.zone}</span></div>
            <div class="info-row"><span class="info-label">TIMESTAMP</span><span class="info-val">${alertItem.timestamp}</span></div>
            
            <div class="mt-4 p-4" style="background: rgba(255,255,255,0.03); border-radius: 6px; border: 1px solid var(--border-color);">
                <h4 style="font-size: 11px; color: var(--text-dim); margin-bottom: 6px;">ANOMALY DESCRIPTION</h4>
                <p style="font-size: 13px; color: #fff; line-height: 1.5;">${alertItem.message}</p>
            </div>
        </div>
    `;

    openUniversalModal({
        title: "Campus Anomaly Details",
        badge: alertItem.severity,
        bodyHtml: bodyHtml,
        footerHtml: `
            <button class="btn-secondary" onclick="closeUniversalModal()">Close</button>
            <button class="btn-danger" onclick="dismissAlert('${alertItem.id}'); closeUniversalModal();">Dismiss Anomaly</button>
        `
    });
}

async function dismissAlert(alertId) {
    try {
        const formData = new FormData();
        formData.append('alert_id', alertId);

        const res = await fetch('/api/alerts/dismiss', {
            method: 'POST',
            body: formData
        });

        if (res.ok) {
            fetchAlertsData();
            fetchDashboardData();
        }
    } catch (err) {
        alert("Error dismissing alert: " + err.message);
    }
}

// =====================================================================
// 10. STUDENTS DIRECTORY & MANAGEMENT
// =====================================================================
function openAddStudentModal() {
    const modal = document.getElementById('addStudentModal');
    if (modal) modal.style.display = 'flex';
}

function closeAddStudentModal() {
    const modal = document.getElementById('addStudentModal');
    if (modal) modal.style.display = 'none';
    const form = document.getElementById('enrollmentForm');
    if (form) form.reset();
}

async function submitEnrollment(e) {
    e.preventDefault();
    const btn = document.getElementById('btnEnrollSubmit');
    const originalText = btn.innerText;
    btn.innerText = "Enrolling Face...";
    btn.disabled = true;

    try {
        const formData = new FormData();
        formData.append('name', document.getElementById('studentName').value.trim());
        formData.append('student_id', document.getElementById('studentId').value.trim());
        formData.append('photo', document.getElementById('studentPhoto').files[0]);

        const res = await fetch('/api/students', { method: 'POST', body: formData });
        const data = await res.json();

        if (res.ok) {
            alert("STUDENT ENROLLED SUCCESSFULLY WITH FACENET EMBEDDING!");
            closeAddStudentModal();
            fetchStudents();
            fetchAttendancePortalData();
        } else {
            alert(data.detail || "Error enrolling student photo.");
        }
    } catch (err) {
        alert("An error occurred during enrollment: " + err.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

function openEditStudentModal(studentId, currentName) {
    document.getElementById('editStudentIdHidden').value = studentId;
    document.getElementById('editStudentIdDisplay').value = studentId;
    document.getElementById('editStudentName').value = currentName;
    const modal = document.getElementById('editStudentModal');
    if (modal) modal.style.display = 'flex';
}

function closeEditStudentModal() {
    const modal = document.getElementById('editStudentModal');
    if (modal) modal.style.display = 'none';
    const form = document.getElementById('editStudentForm');
    if (form) form.reset();
}

async function submitStudentEdit(e) {
    e.preventDefault();
    const btn = document.getElementById('btnEditStudentSubmit');
    if (btn) {
        btn.innerText = "Saving...";
        btn.disabled = true;
    }

    const studentId = document.getElementById('editStudentIdHidden').value;
    const newName = document.getElementById('editStudentName').value.trim();

    try {
        const res = await fetch(`/api/students/${encodeURIComponent(studentId)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName })
        });

        if (res.ok) {
            alert("Student details updated successfully.");
            closeEditStudentModal();
            fetchStudents();
            fetchAttendancePortalData();
        } else {
            alert("Failed to update student.");
        }
    } catch (err) {
        alert("Error saving student changes: " + err.message);
    } finally {
        if (btn) {
            btn.innerText = "SAVE CHANGES";
            btn.disabled = false;
        }
    }
}

function filterStudentsUI() {
    renderStudentsTable();
}

async function fetchStudents() {
    try {
        const res = await fetch('/api/students');
        globalStudentsData = await res.json();
        const badge = document.getElementById('badgeStudentCount');
        if (badge) badge.innerText = `${globalStudentsData.length} Students`;
        const kpi = document.getElementById('kpiEnrolledStudents');
        if (kpi) kpi.innerText = globalStudentsData.length;
        const sideBadge = document.getElementById('sidebarStudentsCount');
        if (sideBadge) sideBadge.innerText = globalStudentsData.length;

        renderStudentsTable();
    } catch (e) {
        console.error("Error fetching students", e);
    }
}

function renderStudentsTable() {
    const tbody = document.getElementById('studentsTableBody');
    if (!tbody) return;

    const searchVal = (document.getElementById('studentsSearchInput')?.value || '').toLowerCase().trim();

    let filtered = globalStudentsData.filter(s => {
        if (searchVal) {
            const matchName = s.name.toLowerCase().includes(searchVal);
            const matchId = s.student_id.toLowerCase().includes(searchVal);
            if (!matchName && !matchId) return false;
        }
        return true;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-dim); padding: 2rem;">No enrolled students found. Click '+ ENROLL NEW STUDENT'</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(s => `
        <tr>
            <td><div class="det-avatar" style="width:30px;height:30px;font-size:0.8rem;">${s.name.charAt(0)}</div></td>
            <td><strong>${s.name}</strong></td>
            <td style="color: var(--accent-cyan); font-family: monospace;">${s.student_id}</td>
            <td style="font-size: 11px; color: var(--text-dim);">${s.created_at || 'Registered'}</td>
            <td><span class="status-pill status-normal">Biometric Active</span></td>
            <td>
                <button class="btn-xs btn-outline" onclick="openEditStudentModal('${s.student_id}', '${escapeQuotes(s.name)}')">Edit</button>
                <button class="btn-xs btn-danger" onclick="deleteStudent('${s.student_id}')">Delete</button>
            </td>
        </tr>
    `).join('');
}

async function deleteStudent(studentId) {
    if (!confirm(`Are you sure you want to delete student ID ${studentId}?`)) return;
    try {
        const res = await fetch(`/api/students/${encodeURIComponent(studentId)}`, { method: 'DELETE' });
        if (res.ok) {
            fetchStudents();
            fetchAttendancePortalData();
        } else {
            alert("Failed to delete student.");
        }
    } catch (e) {
        alert("Error deleting student: " + e.message);
    }
}

// =====================================================================
// 11. HISTORICAL AUDIT REPORTS & CSV EXPORT
// =====================================================================
async function fetchOccupancyLogs() {
    const tbody = document.getElementById('reportsLogsBody');
    if (!tbody) return;

    try {
        const res = await fetch('/api/reports/logs');
        if (!res.ok) throw new Error("Failed to load logs");
        globalOccupancyLogsData = await res.json();
        renderReportsLogsTable();
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center p-4 text-red">Failed to load logs: ${err.message}</td></tr>`;
    }
}

function filterReportsLogsUI() {
    renderReportsLogsTable();
}

function renderReportsLogsTable() {
    const tbody = document.getElementById('reportsLogsBody');
    if (!tbody) return;

    const searchVal = (document.getElementById('reportsSearchInput')?.value || '').toLowerCase().trim();

    let filtered = globalOccupancyLogsData.filter(l => {
        if (searchVal) {
            const matchRoom = (l.room || '').toLowerCase().includes(searchVal);
            const matchFaculty = (l.faculty || '').toLowerCase().includes(searchVal);
            const matchSubject = (l.subject || '').toLowerCase().includes(searchVal);
            const matchStatus = (l.status || '').toLowerCase().includes(searchVal);
            if (!matchRoom && !matchFaculty && !matchSubject && !matchStatus) return false;
        }
        return true;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center p-4 text-dim">No historical logs matching query.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(l => {
        const pct = l.capacity > 0 ? Math.round((l.persons / l.capacity) * 100) : 0;
        return `
        <tr>
            <td style="font-family: monospace; font-size: 11px;">${l.timestamp}</td>
            <td><strong class="text-cyan">${l.room}</strong></td>
            <td>${l.persons} Students</td>
            <td>${l.capacity} Seats</td>
            <td>${pct}%</td>
            <td><span class="status-pill status-${(l.status || 'normal').toLowerCase()}">${l.status || 'Normal'}</span></td>
            <td>${l.faculty || 'Unassigned'}</td>
            <td>${l.subject || 'General'}</td>
        </tr>
        `;
    }).join('');
}

function exportAttendanceCSV() {
    window.location.href = '/api/reports/export-csv';
}

// =====================================================================
// 12. USER PROFILE & SYSTEM DIAGNOSTICS
// =====================================================================
async function fetchUserProfile() {
    try {
        const res = await fetch('/api/user/profile');
        if (res.ok) {
            const data = await res.json();
            if (data.authenticated && data.user) {
                const user = data.user;
                const nameLabel = document.getElementById('userNameLabel');
                const roleLabel = document.getElementById('userRoleLabel');
                const avatarChar = document.getElementById('userAvatarChar');

                if (nameLabel) nameLabel.innerText = user.name;
                if (roleLabel) roleLabel.innerText = user.role.toUpperCase();
                if (avatarChar && user.name) avatarChar.innerText = user.name.charAt(0);
            }
        }
    } catch (e) {
        console.warn("User profile fetch error:", e);
    }
}

async function fetchSystemDiagnostics() {
    try {
        const res = await fetch('/api/system/diagnostics');
        if (res.ok) {
            const d = await res.json();
            const diagStatus = document.getElementById('diagStatus');
            const diagCamMsg = document.getElementById('diagCamMsg');
            const diagFacesCount = document.getElementById('diagFacesCount');
            const diagDbTables = document.getElementById('diagDbTables');
            const diagPlatform = document.getElementById('diagPlatform');

            if (diagStatus) diagStatus.innerText = d.status.toUpperCase();
            if (diagCamMsg) diagCamMsg.innerText = d.camera_status_msg;
            if (diagFacesCount) diagFacesCount.innerText = `${d.known_faces_count} Faces Indexed`;
            if (diagDbTables && d.db_stats) {
                const totalRows = Object.values(d.db_stats).reduce((a, b) => a + b, 0);
                diagDbTables.innerText = `Connected (${totalRows} Records in 8 Tables)`;
            }
            if (diagPlatform) diagPlatform.innerText = `${d.platform} (Python ${d.python_version})`;
        }
    } catch (e) {
        console.warn("Diagnostics fetch error:", e);
    }
}

// =====================================================================
// 13. HARDWARE & BROWSER CAMERA CONTROLS
// =====================================================================
async function startCamera() {
    const btnStart = document.getElementById("btnStartCamera");
    if (btnStart) btnStart.innerText = "◌ Starting...";
    try {
        const res = await fetch('/api/camera/start', { method: 'POST' });
        const data = await res.json();
        if (!data.success) {
            alert("Hardware Camera Notice: " + data.message + "\nYou can also click 'Use Browser Webcam' to stream directly.");
        }
    } catch (e) {
        alert("Unable to reach backend camera engine.");
    } finally {
        if (btnStart) btnStart.innerText = "▶ START CAMERA";
        fetchDashboardData(true);
    }
}

async function stopCamera() {
    if (browserCameraStream) {
        stopBrowserCamera();
    }

    const btnStop = document.getElementById("btnStopCamera");
    if (btnStop) btnStop.innerText = "◌ Stopping...";
    try {
        await fetch('/api/camera/stop', { method: 'POST' });
    } catch (e) {
        console.error("Camera stop request failed.");
    } finally {
        if (btnStop) btnStop.innerText = "■ STOP CAMERA";
        fetchDashboardData(true);
    }
}

function reloadCameraStream() {
    const img1 = document.getElementById('cctvStreamImg');
    const img2 = document.getElementById('cctvExpandedStreamImg');
    const ts = new Date().getTime();
    if (img1) img1.src = `/video_feed?t=${ts}`;
    if (img2) img2.src = `/video_feed?t=${ts}`;
}

async function startBrowserCamera() {
    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert("Browser camera access is not supported on this browser.");
            return;
        }

        browserCameraStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
            audio: false
        });

        // Attach video element to containers
        attachWebcamVideo("mainVideoContainer");
        attachWebcamVideo("cameraExpandedContainer");

        if (browserCameraInterval) clearInterval(browserCameraInterval);
        browserCameraInterval = setInterval(sendBrowserCameraFrame, 500);
        sendBrowserCameraFrame();

        updateCameraUI({ is_running: true });

    } catch (error) {
        console.error("Browser camera error:", error);
        alert("Could not access browser camera: " + error.message);
    }
}

function attachWebcamVideo(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const placeholder = container.querySelector('.elegant-empty-state');
    const img = container.querySelector('img');
    if (placeholder) placeholder.style.display = 'none';
    if (img) img.style.display = 'none';

    let video = container.querySelector('video.browser-camera-elem');
    if (!video) {
        video = document.createElement('video');
        video.className = 'browser-camera-elem';
        video.autoplay = true;
        video.playsInline = true;
        video.muted = true;
        video.style.width = "100%";
        video.style.height = "100%";
        video.style.objectFit = "cover";
        video.style.display = "block";
        video.style.background = "#05070b";
        container.appendChild(video);
    }

    video.srcObject = browserCameraStream;
    video.play();
}

async function sendBrowserCameraFrame() {
    const video = document.querySelector('video.browser-camera-elem');
    if (!video || !browserCameraStream || video.readyState < 2 || video.videoWidth === 0) return;

    const canvas = document.createElement("canvas");
    const maxWidth = 960;
    const scale = Math.min(1, maxWidth / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(async function(blob) {
        if (!blob) return;
        const formData = new FormData();
        formData.append("file", blob, "camera.jpg");

        try {
            await fetch("/camera/frame", { method: "POST", body: formData });
        } catch (error) {
            console.warn("Camera frame upload error:", error);
        }
    }, "image/jpeg", 0.70);
}

function stopBrowserCamera() {
    if (browserCameraInterval) {
        clearInterval(browserCameraInterval);
        browserCameraInterval = null;
    }

    if (browserCameraStream) {
        browserCameraStream.getTracks().forEach(track => track.stop());
        browserCameraStream = null;
    }

    document.querySelectorAll('video.browser-camera-elem').forEach(v => {
        v.srcObject = null;
        v.remove();
    });

    updateCameraUI({ is_running: false });
}

function toggleFullscreen(elementId) {
    const elem = document.getElementById(elementId) || document.documentElement;
    if (!document.fullscreenElement) {
        if (elem.requestFullscreen) elem.requestFullscreen();
        else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
        else if (elem.msRequestFullscreen) elem.msRequestFullscreen();
    } else {
        if (document.exitFullscreen) document.exitFullscreen();
    }
}

// =====================================================================
// 14. ACCESSIBILITY & HELPERS
// =====================================================================
function setupKeyboardInteractions() {
    document.querySelectorAll('.clickable, [role="button"]').forEach(el => {
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                el.click();
            }
        });
    });
}

function escapeQuotes(str) {
    if (!str) return '';
    return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function openAddRoomModal() {
    openUniversalModal({
        title: "Add New Room Schedule",
        badge: "SCHEDULE",
        bodyHtml: `
            <form id="newRoomScheduleForm" onsubmit="event.preventDefault(); alert('Please use Faculty Timetable section to schedule new room periods.'); closeUniversalModal(); navigateToSection('timetable');">
                <p class="text-muted mb-4">Classrooms are automatically monitored via CCTV. To allocate or schedule periods, add an entry in the Faculty Timetable.</p>
                <div class="form-actions mt-6" style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button type="button" class="btn-secondary" onclick="closeUniversalModal()">Cancel</button>
                    <button type="submit" class="btn-primary">Go to Timetable Scheduler</button>
                </div>
            </form>
        `
    });
}

// =====================================================================
// 15. LIVE CAMPUS: DIGITAL TWIN, SMART HEATMAP & EMERGENCY MODE
// =====================================================================

function updateCampusTwinAndLiveHub(twinData) {
    if (!twinData) return;

    // 1. Sync Emergency Mode state
    isEmergencyModeActive = Boolean(twinData.emergency_mode);
    const emergCTA = document.getElementById('btnActivateEmergencyCTA');
    const exitCTA = document.getElementById('btnExitEmergencyCTA');
    const sidebarBadge = document.getElementById('sidebarEmergencyBadge');

    if (isEmergencyModeActive) {
        if (emergCTA) emergCTA.style.display = 'none';
        if (exitCTA) exitCTA.style.display = 'inline-flex';
        if (sidebarBadge) sidebarBadge.style.display = 'inline-block';
        document.body.classList.add('emergency-alarm-active');
    } else {
        if (emergCTA) emergCTA.style.display = 'inline-flex';
        if (exitCTA) exitCTA.style.display = 'none';
        if (sidebarBadge) sidebarBadge.style.display = 'none';
        document.body.classList.remove('emergency-alarm-active');
    }

    // 2. Update Quick Status Pills
    const rooms = twinData.rooms || [];
    const corridors = twinData.corridors || [];

    rooms.forEach(r => {
        const elCount = document.getElementById(`pillCount-${r.room}`);
        const pill = document.getElementById(`pill-${r.room}`);
        if (elCount) elCount.innerText = `${r.persons}/${r.capacity}`;
        if (pill) {
            const dot = pill.querySelector('.qdot');
            if (dot) {
                dot.className = 'qdot ' + (r.occupancy_rate > 90 ? 'qred' : (r.occupancy_rate > 60 ? 'qamber' : 'qgreen'));
            }
        }
    });

    const totalCorr = corridors.reduce((acc, c) => acc + (c.count || 0), 0);
    const elCorr = document.getElementById('pillCount-Corridor');
    const pillCorr = document.getElementById('pill-Corridor');
    if (elCorr) elCorr.innerText = `${totalCorr} Ppl`;
    if (pillCorr) {
        const dot = pillCorr.querySelector('.qdot');
        if (dot) {
            dot.className = 'qdot ' + (totalCorr > 45 ? 'qred' : (totalCorr > 25 ? 'qamber' : 'qgreen'));
        }
    }

    // 3. Update 3D Digital Twin
    if (window.CampusTwin && typeof window.CampusTwin.update === 'function') {
        window.CampusTwin.update(twinData);
        window.CampusTwin.setEmergency(isEmergencyModeActive);
    }

    // 4. Update Smart Heatmap
    renderSmartHeatmap(twinData);

    // 5. Update Emergency Dashboard if open
    if (isEmergencyModeActive || currentLiveCampusView === 'emergency') {
        renderEmergencyDashboard(twinData);
    }
}

function switchLiveCampusView(viewType) {
    currentLiveCampusView = viewType;

    const btnTwin = document.getElementById('tabBtnDigitalTwin');
    const btnHeatmap = document.getElementById('tabBtnHeatmap');
    const btnEmergency = document.getElementById('tabBtnEmergency');

    const viewTwin = document.getElementById('view-digital-twin');
    const viewHeatmap = document.getElementById('view-smart-heatmap');
    const viewEmergency = document.getElementById('view-emergency-mode');
    const modeBadge = document.getElementById('liveCampusModeBadge');

    [btnTwin, btnHeatmap, btnEmergency].forEach(b => { if (b) b.classList.remove('active'); });
    if (viewTwin) viewTwin.style.display = 'none';
    if (viewHeatmap) viewHeatmap.style.display = 'none';
    if (viewEmergency) viewEmergency.style.display = 'none';

    if (viewType === 'twin') {
        if (btnTwin) btnTwin.classList.add('active');
        if (viewTwin) viewTwin.style.display = 'block';
        if (modeBadge) {
            modeBadge.innerText = '● 3D TWIN ACTIVE';
            modeBadge.className = 'live-beacon-tag';
        }
        if (window.CampusTwin && typeof window.CampusTwin.init === 'function') {
            window.CampusTwin.init();
            if (globalDigitalTwinData) window.CampusTwin.update(globalDigitalTwinData);
        }
    } else if (viewType === 'heatmap') {
        if (btnHeatmap) btnHeatmap.classList.add('active');
        if (viewHeatmap) viewHeatmap.style.display = 'block';
        if (modeBadge) {
            modeBadge.innerText = '● HEATMAP ACTIVE';
            modeBadge.className = 'live-beacon-tag badge-cyan';
        }
        if (globalDigitalTwinData) renderSmartHeatmap(globalDigitalTwinData);
    } else if (viewType === 'emergency') {
        if (btnEmergency) btnEmergency.classList.add('active');
        if (viewEmergency) viewEmergency.style.display = 'block';
        if (modeBadge) {
            modeBadge.innerText = '🚨 EMERGENCY AWARENESS';
            modeBadge.className = 'live-beacon-tag badge-danger';
        }
        if (globalDigitalTwinData) renderEmergencyDashboard(globalDigitalTwinData);
    }
}

function focusTwinRoom(roomKey) {
    switchLiveCampusView('twin');
    if (window.CampusTwin && typeof window.CampusTwin.focusOnRoom === 'function') {
        window.CampusTwin.focusOnRoom(roomKey);
    }
}

// =====================================================================
// 16. SMART CAMPUS HEATMAP ENGINE
// =====================================================================
function renderSmartHeatmap(twinData) {
    const container = document.getElementById('heatmapZonesContainer');
    if (!container || !twinData) return;

    const rooms = twinData.rooms || [];
    const corridors = twinData.corridors || [];
    const camRegistry = twinData.camera_registry || {};

    let html = '';

    // Classrooms Section
    html += `<div class="heatmap-section-title">ACADEMIC &amp; LECTURE BLOCKS</div>`;
    html += `<div class="heatmap-cards-grid">`;

    rooms.forEach(r => {
        const cam = camRegistry[r.room] || { camera_id: 'CCTV', status: 'ONLINE' };
        const isOffline = cam.status === 'OFFLINE';
        const pct = r.occupancy_rate;
        let tierClass = 'heat-low';
        let tierText = 'LOW';

        if (isOffline) {
            tierClass = 'heat-offline';
            tierText = 'CAM OFFLINE';
        } else if (pct > 100) {
            tierClass = 'heat-over';
            tierText = 'OVERCAPACITY';
        } else if (pct > 75) {
            tierClass = 'heat-high';
            tierText = 'HIGH';
        } else if (pct > 40) {
            tierClass = 'heat-med';
            tierText = 'MEDIUM';
        }

        html += `
        <div class="heatmap-zone-card ${tierClass}" onclick="viewClassroomDetails('${r.room}')" title="Click to inspect ${r.room} telemetry">
            <div class="heat-card-header">
                <div class="heat-zone-name">${r.room}</div>
                <span class="heat-tier-badge">${tierText}</span>
            </div>
            <div class="heat-card-meta">${r.building} &bull; ${r.floor}</div>
            <div class="heat-metrics-row">
                <div class="heat-val-box">
                    <span class="heat-num">${r.persons}</span>
                    <span class="heat-sub">/ ${r.capacity} Seats</span>
                </div>
                <div class="heat-val-pct">${pct}%</div>
            </div>
            <div class="heat-bar-wrap">
                <div class="heat-bar-fill" style="width: ${Math.min(pct, 100)}%;"></div>
            </div>
            <div class="heat-footer-strip">
                <span>📹 ${cam.camera_id} &bull; ${cam.status}</span>
                <span class="heat-action-arrow">Inspect →</span>
            </div>
        </div>
        `;
    });
    html += `</div>`;

    // Corridors & Pathways Section
    html += `<div class="heatmap-section-title mt-4">CORRIDORS &amp; ARTERIAL PATHWAYS</div>`;
    html += `<div class="heatmap-cards-grid">`;

    corridors.forEach(c => {
        const cam = camRegistry[c.id] || { camera_id: 'Sensor', status: 'ONLINE' };
        const isOffline = cam.status === 'OFFLINE';
        const pct = c.occupancy_rate;
        let tierClass = 'heat-low';
        let tierText = 'LOW';

        if (isOffline) {
            tierClass = 'heat-offline';
            tierText = 'CAM OFFLINE';
        } else if (pct > 100) {
            tierClass = 'heat-over';
            tierText = 'OVERCAPACITY';
        } else if (pct > 75) {
            tierClass = 'heat-high';
            tierText = 'HIGH';
        } else if (pct > 40) {
            tierClass = 'heat-med';
            tierText = 'MEDIUM';
        }

        html += `
        <div class="heatmap-zone-card ${tierClass}" onclick="focusTwinRoom('${c.id}')" title="Inspect corridor flow">
            <div class="heat-card-header">
                <div class="heat-zone-name">${c.name}</div>
                <span class="heat-tier-badge">${tierText}</span>
            </div>
            <div class="heat-card-meta">Zone: ${c.zone} &bull; Safety Limit: ${c.threshold}</div>
            <div class="heat-metrics-row">
                <div class="heat-val-box">
                    <span class="heat-num">${c.count}</span>
                    <span class="heat-sub">People Monitored</span>
                </div>
                <div class="heat-val-pct">${pct}%</div>
            </div>
            <div class="heat-bar-wrap">
                <div class="heat-bar-fill" style="width: ${Math.min(pct, 100)}%;"></div>
            </div>
            <div class="heat-footer-strip">
                <span>📹 ${cam.camera_id} &bull; ${cam.status}</span>
                <span class="heat-action-arrow">Flow →</span>
            </div>
        </div>
        `;
    });
    html += `</div>`;

    container.innerHTML = html;
}

// =====================================================================
// 17. SMART CAMPUS INSIGHTS ENGINE
// =====================================================================
function renderCampusInsights(insights) {
    const container = document.getElementById('campusInsightsList');
    const badge = document.getElementById('insightsCountBadge');
    if (!container) return;

    if (!insights || insights.length === 0) {
        container.innerHTML = `
            <div class="insight-pill-card neutral">
                <span class="in-icon">✅</span>
                <div class="in-body">
                    <strong>All Monitored Zones Normal</strong>
                    <span>Occupancy levels align with capacities and scheduled faculty lectures.</span>
                </div>
            </div>
        `;
        if (badge) badge.innerText = "All Clear";
        return;
    }

    if (badge) badge.innerText = `${insights.length} Active Observations`;

    let html = '';
    insights.forEach(ins => {
        let cardClass = 'neutral';
        let icon = '💡';

        if (ins.severity === 'HIGH') {
            cardClass = 'hazard';
            icon = '🚨';
        } else if (ins.severity === 'WARNING') {
            cardClass = 'warning';
            icon = '⚠️';
        } else if (ins.type === 'camera') {
            cardClass = 'camera';
            icon = '📹';
        }

        html += `
        <div class="insight-pill-card ${cardClass}" onclick="focusTwinRoom('${ins.zone}')" title="Click to view ${ins.zone}">
            <span class="in-icon">${icon}</span>
            <div class="in-body">
                <div class="in-title-row">
                    <strong>${ins.title}</strong>
                    <span class="in-time">${ins.timestamp || ''}</span>
                </div>
                <div class="in-text">${ins.message}</div>
            </div>
        </div>
        `;
    });

    container.innerHTML = html;
}

// =====================================================================
// 18. EMERGENCY / EVACUATION MODE CONTROLLER
// =====================================================================
function promptActivateEmergency() {
    const modal = document.getElementById('activateEmergencyModal');
    if (modal) modal.style.display = 'flex';
}

function closeActivateEmergencyModal() {
    const modal = document.getElementById('activateEmergencyModal');
    if (modal) modal.style.display = 'none';
}

async function executeActivateEmergency() {
    closeActivateEmergencyModal();
    try {
        const res = await fetch('/api/emergency/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ active: true, reason: 'Manual Operator Activation' })
        });
        if (res.ok) {
            isEmergencyModeActive = true;
            switchLiveCampusView('emergency');
            fetchDashboardData(true);
        }
    } catch (e) {
        console.error("Emergency activation error:", e);
    }
}

function promptExitEmergency() {
    const modal = document.getElementById('exitEmergencyModal');
    if (modal) modal.style.display = 'flex';
}

function closeExitEmergencyModal() {
    const modal = document.getElementById('exitEmergencyModal');
    if (modal) modal.style.display = 'none';
}

async function executeExitEmergency() {
    closeExitEmergencyModal();
    try {
        const res = await fetch('/api/emergency/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ active: false })
        });
        if (res.ok) {
            isEmergencyModeActive = false;
            switchLiveCampusView('twin');
            fetchDashboardData(true);
        }
    } catch (e) {
        console.error("Emergency exit error:", e);
    }
}

function renderEmergencyDashboard(twinData) {
    if (!twinData) return;

    // Metrics
    const elTot = document.getElementById('emergTotalOccupancy');
    const elKnown = document.getElementById('emergKnownPeople');
    const elUnk = document.getElementById('emergUnidentifiedPeople');
    const elCam = document.getElementById('emergActiveCameras');

    if (elTot) elTot.innerText = twinData.metrics?.total_occupancy ?? 0;
    if (elKnown) elKnown.innerText = twinData.metrics?.known_detected_people ?? 0;
    if (elUnk) elUnk.innerText = twinData.metrics?.unresolved_detections ?? 0;
    if (elCam) elCam.innerText = twinData.metrics?.active_cameras ?? "24 / 25";

    // Location Occupancy List
    const locList = document.getElementById('emergLocationOccupancyList');
    if (locList) {
        const rooms = twinData.rooms || [];
        const corridors = twinData.corridors || [];
        let locHtml = '<div class="emerg-location-grid">';

        rooms.forEach(r => {
            let tierDot = r.density_tier === 'HIGH' || r.density_tier === 'OVERCAPACITY' ? '🔴' : (r.density_tier === 'MEDIUM' ? '🟡' : '🟢');
            locHtml += `
            <div class="emerg-loc-card" onclick="viewClassroomDetails('${r.room}')">
                <div class="el-left">${tierDot} <strong>${r.room}</strong> <span class="text-dim">(${r.building})</span></div>
                <div class="el-right"><strong class="text-large">${r.persons}</strong> / ${r.capacity} (${r.occupancy_rate}%)</div>
            </div>`;
        });

        corridors.forEach(c => {
            let tierDot = c.density_tier === 'HIGH' || c.density_tier === 'OVERCAPACITY' ? '🔴' : (c.density_tier === 'MEDIUM' ? '🟡' : '🟢');
            locHtml += `
            <div class="emerg-loc-card" onclick="focusTwinRoom('${c.id}')">
                <div class="el-left">${tierDot} <strong>${c.name}</strong></div>
                <div class="el-right"><strong class="text-large">${c.count}</strong> Ppl (Limit: ${c.threshold})</div>
            </div>`;
        });

        locHtml += '</div>';
        locList.innerHTML = locHtml;
    }

    // Evacuation Routes List
    const routeList = document.getElementById('emergEvacuationRoutesList');
    if (routeList) {
        const routes = twinData.evacuation_routes || [];
        let rHtml = '<div class="emerg-routes-list">';
        routes.forEach(rt => {
            rHtml += `
            <div class="emerg-route-card">
                <div class="route-header">
                    <span class="route-zone">📍 ${rt.zone} &bull; ${rt.building}</span>
                    <span class="route-status-tag ${rt.status.includes('Clear') ? 'tag-clear' : 'tag-caution'}">${rt.status}</span>
                </div>
                <div class="route-exit"><strong>Primary Exit:</strong> ${rt.primary_exit} (Alt: ${rt.secondary_exit})</div>
                <div class="route-desc">➡️ ${rt.route_desc}</div>
            </div>`;
        });
        rHtml += '</div>';
        routeList.innerHTML = rHtml;
    }

    // Last Known Locations Table
    const lastKnownBody = document.getElementById('emergLastKnownBody');
    if (lastKnownBody) {
        const locs = twinData.last_known_locations || [];
        if (locs.length === 0) {
            lastKnownBody.innerHTML = `<tr><td colspan="5" class="text-center p-4">No recent detections in active zone.</td></tr>`;
        } else {
            lastKnownBody.innerHTML = locs.map(l => {
                const isUnknown = l.status === 'Unidentified';
                return `
                <tr>
                    <td><strong>${l.name}</strong> <span class="text-dim">(${l.person_id})</span></td>
                    <td><span class="zone-badge">${l.last_location}</span></td>
                    <td>${l.last_time}</td>
                    <td>${l.camera}</td>
                    <td><span class="status-pill ${isUnknown ? 'status-warning' : 'status-normal'}">${l.status}</span></td>
                </tr>`;
            }).join('');
        }
    }

    // Camera Health List
    const camHealthList = document.getElementById('emergCameraHealthList');
    if (camHealthList) {
        const reg = twinData.camera_registry || {};
        let cHtml = '<div class="cam-health-grid">';
        for (const [zone, cam] of Object.entries(reg)) {
            const isOff = cam.status === 'OFFLINE';
            cHtml += `
            <div class="cam-health-item ${isOff ? 'cam-offline' : 'cam-online'}">
                <div class="ch-left">
                    <span class="ch-dot">${isOff ? '⚫' : '🟢'}</span>
                    <div>
                        <div class="ch-id"><strong>${cam.camera_id}</strong> &bull; Zone ${zone}</div>
                        <div class="ch-type text-dim">${cam.type}</div>
                    </div>
                </div>
                <div class="ch-status ${isOff ? 'text-red' : 'text-green'}"><strong>${cam.status}</strong></div>
            </div>`;
        }
        cHtml += '</div>';
        camHealthList.innerHTML = cHtml;
    }
}

// =====================================================================
// 19. TECHEXPO SAFE DEMO MODE SIMULATOR
// =====================================================================
function openDemoModeModal() {
    const modal = document.getElementById('demoModeModal');
    if (modal) modal.style.display = 'flex';
}

function closeDemoModeModal() {
    const modal = document.getElementById('demoModeModal');
    if (modal) modal.style.display = 'none';
}

function applyDemoScenario(scenario) {
    isDemoModeActive = true;
    updateDemoModeUI();

    if (scenario === 'normal') {
        demoOverrides.rooms["A-101"] = 42;
        demoOverrides.rooms["A-102"] = 31;
        demoOverrides.rooms["B-201"] = 0;
        demoOverrides.rooms["AI-Lab"] = 36;
        demoOverrides.rooms["Auditorium"] = 115;
        demoOverrides.corridors["C-1"] = 18;
        demoOverrides.corridors["C-2"] = 22;
        demoOverrides.cameraOffline = "C-2";
        if (isEmergencyModeActive) executeExitEmergency();
    } else if (scenario === 'surge_a101') {
        demoOverrides.rooms["A-101"] = 72; // Overcapacity (Cap: 60)
        demoOverrides.rooms["A-102"] = 45;
        demoOverrides.corridors["C-1"] = 25;
        switchLiveCampusView('twin');
        focusTwinRoom('A-101');
    } else if (scenario === 'corridor_congestion') {
        demoOverrides.rooms["A-101"] = 20;
        demoOverrides.corridors["C-1"] = 48; // Limit: 30
        demoOverrides.corridors["C-2"] = 52; // Limit: 35
        switchLiveCampusView('heatmap');
    } else if (scenario === 'cam_offline') {
        demoOverrides.cameraOffline = "C-2";
        switchLiveCampusView('twin');
        focusTwinRoom('C-2');
    } else if (scenario === 'emergency_evac') {
        demoOverrides.rooms["A-101"] = 58;
        demoOverrides.corridors["C-1"] = 42;
        executeActivateEmergency();
    }

    // Sync sliders
    syncDemoSliders();
    fetchDashboardData(true);
}

function onDemoSliderChange(zone, val) {
    isDemoModeActive = true;
    updateDemoModeUI();

    const num = parseInt(val, 10);
    if (zone.startsWith('A-') || zone.startsWith('B-') || zone === 'AI-Lab' || zone === 'Auditorium') {
        demoOverrides.rooms[zone] = num;
        const valLabel = document.getElementById(`demoSliderVal_${zone.replace('-', '')}`);
        if (valLabel) valLabel.innerText = `${num} Ppl`;
    } else if (zone.startsWith('C-')) {
        demoOverrides.corridors[zone] = num;
        const valLabel = document.getElementById(`demoSliderVal_${zone.replace('-', '')}`);
        if (valLabel) valLabel.innerText = `${num} Ppl`;
    }

    fetchDashboardData(true);
}

function disableDemoMode() {
    isDemoModeActive = false;
    updateDemoModeUI();
    closeDemoModeModal();
    fetchDashboardData(true);
}

function updateDemoModeUI() {
    const btnLabel = document.getElementById('demoModeBtnLabel');
    const badge = document.getElementById('demoActiveStatusBadge');
    if (btnLabel) {
        btnLabel.innerText = isDemoModeActive ? 'DEMO MODE: ON' : 'DEMO MODE';
    }
    if (badge) {
        badge.innerText = isDemoModeActive ? 'DEMO ACTIVE' : 'DEMO STANDBY';
        badge.className = isDemoModeActive ? 'panel-badge badge-warning' : 'panel-badge';
    }
}

function syncDemoSliders() {
    const r1 = document.getElementById('demoRange_A101');
    const r2 = document.getElementById('demoRange_A102');
    const rc = document.getElementById('demoRange_C1');
    const ra = document.getElementById('demoRange_Auditorium');

    if (r1) { r1.value = demoOverrides.rooms["A-101"] || 42; document.getElementById('demoSliderVal_A101').innerText = `${r1.value} Ppl`; }
    if (r2) { r2.value = demoOverrides.rooms["A-102"] || 31; document.getElementById('demoSliderVal_A102').innerText = `${r2.value} Ppl`; }
    if (rc) { rc.value = demoOverrides.corridors["C-1"] || 18; document.getElementById('demoSliderVal_C1').innerText = `${rc.value} Ppl`; }
    if (ra) { ra.value = demoOverrides.rooms["Auditorium"] || 115; document.getElementById('demoSliderVal_Auditorium').innerText = `${ra.value} Ppl`; }
}

function applyDemoOverridesToTwinData(data) {
    if (!data) return data;
    const cloned = JSON.parse(JSON.stringify(data));

    cloned.rooms = cloned.rooms.map(r => {
        if (demoOverrides.rooms[r.room] !== undefined) {
            r.persons = demoOverrides.rooms[r.room];
            r.occupancy_rate = roundPct((r.persons / r.capacity) * 100);
            if (r.persons === 0) r.density_tier = "EMPTY";
            else if (r.occupancy_rate <= 40) r.density_tier = "LOW";
            else if (r.occupancy_rate <= 75) r.density_tier = "MEDIUM";
            else if (r.occupancy_rate <= 100) r.density_tier = "HIGH";
            else r.density_tier = "OVERCAPACITY";
        }
        return r;
    });

    cloned.corridors = cloned.corridors.map(c => {
        if (demoOverrides.corridors[c.id] !== undefined) {
            c.count = demoOverrides.corridors[c.id];
            c.occupancy_rate = roundPct((c.count / c.threshold) * 100);
            if (c.occupancy_rate <= 40) c.density_tier = "LOW";
            else if (c.occupancy_rate <= 75) c.density_tier = "MEDIUM";
            else if (c.occupancy_rate <= 100) c.density_tier = "HIGH";
            else c.density_tier = "OVERCAPACITY";
        }
        return c;
    });

    const totRoom = cloned.rooms.reduce((acc, r) => acc + r.persons, 0);
    const totCorr = cloned.corridors.reduce((acc, c) => acc + c.count, 0);
    cloned.metrics.total_occupancy = totRoom + totCorr;

    return cloned;
}

function generateDemoInsights(baseInsights) {
    if (!isDemoModeActive) return baseInsights;

    const list = [];
    const a101Count = demoOverrides.rooms["A-101"] || 42;
    if (a101Count > 60) {
        list.push({
            type: "hazard",
            severity: "HIGH",
            zone: "A-101",
            title: "Overcapacity Hazard: A-101",
            message: `A-101 currently has ${a101Count} detected people out of a capacity of 60 (${Math.round((a101Count/60)*100)}%).`,
            timestamp: new Date().toLocaleTimeString()
        });
    } else if (a101Count >= 42) {
        list.push({
            type: "density",
            severity: "MEDIUM",
            zone: "A-101",
            title: "High Occupancy Observation: A-101",
            message: `A-101 currently has ${a101Count} detected people out of a capacity of 60.`,
            timestamp: new Date().toLocaleTimeString()
        });
    }

    const c1Count = demoOverrides.corridors["C-1"] || 18;
    if (c1Count >= 30) {
        list.push({
            type: "flow",
            severity: "HIGH",
            zone: "Academic Block A Corridor",
            title: "Corridor Congestion Warning",
            message: `Academic Corridor C-1 currently has high occupancy (${c1Count} persons, limit: 30).`,
            timestamp: new Date().toLocaleTimeString()
        });
    }

    list.push({
        type: "camera",
        severity: "WARNING",
        zone: "C-2",
        title: "Camera Offline: Camera-07",
        message: "Camera-07 (Main Admin Lobby) is offline or unavailable.",
        timestamp: new Date().toLocaleTimeString()
    });

    list.push({
        type: "timetable",
        severity: "NORMAL",
        zone: "A-101",
        title: "Timetable Cross-Check",
        message: "Occupancy is consistent with scheduled class 'CS-601: Computer Vision & AI'.",
        timestamp: new Date().toLocaleTimeString()
    });

    return list;
}

function roundPct(val) {
    return Math.round(val * 10) / 10;
}
