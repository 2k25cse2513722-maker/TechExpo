/**
 * CampusVision AI — 3D Campus Digital Twin Engine
 * Tech Expo 2026 Edition
 * Interactive Three.js spatial visualization of campus buildings, classrooms,
 * corridors, real-time occupancy beacons, camera status, and emergency evacuation paths.
 */

(function () {
    let scene, camera, renderer, container;
    let roomMeshes = {};
    let beaconSprites = {};
    let evacuationArrows = [];
    let raycaster, mouse;
    let hoveredRoom = null;
    let isEmergencyMode = false;
    let isInitialized = false;

    // Camera control state
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    let cameraTheta = Math.PI / 4;  // 45 degrees
    let cameraPhi = Math.PI / 3;    // 60 degrees from top
    let cameraRadius = 38;
    let cameraTarget = new THREE.Vector3(0, 0, 0);

    // Campus spatial coordinates definition
    const CAMPUS_ZONES = {
        "A-101": {
            name: "A-101",
            building: "Academic Block A",
            type: "room",
            pos: [-10, 1.5, -6],
            size: [8, 3, 7],
            floor: 1,
            labelPos: [-10, 4.2, -6],
            exitTarget: [-10, 0.5, 3]
        },
        "A-102": {
            name: "A-102",
            building: "Academic Block A",
            type: "room",
            pos: [-10, 1.5, 4],
            size: [8, 3, 7],
            floor: 1,
            labelPos: [-10, 4.2, 4],
            exitTarget: [-10, 0.5, 3]
        },
        "C-1": {
            name: "C-1",
            title: "Corridor C-1 (Block A)",
            building: "Academic Block A",
            type: "corridor",
            pos: [-4.5, 0.6, -1],
            size: [3, 1.2, 17],
            floor: 1,
            labelPos: [-4.5, 2.5, -1],
            exitTarget: [0, 0.5, -1]
        },
        "C-2": {
            name: "C-2",
            title: "Central Admin Corridor",
            building: "Central Lobby",
            type: "corridor",
            pos: [0, 0.6, -1],
            size: [6, 1.2, 5],
            floor: 1,
            labelPos: [0, 2.5, -1],
            exitTarget: [0, 0.5, 12]
        },
        "B-201": {
            name: "B-201",
            building: "Academic Block B",
            type: "room",
            pos: [10, 3.5, -6],
            size: [8, 3.5, 7],
            floor: 2,
            labelPos: [10, 6.2, -6],
            exitTarget: [10, 0.5, 3]
        },
        "AI-Lab": {
            name: "AI-Lab",
            building: "Research Wing",
            type: "room",
            pos: [10, 1.5, 4],
            size: [8, 3, 7],
            floor: 1,
            labelPos: [10, 4.2, 4],
            exitTarget: [10, 0.5, 3]
        },
        "Auditorium": {
            name: "Auditorium",
            building: "Convention Center",
            type: "room",
            pos: [0, 2.5, -14],
            size: [14, 5, 10],
            floor: 1,
            labelPos: [0, 6.0, -14],
            exitTarget: [0, 0.5, -8]
        },
        "Quad": {
            name: "Quad",
            title: "Evacuation Assembly Area",
            type: "assembly",
            pos: [0, 0.1, 14],
            size: [18, 0.2, 10],
            floor: 0,
            labelPos: [0, 1.8, 14]
        }
    };

    function getTierColor(tier, isCameraOffline = false) {
        if (isCameraOffline) return 0x64748b; // Dim slate for offline
        switch (tier) {
            case "OVERCAPACITY":
            case "HIGH":
                return 0xef4444; // Crimson Red
            case "MEDIUM":
                return 0xf59e0b; // Amber
            case "LOW":
                return 0x10b981; // Emerald Green
            default:
                return 0x06b6d4; // Cyan standby
        }
    }

    function initCampusTwin() {
        container = document.getElementById("campus-twin-canvas-container");
        if (!container || isInitialized) return;

        // 1. Scene & Lighting
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x07090d);
        scene.fog = new THREE.FogExp2(0x07090d, 0.015);

        // 2. Camera setup
        const aspect = container.clientWidth / (container.clientHeight || 450);
        camera = new THREE.PerspectiveCamera(45, aspect, 0.5, 500);
        updateCameraPosition();

        // 3. Renderer setup
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(container.clientWidth, container.clientHeight || 450);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.innerHTML = "";
        container.appendChild(renderer.domElement);

        // 4. Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        ambientLight.name = "ambientLight";
        scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xa5f3fc, 1.2);
        dirLight.position.set(20, 40, 20);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 1024;
        dirLight.shadow.mapSize.height = 1024;
        dirLight.name = "dirLight";
        scene.add(dirLight);

        const emergencyLight = new THREE.PointLight(0xef4444, 0, 60);
        emergencyLight.position.set(0, 15, 0);
        emergencyLight.name = "emergencySirenLight";
        scene.add(emergencyLight);

        // 5. Ground Plane & Grid
        const gridHelper = new THREE.GridHelper(60, 30, 0x1e293b, 0x0f172a);
        gridHelper.position.y = 0;
        scene.add(gridHelper);

        const groundGeo = new THREE.PlaneGeometry(60, 60);
        const groundMat = new THREE.MeshStandardMaterial({
            color: 0x0a0f18,
            roughness: 0.9,
            metalness: 0.1
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.05;
        ground.receiveShadow = true;
        scene.add(ground);

        // 6. Build Campus Zones & Rooms
        buildCampusStructures();

        // 7. Raycasting & Mouse Events
        raycaster = new THREE.Raycaster();
        mouse = new THREE.Vector2();

        setupControls();
        animate();

        isInitialized = true;
        window.addEventListener("resize", onWindowResize);
    }

    function buildCampusStructures() {
        // Base campus outline building foundations
        for (const [key, zone] of Object.entries(CAMPUS_ZONES)) {
            const [w, h, d] = zone.size;
            const [x, y, z] = zone.pos;

            if (zone.type === "assembly") {
                // Assembly Quad Ground
                const quadGeo = new THREE.BoxGeometry(w, h, d);
                const quadMat = new THREE.MeshStandardMaterial({
                    color: 0x064e3b,
                    emissive: 0x047857,
                    emissiveIntensity: 0.3,
                    roughness: 0.8
                });
                const quadMesh = new THREE.Mesh(quadGeo, quadMat);
                quadMesh.position.set(x, y, z);
                quadMesh.receiveShadow = true;
                scene.add(quadMesh);

                createHtmlBeacon(key, "EMERGENCY ASSEMBLY QUAD", "MUSTER POINT 01", 0x10b981);
                continue;
            }

            // Room Building Block
            const geo = new THREE.BoxGeometry(w, h, d);
            const mat = new THREE.MeshPhysicalMaterial({
                color: 0x0d1522,
                emissive: 0x06b6d4,
                emissiveIntensity: 0.15,
                transparent: true,
                opacity: 0.78,
                roughness: 0.3,
                metalness: 0.6,
                clearcoat: 0.3,
                wireframe: false
            });

            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(x, y, z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.userData = { roomKey: key, zoneData: zone };

            // Edges Wireframe Accent
            const edgesGeo = new THREE.EdgesGeometry(geo);
            const edgesMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.6 });
            const edges = new THREE.LineSegments(edgesGeo, edgesMat);
            mesh.add(edges);

            // Roof / Floor Indicator
            const roofGeo = new THREE.BoxGeometry(w - 0.2, 0.1, d - 0.2);
            const roofMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4 });
            const roof = new THREE.Mesh(roofGeo, roofMat);
            roof.position.set(0, h / 2 + 0.05, 0);
            mesh.add(roof);

            scene.add(mesh);
            roomMeshes[key] = mesh;

            // Add 3D Floating Beacon
            createHtmlBeacon(key, zone.title || zone.name, "Initializing...", 0x06b6d4);

            // Build camera antenna / marker for active camera rooms
            if (key === "A-101" || key === "C-2") {
                const camCylinderGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.8, 16);
                const camMat = new THREE.MeshBasicMaterial({ color: key === "C-2" ? 0x64748b : 0x06b6d4 });
                const camCylinder = new THREE.Mesh(camCylinderGeo, camMat);
                camCylinder.position.set(x, y + h / 2 + 0.6, z);
                scene.add(camCylinder);

                const pulseRingGeo = new THREE.RingGeometry(0.4, 0.6, 16);
                const pulseRingMat = new THREE.MeshBasicMaterial({
                    color: key === "C-2" ? 0xef4444 : 0x10b981,
                    side: THREE.DoubleSide,
                    transparent: true,
                    opacity: 0.8
                });
                const pulseRing = new THREE.Mesh(pulseRingGeo, pulseRingMat);
                pulseRing.rotation.x = -Math.PI / 2;
                pulseRing.position.set(x, y + h / 2 + 1.1, z);
                pulseRing.name = `camPulse_${key}`;
                scene.add(pulseRing);
            }
        }

        // Connecting pathways & roads
        createPathways();
    }

    function createPathways() {
        const pathMat = new THREE.MeshStandardMaterial({
            color: 0x111827,
            roughness: 0.9
        });

        // Center spine corridor path
        const spineGeo = new THREE.BoxGeometry(4, 0.05, 30);
        const spine = new THREE.Mesh(spineGeo, pathMat);
        spine.position.set(0, 0.02, 0);
        scene.add(spine);

        // East-West link
        const ewGeo = new THREE.BoxGeometry(26, 0.05, 4);
        const ew = new THREE.Mesh(ewGeo, pathMat);
        ew.position.set(0, 0.02, -1);
        scene.add(ew);
    }

    function createHtmlBeacon(key, title, subtitle, colorHex) {
        const zone = CAMPUS_ZONES[key];
        if (!zone) return;

        // Create a canvas texture for crisp 3D sprite label
        const canvas = document.createElement("canvas");
        canvas.width = 256;
        canvas.height = 128;
        const ctx = canvas.getContext("2d");

        drawBeaconCanvas(ctx, title, subtitle, colorHex);

        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;

        const spriteMat = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: false
        });
        const sprite = new THREE.Sprite(spriteMat);
        const [x, y, z] = zone.labelPos;
        sprite.position.set(x, y, z);
        sprite.scale.set(6, 3, 1);
        sprite.userData = { canvas, ctx, title, key };

        scene.add(sprite);
        beaconSprites[key] = sprite;
    }

    function drawBeaconCanvas(ctx, title, subtitle, colorHex, isOffline = false) {
        ctx.clearRect(0, 0, 256, 128);

        // Background rounded pill
        ctx.fillStyle = "rgba(13, 17, 24, 0.88)";
        ctx.strokeStyle = isOffline ? "#64748b" : (typeof colorHex === "number" ? "#" + colorHex.toString(16).padStart(6, "0") : colorHex);
        ctx.lineWidth = 4;
        
        ctx.beginPath();
        ctx.roundRect(10, 14, 236, 100, 16);
        ctx.fill();
        ctx.stroke();

        // Status indicator dot
        ctx.fillStyle = isOffline ? "#64748b" : (typeof colorHex === "number" ? "#" + colorHex.toString(16).padStart(6, "0") : colorHex);
        ctx.beginPath();
        ctx.arc(36, 44, 8, 0, Math.PI * 2);
        ctx.fill();

        // Title
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 24px Inter, sans-serif";
        ctx.fillText(title, 54, 52);

        // Subtitle / Telemetry
        ctx.fillStyle = "#94a3b8";
        ctx.font = "18px 'JetBrains Mono', monospace";
        ctx.fillText(subtitle, 36, 88);
    }

    function updateCameraPosition() {
        const x = cameraTarget.x + cameraRadius * Math.sin(cameraPhi) * Math.sin(cameraTheta);
        const y = cameraTarget.y + cameraRadius * Math.cos(cameraPhi);
        const z = cameraTarget.z + cameraRadius * Math.sin(cameraPhi) * Math.cos(cameraTheta);
        camera.position.set(x, y, z);
        camera.lookAt(cameraTarget);
    }

    function setupControls() {
        const dom = renderer.domElement;

        dom.addEventListener("mousedown", (e) => {
            isDragging = true;
            previousMousePosition = { x: e.clientX, y: e.clientY };
        });

        window.addEventListener("mouseup", () => {
            isDragging = false;
        });

        dom.addEventListener("mousemove", (e) => {
            const rect = dom.getBoundingClientRect();
            mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

            if (isDragging) {
                const deltaX = e.clientX - previousMousePosition.x;
                const deltaY = e.clientY - previousMousePosition.y;

                cameraTheta -= deltaX * 0.007;
                cameraPhi = Math.max(0.15, Math.min(Math.PI / 2.1, cameraPhi - deltaY * 0.007));

                updateCameraPosition();
                previousMousePosition = { x: e.clientX, y: e.clientY };
            } else {
                handleHover();
            }
        });

        dom.addEventListener("wheel", (e) => {
            e.preventDefault();
            cameraRadius = Math.max(12, Math.min(65, cameraRadius + e.deltaY * 0.03));
            updateCameraPosition();
        }, { passive: false });

        // Click on Room raycasting
        dom.addEventListener("click", () => {
            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(Object.values(roomMeshes));
            if (intersects.length > 0) {
                const clickedMesh = intersects[0].object;
                const roomKey = clickedMesh.userData.roomKey;
                if (roomKey && typeof window.viewClassroomDetails === "function") {
                    window.viewClassroomDetails(roomKey);
                }
            }
        });

        // Touch support for tablets & mobile
        let touchStart = { x: 0, y: 0 };
        dom.addEventListener("touchstart", (e) => {
            if (e.touches.length === 1) {
                touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            }
        }, { passive: true });

        dom.addEventListener("touchmove", (e) => {
            if (e.touches.length === 1) {
                const deltaX = e.touches[0].clientX - touchStart.x;
                const deltaY = e.touches[0].clientY - touchStart.y;
                cameraTheta -= deltaX * 0.008;
                cameraPhi = Math.max(0.15, Math.min(Math.PI / 2.1, cameraPhi - deltaY * 0.008));
                updateCameraPosition();
                touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            }
        }, { passive: true });
    }

    function handleHover() {
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(Object.values(roomMeshes));

        if (intersects.length > 0) {
            const hit = intersects[0].object;
            if (hoveredRoom !== hit) {
                if (hoveredRoom) resetMeshHighlight(hoveredRoom);
                hoveredRoom = hit;
                highlightMesh(hoveredRoom);
                renderer.domElement.style.cursor = "pointer";
            }
        } else {
            if (hoveredRoom) {
                resetMeshHighlight(hoveredRoom);
                hoveredRoom = null;
                renderer.domElement.style.cursor = "default";
            }
        }
    }

    function highlightMesh(mesh) {
        mesh.material.emissiveIntensity = 0.65;
        mesh.scale.set(1.02, 1.04, 1.02);
    }

    function resetMeshHighlight(mesh) {
        mesh.material.emissiveIntensity = 0.2;
        mesh.scale.set(1, 1, 1);
    }

    // Animation loop
    let clock = new THREE.Clock();
    function animate() {
        requestAnimationFrame(animate);
        const elapsed = clock.getElapsedTime();

        // Pulsing active camera rings
        const camRing1 = scene.getObjectByName("camPulse_A-101");
        if (camRing1) {
            const scale = 1 + Math.sin(elapsed * 4) * 0.2;
            camRing1.scale.set(scale, scale, 1);
        }

        // Emergency Siren pulse in 3D
        const emergencyLight = scene.getObjectByName("emergencySirenLight");
        if (emergencyLight) {
            if (isEmergencyMode) {
                emergencyLight.intensity = (Math.sin(elapsed * 6) + 1) * 2.5;
            } else {
                emergencyLight.intensity = 0;
            }
        }

        // Animate Evacuation directional arrows in 3D
        if (evacuationArrows.length > 0) {
            evacuationArrows.forEach(arrow => {
                arrow.position.y = 0.6 + Math.sin(elapsed * 3 + arrow.userData.offset) * 0.2;
            });
        }

        renderer.render(scene, camera);
    }

    function onWindowResize() {
        if (!container || !renderer || !camera) return;
        const width = container.clientWidth;
        const height = container.clientHeight || 450;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    }

    // Update Digital Twin state with real telemetry
    function updateCampusTwin(twinData) {
        if (!isInitialized) initCampusTwin();
        if (!twinData) return;

        const rooms = twinData.rooms || [];
        const corridors = twinData.corridors || [];
        const camRegistry = twinData.camera_registry || {};

        // 1. Update Rooms
        rooms.forEach(room => {
            const mesh = roomMeshes[room.room];
            const sprite = beaconSprites[room.room];
            const camInfo = camRegistry[room.room] || {};
            const isCamOffline = camInfo.status === "OFFLINE";
            const colorHex = getTierColor(room.density_tier, isCamOffline);

            if (mesh) {
                mesh.material.color.setHex(isEmergencyMode ? (room.density_tier === "HIGH" || room.density_tier === "OVERCAPACITY" ? 0xef4444 : 0x0f172a) : 0x0d1522);
                mesh.material.emissive.setHex(colorHex);
                mesh.material.emissiveIntensity = isEmergencyMode ? 0.45 : 0.22;
            }

            if (sprite && sprite.userData) {
                const labelSub = `${room.persons}/${room.capacity} (${room.occupancy_rate}%) • ${isCamOffline ? 'CAM OFFLINE' : 'CAM ON'}`;
                drawBeaconCanvas(sprite.userData.ctx, room.room, labelSub, colorHex, isCamOffline);
                sprite.material.map.needsUpdate = true;
            }
        });

        // 2. Update Corridors
        corridors.forEach(corr => {
            const mesh = roomMeshes[corr.id];
            const sprite = beaconSprites[corr.id];
            const camInfo = camRegistry[corr.id] || {};
            const isCamOffline = camInfo.status === "OFFLINE";
            const colorHex = getTierColor(corr.density_tier, isCamOffline);

            if (mesh) {
                mesh.material.emissive.setHex(colorHex);
                mesh.material.emissiveIntensity = isEmergencyMode ? 0.5 : 0.25;
            }

            if (sprite && sprite.userData) {
                const labelSub = `${corr.count} Ppl • ${isCamOffline ? 'CAM OFFLINE' : 'ACTIVE'}`;
                drawBeaconCanvas(sprite.userData.ctx, corr.id, labelSub, colorHex, isCamOffline);
                sprite.material.map.needsUpdate = true;
            }
        });

        // 3. Update Camera 07 status beacon explicitly if offline
        const c2Sprite = beaconSprites["C-2"];
        if (c2Sprite && c2Sprite.userData) {
            const c2Cam = camRegistry["C-2"];
            if (c2Cam && c2Cam.status === "OFFLINE") {
                drawBeaconCanvas(c2Sprite.userData.ctx, "C-2", "Camera-07 OFFLINE", 0x64748b, true);
                c2Sprite.material.map.needsUpdate = true;
            }
        }
    }

    function setCampusTwinEmergency(active) {
        isEmergencyMode = Boolean(active);
        const ambient = scene ? scene.getObjectByName("ambientLight") : null;
        if (ambient) {
            ambient.color.setHex(isEmergencyMode ? 0xff8888 : 0xffffff);
            ambient.intensity = isEmergencyMode ? 0.4 : 0.7;
        }

        // Toggle 3D Evacuation arrows
        toggleEvacuationArrows(isEmergencyMode);
    }

    function toggleEvacuationArrows(show) {
        // Clear old arrows
        evacuationArrows.forEach(arr => scene.remove(arr));
        evacuationArrows = [];

        if (!show) return;

        // Create animated glowing 3D arrow cones leading to Exit Gates & Quad
        const arrowGeo = new THREE.ConeGeometry(0.5, 1.2, 8);
        const arrowMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });

        const routePoints = [
            { pos: [-10, 0.6, -1], rot: [0, 0, -Math.PI / 2], offset: 0 },
            { pos: [-6, 0.6, -1], rot: [0, 0, -Math.PI / 2], offset: 1 },
            { pos: [-2, 0.6, 2], rot: [-Math.PI / 2, 0, 0], offset: 2 },
            { pos: [0, 0.6, 6], rot: [-Math.PI / 2, 0, 0], offset: 3 },
            { pos: [0, 0.6, 10], rot: [-Math.PI / 2, 0, 0], offset: 4 },
            { pos: [8, 0.6, 2], rot: [-Math.PI / 2, 0, 0], offset: 2.5 }
        ];

        routePoints.forEach(pt => {
            const arrow = new THREE.Mesh(arrowGeo, arrowMat);
            arrow.position.set(pt.pos[0], pt.pos[1], pt.pos[2]);
            arrow.rotation.set(pt.rot[0], pt.rot[1], pt.rot[2]);
            arrow.userData = { offset: pt.offset };
            scene.add(arrow);
            evacuationArrows.push(arrow);
        });
    }

    function focusTwinOnRoom(roomKey) {
        const zone = CAMPUS_ZONES[roomKey];
        if (!zone) return;

        cameraTarget.set(zone.pos[0], zone.pos[1], zone.pos[2]);
        cameraRadius = 18;
        cameraPhi = Math.PI / 3.2;
        updateCameraPosition();

        if (roomMeshes[roomKey]) {
            highlightMesh(roomMeshes[roomKey]);
        }
    }

    function resetTwinCamera() {
        cameraTarget.set(0, 0, 0);
        cameraRadius = 38;
        cameraTheta = Math.PI / 4;
        cameraPhi = Math.PI / 3;
        updateCameraPosition();
    }

    // Expose Global API
    window.CampusTwin = {
        init: initCampusTwin,
        update: updateCampusTwin,
        setEmergency: setCampusTwinEmergency,
        focusOnRoom: focusTwinOnRoom,
        resetCamera: resetTwinCamera
    };
})();
