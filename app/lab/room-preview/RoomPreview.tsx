"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { createRoomScene } from "../../joi-signal-lab/room3d";
import { JoiMusicPlayer } from "../../joi-signal-lab/JoiMusicPlayer";

/**
 * A bench for the About room, driven from the console rather than from a scroll.
 *
 * Nothing here ships: the page is development-only. It exists because the room is the
 * one part of the site that cannot be checked by reading the DOM, and because an agent
 * browser pane suspends `requestAnimationFrame` — so this renders explicitly, one
 * frame per call, into a `preserveDrawingBuffer` canvas.
 *
 *   await __room.ready
 *   __room.nodes("book")                              // find geometry by name
 *   await __room.shot("wide", { pos: [11, 6, 16], look: [0, 2.3, -1.7] })
 *   await __room.shot("atlas-check", { only: "screen" })   // isolate one node
 *
 * Frames land in `.next/cache/room-preview/<name>.png`.
 */
export function RoomPreview() {
  const hostRef = useRef<HTMLDivElement>(null);
  // The deck console is DOM and the room is WebGL, so the only way to see whether the
  // console reads against the room is to put the real one over the real other one.
  const [deck, setDeck] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      // The whole point: read pixels back after an explicit render, with no compositor
      // and no animation frame in the loop.
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(1);
    renderer.setSize(1440, 900, false);
    renderer.setClearColor(0x020810, 1);
    host.appendChild(renderer.domElement);

    const room = createRoomScene();
    const camera = new THREE.PerspectiveCamera(31, 1440 / 900, 0.1, 200);

    // The room's materials write scene-linear straight to `gl_FragColor`; on the page
    // that lands in a render target and `postfx` owns the one linear→sRGB encode and
    // the display grade. Drawing to a canvas here instead would show un-encoded linear
    // — a black room — so the bench renders through a target and repeats the room's
    // half of that grade: encode, the 0.025 sepia, brightness 1.18, contrast 0.86.
    const target = new THREE.WebGLRenderTarget(1440, 900, { type: THREE.HalfFloatType });
    const gradeScene = new THREE.Scene();
    const gradeCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const grade = new THREE.ShaderMaterial({
      uniforms: {
        uBase: { value: target.texture },
        uSepia: { value: 0.025 },
        uBrightness: { value: 1.18 },
        uContrast: { value: 0.86 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
      `,
      fragmentShader: `
        precision highp float;
        uniform sampler2D uBase;
        uniform float uSepia;
        uniform float uBrightness;
        uniform float uContrast;
        varying vec2 vUv;
        void main() {
          vec3 c = max(texture2D(uBase, vUv).rgb, vec3(0.0));
          vec3 lo = c * 12.92;
          vec3 hi = 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055;
          c = mix(lo, hi, step(vec3(0.0031308), c));
          vec3 sepia = vec3(
            dot(c, vec3(0.393, 0.769, 0.189)),
            dot(c, vec3(0.349, 0.686, 0.168)),
            dot(c, vec3(0.272, 0.534, 0.131))
          );
          c = clamp(mix(c, sepia, uSepia) * uBrightness, 0.0, 1.0);
          gl_FragColor = vec4(clamp((c - 0.5) * uContrast + 0.5, 0.0, 1.0), 1.0);
        }
      `,
    });
    gradeScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), grade));

    // The scene loads two GLBs and ten atlases on its own schedule and exposes no
    // "done" signal; the base model appearing in the graph is that signal.
    const ready = new Promise<void>((resolve) => {
      const poll = () => {
        if ((room.scene as any).getObjectByName("about-room-desk")) resolve();
        else setTimeout(poll, 100);
      };
      poll();
    });

    const bounds = (node: any) => {
      const box = new THREE.Box3().setFromObject(node);
      const size = box.getSize(new THREE.Vector3());
      const centre = box.getCenter(new THREE.Vector3());
      return {
        min: box.min.toArray().map((v: number) => +v.toFixed(3)),
        max: box.max.toArray().map((v: number) => +v.toFixed(3)),
        size: size.toArray().map((v: number) => +v.toFixed(3)),
        centre: centre.toArray().map((v: number) => +v.toFixed(3)),
      };
    };

    const api = {
      room,
      renderer,
      ready,

      /** Every named node whose name contains `needle`, with world bounds. */
      nodes(needle = "") {
        const found: any[] = [];
        room.scene.traverse((node: any) => {
          if (!node.name || !node.name.toLowerCase().includes(needle.toLowerCase())) return;
          found.push({ name: node.name, type: node.type, ...bounds(node) });
        });
        return found;
      },

      /**
       * Scale every baked material's exposure.
       *
       * The room ships through the site's post chain, which lifts the whole image;
       * the bench draws raw, so a grade that is right on the page looks black here.
       * This is the stand-in for that lift while judging the balance between the
       * base's daylight bake and our own blue-hour props.
       */
      gain(factor = 1) {
        const seen = new Set<any>();
        room.scene.traverse((node: any) => {
          const uniform = node.material?.uniforms?.uExposure;
          if (!uniform || seen.has(node.material)) return;
          seen.add(node.material);
          node.material.userData.baseExposure ??= uniform.value;
          uniform.value = node.material.userData.baseExposure * factor;
        });
        return `${seen.size} materials at ×${factor}`;
      },

      /** Every baked atlas in the scene, by the id in its texture name. */
      atlases() {
        const found = new Map<string, any>();
        room.scene.traverse((node: any) => {
          const texture = node.material?.uniforms?.uBake?.value;
          if (texture?.name) found.set(texture.name.replace(/^about-room-(base|prop)-/, ""), texture);
        });
        return found;
      },

      /**
       * Repoint matching meshes at a different atlas, and optionally a different UV
       * set. This is how the recovered mesh→atlas table gets checked: swap, shoot,
       * look, keep whichever reads as the object rather than as a packing layout.
       */
      setAtlas(needle: string, atlasId: string, uvChannel: 0 | 1 = 0) {
        const texture = api.atlases().get(atlasId);
        if (!texture) return `no atlas "${atlasId}" (have ${[...api.atlases().keys()].join(", ")})`;
        let template: any = null;
        room.scene.traverse((node: any) => {
          if (!template && node.material?.uniforms?.uBake) template = node.material;
        });
        const material = template.clone();
        material.uniforms.uBake.value = texture;
        material.defines = uvChannel === 1 ? { USE_UV1: "" } : {};
        material.vertexShader = material.vertexShader.replace(/vBakeUv = uv\d?;/, `vBakeUv = uv${uvChannel || ""};`);
        material.needsUpdate = true;
        let count = 0;
        room.scene.traverse((node: any) => {
          if (node.isMesh && node.name.toLowerCase().includes(needle.toLowerCase())) {
            node.material = material;
            count += 1;
          }
        });
        return `${count} mesh(es) → ${atlasId} uv${uvChannel}`;
      },

      /**
       * Shoot the room through its *own* camera after ticking `update`, which is the
       * only way to see anything the scene drives itself — the focus blend, player mode,
       * the tonearm. `shot` below poses the bench's camera instead and would show none
       * of it.
       */
      async live(
        name: string,
        {
          playerMode = false,
          tonearm = null as number | null,
          orbit = [0, 0] as [number, number],
          ticks = 140,
          width = 1440,
          height = 900,
        } = {},
      ) {
        renderer.setSize(width, height, false);
        target.setSize(width, height);
        room.setFullAspect(width / height);
        room.setPlayerMode(playerMode);
        room.setTonearm(tonearm);
        room.resetPlayerOrbit();
        if (orbit[0] || orbit[1]) room.orbitPlayer(orbit[0], orbit[1]);
        // The camera, the focus blend and the arm all ease a fixed fraction per frame,
        // so they need frames rather than a single call to arrive anywhere.
        for (let i = 0; i < ticks; i += 1) room.update(i * 16.7);
        renderer.setRenderTarget(target);
        renderer.render(room.scene, room.fullCamera);
        renderer.setRenderTarget(null);
        renderer.render(gradeScene, gradeCamera);
        const dataUrl = renderer.domElement.toDataURL("image/png");
        const response = await fetch("/api/room-capture", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name, dataUrl }),
        });
        return response.json();
      },

      /**
       * Render one frame and write it to `.next/cache/room-preview/<name>.png`.
       *
       * `only` hides everything except nodes matching that substring, which is how the
       * per-mesh atlas assignments get checked one at a time.
       */
      async shot(
        name: string,
        {
          pos = [11.4, 6.6, 16.2],
          look = [0, 2.3, -1.72],
          fov = 31,
          width = 1440,
          height = 900,
          only = null as string | null,
          hidden = [] as string[],
        } = {},
      ) {
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.fov = fov;
        camera.position.set(pos[0], pos[1], pos[2]);
        camera.lookAt(look[0], look[1], look[2]);
        camera.updateProjectionMatrix();

        const restored: Array<[any, boolean]> = [];
        if (only || hidden.length) {
          room.scene.traverse((node: any) => {
            if (!node.isMesh) return;
            const name = node.name || "";
            const parentName = node.parent?.name || "";
            const matches = (needle: string) =>
              name.toLowerCase().includes(needle.toLowerCase()) ||
              parentName.toLowerCase().includes(needle.toLowerCase());
            const wanted = only ? matches(only) : true;
            const blocked = hidden.some(matches);
            if (!wanted || blocked) {
              restored.push([node, node.visible]);
              node.visible = false;
            }
          });
        }

        target.setSize(width, height);
        renderer.setRenderTarget(target);
        renderer.render(room.scene, camera);
        renderer.setRenderTarget(null);
        renderer.render(gradeScene, gradeCamera);
        const dataUrl = renderer.domElement.toDataURL("image/png");
        restored.forEach(([node, visible]) => { node.visible = visible; });

        const response = await fetch("/api/room-capture", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name, dataUrl }),
        });
        return response.json();
      },
    };

    (window as any).__room = api;
    (window as any).__deck = (on = true) => { setDeck(on); return on ? "deck shown" : "deck hidden"; };
    ready.then(() => console.info("[room-preview] ready — window.__room"));

    return () => {
      delete (window as any).__room;
      delete (window as any).__deck;
      room.dispose();
      target.dispose();
      grade.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, display: "grid", placeItems: "center", overflow: "hidden", background: "#020810" }}>
      <div ref={hostRef} style={{ maxWidth: "100%", maxHeight: "100%", overflow: "hidden", display: "grid" }} />
      {deck ? (
        <JoiMusicPlayer
          open
          onClose={() => setDeck(false)}
          onResetView={() => {}}
        />
      ) : null}
    </div>
  );
}
