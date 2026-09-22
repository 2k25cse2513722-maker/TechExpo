// PSIT CampusVision AI — Real-time Dashboard Engine

// Update live clock in navbar
function updateClock() {
  const clockEl = document.getElementById("liveClock");
  if (clockEl) {
    const now = new Date();
    clockEl.innerText = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
}
setInterval(updateClock, 1000);
updateClock();

// Fetch and update all dashboard components
async function fetchDashboardData() {
  try {
    // 1. Fetch Campus Summary Stats
    const summaryRes = await fetch('/api/campus-summary');
    if (summaryRes.ok) {
      const summary = await summaryRes.json();
      updateSummaryCards(summary);
    }

    // 2. Fetch Rooms
    const roomsRes = await fetch('/api/rooms');
    if (roomsRes.ok) {
      const rooms = await roomsRes.json();
      updateRoomsGrid(rooms);
    }

    // 3. Fetch Corridors
    const corridorsRes = await fetch('/api/corridors');
    if (corridorsRes.ok) {
      const corridors = await corridorsRes.json();
      updateCorridors(corridors);
    }

    // 4. Fetch Timetable Verification
    const timetableRes = await fetch('/api/timetable');
    if (timetableRes.ok) {
      const timetable = await timetableRes.json();
      updateTimetableTable(timetable);
    }

    // 5. Fetch Camera Status
    const cameraRes = await fetch('/api/camera/status');
    if (cameraRes.ok) {
      const camStatus = await cameraRes.json();
      updateCameraUI(camStatus);
    }

    // 6. Fetch Campus Alerts
    const alertsRes = await fetch('/api/alerts');
    if (alertsRes.ok) {
      const alerts = await alertsRes.json();
      updateAlertsUI(alerts);
    }
  } catch (error) {
    console.warn("Dashboard sync warning:", error);
  }
}

// Update Alerts UI
function updateAlertsUI(alerts) {
  const container = document.getElementById("alertsContainer");
  if (!container) return;

  if (!alerts || alerts.length === 0) {
    container.style.display = "none";
    container.innerHTML = "";
    return;
  }

  container.style.display = "flex";
  container.innerHTML = "";

  alerts.forEach(a => {
    const item = document.createElement("div");
    const isHigh = a.severity === "HIGH";
    item.className = `alert-banner-item ${isHigh ? 'alert-banner-high' : 'alert-banner-warning'}`;

    item.innerHTML = `
      <div class="alert-content-left">
        <span class="alert-tag ${isHigh ? 'alert-tag-high' : 'alert-tag-warning'}">${a.severity}</span>
        <div>
          <strong>${a.title}</strong> &mdash; <span>${a.message}</span>
        </div>
      </div>
      <div>
        <button class="btn-dismiss" onclick="dismissAlert('${a.id}')">Dismiss ✕</button>
      </div>
    `;
    container.appendChild(item);
  });
}

// Dismiss Alert
async function dismissAlert(alertId) {
  try {
    const form = new FormData();
    form.append("alert_id", alertId);
    await fetch('/api/alerts/dismiss', { method: 'POST', body: form });
    fetchDashboardData();
  } catch (e) {
    console.error("Alert dismiss error:", e);
  }
}

// Update Camera Monitor UI
function updateCameraUI(cam) {
  const badge = document.getElementById("cameraStatusBadge");
  const btnStart = document.getElementById("btnStartCamera");
  const btnStop = document.getElementById("btnStopCamera");
  const msg = document.getElementById("cctvStatusMsg");

  if (cam.is_running) {
    if (badge) {
      badge.className = "badge badge-normal";
      badge.innerText = "● CAMERA ACTIVE (YOLOv11)";
    }
    if (btnStart) btnStart.disabled = true;
    if (btnStop) btnStop.disabled = false;
    if (msg) msg.innerText = `● Live detection streaming — ${cam.latest_count} students detected in ${cam.room}`;
  } else {
    if (badge) {
      badge.className = "badge badge-warning";
      badge.innerText = "○ CAMERA STANDBY";
    }
    if (btnStart) btnStart.disabled = false;
    if (btnStop) btnStop.disabled = true;
    if (msg) msg.innerText = cam.status_message || "Camera Standby (Click 'Start AI Camera' to activate)";
  }
}

// Start AI Camera
async function startCamera() {
  const btnStart = document.getElementById("btnStartCamera");
  const msg = document.getElementById("cctvStatusMsg");
  if (btnStart) btnStart.innerText = "⏳ Starting...";
  if (msg) msg.innerText = "Initializing YOLO model and camera hardware...";

  try {
    const res = await fetch('/api/camera/start', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      console.log("Camera started successfully.");
    } else {
      alert("Camera Start: " + data.message);
    }
  } catch (e) {
    console.error("Camera start error:", e);
  } finally {
    if (btnStart) btnStart.innerText = "▶ Start AI Camera";
    fetchDashboardData();
  }
}

// Stop AI Camera
async function stopCamera() {
  const btnStop = document.getElementById("btnStopCamera");
  if (btnStop) btnStop.innerText = "⏳ Stopping...";

  try {
    const res = await fetch('/api/camera/stop', { method: 'POST' });
    const data = await res.json();
    console.log("Camera stopped:", data);
  } catch (e) {
    console.error("Camera stop error:", e);
  } finally {
    if (btnStop) btnStop.innerText = "⏹ Stop Camera";
    fetchDashboardData();
  }
}

// 1. Update Stat Cards
function updateSummaryCards(data) {
  const totalEl = document.getElementById('statTotalPersons');
  const activeEl = document.getElementById('statActiveRooms');
  const emptyEl = document.getElementById('statEmptyRooms');
  const corridorEl = document.getElementById('statCorridorFootfall');

  if (totalEl) totalEl.innerText = data.total_persons_detected ?? 0;
  if (activeEl) activeEl.innerText = data.active_classrooms ?? 0;
  if (emptyEl) emptyEl.innerText = data.empty_classrooms ?? 0;
  if (corridorEl) corridorEl.innerText = data.corridor_total ?? 0;
}

// 2. Update Classrooms Grid
function updateRoomsGrid(rooms) {
  const grid = document.getElementById('roomsGrid');
  if (!grid) return;

  grid.innerHTML = '';

  rooms.forEach(room => {
    const card = document.createElement('div');
    card.className = `room-card ${room.is_live_feed ? 'live-feed-card' : ''}`;

    const percent = Math.min(100, Math.round((room.persons / room.capacity) * 100));
    
    // Determine status badge class
    let badgeClass = 'badge-normal';
    if (room.status === 'Empty') badgeClass = 'badge-empty';
    else if (room.status === 'Full') badgeClass = 'badge-full';
    else if (percent >= 80) badgeClass = 'badge-warning';

    // Determine progress bar fill class
    let fillClass = 'fill-green';
    if (percent >= 90) fillClass = 'fill-red';
    else if (percent >= 65) fillClass = 'fill-amber';

    card.innerHTML = `
      <div class="room-top">
        <span class="room-title">🏫 ${room.room}</span>
        <span class="badge ${badgeClass}">${room.status}</span>
      </div>

      <div class="room-counts">
        <span class="count-big">${room.persons}</span>
        <span class="count-sub">/ ${room.capacity} seats</span>
      </div>

      <div class="progress-bar-bg">
        <div class="progress-bar-fill ${fillClass}" style="width: ${percent}%;"></div>
      </div>

      <div class="room-meta">
        <span>👨‍🏫 ${room.faculty || 'Unassigned'}</span>
        <span>${percent}% Occupied</span>
      </div>
    `;

    grid.appendChild(card);
  });
}

// 3. Update Corridors Section
function updateCorridors(corridors) {
  const container = document.getElementById('corridorList');
  if (!container) return;

  container.innerHTML = '';

  corridors.forEach(c => {
    const item = document.createElement('div');
    item.className = 'corridor-item';

    let badgeClass = 'badge-normal';
    if (c.status === 'High Congestion') badgeClass = 'badge-full';
    else if (c.status === 'Moderate') badgeClass = 'badge-warning';

    item.innerHTML = `
      <div>
        <div class="corridor-name">🚶 ${c.name}</div>
        <div class="corridor-zone">${c.zone} • Capacity Threshold: ${c.threshold}</div>
      </div>
      <div class="corridor-stats">
        <div class="corridor-count">${c.count} <span style="font-size: 12px; color: var(--text-muted);">ppl</span></div>
        <span class="badge ${badgeClass}">${c.status}</span>
      </div>
    `;

    container.appendChild(item);
  });
}

// 4. Update Timetable Table
function updateTimetableTable(entries) {
  const tbody = document.getElementById('timetableBody');
  if (!tbody) return;

  tbody.innerHTML = '';

  entries.forEach(entry => {
    const row = document.createElement('tr');

    let badgeClass = 'badge-normal';
    if (entry.verification_status.includes('Empty') || entry.verification_status.includes('Pending')) {
      badgeClass = 'badge-warning';
    } else if (entry.verification_status.includes('Overcrowded')) {
      badgeClass = 'badge-full';
    } else if (entry.verification_status.includes('Unscheduled')) {
      badgeClass = 'badge-empty';
    }

    row.innerHTML = `
      <td>
        <div class="faculty-name">${entry.faculty}</div>
        <div class="subject-code">${entry.subject}</div>
      </td>
      <td><strong>${entry.room}</strong></td>
      <td>${entry.time_slot}</td>
      <td>${entry.actual_detected} / ${entry.expected_strength}</td>
      <td><span class="badge ${badgeClass}">${entry.verification_status}</span></td>
    `;

    tbody.appendChild(row);
  });
}

// Poll data every 2 seconds
fetchDashboardData();
setInterval(fetchDashboardData, 2000);
