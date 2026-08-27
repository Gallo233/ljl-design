"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { createOceanScene, SEA_STATES } from "../../joi-signal-lab/oceanScene";
import { createHeroScene } from "../../joi-signal-lab/heroScene";

/**
 * A bench for the sea, driven from the console rather than from a scroll.
 *
 * Nothing here ships. It exists for the same reason `room-preview` does: an agent
 * browser pane reports `document.visibilityState === "hidden"`, which suspends
 * `requestAnimationFrame` and therefore every paint on the site, so a screenshot of the
 * real page is a black rectangle whatever the water is doing. This renders explicitly,
 * one frame per call, into a `preserveDrawingBuffer` canvas.
 *
 *   await __ocean.shot("calm")
 *   __ocean.state(3); await __ocean.shot("dusk")
 *   __ocean.probe()            // sampled colours vs. the reference readings
 *
 * Frames land in `.next/cache/room-preview/<name>.png` via the existing capture route.
 */

/** Copied from `postfx.ts` so the bench tone maps exactly the way the page does. */
const NEUTRAL_TONEMAP_GLSL = /* glsl */ `
  vec3 neutralToneMapping(vec3 color, float exposure) {
    const float StartCompression = 0.8 - 0.04;
    const float Desaturation = 0.15;
    color *= exposure;
    float x = min(color.r, min(color.g, color.b));
    float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
    color -= offset;
    float peak = max(color.r, max(color.g, color.b));
    if (peak < StartCompression) return color;
    float d = 1.0 - StartCompression;
    float newPeak = 1.0 - d * d / (peak + d - StartCompression);
    color *= newPeak / peak;
    float g = 1.0 - 1.0 / (Desaturation * (peak - newPeak) + 1.0);
    return mix(color, vec3(newPeak), g);
  }
`;

const WIDTH = 1280;
const HEIGHT = Math.round(1280 / (10.15 / 7.875));

