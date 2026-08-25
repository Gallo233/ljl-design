"use client";

import { useEffect, useRef } from "react";
import { createHeroScene, type HeroScene } from "./heroScene";
import { detectQuality } from "./quality";
import styles from "./joi-signal-lab.module.css";
import * as THREE from "three";

type Joi9000HeroProps = {
  /** Live scroll progress, 0 at the top to 1 when the reel has arrived. */
  progressRef: { current: number };
  onFormChange: (index: number) => void;
  onReady: () => void;
};

/**
 * The hero's canvas and loop.
 *
 * The scene itself now lives in `heroScene.ts` and knows nothing about renderers —
 * this component is the part that owns a canvas, a pixel ratio and a frame loop, and
 * it is deliberately thin, because a stage that composites every scene through one
 * post chain will take that job over and this file will go.
 */
export function Joi9000Hero({ progressRef, onFormChange, onReady }: Joi9000HeroProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onFormChangeRef = useRef(onFormChange);
  const onReadyRef = useRef(onReady);

  useEffect(() => { onFormChangeRef.current = onFormChange; }, [onFormChange]);
  useEffect(() => { onReadyRef.current = onReady; }, [onReady]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const quality = detectQuality();

    let renderer: any;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
    } catch {
      // No context: the CSS backdrop behind this canvas carries the hero on its own.
      onReadyRef.current();
      return;
    }
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.shadowMap.enabled = quality.shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const hero: HeroScene = createHeroScene({
      isMobile: quality.isMobile,
      reducedMotion: quality.reducedMotion,
      shadows: quality.shadows,
      onFormChange: (index) => onFormChangeRef.current(index),
      onModelReady: () => onReadyRef.current(),
    });

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const width = Math.max(1, bounds.width);
      const height = Math.max(1, bounds.height);
      const pixelRatio = Math.min(window.devicePixelRatio || 1, quality.dprCap);
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
      hero.setSize(width, height, pixelRatio);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    resize();

    const pointerMove = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect();
      hero.setPointer(
        ((event.clientX - bounds.left) / Math.max(1, bounds.width)) * 2 - 1,
        -(((event.clientY - bounds.top) / Math.max(1, bounds.height)) * 2 - 1),
      );
    };
    const pointerLeave = () => hero.setPointer(0, 0);
    const click = () => hero.cycleForm();
    canvas.addEventListener("pointermove", pointerMove, { passive: true });
    canvas.addEventListener("pointerleave", pointerLeave);
    canvas.addEventListener("click", click);

    /**
     * The CRT layer's opacity is `max(0, 1 - filmReveal * 1.35)` (see JoiSignalLab), which
     * reaches zero a little past `progress` 0.83. Past that this scene — a GLB, thousands of
     * particles, shadow-casting lights — was still being drawn sixty times a second behind a
     * fully transparent layer, on the same GPU the reel was competing for.
     *
     * The scene keeps updating so nothing has to be rebuilt on the way back up; only the
     * draw call is skipped. The first pass always runs, because the boot loader waits on
     * `onReady`, which the scene fires from inside its first update.
     */
    const HERO_HIDDEN_AT = 0.86;

    const clock = new THREE.Clock();
    let frame = 0;
    const render = () => {
      const delta = Math.min(clock.getDelta(), 0.05);
      const progress = progressRef.current;
      hero.update(delta, progress);
      if (!hero.isReady() || (!document.hidden && progress < HERO_HIDDEN_AT)) {
        renderer.render(hero.scene, hero.camera);
      }
      frame = window.requestAnimationFrame(render);
    };
    render();

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("pointerleave", pointerLeave);
      canvas.removeEventListener("click", click);
      hero.dispose();
      renderer.dispose();
    };
  }, [progressRef]);

  return (
    <canvas
      ref={canvasRef}
      className={styles.computerCanvas}
      aria-label="Interactive JOI9000 terminal. Move to disturb the screen particles and click to reform them."
    />
  );
}
