"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import styles from "./joi-signal-lab.module.css";

type Joi9000HeroProps = {
  progress: number;
  onFormChange: (index: number) => void;
  onReady: () => void;
};

type ParticleShape = {
  positions: Float32Array;
  colors: Float32Array;
  eyes: Float32Array;
  mode: number;
};

const FORM_COUNT = 4;
const JOI_PALETTE = [
  [0.96, 0.89, 0.83],
  [0.88, 0.45, 0.35],
  [0.35, 0.23, 0.2],
  [0.47, 0.58, 0.64],
  [0.84, 0.56, 0.28],
  [0.72, 0.5, 0.42],
] as const;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => {
  const amount = clamp01(value);
  return amount * amount * (3 - 2 * amount);
};

function seededRandom(seed = 1) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function roundedRectShape(width: number, height: number, radius: number) {
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;
  const right = x + width;
  const top = y + height;
  shape.moveTo(x + radius, y);
  shape.lineTo(right - radius, y);
  shape.quadraticCurveTo(right, y, right, y + radius);
  shape.lineTo(right, top - radius);
  shape.quadraticCurveTo(right, top, right - radius, top);
  shape.lineTo(x + radius, top);
  shape.quadraticCurveTo(x, top, x, top - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return shape;
}

function createRoundedBox(width: number, height: number, depth: number, radius: number) {
  const geometry = new THREE.ExtrudeGeometry(roundedRectShape(width, height, radius), {
    depth,
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: Math.min(radius * 0.42, 0.12),
    bevelThickness: Math.min(depth * 0.16, 0.1),
    curveSegments: 8,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function makeLabelTexture() {
  const surface = document.createElement("canvas");
  surface.width = 1024;
  surface.height = 240;
  const context = surface.getContext("2d");
  if (!context) return new THREE.CanvasTexture(surface);
  context.clearRect(0, 0, surface.width, surface.height);
  context.fillStyle = "#111317";
  context.fillRect(0, 0, surface.width, surface.height);
  context.strokeStyle = "rgba(236, 216, 193, .36)";
  context.lineWidth = 4;
  context.strokeRect(8, 8, surface.width - 16, surface.height - 16);
  context.fillStyle = "#ede4d8";
  context.font = "italic 700 96px Georgia, serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("JOI9000", surface.width / 2, surface.height / 2 + 4);
  const texture = new THREE.CanvasTexture(surface);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function createTextCanvas(text: string) {
  const surface = document.createElement("canvas");
  surface.width = 960;
  surface.height = 360;
  const context = surface.getContext("2d");
  if (!context) return surface;
  context.clearRect(0, 0, surface.width, surface.height);
  context.fillStyle = "#fff";
  context.font = `800 ${text === "Joi" ? 284 : 224}px Arial, Helvetica, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, surface.width / 2, surface.height * 0.52);
  return surface;
}

function createJoiFaceCanvas() {
  const surface = document.createElement("canvas");
  surface.width = 520;
  surface.height = 520;
  const context = surface.getContext("2d");
  if (!context) return surface;
  const ellipse = (x: number, y: number, rx: number, ry: number, color: string) => {
    context.beginPath();
    context.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    context.fillStyle = color;
    context.fill();
  };

  context.clearRect(0, 0, 520, 520);
  context.fillStyle = "#61453c";
  context.beginPath();
  context.moveTo(94, 254);
  context.quadraticCurveTo(84, 60, 260, 45);
  context.quadraticCurveTo(438, 62, 428, 254);
  context.quadraticCurveTo(417, 394, 345, 411);
  context.lineTo(175, 410);
  context.quadraticCurveTo(104, 388, 94, 254);
  context.closePath();
  context.fill();
  ellipse(260, 245, 132, 152, "#f3c9b0");
  context.fillStyle = "#68493e";
  context.beginPath();
  context.moveTo(131, 188);
  context.quadraticCurveTo(164, 67, 262, 67);
  context.quadraticCurveTo(367, 67, 401, 184);
  context.quadraticCurveTo(348, 141, 318, 132);
  context.quadraticCurveTo(298, 180, 277, 190);
  context.quadraticCurveTo(254, 140, 229, 130);
  context.quadraticCurveTo(207, 181, 180, 190);
  context.quadraticCurveTo(164, 154, 131, 188);
  context.closePath();
  context.fill();
  context.strokeStyle = "#563a32";
  context.lineWidth = 9;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(180, 216);
  context.quadraticCurveTo(215, 197, 239, 217);
  context.moveTo(283, 217);
  context.quadraticCurveTo(314, 197, 341, 217);
  context.stroke();
  ellipse(209, 258, 35, 42, "#fff9f3");
  ellipse(311, 258, 35, 42, "#fff9f3");
  ellipse(211, 264, 21, 29, "#ba762e");
  ellipse(309, 264, 21, 29, "#ba762e");
  ellipse(212, 267, 12, 20, "#30221f");
  ellipse(308, 267, 12, 20, "#30221f");
  ellipse(204, 254, 6, 8, "#fff");
  ellipse(300, 254, 6, 8, "#fff");
  ellipse(166, 310, 25, 10, "rgba(220,111,91,.42)");
  ellipse(354, 310, 25, 10, "rgba(220,111,91,.42)");
  context.fillStyle = "#a45143";
  context.beginPath();
  context.moveTo(217, 325);
  context.quadraticCurveTo(260, 361, 303, 325);
  context.quadraticCurveTo(286, 386, 260, 387);
  context.quadraticCurveTo(233, 386, 217, 325);
  context.closePath();
  context.fill();
  ellipse(260, 365, 24, 10, "#e58b83");
  context.fillStyle = "#df765d";
  context.beginPath();
  context.moveTo(397, 244);
  context.lineTo(461, 218);
  context.lineTo(441, 275);
  context.lineTo(467, 314);
  context.lineTo(402, 299);
  context.closePath();
  context.fill();
  context.fillStyle = "#f4e7db";
  context.beginPath();
  context.moveTo(145, 520);
  context.quadraticCurveTo(166, 409, 220, 388);
  context.lineTo(302, 388);
  context.quadraticCurveTo(361, 414, 379, 520);
  context.closePath();
  context.fill();
  context.fillStyle = "#fff";
  context.beginPath();
  context.moveTo(206, 399);
  context.lineTo(260, 453);
  context.lineTo(314, 399);
  context.lineTo(298, 520);
  context.lineTo(222, 520);
  context.closePath();
  context.fill();
  context.fillStyle = "#6f8795";
  context.beginPath();
  context.moveTo(260, 430);
  context.lineTo(287, 459);
  context.lineTo(266, 480);
  context.lineTo(260, 520);
  context.lineTo(254, 480);
  context.lineTo(233, 459);
  context.closePath();
  context.fill();
  return surface;
}

function colorFor(index: number, randomValue: number) {
  return JOI_PALETTE[(index * 3 + Math.floor(randomValue * 13)) % JOI_PALETTE.length];
}

function createNebulaShape(count: number): ParticleShape {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const eyes = new Float32Array(count);
  const random = seededRandom(1907);
  for (let index = 0; index < count; index += 1) {
    const offset = index * 3;
    const ratio = index / count;
    let x = 0;
    let y = 0;
    let z = 0;
    if (ratio < 0.82) {
      const theta = Math.acos(1 - 2 * random());
      const phi = Math.PI * 2 * random() + theta * 1.65;
      const shell = 0.62 + Math.pow(random(), 1.8) * 0.28;
      x = Math.sin(theta) * Math.cos(phi) * shell * 1.25;
      y = Math.cos(theta) * shell * 0.95;
      z = Math.sin(theta) * Math.sin(phi) * shell * 0.45;
    } else {
      const angle = random() * Math.PI * 2;
      const radius = 0.86 + random() * 0.56;
      x = Math.cos(angle) * radius * 1.12;
      y = Math.sin(angle) * radius * 0.24;
      z = Math.sin(angle) * 0.18 + (random() - 0.5) * 0.08;
    }
    positions[offset] = x;
    positions[offset + 1] = y;
    positions[offset + 2] = z;
    const color = colorFor(index, random());
    const brightness = 0.72 + random() * 0.35;
    colors[offset] = color[0] * brightness;
    colors[offset + 1] = color[1] * brightness;
    colors[offset + 2] = color[2] * brightness;
  }
  return { positions, colors, eyes, mode: 0 };
}

function createCanvasShape(
  surface: HTMLCanvasElement,
  count: number,
  options: {
    seed: number;
    width: number;
    height: number;
    mode: number;
    pixelColor?: boolean;
    eyes?: Array<{ x: number; y: number; rx: number; ry: number; side: number }>;
  },
): ParticleShape {
  const context = surface.getContext("2d", { willReadFrequently: true });
  const image = context?.getImageData(0, 0, surface.width, surface.height);
  const pixels: Array<{ x: number; y: number; r: number; g: number; b: number }> = [];
  const step = 4;
  let minX = surface.width;
  let minY = surface.height;
  let maxX = 0;
  let maxY = 0;
  if (image) {
    for (let y = 2; y < surface.height; y += step) {
      for (let x = 2; x < surface.width; x += step) {
        const pixelIndex = (y * surface.width + x) * 4;
        if (image.data[pixelIndex + 3] < 36) continue;
        pixels.push({
          x,
          y,
          r: image.data[pixelIndex] / 255,
          g: image.data[pixelIndex + 1] / 255,
          b: image.data[pixelIndex + 2] / 255,
        });
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  if (pixels.length === 0) pixels.push({ x: surface.width / 2, y: surface.height / 2, r: 1, g: 1, b: 1 });
  const contentWidth = Math.max(1, maxX - minX);
  const contentHeight = Math.max(1, maxY - minY);
  const contentCenterX = (minX + maxX) / 2;
  const contentCenterY = (minY + maxY) / 2;
  const scale = Math.min(options.width / contentWidth, options.height / contentHeight);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const eyes = new Float32Array(count);
  const random = seededRandom(options.seed);
  for (let index = 0; index < count; index += 1) {
    const offset = index * 3;
    const pixel = pixels[Math.floor(random() * pixels.length)];
    const pixelX = pixel.x + (random() - 0.5) * step * 0.72;
    const pixelY = pixel.y + (random() - 0.5) * step * 0.72;
    positions[offset] = (pixelX - contentCenterX) * scale;
    positions[offset + 1] = (contentCenterY - pixelY) * scale;
    positions[offset + 2] = (random() - 0.5) * 0.06;
    if (options.pixelColor) {
      colors[offset] = pixel.r;
      colors[offset + 1] = pixel.g;
      colors[offset + 2] = pixel.b;
    } else {
      const color = colorFor(index, random());
      const variation = 0.82 + random() * 0.22;
      colors[offset] = color[0] * variation;
      colors[offset + 1] = color[1] * variation;
      colors[offset + 2] = color[2] * variation;
    }
    for (const eye of options.eyes ?? []) {
      const x = (pixel.x - eye.x) / eye.rx;
      const y = (pixel.y - eye.y) / eye.ry;
      if (x * x + y * y <= 1) {
        eyes[index] = eye.side;
        break;
      }
    }
  }
  return { positions, colors, eyes, mode: options.mode };
}

function createCrtMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: { value: 0 }, uRedPulse: { value: 0 } },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 p = position;
        vec2 centered = uv - 0.5;
        p.z += (1.0 - dot(centered, centered) * 2.3) * 0.045;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uRedPulse;
      varying vec2 vUv;
      float rnd(vec2 value) {
        return fract(sin(dot(value, vec2(12.9898, 78.233))) * 43758.5453);
      }
      void main() {
        vec2 centered = vUv - 0.5;
        vec2 q = abs(centered) - vec2(0.475, 0.445);
        float rounded = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 0.045;
        float mask = 1.0 - smoothstep(-0.008, 0.006, rounded);
        if (mask < 0.01) discard;
        float vignette = smoothstep(0.78, 0.18, length(centered * vec2(1.05, 1.3)));
        float scan = 0.88 + 0.12 * sin(vUv.y * 1050.0 + uTime * 4.0);
        float noise = (rnd(gl_FragCoord.xy + floor(uTime * 20.0)) - 0.5) * 0.045;
        vec3 base = mix(vec3(0.006, 0.012, 0.019), vec3(0.035, 0.073, 0.085), vignette);
        base += vec3(0.12, 0.005, 0.002) * uRedPulse * (1.0 - length(centered));
        gl_FragColor = vec4((base + noise) * scan, mask);
      }
    `,
  });
}

function createFogMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.NormalBlending,
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 1 } },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uOpacity;
      varying vec2 vUv;

      float hash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + 1.0), f.x), f.y);
      }
      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.56;
        for (int i = 0; i < 5; i++) {
          value += amplitude * noise(p);
          p = p * 2.03 + 17.1;
          amplitude *= 0.48;
        }
        return value;
      }
      void main() {
        vec2 uv = vUv;
        float drift = uTime * 0.012;
        float cloud = fbm(uv * vec2(3.4, 2.1) + vec2(drift, -drift * 0.36));
        cloud += fbm(uv * vec2(7.1, 4.2) - vec2(drift * 0.42, 0.0)) * 0.3;
        cloud = smoothstep(0.42, 1.05, cloud);
        float edge = smoothstep(0.0, 0.2, uv.x) * smoothstep(0.0, 0.2, 1.0 - uv.x);
        edge *= smoothstep(0.0, 0.16, uv.y) * smoothstep(0.0, 0.22, 1.0 - uv.y);
        vec3 cold = vec3(0.19, 0.22, 0.29);
        vec3 warm = vec3(0.36, 0.29, 0.28);
        vec3 color = mix(cold, warm, smoothstep(0.22, 0.88, uv.y));
        gl_FragColor = vec4(color, cloud * edge * 0.58 * uOpacity);
      }
    `,
  });
}

function createBeamMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 1 },
      uColor: { value: new THREE.Color(0xf0cda7) },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uOpacity;
      uniform vec3 uColor;
      varying vec2 vUv;
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }
      void main() {
        float longitudinal = smoothstep(0.0, 0.16, vUv.y) * smoothstep(0.0, 0.46, 1.0 - vUv.y);
        float shimmer = 0.82 + hash(floor(vUv * 80.0 + uTime * vec2(1.7, -2.1))) * 0.18;
        float alpha = longitudinal * shimmer * uOpacity * 0.045;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
  });
}

function createParticleMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    uniforms: {
      uTime: { value: 0 },
      uMorph: { value: 1 },
      uMode: { value: 0 },
      uLook: { value: new THREE.Vector2() },
      uPointScale: { value: 1 },
      uRipple: { value: new THREE.Vector3(0, 0, -20) },
      uOpacity: { value: 1 },
    },
    vertexShader: `
      attribute vec3 aTarget;
      attribute vec3 aTargetColor;
      attribute float aSize;
      attribute float aSeed;
      attribute float aEye;
      uniform float uTime;
      uniform float uMorph;
      uniform float uMode;
      uniform vec2 uLook;
      uniform float uPointScale;
      uniform vec3 uRipple;
      uniform float uOpacity;
      varying vec3 vColor;
      varying float vAlpha;
      varying float vPixel;

      void main() {
        float amount = uMorph * uMorph * (3.0 - 2.0 * uMorph);
        vec3 point = mix(position, aTarget, amount);
        vColor = mix(color, aTargetColor, amount);
        float planetary = 1.0 - step(0.5, uMode);
        point += normalize(point + vec3(0.001))
          * sin(uTime * 0.74 + aSeed * 5.7) * 0.008 * planetary;
        float rippleAge = uTime - uRipple.z;
        if (rippleAge > 0.0 && rippleAge < 1.7) {
          vec2 delta = point.xy - uRipple.xy;
          float distanceToPointer = max(length(delta), 0.001);
          float radius = rippleAge * 1.12;
          float ring = exp(-abs(distanceToPointer - radius) * 11.0) * exp(-rippleAge * 1.2);
          point.xy += delta / distanceToPointer * ring * 0.08;
          point.z += ring * 0.14;
        }
        float face = step(2.5, uMode);
        point.xy += uLook * vec2(0.035, 0.025) * abs(aEye) * face;
        vec4 mvPosition = modelViewMatrix * vec4(point, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = max(1.0, aSize * uPointScale * mix(0.78, 1.22, face));
        vAlpha = uOpacity * mix(0.52, 1.0, fract(aSeed * 7.13));
        vPixel = face;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      varying float vPixel;
      void main() {
        vec2 centered = gl_PointCoord - 0.5;
        float circle = 1.0 - smoothstep(0.22, 0.5, length(centered));
        float square = 1.0 - smoothstep(0.4, 0.5, max(abs(centered.x), abs(centered.y)));
        float alpha = mix(circle, square, vPixel) * vAlpha;
        if (alpha < 0.012) discard;
        gl_FragColor = vec4(vColor * (1.05 + circle * 0.18), alpha);
      }
    `,
  });
}

export function Joi9000Hero({ progress, onFormChange, onReady }: Joi9000HeroProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progressRef = useRef(progress);
  const onFormChangeRef = useRef(onFormChange);
  const onReadyRef = useRef(onReady);

  useEffect(() => { progressRef.current = progress; }, [progress]);
  useEffect(() => { onFormChangeRef.current = onFormChange; }, [onFormChange]);
  useEffect(() => { onReadyRef.current = onReady; }, [onReady]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isMobile = window.matchMedia("(max-width: 760px)").matches;
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.shadowMap.enabled = !isMobile;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x07090e, 0.062);
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    const initialCamera = new THREE.Vector3(0, 0.2, 4.5);
    const initialLookAt = new THREE.Vector3(0, 0, 0);
    camera.position.copy(initialCamera);

    // Rebuild Shader's actual scene hierarchy so the model, screen and camera
    // share the same coordinate system as the reference.
    const computer = new THREE.Group();
    computer.position.set(isMobile ? -1 : -1.55, isMobile ? -1 : -0.35, 0);
    computer.scale.setScalar(isMobile ? 0.8 : 0.88);
    computer.rotation.y = isMobile ? 0.71 : 0;
    scene.add(computer);

    const modelRoot = new THREE.Group();
    modelRoot.position.set(-1.1, -1.4, 0);
    modelRoot.scale.setScalar(0.14);
    modelRoot.rotation.y = Math.PI;
    computer.add(modelRoot);

    let disposed = false;
    let modelLoaded = false;
    const labelTexture = makeLabelTexture();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath("/draco/");
    const loader = new GLTFLoader();
    loader.setDRACOLoader(dracoLoader);
    loader.load(
      "/models/joi9000-computer.glb",
      (gltf: any) => {
        if (disposed) return;
        const model = gltf.scene;
        const originalLogo = model.getObjectByName("logo");
        if (originalLogo) {
          originalLogo.visible = true;
          originalLogo.traverse((object: any) => {
            if (!object.isMesh) return;
            object.material = new THREE.MeshStandardMaterial({
              color: 0x090b0e,
              roughness: 0.34,
              metalness: 0.42,
            });
          });
        }
        model.traverse((object: any) => {
          if (!object.isMesh) return;
          object.castShadow = !isMobile && object.name !== "background";
          object.receiveShadow = true;
          if (object.name === "computer" && object.material) {
            object.material = object.material.clone();
            object.material.roughness = 0.8;
            object.material.metalness = 0.83;
            object.material.side = THREE.DoubleSide;
          }
          if (object.name === "keyboard") {
            object.material = new THREE.MeshStandardMaterial({
              color: 0x050609,
              roughness: 0.2,
              metalness: 0,
            });
          }
        });
        modelRoot.add(model);
        modelLoaded = true;
      },
      undefined,
      (error: unknown) => {
        console.error("JOI9000 model failed to load", error);
      },
    );

    const blackMaterial = new THREE.MeshStandardMaterial({
      color: 0x050609,
      roughness: 0.32,
      metalness: 0.34,
    });

    const screenRig = new THREE.Group();
    screenRig.position.set(-22, 11, 2);
    screenRig.rotation.y = Math.PI - 0.735;
    modelRoot.add(screenRig);
    const screenMaterial = createCrtMaterial();
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 28, 20), screenMaterial);
    screen.scale.set(10.15, 7.875, 1);
    screen.position.set(-0.2, -0.55, 0.1);
    screen.rotation.x = -0.07;
    screenRig.add(screen);

    const particleCount = reducedMotion ? 1700 : (isMobile ? 3000 : 5200);
    const particleGeometry = new THREE.BufferGeometry();
    const fromPositions = new Float32Array(particleCount * 3);
    const targetPositions = new Float32Array(particleCount * 3);
    const fromColors = new Float32Array(particleCount * 3);
    const targetColors = new Float32Array(particleCount * 3);
    const eyes = new Float32Array(particleCount);
    const sizes = new Float32Array(particleCount);
    const seeds = new Float32Array(particleCount);
    const sizeRandom = seededRandom(233);
    for (let index = 0; index < particleCount; index += 1) {
      sizes[index] = 0.48 + sizeRandom() * 1.22;
      seeds[index] = sizeRandom() * 1000;
    }
    particleGeometry.setAttribute("position", new THREE.BufferAttribute(fromPositions, 3));
    particleGeometry.setAttribute("aTarget", new THREE.BufferAttribute(targetPositions, 3));
    particleGeometry.setAttribute("color", new THREE.BufferAttribute(fromColors, 3));
    particleGeometry.setAttribute("aTargetColor", new THREE.BufferAttribute(targetColors, 3));
    particleGeometry.setAttribute("aEye", new THREE.BufferAttribute(eyes, 1));
    particleGeometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    particleGeometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));

    const faceSurface = createJoiFaceCanvas();
    const shapes: ParticleShape[] = [
      createNebulaShape(particleCount),
      createCanvasShape(createTextCanvas("Joi"), particleCount, {
        seed: 414,
        width: 2.75,
        height: 1.25,
        mode: 1,
      }),
      createCanvasShape(createTextCanvas("Gallo"), particleCount, {
        seed: 815,
        width: 2.85,
        height: 1.2,
        mode: 2,
      }),
      createCanvasShape(faceSurface, particleCount, {
        seed: 992,
        width: 1.58,
        height: 1.82,
        mode: 3,
        pixelColor: true,
        eyes: [
          { x: 209, y: 258, rx: 38, ry: 46, side: -1 },
          { x: 311, y: 258, rx: 38, ry: 46, side: 1 },
        ],
      }),
    ];
    fromPositions.set(shapes[0].positions);
    targetPositions.set(shapes[0].positions);
    fromColors.set(shapes[0].colors);
    targetColors.set(shapes[0].colors);
    eyes.set(shapes[0].eyes);

    const particleMaterial = createParticleMaterial();
    const particlePoints = new THREE.Points(particleGeometry, particleMaterial);
    particlePoints.position.set(-0.2, -0.55, 0.16);
    particlePoints.rotation.x = -0.07;
    particlePoints.scale.setScalar(3.18);
    screenRig.add(particlePoints);

    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(8.7, 1.58),
      new THREE.MeshBasicMaterial({
        map: labelTexture,
        toneMapped: false,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
    );
    label.position.set(-20.25, 4.78, 0.45);
    label.rotation.set(-Math.PI / 2, 0, Math.PI);
    label.renderOrder = 4;
    modelRoot.add(label);

    const lens = new THREE.Group();
    lens.position.set(-4.25, -4.72, 1);
    lens.rotation.x = -0.07;
    lens.scale.setScalar(1.15);
    const lensOuter = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.78, 0.24, 48), blackMaterial);
    lensOuter.rotation.x = Math.PI / 2;
    lens.add(lensOuter);
    const lensRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.5, 0.095, 16, 48),
      new THREE.MeshStandardMaterial({ color: 0x73150f, emissive: 0xd02216, emissiveIntensity: 0.82, roughness: 0.22 }),
    );
    lensRing.position.z = 0.15;
    lens.add(lensRing);
    const lensCoreMaterial = new THREE.MeshBasicMaterial({
      color: 0xff3a22,
      toneMapped: false,
    });
    const lensCore = new THREE.Mesh(new THREE.SphereGeometry(0.39, 32, 24), lensCoreMaterial);
    lensCore.scale.z = 0.56;
    lensCore.position.z = 0.21;
    lens.add(lensCore);
    const redLight = new THREE.PointLight(0xff2417, 2.8, 8, 2);
    redLight.position.set(0, 0, 1.2);
    lens.add(redLight);
    screenRig.add(lens);

    const fogMaterial = createFogMaterial();
    const fogBackdrop = new THREE.Mesh(new THREE.PlaneGeometry(18, 10), fogMaterial);
    fogBackdrop.position.set(0, 0.2, -5.4);
    fogBackdrop.renderOrder = -10;
    scene.add(fogBackdrop);

    const screenLight = new THREE.PointLight(0xf2c79d, 4.6, 7.5, 1.4);
    scene.add(screenLight);
    const screenLightTarget = new THREE.Object3D();
    scene.add(screenLightTarget);
    const screenSpotLight = new THREE.SpotLight(0xf3cda8, 9.5, 10, 0.52, 0.72, 1.1);
    screenSpotLight.castShadow = !isMobile;
    screenSpotLight.shadow.mapSize.set(1024, 1024);
    screenSpotLight.shadow.bias = -0.0003;
    screenSpotLight.target = screenLightTarget;
    scene.add(screenSpotLight);

    const beamMaterial = createBeamMaterial();
    const screenBeam = new THREE.Mesh(
      new THREE.ConeGeometry(1.72, 2.55, 42, 1, true),
      beamMaterial,
    );
    screenBeam.renderOrder = 3;
    scene.add(screenBeam);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 18),
      new THREE.MeshStandardMaterial({ color: 0x080a10, roughness: 0.9, metalness: 0.04, transparent: true, opacity: 0.74 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.42;
    floor.receiveShadow = true;
    scene.add(floor);

    const ambient = new THREE.HemisphereLight(0xd7e6ff, 0x16131b, 1.35);
    scene.add(ambient);
    const keyLight = new THREE.DirectionalLight(0xffeee1, 3.1);
    keyLight.position.set(-3.5, 5.5, 5.5);
    keyLight.castShadow = !isMobile;
    keyLight.shadow.mapSize.set(1024, 1024);
    scene.add(keyLight);
    const rimLight = new THREE.PointLight(0x5f82ff, 3.2, 14, 2);
    rimLight.position.set(3.5, 1.8, -1);
    scene.add(rimLight);

    const dustGeometry = new THREE.BufferGeometry();
    const dustCount = isMobile ? 220 : 520;
    const dustPositions = new Float32Array(dustCount * 3);
    const dustRandom = seededRandom(9000);
    for (let index = 0; index < dustCount; index += 1) {
      const offset = index * 3;
      dustPositions[offset] = (dustRandom() - 0.5) * 14;
      dustPositions[offset + 1] = (dustRandom() - 0.5) * 8;
      dustPositions[offset + 2] = -1 - dustRandom() * 8;
    }
    dustGeometry.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
    const dustMaterial = new THREE.PointsMaterial({
      color: 0xd7c4ae,
      size: 0.012,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
    });
    const dust = new THREE.Points(dustGeometry, dustMaterial);
    scene.add(dust);

    let animationFrame = 0;
    let width = 1;
    let height = 1;
    const clock = new THREE.Clock();
    const finalCamera = new THREE.Vector3();
    const screenWorldPosition = new THREE.Vector3();
    const screenWorldScale = new THREE.Vector3();
    const screenWorldQuaternion = new THREE.Quaternion();
    const screenNormal = new THREE.Vector3();
    const lookAt = new THREE.Vector3();
    const pointer = new THREE.Vector2();
    const targetPointer = new THREE.Vector2();
    const lightOrigin = new THREE.Vector3();
    const beamOrigin = new THREE.Vector3();
    const lightTarget = new THREE.Vector3();
    const lightDirection = new THREE.Vector3();
    const beamUp = new THREE.Vector3(0, 1, 0);
    const formLightColors = [
      new THREE.Color(0xf2c9a6),
      new THREE.Color(0xf07861),
      new THREE.Color(0x8ab6cc),
      new THREE.Color(0xefb47b),
    ];
    let currentForm = 0;
    let transitionStartedAt = 0;
    let transitionDuration = 1.1;
    let transitionActive = false;
    let readySent = false;

    const updateFinalCamera = () => {
      screen.updateWorldMatrix(true, false);
      screen.getWorldPosition(screenWorldPosition);
      screen.getWorldScale(screenWorldScale);
      screen.getWorldQuaternion(screenWorldQuaternion);
      screenNormal.set(0, 0, 1).applyQuaternion(screenWorldQuaternion).normalize();
      const radians = THREE.MathUtils.degToRad(50);
      const aspect = width / Math.max(1, height);
      const screenAspect = screenWorldScale.x / Math.max(0.001, screenWorldScale.y);
      const fitDistance = (aspect < screenAspect
        ? screenWorldScale.y / 2 / Math.tan(radians / 2)
        : screenWorldScale.x / 2 / (Math.tan(radians / 2) * aspect)) * 0.9;
      finalCamera.copy(screenWorldPosition).addScaledVector(screenNormal, fitDistance);
    };

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.25 : 1.65));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      particleMaterial.uniforms.uPointScale.value = renderer.getPixelRatio() * (isMobile ? 1.15 : 1);
      updateFinalCamera();
    };

    const snapshotMorph = () => {
      const amount = smooth(particleMaterial.uniforms.uMorph.value);
      for (let index = 0; index < fromPositions.length; index += 1) {
        fromPositions[index] += (targetPositions[index] - fromPositions[index]) * amount;
        fromColors[index] += (targetColors[index] - fromColors[index]) * amount;
      }
    };

    const morphTo = (nextForm: number) => {
      snapshotMorph();
      const shape = shapes[nextForm];
      targetPositions.set(shape.positions);
      targetColors.set(shape.colors);
      eyes.set(shape.eyes);
      particleGeometry.attributes.position.needsUpdate = true;
      particleGeometry.attributes.aTarget.needsUpdate = true;
      particleGeometry.attributes.color.needsUpdate = true;
      particleGeometry.attributes.aTargetColor.needsUpdate = true;
      particleGeometry.attributes.aEye.needsUpdate = true;
      particleMaterial.uniforms.uMorph.value = 0;
      particleMaterial.uniforms.uMode.value = shape.mode;
      transitionStartedAt = particleMaterial.uniforms.uTime.value;
      transitionDuration = reducedMotion ? 0.01 : (nextForm === 3 ? 1.35 : 1.16);
      transitionActive = true;
      currentForm = nextForm;
      onFormChangeRef.current(nextForm);
    };

    const pointerMove = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect();
      targetPointer.set(
        ((event.clientX - bounds.left) / Math.max(1, bounds.width)) * 2 - 1,
        -(((event.clientY - bounds.top) / Math.max(1, bounds.height)) * 2 - 1),
      );
      if (reducedMotion || progressRef.current > 0.72) return;
      const now = particleMaterial.uniforms.uTime.value;
      if (now - particleMaterial.uniforms.uRipple.value.z > 0.12) {
        particleMaterial.uniforms.uRipple.value.set(targetPointer.x * 1.55, targetPointer.y * 0.98, now);
      }
    };
    const pointerLeave = () => targetPointer.set(0, 0);
    const click = () => {
      if (progressRef.current > 0.7) return;
      morphTo((currentForm + 1) % FORM_COUNT);
    };

    canvas.addEventListener("pointermove", pointerMove, { passive: true });
    canvas.addEventListener("pointerleave", pointerLeave);
    canvas.addEventListener("click", click);
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    resize();
    onFormChangeRef.current(0);

    const render = () => {
      const delta = Math.min(clock.getDelta(), 0.05);
      const time = particleMaterial.uniforms.uTime.value + delta;
      particleMaterial.uniforms.uTime.value = time;
      screenMaterial.uniforms.uTime.value = time;
      fogMaterial.uniforms.uTime.value = time;
      beamMaterial.uniforms.uTime.value = time;
      if (transitionActive) {
        const amount = clamp01((time - transitionStartedAt) / transitionDuration);
        particleMaterial.uniforms.uMorph.value = amount;
        if (amount >= 1) transitionActive = false;
      }
      pointer.lerp(targetPointer, reducedMotion ? 1 : 1 - Math.exp(-5.4 * delta));
      particleMaterial.uniforms.uLook.value.copy(pointer);
      const journey = clamp01(progressRef.current);
      const cameraProgressBase = Math.min(journey / 0.8, 1);
      const cameraProgress = 1 - Math.pow(1 - cameraProgressBase, 1.4);
      const parallaxStrength = 1 - cameraProgress;
      const filmHandoff = smooth((journey - 0.66) / 0.22);
      particleMaterial.uniforms.uOpacity.value = 1 - filmHandoff;
      updateFinalCamera();
      lightOrigin.copy(screenWorldPosition).addScaledVector(screenNormal, 0.26);
      beamOrigin
        .set(screenWorldPosition.x, screenWorldPosition.y - screenWorldScale.y * 0.44, screenWorldPosition.z)
        .addScaledVector(screenNormal, 0.18);
      lightTarget.set(screenWorldPosition.x, screenWorldPosition.y - 2.15, screenWorldPosition.z + 0.72);
      screenLight.position.copy(lightOrigin);
      screenSpotLight.position.copy(lightOrigin);
      screenLightTarget.position.copy(lightTarget);
      screenLight.color.lerp(formLightColors[currentForm], 1 - Math.exp(-2.4 * delta));
      screenSpotLight.color.copy(screenLight.color);
      beamMaterial.uniforms.uColor.value.copy(screenLight.color);
      screenBeam.position.copy(beamOrigin).add(lightTarget).multiplyScalar(0.5);
      lightDirection.subVectors(beamOrigin, lightTarget);
      const beamLength = Math.max(0.01, lightDirection.length());
      screenBeam.quaternion.setFromUnitVectors(beamUp, lightDirection.normalize());
      screenBeam.scale.set(1, beamLength / 2.55, 1);
      const outsideScreen = 1 - smooth((journey - 0.56) / 0.22);
      beamMaterial.uniforms.uOpacity.value = outsideScreen;
      fogMaterial.uniforms.uOpacity.value = (0.92 - cameraProgress * 0.62) * (1 - filmHandoff);
      screenLight.intensity = 3.7 + Math.sin(time * 1.2) * 0.24;
      screenSpotLight.intensity = 8.7 + Math.sin(time * 1.2) * 0.42;
      camera.position.lerpVectors(initialCamera, finalCamera, cameraProgress);
      camera.position.x += pointer.x * 0.3 * parallaxStrength;
      camera.position.y += pointer.y * 0.3 * parallaxStrength;
      lookAt.lerpVectors(initialLookAt, screenWorldPosition, cameraProgress);
      camera.lookAt(lookAt);
      const lensPulse = 1 + Math.sin(time * 1.45) * 0.035;
      lensCore.scale.set(lensPulse, lensPulse, 0.56);
      redLight.intensity = 2.45 + Math.sin(time * 1.45) * 0.24;
      screenMaterial.uniforms.uRedPulse.value = Math.max(0, Math.sin(time * 1.45)) * 0.12;
      dust.rotation.z += reducedMotion ? 0 : delta * 0.006;
      renderer.render(scene, camera);
      if (!readySent && modelLoaded) {
        readySent = true;
        onReadyRef.current();
      }
      animationFrame = window.requestAnimationFrame(render);
    };
    render();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("pointerleave", pointerLeave);
      canvas.removeEventListener("click", click);
      scene.traverse((object: any) => {
        object.geometry?.dispose?.();
        if (Array.isArray(object.material)) object.material.forEach((material: any) => material.dispose?.());
        else object.material?.dispose?.();
      });
      labelTexture.dispose();
      dracoLoader.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={styles.computerCanvas}
      aria-label="Interactive JOI9000 terminal. Move to disturb the screen particles and click to reform them."
    />
  );
}
