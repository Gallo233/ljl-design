"use client";
import { useEffect, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { holoVertex, holoFragment, holoEdgeFragment } from "./holoMaterial";

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const artwork = `${base}/media/holo-badge-original`;

/** A Blender-authored laminate, with the skill's four registered texture layers.
 * The renderer lives across flips. Hiding a face pauses drawing, never disposes its
 * context; the original image beneath remains the loading/context-loss fallback.
 */
export function HoloBack({ active, flipped, surface }: {
  active: boolean; flipped: boolean; surface: RefObject<HTMLDivElement | null>;
}) {
  const host = useRef<HTMLSpanElement>(null);
  const [started, setStarted] = useState(false);
  const state = useRef({ active, flipped });
  state.current = { active, flipped };
  const wake = useRef<() => void>(() => {});
  useEffect(() => { if (active) setStarted(true); wake.current(); }, [active, flipped]);

  useEffect(() => {
    const element = host.current;
    if (!started || !element) return;
    let renderer: any;
    try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" }); }
    catch { element.dataset.holoState = "fallback"; return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    // This is already graded illustration, not scene-referred camera footage.
    // Keep the original print's sRGB values; only foil/contour highlights bloom.
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.setClearColor(0x081416, 1);
    const canvas = renderer.domElement;
    canvas.style.cssText = "display:block;width:100%;height:100%";
    element.appendChild(canvas);
    element.dataset.holoState = "loading";
    element.style.opacity = "0";

    const scene = new THREE.Scene();
    // The GLB is authored in this exact 190:268 card proportion, including its hole.
    const width = 6.3, height = width * 268 / 190;
    const camera = new THREE.OrthographicCamera(-width / 2, width / 2, height / 2, -height / 2, .1, 40);
    camera.position.set(0, 0, 20);
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(380, 536), .22, .35, 1.0);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    const uniforms = {
      tSubject: { value: null as any }, tBackground: { value: null as any },
      tText: { value: null as any }, tLine: { value: null as any },
      uTime: { value: 0 }, uView: { value: new THREE.Vector3(0, 0, 1) },
      uFoil: { value: .9 }, uScale: { value: 1.25 },
      uDepth: { value: .4 }, uBgDepth: { value: -.25 },
    };
    const faceMaterial = new THREE.ShaderMaterial({ uniforms, vertexShader: holoVertex, fragmentShader: holoFragment });
    const edgeMaterial = new THREE.ShaderMaterial({ uniforms, vertexShader: holoVertex, fragmentShader: holoEdgeFragment });
    const goldMaterial = new THREE.MeshBasicMaterial({ color: 0xced1c4 });
    const materials = [faceMaterial, edgeMaterial, goldMaterial];
    const textures: any[] = [];
    let model: any = null, frame = 0, disposed = false, ready = false, contextLost = false;
    let drawUntil = 0, previousView = "", lastPaint = 0;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");

    const paint = (now: number) => {
      frame = 0;
      if (disposed || contextLost || !ready || !state.current.active || document.hidden) return;
      // Pointer samples may arrive at 120–240Hz. Match a 60Hz drawing budget
      // before reading an animated CSS matrix or submitting the bloom passes.
      if (now - lastPaint < 15) {
        if (now < drawUntil) frame = requestAnimationFrame(paint);
        return;
      }
      // The DOM flip and the image plane both rotate by 180deg, so derive the eye
      // from their combined matrix. Using the GLB plane matrix swaps up and normal.
      const transform = surface.current ? getComputedStyle(surface.current).transform : "none";
      const matrix = new DOMMatrix(transform === "none" ? undefined : transform).rotate(0, 180, 0).inverse();
      const view = matrix.transformPoint(new DOMPoint(0, 0, 1, 0));
      uniforms.uView.value.set(view.x, -view.y, view.z).normalize();
      const key = [view.x, view.y, view.z].map(n => n.toFixed(4)).join(",");
      const visible = state.current.flipped || view.z > .02;
      if (visible && (key !== previousView || (!motion.matches && now - lastPaint > 50))) {
        uniforms.uTime.value = motion.matches ? 0 : now * .001;
        composer.render();
        element.style.opacity = "1";
        element.dataset.holoView = key;
        previousView = key; lastPaint = now;
      }
      // A bounded burst follows transitions/hover; idle and off-section cost no rAF.
      if (visible && now < drawUntil) frame = requestAnimationFrame(paint);
    };
    const schedule = () => {
      // A pointer moving over Contact must not wake the hidden reverse. During
      // a flip to the portrait, finish only the portion that is still facing us.
      if (!state.current.flipped && uniforms.uView.value.z <= 0) return;
      drawUntil = performance.now() + (motion.matches ? 520 : 1100);
      if (!frame && ready && !disposed && state.current.active && !contextLost) frame = requestAnimationFrame(paint);
    };
    wake.current = schedule;
    const resize = () => {
      const w = element.clientWidth, h = element.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false); composer.setSize(w, h); schedule();
    };
    const observer = new ResizeObserver(resize); observer.observe(element); resize();
    const lost = (event: Event) => {
      event.preventDefault(); contextLost = true; cancelAnimationFrame(frame); frame = 0;
      element.style.opacity = "0"; element.dataset.holoState = "fallback";
    };
    const restored = () => { contextLost = false; element.dataset.holoState = "ready"; previousView = ""; schedule(); };
    canvas.addEventListener("webglcontextlost", lost);
    canvas.addEventListener("webglcontextrestored", restored);
    window.addEventListener("pointermove", schedule, { passive: true });
    window.addEventListener("pointerup", schedule, { passive: true });
    document.addEventListener("visibilitychange", schedule);
    motion.addEventListener("change", schedule);

    const loader = new THREE.TextureLoader();
    const loadImage = async (name: string) => {
      const texture = await loader.loadAsync(`${artwork}/${name}.png`);
      if (disposed) { texture.dispose(); return texture; }
      texture.colorSpace = THREE.NoColorSpace;
      texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
      textures.push(texture); return texture;
    };
    const loadModel = async () => {
      const gltf = await new GLTFLoader().loadAsync(`${base}/models/holo-badge-original.glb`);
      if (disposed) {
        gltf.scene.traverse((ob: any) => { ob.geometry?.dispose(); if (Array.isArray(ob.material)) ob.material.forEach((m: any) => m.dispose()); else ob.material?.dispose(); });
        return gltf.scene;
      }
      model = gltf.scene; return model;
    };
    Promise.all([Promise.all(["subject", "background", "text", "lineart"].map(loadImage)), loadModel()])
      .then(([layers, root]) => {
        if (disposed) return;
        [uniforms.tSubject.value, uniforms.tBackground.value, uniforms.tText.value, uniforms.tLine.value] = layers;
        let fronts = 0;
        root.traverse((ob: any) => {
          if (!ob.isMesh) return;
          const originals = Array.isArray(ob.material) ? ob.material : [ob.material];
          const mapped = originals.map((original: any) => {
            const role = original.name; original.dispose();
            if (role === "web_front") { fronts++; return faceMaterial; }
            if (role === "web_gold") return goldMaterial;
            if (role === "web_text") ob.visible = false;
            return edgeMaterial;
          });
          ob.material = Array.isArray(ob.material) ? mapped : mapped[0];
        });
        if (!fronts) throw new Error("Missing Blender web_front material");
        scene.add(root); ready = true;
        element.dataset.holoState = "ready";
        element.dataset.holoLayers = "subject background lineart text";
        element.dataset.holoModel = "Blender / holo-badge-original.glb";
        resize(); schedule();
      }).catch((error: unknown) => {
        if (!disposed) { element.dataset.holoState = "fallback"; element.style.opacity = "0"; console.warn("Holographic badge kept its printed fallback:", error); }
      });

    return () => {
      disposed = true; ready = false; wake.current = () => {};
      cancelAnimationFrame(frame); observer.disconnect();
      window.removeEventListener("pointermove", schedule); window.removeEventListener("pointerup", schedule);
      document.removeEventListener("visibilitychange", schedule); motion.removeEventListener("change", schedule);
      // Remove the handler before deliberately releasing the context. It must never
      // hide a future canvas mounted into this same span during React remount/HMR.
      canvas.removeEventListener("webglcontextlost", lost); canvas.removeEventListener("webglcontextrestored", restored);
      model?.traverse((ob: any) => ob.geometry?.dispose());
      textures.forEach(texture => texture.dispose()); materials.forEach(material => material.dispose());
      composer.passes.forEach((pass: any) => pass.dispose?.()); composer.dispose();
      renderer.dispose(); renderer.forceContextLoss(); canvas.remove();
    };
  }, [started, surface]);
  return <span ref={host} aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />;
}
