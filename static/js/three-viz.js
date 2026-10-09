// three-viz.js
document.addEventListener("DOMContentLoaded", () => {
    // ---------------------------------------------------------
    // Configuration & Setup
    // ---------------------------------------------------------
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let isCameraRunning = false;
    let aiFaceCount = 0;
    let aiRecognizedCount = 0;
    
    // ---------------------------------------------------------
    // SCENE: AI HERO CORE (Pass 2)
    // ---------------------------------------------------------
    const container = document.getElementById('ai-core-container');
    if (!container) return;

    const scene = new THREE.Scene();
    
    // Adjusted camera so the core appears larger
    const camera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.z = 11; // Moved closer

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Lights - Intensified (Command Center Cyan & Electric Blue)
    const ambientLight = new THREE.AmbientLight(0xcaf0f8, 0.7);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0x00b4d8, 3.5, 50);
    pointLight.position.set(5, 5, 5);
    scene.add(pointLight);

    const electricLight = new THREE.PointLight(0x0096c7, 2.8, 50);
    electricLight.position.set(-5, -5, 5);
    scene.add(electricLight);

    // AI Core (Scaled up with Deep Navy base and Vibrant Cyan Emissive)
    const coreGeo = new THREE.IcosahedronGeometry(2.8, 1);
    const coreMat = new THREE.MeshPhysicalMaterial({
        color: 0x03045e,
        emissive: 0x00b4d8,
        emissiveIntensity: 0.25, // Standby intensity
        transparent: true,
        opacity: 0.92,
        roughness: 0.1,
        metalness: 0.9,
        wireframe: true,
    });
    const aiCore = new THREE.Mesh(coreGeo, coreMat);
    aiCore.position.x = 1;
    scene.add(aiCore);

    // Orbital Rings (Cobalt & Cyan Glow)
    const ringGeo1 = new THREE.TorusGeometry(4.5, 0.015, 16, 100);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x0077b6, transparent: true, opacity: 0.7 });
    const ring1 = new THREE.Mesh(ringGeo1, ringMat);
    ring1.rotation.x = Math.PI / 3;
    ring1.position.x = 1;
    scene.add(ring1);

    const ringGeo2 = new THREE.TorusGeometry(5.8, 0.015, 16, 100);
    const ringMat2 = new THREE.MeshBasicMaterial({ color: 0x48cae4, transparent: true, opacity: 0.65 });
    const ring2 = new THREE.Mesh(ringGeo2, ringMat2);
    ring2.rotation.y = Math.PI / 3;
    ring2.position.x = 1;
    scene.add(ring2);

    // Scanning Ring (Active when camera is running)
    const scanGeo = new THREE.TorusGeometry(4.0, 0.03, 16, 100);
    const scanMat = new THREE.MeshBasicMaterial({ color: 0x00b4d8, transparent: true, opacity: 0 });
    const scanRing = new THREE.Mesh(scanGeo, scanMat);
    scanRing.rotation.x = Math.PI / 2;
    scanRing.position.x = 1;
    scene.add(scanRing);

    // Particles (Ice-cyan telemetry particles)
    const particlesGeo = new THREE.BufferGeometry();
    const particleCount = 200; 
    const posArray = new Float32Array(particleCount * 3);
    for(let i=0; i < particleCount * 3; i++) {
        posArray[i] = (Math.random() - 0.5) * 20;
    }
    particlesGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const particlesMat = new THREE.PointsMaterial({
        size: 0.07,
        color: 0x90e0ef,
        transparent: true,
        opacity: 0.75
    });
    const particlesMesh = new THREE.Points(particlesGeo, particlesMat);
    scene.add(particlesMesh);

    // Mouse Parallax
    let mouseX = 0;
    let mouseY = 0;
    document.addEventListener('mousemove', (event) => {
        const rect = container.getBoundingClientRect();
        if (event.clientX >= rect.left && event.clientX <= rect.right &&
            event.clientY >= rect.top && event.clientY <= rect.bottom) {
            mouseX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouseY = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        }
    });

    let time = 0;

    // Animation Loop
    function animateCore() {
        time += 0.01;
        let pulseSpeed = isCameraRunning ? 4 : 2;
        let pulseScale = isCameraRunning ? 0.04 : 0.02;

        if (aiRecognizedCount > 0) {
            pulseSpeed = 6;
            pulseScale = 0.06;
        } else if (aiFaceCount > 0) {
            pulseSpeed = 5;
            pulseScale = 0.05;
        }

        if (!prefersReducedMotion) {
            let rotY = isCameraRunning ? 0.005 : 0.002;
            let rotX = isCameraRunning ? 0.002 : 0.001;
            
            if (aiFaceCount > 0) { rotY += 0.003; rotX += 0.001; }
            
            aiCore.rotation.y += rotY;
            aiCore.rotation.x += rotX;

            ring1.rotation.z -= 0.002;
            ring2.rotation.z += 0.0015;

            // Pulse
            const scale = 1 + Math.sin(time * pulseSpeed) * pulseScale;
            aiCore.scale.set(scale, scale, scale);

            particlesMesh.rotation.y -= isCameraRunning ? 0.001 : 0.0005;

            // Parallax
            camera.position.x += (mouseX * 1.0 - camera.position.x) * 0.05;
            camera.position.y += (mouseY * 1.0 - camera.position.y) * 0.05;
            camera.lookAt(new THREE.Vector3(1, 0, 0));

            // Scanning Effect
            if (isCameraRunning) {
                scanRing.scale.x = 1 + (time % 1.5) * 0.4;
                scanRing.scale.y = 1 + (time % 1.5) * 0.4;
                scanRing.scale.z = 1 + (time % 1.5) * 0.4;
                scanMat.opacity = Math.max(0, 0.8 - (time % 1.5) * 0.5);
            } else {
                scanMat.opacity = 0;
            }
        }

        renderer.render(scene, camera);
    }
    renderer.setAnimationLoop(animateCore);

    window.addEventListener('resize', () => {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    });

    // ---------------------------------------------------------
    // GLOBAL API FOR dashboard.js
    // ---------------------------------------------------------
    window.update3DViz = function(isRunning) {
        isCameraRunning = isRunning;

        const statusText = document.getElementById('aiCoreStatusText');
        if (statusText) {
            if (isRunning) {
                statusText.innerText = "ACTIVE SCANNING";
                statusText.style.color = "var(--accent-cyan)";
                coreMat.emissiveIntensity = 0.6; // brighter core
                particlesMat.color.setHex(0x10b981); // turn particles green
                scanMat.color.setHex(0x10b981); // green scan
            } else {
                statusText.innerText = "SYSTEM STANDBY";
                statusText.style.color = "var(--text-dim)";
                coreMat.emissiveIntensity = 0.2;
                particlesMat.color.setHex(0x06b6d4); // cyan particles
                scanMat.color.setHex(0x06b6d4);
            }
        }
    };
    
    window.updateAI3D = function(faceCount, recognizedCount) {
        aiFaceCount = faceCount || 0;
        aiRecognizedCount = recognizedCount || 0;
    };
});