export function OceanPreview() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: false,
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(1);
    renderer.setSize(WIDTH, HEIGHT, false);
    renderer.domElement.style.maxWidth = "100%";
    host.appendChild(renderer.domElement);

    const ocean = createOceanScene({ isMobile: false, reducedMemory: false, reducedMotion: false, aspect: WIDTH / HEIGHT });

    /*
     * The sea on its own is only half the deliverable — what ships is the sea seen
     * through the JOI9000's glass. This is the production path exactly: the ocean scene
     * into a HalfFloat target, the target sampled by the terminal's screen material,
     * the terminal through the same tone map and grade the stage applies.
     */
    const heroTarget = new THREE.WebGLRenderTarget(WIDTH, HEIGHT, {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
      stencilBuffer: false,
      generateMipmaps: false,
    });
    heroTarget.texture.colorSpace = THREE.LinearSRGBColorSpace;
    const hero = createHeroScene({
      isMobile: false,
      reducedMotion: false,
      shadows: true,
      screenMap: heroTarget.texture,
      onModelReady: () => console.info("[ocean-preview] JOI9000 model ready"),
    });

    // The sea writes scene-linear; on the page the CRT glass samples it and `postfx`
    // owns the one tone map and the one encode. Drawing straight to a canvas here would
    // show un-encoded linear — a flat dark slab — so the bench repeats the chain's
    // colour half: Neutral tone map, linear->sRGB, then the sepia/contrast the compose
    // pass applies. `uCrt` toggles that last part so the sea can be judged both as it
    // leaves the shader and as it arrives on the glass.
    const target = new THREE.WebGLRenderTarget(WIDTH, HEIGHT, { type: THREE.HalfFloatType });
    target.texture.colorSpace = THREE.LinearSRGBColorSpace;
    const gradeScene = new THREE.Scene();
    const gradeCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const grade = new THREE.ShaderMaterial({
      uniforms: {
        uBase: { value: target.texture },
        uCrt: { value: 1 },
        uSepiaIntensity: { value: 0.18 },
        uContrast: { value: 1.04 },
        uPhosphor: { value: new THREE.Vector3(1.0, 0.8, 0.0) },
        uPhosphorAmount: { value: 0.1 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
      `,
      fragmentShader: `
        precision highp float;
        uniform sampler2D uBase;
        uniform float uCrt;
        uniform float uSepiaIntensity;
        uniform float uContrast;
        uniform vec3 uPhosphor;
        uniform float uPhosphorAmount;
        varying vec2 vUv;
        ${NEUTRAL_TONEMAP_GLSL}
        void main() {
          vec3 c = max(texture2D(uBase, vUv).rgb, vec3(0.0));
          c = neutralToneMapping(c, 1.0);
          // Stand-in for the chain's bloom feeding the phosphor add: the bright half of
          // the picture is what lights it, and on the sea that is the glitter.
          float bright = max(0.0, dot(c, vec3(0.2126, 0.7152, 0.0722)) - 0.62);
          c += bright * uPhosphor * uPhosphorAmount * uCrt;
          vec3 lo = c * 12.92;
          vec3 hi = 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055;
          c = mix(lo, hi, step(vec3(0.0031308), c));
          vec3 sepia = vec3(
            dot(c, vec3(0.393, 0.769, 0.189)),
            dot(c, vec3(0.349, 0.686, 0.168)),
            dot(c, vec3(0.272, 0.534, 0.131))
          );
          c = mix(c, sepia, uSepiaIntensity * uCrt);
          c = clamp(c, 0.0, 1.0);
          c = mix(c, clamp((c - 0.5) * uContrast + 0.5, 0.0, 1.0), uCrt);
          gl_FragColor = vec4(c, 1.0);
        }
      `,
    });
    gradeScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), grade));

    let simulated = 0;

    /** The sea alone, filling the frame. */
    const draw = () => {
      renderer.setRenderTarget(target);
      renderer.render(ocean.scene, ocean.camera);
      renderer.setRenderTarget(null);
      renderer.render(gradeScene, gradeCamera);
    };

    /** The sea as it actually ships: inside the terminal, at a given scroll position. */
    const drawTerminal = (progress: number) => {
      renderer.setRenderTarget(heroTarget);
      renderer.clear();
      renderer.render(ocean.scene, ocean.camera);
      renderer.setRenderTarget(null);
      hero.setSize(WIDTH, HEIGHT);
      hero.update(1 / 60, progress);
      renderer.setRenderTarget(target);
      renderer.clear();
      renderer.render(hero.scene, hero.camera);
      renderer.setRenderTarget(null);
      renderer.render(gradeScene, gradeCamera);
    };

    const readback = document.createElement("canvas");
    readback.width = WIDTH;
    readback.height = HEIGHT;
    const readbackContext = readback.getContext("2d", { willReadFrequently: true });

    const hex = (r: number, g: number, b: number) =>
      "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");

    const api = {
      ocean,
      renderer,
      states: SEA_STATES.map((state) => state.label),

      /**
       * Advance the simulation without painting. Sixty steps a second so the wave
       * cascade settles the same way it would after a few seconds on the page — a
       * single huge delta would put every octave at the same phase.
       */
      advance(seconds = 6) {
        const step = 1 / 60;
        for (let t = 0; t < seconds; t += step) ocean.update(step);
        simulated += seconds;
        return `t = ${simulated.toFixed(1)}s`;
      },

      /** Jump to a sea state and settle it, since the states cross-fade over ~1.4s. */
      state(index: number) {
        while (ocean.seaState() !== index) ocean.cycleSeaState();
        api.advance(4);
        return SEA_STATES[index].label;
      },

      /** Toggle the CRT half of the grade to see the sea before/after the filter. */
      crt(on = true) {
        grade.uniforms.uCrt.value = on ? 1 : 0;
        return on ? "with CRT grade" : "raw tone-mapped";
      },

      /**
       * Average colour in horizontal bands, against the readings taken off the
       * reference footage. Numbers, because judging blue-green by eye through a sepia
       * filter on a hidden browser pane is not judging anything.
       */
      probe() {
        draw();
        readbackContext!.drawImage(renderer.domElement, 0, 0);
        const band = (label: string, y0: number, y1: number, reference: string) => {
          const top = Math.round(HEIGHT * y0);
          const rows = Math.max(1, Math.round(HEIGHT * (y1 - y0)));
          const data = readbackContext!.getImageData(0, top, WIDTH, rows).data;
          let r = 0, g = 0, b = 0;
          for (let i = 0; i < data.length; i += 4) { r += data[i]; g += data[i + 1]; b += data[i + 2]; }
          const n = data.length / 4;
          return {
            band: label,
            got: hex(Math.round(r / n), Math.round(g / n), Math.round(b / n)),
            reference,
          };
        };
        // References are the reference footage averaged over these exact bands. Earlier
        // numbers came from differently-placed crops and were not comparable.
        return [
          band("sky", 0.05, 0.3, "#a1afc5"),
          band("horizon haze", 0.4, 0.45, "#9ca4b1"),
          band("far water", 0.46, 0.58, "#708295"),
          band("near water", 0.8, 0.98, "#527683"),
        ];
      },

      /** Find the horizon by the biggest row-to-row luminance drop. Should land at 43%. */
      horizon() {
        draw();
        readbackContext!.drawImage(renderer.domElement, 0, 0);
        const data = readbackContext!.getImageData(0, 0, WIDTH, HEIGHT).data;
        const rowLuma: number[] = [];
        for (let y = 0; y < HEIGHT; y += 1) {
          let sum = 0;
          for (let x = 0; x < WIDTH * 0.45; x += 8) {
            const i = (y * WIDTH + x) * 4;
            sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
          }
          rowLuma.push(sum / (WIDTH * 0.45 / 8));
        }
        let bestDrop = 0;
        let bestY = 0;
        // Searched between 30% and 60% only. Below that the glitter path produces a
        // bigger row-to-row drop than the horizon does; above it, a cloud edge does. The
        // horizon cannot be outside this band for any camera we would ship.
        for (let y = Math.round(HEIGHT * 0.3); y < HEIGHT * 0.6; y += 1) {
          const drop = rowLuma[y - 4] - rowLuma[y + 4];
          if (drop > bestDrop) { bestDrop = drop; bestY = y; }
        }
        return { row: bestY, fraction: +(bestY / HEIGHT).toFixed(3), target: 0.43, drop: +bestDrop.toFixed(1) };
      },

      hero,

      /**
       * Shoot the terminal at a scroll position: 0 is the top of the page, 0.66 is where
       * the camera has nearly arrived at the glass and the picture is still at full
       * strength — the worst case for the target being magnified.
       */
      async terminal(name: string, progress = 0) {
        // The camera flight and the light spill both settle over time, so let them.
        for (let i = 0; i < 90; i += 1) drawTerminal(progress);
        const dataUrl = renderer.domElement.toDataURL("image/png");
        const response = await fetch("/api/room-capture", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: `terminal-${name}`, dataUrl }),
        });
        return response.json();
      },

      /**
       * Build, render and dispose one sea per quality tier. Each tier compiles a
       * different shader — the wave and detail counts are `#define`s — so a tier that
       * only exists on a phone can fail to compile and nobody would find out here.
       */
      tiers() {
        const cases = [
          { label: "desktop", isMobile: false, reducedMemory: false, reducedMotion: false },
          { label: "reducedMemory", isMobile: false, reducedMemory: true, reducedMotion: false },
          { label: "mobile", isMobile: true, reducedMemory: true, reducedMotion: false },
          { label: "reducedMotion", isMobile: false, reducedMemory: false, reducedMotion: true },
        ];
        return cases.map((tier) => {
          const before = renderer.info.programs?.length ?? 0;
          const probe = createOceanScene({ ...tier, aspect: WIDTH / HEIGHT });
          for (let i = 0; i < 40; i += 1) probe.update(1 / 60);
          renderer.setRenderTarget(target);
          renderer.render(probe.scene, probe.camera);
          renderer.setRenderTarget(null);
          const errors = renderer.getContext().getError();
          const sea: any = probe.scene.children.find((c: any) => c.geometry?.index);
          const verts = sea ? sea.geometry.attributes.position.count : 0;
          const tris = sea ? sea.geometry.index.count / 3 : 0;
          probe.dispose();
          return {
            ...tier,
            vertices: verts,
            triangles: tris,
            waveCount: sea?.material.defines.WAVE_COUNT,
            detailOctaves: sea?.material.defines.DETAIL_OCTAVES,
            glError: errors,
            programsBefore: before,
          };
        });
      },

      /** Render one frame and write it to `.next/cache/room-preview/<name>.png`. */
      async shot(name: string) {
        draw();
        const dataUrl = renderer.domElement.toDataURL("image/png");
        const response = await fetch("/api/room-capture", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: `ocean-${name}`, dataUrl }),
        });
        return response.json();
      },
    };

    api.advance(8);
    draw();
    (window as any).__ocean = api;
    console.info("[ocean-preview] ready — window.__ocean");

    return () => {
      delete (window as any).__ocean;
      ocean.dispose();
      hero.dispose();
      heroTarget.dispose();
      target.dispose();
      grade.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={hostRef} style={{ display: "grid", placeItems: "center", minHeight: "100vh", background: "#05080c" }} />;
}
