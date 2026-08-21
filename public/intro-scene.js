import * as THREE from "/assets/three.module.js";

const canvas = document.querySelector("#introSceneCanvas");

if (canvas && !window.__allJoiIntroSceneBooted) {
  window.__allJoiIntroSceneBooted = true;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: false,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarsePointer ? 1.2 : 1.65));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;
  renderer.setClearColor(0x050504, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x050504, 0.026);

  const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.08, 80);
  camera.position.set(0, 2.6, 8);

  const world = new THREE.Group();
  scene.add(world);

  scene.add(new THREE.HemisphereLight(0xffefd1, 0x090806, 0.46));
  const keyLight = new THREE.PointLight(0xffb866, 42, 34, 1.8);
  keyLight.position.set(3.5, 5.2, 2.5);
  scene.add(keyLight);
  const rimLight = new THREE.PointLight(0xffd9a1, 24, 26, 2);
  rimLight.position.set(-4.5, 1.4, -8);
  scene.add(rimLight);

  const palette = {
    ink: new THREE.Color(0x050504),
    bronze: new THREE.Color(0x9f6740),
    amber: new THREE.Color(0xffad61),
    pearl: new THREE.Color(0xffead0),
  };

  const introUniforms = {
    time: { value: 0 },
    pointer: { value: new THREE.Vector2(0.5, 0.5) },
    opacity: { value: 1 },
    pulse: { value: 0 },
  };

  const mapGeometry = new THREE.PlaneGeometry(19, 15, 160, 120);
  const mapMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: introUniforms,
    vertexShader: `
      uniform float time;
      uniform vec2 pointer;
      uniform float pulse;
      varying vec2 vUv;
      varying float vLift;

      float terrain(vec2 p) {
        float a = sin(p.x * 4.7 + time * 0.16) * 0.08;
        float b = cos(p.y * 5.4 - time * 0.11) * 0.07;
        float c = sin((p.x + p.y) * 8.2) * 0.035;
        return a + b + c;
      }

      void main() {
        vUv = uv;
        vec3 p = position;
        vec2 cursor = pointer - 0.5;
        float proximity = 1.0 - smoothstep(0.0, 0.42, distance(uv, pointer));
        p.z += terrain(uv) + proximity * 0.16 + pulse * 0.05;
        vLift = p.z;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform float opacity;
      uniform float pulse;
      varying vec2 vUv;
      varying float vLift;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      void main() {
        vec2 p = (vUv - 0.5) * vec2(1.25, 1.0);
        float field =
          sin(p.x * 18.0 + sin(p.y * 8.0) * 2.2) +
          cos(p.y * 21.0 - sin(p.x * 7.0) * 2.4) +
          sin((p.x + p.y) * 13.0);
        float contour = 1.0 - smoothstep(0.055, 0.12, abs(fract(field * 0.23 + time * 0.006) - 0.5));
        float major = 1.0 - smoothstep(0.025, 0.07, abs(fract(field * 0.057) - 0.5));
        float vignette = smoothstep(0.78, 0.12, length(p));
        float grain = step(0.9975, hash(floor(vUv * 520.0) + floor(time * 0.4)));
        vec3 lineColor = mix(vec3(0.50, 0.30, 0.16), vec3(1.0, 0.76, 0.48), major);
        float alpha = (contour * 0.15 + major * 0.34 + grain * 0.16) * vignette * opacity;
        alpha *= 0.78 + vLift * 0.9 + pulse * 0.12;
        gl_FragColor = vec4(lineColor, alpha);
      }
    `,
  });
  const map = new THREE.Mesh(mapGeometry, mapMaterial);
  map.rotation.x = -Math.PI / 2;
  map.position.set(0, -2.15, -3.5);
  world.add(map);

  function makeRoute() {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-4.6, -1.94, 3.2),
      new THREE.Vector3(-2.6, -1.94, 0.9),
      new THREE.Vector3(0.8, -1.94, -2.2),
      new THREE.Vector3(-0.7, -1.94, -6.5),
      new THREE.Vector3(0, -0.4, -10.7),
    ]);
    const geometry = new THREE.TubeGeometry(curve, 160, 0.023, 8, false);
    const material = new THREE.MeshStandardMaterial({
      color: 0xffbb72,
      emissive: 0xff7b32,
      emissiveIntensity: 3.4,
      transparent: true,
      opacity: 0.82,
      roughness: 0.28,
      metalness: 0.08,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.baseOpacity = material.opacity;
    return mesh;
  }

  const route = makeRoute();
  world.add(route);

  const knockRings = [
    new THREE.Vector3(-2.6, -2.02, -0.8),
    new THREE.Vector3(1.7, -2.02, -2.5),
    new THREE.Vector3(0.2, -2.02, -5.7),
  ].map((position, index) => {
    const material = new THREE.MeshBasicMaterial({
      color: index === 2 ? 0xffc17b : 0x9f6740,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.94, 1.01, 96), material);
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(position);
    ring.scale.setScalar(0.05);
    ring.userData.index = index;
    world.add(ring);
    return ring;
  });

  const corridor = new THREE.Group();
  world.add(corridor);

  function rectangularContour(width, height, z, opacity) {
    const points = [
      new THREE.Vector3(-width / 2, -height / 2, z),
      new THREE.Vector3(width / 2, -height / 2, z),
      new THREE.Vector3(width / 2, height / 2, z),
      new THREE.Vector3(-width / 2, height / 2, z),
      new THREE.Vector3(-width / 2, -height / 2, z),
    ];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: 0xb77b4c,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
    });
    const line = new THREE.Line(geometry, material);
    line.userData.baseOpacity = opacity;
    corridor.add(line);
    return line;
  }

  for (let i = 0; i < 11; i += 1) {
    const depth = -1.8 - i * 0.86;
    const scale = 1 + i * 0.06;
    rectangularContour(8.2 * scale, 5.7 * scale, depth, 0.08 + i * 0.012);
  }

  const doorPivot = new THREE.Group();
  doorPivot.position.set(-2.6, 0.35, -11.25);
  corridor.add(doorPivot);

  const doorMaterial = new THREE.MeshStandardMaterial({
    color: 0x0b0907,
    metalness: 0.28,
    roughness: 0.58,
    transparent: true,
    opacity: 0.98,
  });
  doorMaterial.userData.baseOpacity = doorMaterial.opacity;
  const door = new THREE.Mesh(new THREE.BoxGeometry(5.2, 7.15, 0.18), doorMaterial);
  door.position.x = 2.6;
  doorPivot.add(door);

  const seamMaterial = new THREE.MeshBasicMaterial({
    color: 0xffb86a,
    transparent: true,
    opacity: 0.2,
    blending: THREE.AdditiveBlending,
  });
  const seam = new THREE.Mesh(new THREE.PlaneGeometry(0.025, 6.9), seamMaterial);
  seam.position.set(5.205, 0, 0.105);
  doorPivot.add(seam);

  const peephole = new THREE.Group();
  peephole.position.set(2.6, 1.34, 0.16);
  doorPivot.add(peephole);

  const outerRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.72, 0.13, 24, 112),
    new THREE.MeshStandardMaterial({
      color: 0x8d5e3c,
      metalness: 0.9,
      roughness: 0.26,
    }),
  );
  peephole.add(outerRing);

  const innerRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.49, 0.045, 16, 96),
    new THREE.MeshStandardMaterial({
      color: 0xe3b782,
      metalness: 0.76,
      roughness: 0.18,
      emissive: 0x5c2a12,
      emissiveIntensity: 0.42,
    }),
  );
  innerRing.position.z = 0.03;
  peephole.add(innerRing);

  const lensMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x4d3528,
    transparent: true,
    opacity: 0.42,
    roughness: 0.08,
    metalness: 0,
    transmission: 0.62,
    thickness: 0.38,
    ior: 1.42,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
  });
  const lens = new THREE.Mesh(new THREE.SphereGeometry(0.48, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2), lensMaterial);
  lens.scale.z = 0.3;
  lens.rotation.x = Math.PI / 2;
  lens.position.z = 0.03;
  peephole.add(lens);

  const shutterMaterial = new THREE.MeshStandardMaterial({
    color: 0x24170f,
    metalness: 0.75,
    roughness: 0.34,
  });
  const shutter = new THREE.Mesh(new THREE.CircleGeometry(0.5, 96), shutterMaterial);
  shutter.position.set(0, 0, 0.1);
  peephole.add(shutter);

  const handlePivot = new THREE.Group();
  handlePivot.position.set(1.3, -1.05, 0.18);
  doorPivot.add(handlePivot);

  const handleMaterial = new THREE.MeshStandardMaterial({
    color: 0x9a6948,
    metalness: 0.92,
    roughness: 0.24,
    emissive: 0x2d1509,
    emissiveIntensity: 0.24,
  });
  const handleRosette = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.12, 64), handleMaterial);
  handleRosette.rotation.x = Math.PI / 2;
  handlePivot.add(handleRosette);
  const lever = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.115, 1.45, 32), handleMaterial);
  lever.rotation.z = Math.PI / 2;
  lever.position.x = 0.68;
  lever.position.z = 0.12;
  handlePivot.add(lever);
  const leverCap = new THREE.Mesh(new THREE.SphereGeometry(0.13, 32, 24), handleMaterial);
  leverCap.position.set(1.38, 0, 0.12);
  handlePivot.add(leverCap);

  const particleCount = reduceMotion ? 80 : coarsePointer ? 150 : 260;
  const positions = new Float32Array(particleCount * 3);
  const sizes = new Float32Array(particleCount);
  for (let i = 0; i < particleCount; i += 1) {
    const spread = i / particleCount;
    positions[i * 3] = (Math.random() - 0.5) * 13;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 7;
    positions[i * 3 + 2] = -2 - Math.random() * 14;
    sizes[i] = 0.6 + spread * 1.2;
  }
  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  particleGeometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
  const particleMaterial = new THREE.PointsMaterial({
    color: 0xeaa361,
    size: coarsePointer ? 0.022 : 0.018,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const particles = new THREE.Points(particleGeometry, particleMaterial);
  world.add(particles);

  const stateTargets = {
    mapDormant: 0,
    mapOpening: 0.2,
    mapListening: 0.65,
    corridorForming: 1.25,
    peepholeApproach: 1.8,
    peepholeLocked: 2.25,
    peepholeDragging: 2.28,
    peepholeOpening: 2.55,
    joiReveal: 3.05,
    handleLocked: 3.75,
    handleDragging: 3.82,
    doorOpening: 4.72,
    home: 5.6,
  };

  const cameraKeyframes = [
    { p: new THREE.Vector3(0, 2.7, 8), l: new THREE.Vector3(0, -1.5, -3.5) },
    { p: new THREE.Vector3(0, 1.65, 4.4), l: new THREE.Vector3(0, 0.05, -9.6) },
    { p: new THREE.Vector3(0, 1.55, -7.55), l: new THREE.Vector3(0, 1.15, -11.2) },
    { p: new THREE.Vector3(0, 1.48, -8.35), l: new THREE.Vector3(0, 1.12, -11.2) },
    { p: new THREE.Vector3(0.6, -0.62, -7.65), l: new THREE.Vector3(-0.2, -0.8, -11.1) },
    { p: new THREE.Vector3(0, 1.2, -9.4), l: new THREE.Vector3(0, 0.55, -13.2) },
  ];

  let currentState = document.body.dataset.state || "mapDormant";
  let stage = stateTargets[currentState] ?? 0;
  let targetStage = stage;
  let peepholeProgress = 0;
  let handleProgress = 0;
  let stateChangedAt = performance.now();
  let pointerX = 0.5;
  let pointerY = 0.5;

  function smoothstep(edge0, edge1, value) {
    const x = Math.max(0, Math.min(1, (value - edge0) / Math.max(edge1 - edge0, 0.0001)));
    return x * x * (3 - 2 * x);
  }

  function setObjectOpacity(object, value) {
    object.traverse((child) => {
      if (!child.material) return;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => {
        if (material.userData.baseOpacity == null) {
          material.userData.baseOpacity = material.opacity == null ? 1 : material.opacity;
        }
        material.transparent = true;
        material.opacity = material.userData.baseOpacity * value;
      });
    });
  }

  function sampleCamera(value) {
    const clamped = Math.max(0, Math.min(cameraKeyframes.length - 1, value));
    const index = Math.min(cameraKeyframes.length - 2, Math.floor(clamped));
    const mix = clamped - index;
    const a = cameraKeyframes[index];
    const b = cameraKeyframes[index + 1];
    return {
      position: a.p.clone().lerp(b.p, mix),
      lookAt: a.l.clone().lerp(b.l, mix),
    };
  }

  function setState(nextState) {
    currentState = nextState;
    targetStage = stateTargets[nextState] ?? targetStage;
    stateChangedAt = performance.now();
    canvas.dataset.sceneState = nextState;
  }

  function setPeepholeProgress(value) {
    peepholeProgress = Math.max(0, Math.min(1, value));
  }

  function setHandleProgress(value) {
    handleProgress = Math.max(0, Math.min(1, value));
  }

  window.allJoiIntroScene = { setState, setPeepholeProgress, setHandleProgress };

  const bodyObserver = new MutationObserver(() => {
    setState(document.body.dataset.state || "mapDormant");
  });
  bodyObserver.observe(document.body, { attributes: true, attributeFilter: ["data-state"] });

  window.addEventListener("pointermove", (event) => {
    pointerX = event.clientX / Math.max(window.innerWidth, 1);
    pointerY = event.clientY / Math.max(window.innerHeight, 1);
    introUniforms.pointer.value.set(pointerX, 1 - pointerY);
  }, { passive: true });

  window.addEventListener("resize", () => {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarsePointer ? 1.2 : 1.65));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / Math.max(window.innerHeight, 1);
    camera.updateProjectionMatrix();
  });

  function animate(now) {
    const seconds = now * 0.001;
    const lambda = reduceMotion ? 12 : 3.8;
    const delta = Math.min(0.05, (animate.lastTime ? now - animate.lastTime : 16) / 1000);
    animate.lastTime = now;
    stage += (targetStage - stage) * (1 - Math.exp(-lambda * delta));

    introUniforms.time.value = seconds;
    const inListening = currentState === "mapListening";
    introUniforms.pulse.value += ((inListening ? 1 : 0) - introUniforms.pulse.value) * 0.08;

    const cam = sampleCamera(stage);
    const parallax = currentState === "home" ? 0 : 1;
    cam.position.x += (pointerX - 0.5) * 0.22 * parallax;
    cam.position.y += (0.5 - pointerY) * 0.13 * parallax;
    camera.position.lerp(cam.position, reduceMotion ? 0.42 : 0.11);
    camera.lookAt(cam.lookAt);

    const mapOpacity = 1 - smoothstep(0.8, 1.75, stage);
    introUniforms.opacity.value = Math.max(0, mapOpacity);
    route.material.opacity = 0.18 + Math.max(0, 1 - smoothstep(3.8, 5.3, stage)) * 0.68;
    route.material.emissiveIntensity = 1.8 + Math.sin(seconds * 2.1) * 0.24;

    const corridorOpacity = smoothstep(0.6, 1.4, stage) * (1 - smoothstep(4.75, 5.65, stage));
    setObjectOpacity(corridor, corridorOpacity);
    doorMaterial.opacity = 0.98 * corridorOpacity;

    const peepholeScale = 0.74 + smoothstep(1.2, 2.3, stage) * 0.26;
    peephole.scale.setScalar(peepholeScale);
    shutter.position.y = peepholeProgress * 0.76;
    shutter.rotation.z = -peepholeProgress * 0.55;
    shutter.material.opacity = 1 - peepholeProgress * 0.86;
    shutter.material.transparent = true;
    lensMaterial.opacity = 0.32 + peepholeProgress * 0.24;

    const handleReveal = smoothstep(3.25, 3.9, stage);
    handlePivot.visible = handleReveal > 0.01;
    handlePivot.scale.setScalar(0.88 + handleReveal * 0.12);
    handlePivot.rotation.z = -handleProgress * 1.08;
    seamMaterial.opacity = 0.15 + handleProgress * 0.78 + smoothstep(4.2, 4.9, stage) * 0.5;

    const doorOpen = Math.max(handleProgress, smoothstep(4.35, 5.1, stage));
    doorPivot.rotation.y = -doorOpen * 1.08;
    door.position.z = -doorOpen * 0.12;

    const listeningElapsed = (now - stateChangedAt) / 1000;
    knockRings.forEach((ring, index) => {
      if (!inListening) {
        ring.material.opacity *= 0.88;
        return;
      }
      const local = Math.max(0, listeningElapsed - index * 0.34);
      const cycle = Math.min(1, local / 1.08);
      ring.scale.setScalar(0.16 + cycle * (1.8 + index * 0.28));
      ring.material.opacity = Math.sin(cycle * Math.PI) * (0.24 + index * 0.08);
    });

    particles.rotation.y = seconds * 0.008;
    particleMaterial.opacity = Math.max(0.06, 0.22 + Math.sin(seconds * 0.33) * 0.03) * (1 - smoothstep(5.0, 5.65, stage));

    const homeFade = 1 - smoothstep(5.02, 5.58, stage);
    canvas.style.opacity = String(Math.max(0, homeFade));
    canvas.style.pointerEvents = currentState === "home" ? "none" : "auto";

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  setState(currentState);
  requestAnimationFrame(animate);
}
