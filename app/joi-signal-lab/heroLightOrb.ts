import * as THREE from "three";

/**
 * A light you can pick up.
 *
 * The hero's other lights are furniture — the terminal's spill, a key, a rim — placed
 * once and animated on rails. This one is the opposite: the visitor decides where it
 * goes, and everything downstream of it has to be recomputed from wherever they left
 * it. Which is the whole reason it is built the way it is below.
 *
 * Three things follow the orb, and they are three different mechanisms:
 *
 *   1. Shadows. A real `PointLight` with a real cube shadow map. Six faces, so it is
 *      the expensive one — see `shadowDirty` for why it is nonetheless close to free.
 *   2. Shafts. Volumetric scattering, done as a screen-space radial march out of an
 *      occlusion buffer (Mitchell's post-process formulation, GPU Gems 3 ch. 13). This
 *      is the Tyndall effect proper: the shafts exist because the march is *blocked*,
 *      so the terminal's silhouette carves them rather than a cone mesh faking them.
 *   3. Motes. The dust already in the scene, re-lit per point by distance to the orb —
 *      the thing the effect is actually named after. Fog you can see is fog with
 *      something in it.
 *
 * The scattering pass is why this module reaches for layers. It needs to render the
 * scene twice more per frame with two different definitions of what is in it, and
 * layers are the only way to say that without keeping a second copy of the hierarchy.
 */

/** Solid geometry that blocks the orb. Rendered flat black into the occlusion buffer. */
export const OCCLUDER_LAYER = 1;
/** The orb's emissive body. The only thing the scattering pass treats as a light source. */
export const ORB_SOURCE_LAYER = 2;

/** Samples along each radial march. The cost of the whole effect is roughly this number. */
const SCATTER_SAMPLES = 48;
/**
 * A floor the light must not sink through. The room had one at -1.42 that caught this
 * light's shadow; space does not, so the caller can push the limit out of reach.
 */
const DEFAULT_FLOOR_CLEARANCE = -1.24;

export type HeroLightOrb = {
  /** Added to the hero scene by the caller. Holds the orb body and its light. */
  group: any;
  /** The additive full-screen quad the shafts land on. Also added by the caller. */
  composite: any;
  /**
   * Sync per-frame GPU state and, when the tier allows, draw the scattering buffer.
   * Called once a frame *before* the beauty render, because the composite quad samples
   * what this writes.
   */
  prepare: (renderer: any, scene: any, camera: any) => void;
  /**
   * Advance the orb itself: drag spring, idle drift, energy. Returns the smoothed
   * energy, which the caller's dust reads so motes and orb fade as one thing.
   */
  update: (delta: number, time: number, visibility: number) => number;
  /** True when the pointer is over the orb — the host turns this into a cursor. */
  hitTest: (ndc: { x: number; y: number }, camera: any) => boolean;
  /** Take hold. Returns false if the pointer was not on the orb, so the host can move on. */
  grab: (ndc: { x: number; y: number }, camera: any) => boolean;
  /** Carry it. No-op unless held. */
  moveTo: (ndc: { x: number; y: number }, camera: any) => void;
  /** Let go. Returns true if a drag actually happened, so the host can eat the click. */
  release: () => boolean;
  /**
   * Where a carried orb travels. The drag plane is built through this point rather than
   * through wherever the orb happened to be sitting, which is what lets it be brought
   * forward to the terminal instead of only sliding around behind it.
   */
  setCarryAnchor: (position: any) => void;
  isHeld: () => boolean;
  /**
   * Re-render the cube shadow map on the next frame. The caller pokes this when the
   * scene's geometry changes under a stationary orb — model load, most of all.
   */
  invalidateShadow: () => void;
  dispose: () => void;
};

export type HeroLightOrbOptions = {
  /** Where the orb sits before anyone touches it, in world space. */
  home: any;
  reducedMotion: boolean;
  /** Cube shadow map. Off on phones, where the whole shadow tier is off. */
  shadows: boolean;
  /** The scattering pass. Two extra scene renders, so it follows the same tier. */
  scattering: boolean;
  /** Resolution divisor for the occlusion buffer. Half is plenty — the march blurs it. */
  scatterScale?: number;
  /** Lowest the orb may be carried. Defaults to the room's floor; space has none. */
  floorClearance?: number;
  /** Seconds of stillness after a drag before the orb drifts back to `home`. */
  returnDelay?: number;
  /**
   * Overall size of the body. The orb began as a desk lamp beside the terminal; as the
   * sun of a solar system it has to hold the centre of a much deeper frame, and a lamp
   * scaled up is exactly what a sun looks like from far enough away.
   */
  scale?: number;
  /** Point light range and falloff. A sun has to reach across the system, a lamp does not. */
  lightRange?: number;
  lightDecay?: number;
  lightIntensity?: number;
};

/**
 * The orb's body: a hot core that reads as the filament, wrapped in a halo that falls
 * off with the view angle so the sphere does not end at a hard silhouette. Both are
 * additive and neither writes depth, because the halo has to sit over the core and the
 * core has to sit over whatever is behind it without punching a hole in the fog.
 *
 * Output runs well above 1.0 on purpose. The stage's slot targets are HalfFloat and the
 * post chain tone maps at the end, so an over-range core is what gives the bloom
 * something to find — clamping here would cost the orb its glow.
 */
function createOrbMaterial(color: any, hot: number, falloff: number) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
    uniforms: {
      uColor: { value: color },
      uEnergy: { value: 1 },
      uHot: { value: hot },
      uFalloff: { value: falloff },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uEnergy;
      uniform float uHot;
      uniform float uFalloff;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        // Facing the camera is the centre of the disc; grazing is the rim. Raising the
        // grazing term to uFalloff is what separates the core (tight, near-solid) from
        // the halo (wide, feathered) with one shader.
        float facing = clamp(dot(normalize(vNormal), normalize(vView)), 0.0, 1.0);
        float body = pow(facing, uFalloff);
        gl_FragColor = vec4(uColor * body * uHot * uEnergy, body);
      }
    `,
  });
}

/**
 * The radial march.
 *
 * Reads the occlusion buffer — orb bright, every occluder flat black — and walks each
 * pixel back toward the orb's screen position, accumulating what it passes through with
 * a geometric decay. Where the walk crosses black the accumulation stalls, and that
 * stall *is* the shaft edge. Nothing here knows about the computer's geometry; the
 * silhouette does all the work.
 *
 * The fbm term is the difference between a radial blur and fog. Real air is not a
 * uniform medium, so a clean decay reads as a lens artefact rather than light in a
 * room. Modulating each sample by drifting noise gives the shafts the uneven density
 * that makes them look like they are passing through something.
 */
function createScatterMaterial(occlusionMap: any, color: any) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uOcclusion: { value: occlusionMap },
      uColor: { value: color },
      /** Orb position in screen uv. */
      uLight: { value: new THREE.Vector2(0.5, 0.5) },
      uTime: { value: 0 },
      /** Fades the shafts out with the orb, and off the edges of the frame. */
      uVisible: { value: 0 },
      /** How far along the ray the march reaches, as a fraction of the distance. */
      uDensity: { value: 0.86 },
      uWeight: { value: 0.043 },
      uDecay: { value: 0.962 },
      uExposure: { value: 1.0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        // Straight to clip space. This quad is the frame, not a thing in the room, so
        // the camera matrices would only get in its way.
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uOcclusion;
      uniform vec3 uColor;
      uniform vec2 uLight;
      uniform float uTime;
      uniform float uVisible;
      uniform float uDensity;
      uniform float uWeight;
      uniform float uDecay;
      uniform float uExposure;
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
        float amplitude = 0.58;
        for (int i = 0; i < 3; i++) {
          value += amplitude * noise(p);
          p = p * 2.07 + 11.3;
          amplitude *= 0.5;
        }
        return value;
      }

      void main() {
        if (uVisible <= 0.001) discard;
        vec2 coord = vUv;
        vec2 delta = (vUv - uLight) * (uDensity / float(${SCATTER_SAMPLES}));
        float illumination = 1.0;
        vec3 accum = vec3(0.0);
        vec2 drift = vec2(uTime * 0.021, uTime * -0.014);
        // Break the sample phase per pixel. Without it the march bands into visible
        // rings at this sample count, and the rings survive the bloom.
        coord -= delta * hash(gl_FragCoord.xy);
        for (int i = 0; i < ${SCATTER_SAMPLES}; i++) {
          coord -= delta;
          vec3 sampled = texture2D(uOcclusion, coord).rgb;
          float medium = 0.62 + 0.38 * fbm(coord * vec2(5.2, 3.4) + drift);
          accum += sampled * illumination * uWeight * medium;
          illumination *= uDecay;
        }
        gl_FragColor = vec4(accum * uExposure * uColor * uVisible, 1.0);
      }
    `,
  });
}

export function createHeroLightOrb(options: HeroLightOrbOptions): HeroLightOrb {
  const { reducedMotion, shadows, scattering } = options;
  const scatterScale = options.scatterScale ?? 2;
  const scale = options.scale ?? 1;
  const intensity = options.lightIntensity ?? 5.4;
  const floorClearance = options.floorClearance ?? DEFAULT_FLOOR_CLEARANCE;
  const returnDelay = options.returnDelay ?? 3;
  const color = new THREE.Color(0xffcf9a);

  const group = new THREE.Group();
  group.position.copy(options.home);

  const coreMaterial = createOrbMaterial(color, 3.4, 0.55);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.085 * scale, 28, 20), coreMaterial);
  /*
   * The original orb, unchanged.
   *
   * Two things were tried on top of this and both were rejected for the same reason: a
   * screen-space volumetric march threw a soft fan across a third of the frame, and a
   * billboarded starburst threw hard spikes right across it. A sun in this composition
   * wants neither — it wants to be a bright round body that stays where it is put.
   */
  const haloMaterial = createOrbMaterial(color, 0.62, 2.1);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.26 * scale, 24, 18), haloMaterial);
  // Both are light sources as far as the scattering pass is concerned. The halo is the
  // one that matters there: a disc the size of the core alone throws shafts too thin to
  // read once the march has decayed across the frame.
  [core, halo].forEach((mesh: any) => {
    mesh.layers.enable(ORB_SOURCE_LAYER);
    mesh.renderOrder = 4;
    group.add(mesh);
  });

  const light = new THREE.PointLight(
    color.clone(), intensity, options.lightRange ?? 8.5, options.lightDecay ?? 1.7);
  light.castShadow = shadows;
  if (shadows) {
    light.shadow.mapSize.set(512, 512);
    light.shadow.camera.near = 0.08;
    light.shadow.camera.far = Math.max(9, (options.lightRange ?? 8.5) * 1.1);
    light.shadow.bias = -0.0016;
    // Point-light shadows sample a cube, so acne shows up along the seams first. Pushing
    // along the normal fixes it where a depth bias alone would only trade it for peter-panning.
    light.shadow.normalBias = 0.035;
    /*
     * A cube shadow map is six renders of the scene. Left on `autoUpdate` that is six
     * every frame, for a light that is stationary except in the seconds someone is
     * actually dragging it — and the geometry it shadows never moves at all. So the map
     * is rebuilt only when the orb has moved far enough to change it, or when the
     * caller says the scene itself changed. Idle, the orb costs nothing.
     */
    light.shadow.autoUpdate = false;
    light.shadow.needsUpdate = true;
  }
  group.add(light);

  // Sized for real on the first `prepare`; 2x2 keeps the allocation trivial until then.
  const occlusionTarget = new THREE.WebGLRenderTarget(2, 2, {
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: true,
    stencilBuffer: false,
    generateMipmaps: false,
  });
  occlusionTarget.texture.colorSpace = THREE.LinearSRGBColorSpace;

  const occluderMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const scatterMaterial = createScatterMaterial(occlusionTarget.texture, color);
  const composite = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), scatterMaterial);
  composite.frustumCulled = false;
  composite.renderOrder = 900;
  composite.visible = false;

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const worldPosition = new THREE.Vector3();
  const projected = new THREE.Vector3();
  const shadowAnchor = new THREE.Vector3().copy(options.home);
  /** Where it belongs. Everything the visitor does to it is temporary. */
  const home = new THREE.Vector3().copy(options.home);
  /** The depth a carried orb is moved in. Set by the host to the terminal's position. */
  const carryAnchor = new THREE.Vector3().copy(options.home);
  /** Where the visitor last put the light. The idle drift is measured from here. */
  const anchor = new THREE.Vector3().copy(options.home);
  const target = new THREE.Vector3().copy(options.home);
  const velocity = new THREE.Vector3();
  const dragPlane = new THREE.Plane();
  const planeNormal = new THREE.Vector3();
  const hit = new THREE.Vector3();
  const spring = new THREE.Vector3();
  const grabOffset = new THREE.Vector3();
  const bufferSize = new THREE.Vector2();

  let held = false;
  let dragged = false;
  /** Seconds since the visitor last touched it. Drives the return home. */
  let idle = 0;
  let energy = 1;
  let scatterEnabled = scattering;
  let sizedWidth = 0;
  let sizedHeight = 0;

  const setPointer = (ndc: { x: number; y: number }, camera: any) => {
    pointer.set(ndc.x, ndc.y);
    raycaster.setFromCamera(pointer, camera);
  };

  const intersectsOrb = () => raycaster.intersectObject(halo, false).length > 0;

  return {
    group,
    composite,

    prepare: (renderer: any, scene: any, camera: any) => {
      renderer.getDrawingBufferSize(bufferSize);
      const width = Math.max(2, Math.floor(bufferSize.x / scatterScale));
      const height = Math.max(2, Math.floor(bufferSize.y / scatterScale));
      if (width !== sizedWidth || height !== sizedHeight) {
        occlusionTarget.setSize(width, height);
        sizedWidth = width;
        sizedHeight = height;
      }

      if (!scatterEnabled) return;

      group.getWorldPosition(worldPosition);
      projected.copy(worldPosition).project(camera);
      // Behind the camera the projection folds back through the centre of the frame and
      // the march would drag a bright streak out of nowhere. Nothing to scatter, so stop.
      const inFront = projected.z < 1;
      const lightUv = scatterMaterial.uniforms.uLight.value;
      lightUv.set(projected.x * 0.5 + 0.5, projected.y * 0.5 + 0.5);
      // Ease off past the frame edge rather than cutting: an orb just out of shot still
      // throws shafts into it, and a hard cut on the boundary is the one thing that
      // would read as a bug.
      const offFrame = Math.max(Math.abs(projected.x), Math.abs(projected.y));
      const edge = 1 - THREE.MathUtils.smoothstep(offFrame, 1.0, 2.2);
      const visible = inFront ? edge * energy : 0;
      scatterMaterial.uniforms.uVisible.value = visible;
      composite.visible = visible > 0.001;
      if (!composite.visible) return;

      const previousTarget = renderer.getRenderTarget();
      const previousAutoClear = renderer.autoClear;
      renderer.setRenderTarget(occlusionTarget);
      renderer.autoClear = false;
      renderer.clear(true, true, false);

      /*
       * Two renders, one buffer, and the depth written by the first is load-bearing for
       * the second: carry the orb behind the terminal and it is occluded by its own
       * occluders, so the shafts correctly appear to originate from behind the case
       * rather than in front of it.
       */
      const previousOverride = scene.overrideMaterial;
      scene.overrideMaterial = occluderMaterial;
      camera.layers.set(OCCLUDER_LAYER);
      renderer.render(scene, camera);

      scene.overrideMaterial = null;
      camera.layers.set(ORB_SOURCE_LAYER);
      renderer.render(scene, camera);

      scene.overrideMaterial = previousOverride;
      camera.layers.set(0);
      renderer.setRenderTarget(previousTarget);
      renderer.autoClear = previousAutoClear;
    },

    update: (delta: number, time: number, visibility: number) => {
      energy += (visibility - energy) * (1 - Math.exp(-4.5 * delta));
      scatterMaterial.uniforms.uTime.value = time;

      if (!held) {
        idle += delta;
        /*
         * Drift back to where it belongs. The sun is part of a composition, and a page
         * left with it parked in a corner is a page the next visitor arrives at broken —
         * but snapping it back the instant the pointer lifts would fight anyone still
         * looking at what they just did. Three seconds of stillness, then a slow ease.
         */
        if (idle > returnDelay) {
          anchor.lerp(home, 1 - Math.exp(-1.1 * delta));
        }
      }

      if (!held && !reducedMotion) {
        /*
         * Left alone it breathes, so a light nobody has touched still looks like it is on
         * rather than pasted onto the frame.
         *
         * The drift is an offset *from* where it was put down, not something added to the
         * target each frame. Accumulating would make this an open loop: the floor clamp
         * below eats the bottom of every swing, so the orb would ratchet upward, and any
         * hitch in the clock — a backgrounded tab resuming, an uneven frame — would leave
         * a bias that never washes out. Measured from an anchor it is exactly bounded.
         */
        target.set(
          anchor.x + Math.cos(time * 0.43) * 0.052,
          anchor.y + Math.sin(time * 0.62) * 0.074,
          anchor.z,
        );
        target.y = Math.max(target.y, floorClearance);
      }

      // Critically-damped-ish spring rather than a lerp: the orb has to feel like it has
      // mass when it is thrown, and a lerp cannot overshoot.
      const stiffness = held ? 148 : 46;
      const damping = held ? 21 : 11.5;
      velocity.addScaledVector(
        spring.copy(target).sub(group.position).multiplyScalar(stiffness),
        delta,
      );
      velocity.multiplyScalar(Math.exp(-damping * delta));
      group.position.addScaledVector(velocity, delta);
      // Flush the transform now rather than letting the next `render` do it. Everything
      // downstream this frame — the shadow anchor, the lit dust, the screen position the
      // shafts march from — reads the world matrix, and reading last frame's would leave
      // all three trailing the orb by a frame while it is being dragged.
      group.updateWorldMatrix(true, false);

      const pulse = reducedMotion ? 1 : 0.94 + Math.sin(time * 2.1) * 0.06;
      coreMaterial.uniforms.uEnergy.value = energy * pulse;
      haloMaterial.uniforms.uEnergy.value = energy * pulse;
      light.intensity = intensity * energy * pulse;
      light.visible = energy > 0.02;

      if (shadows && light.visible) {
        group.getWorldPosition(worldPosition);
        // Rebuilding six faces for a millimetre of drift is waste; rebuilding for a
        // centimetre is invisible. This threshold is the whole budget of the effect.
        if (worldPosition.distanceToSquared(shadowAnchor) > 0.0004) {
          shadowAnchor.copy(worldPosition);
          light.shadow.needsUpdate = true;
        }
      }

      return energy;
    },

    hitTest: (ndc, camera) => {
      setPointer(ndc, camera);
      return intersectsOrb();
    },

    grab: (ndc, camera) => {
      setPointer(ndc, camera);
      if (!intersectsOrb()) return false;
      held = true;
      dragged = false;
      idle = 0;
      group.getWorldPosition(worldPosition);
      /*
       * Carry on a camera-facing plane through the *terminal*, not through the orb.
       *
       * Through the orb it tracked the pointer one-to-one at whatever depth it was picked
       * up from — which, now that the sun starts six units behind the terminal, meant it
       * could only ever slide around behind it and never light the face anyone can see.
       * Anchoring the plane to the terminal instead means picking the sun up brings it
       * into the room: it swings forward to the terminal's depth and from there its light
       * actually falls on the case, and the shadows move with it.
       */
      camera.getWorldDirection(planeNormal);
      dragPlane.setFromNormalAndCoplanarPoint(planeNormal, carryAnchor);
      // No offset: the orb is being moved onto a different plane from the one it is on,
      // so preserving the grab offset would just carry the depth error across. It flies to
      // the pointer instead, and the spring makes that a travel rather than a jump.
      grabOffset.set(0, 0, 0);
      return true;
    },

    moveTo: (ndc, camera) => {
      if (!held) return;
      setPointer(ndc, camera);
      if (!raycaster.ray.intersectPlane(dragPlane, hit)) return;
      dragged = true;
      idle = 0;
      target.copy(hit).add(grabOffset);
      // The floor is a real occluder and a real shadow catcher; letting the orb sink
      // under it would put the light on the wrong side of both.
      target.y = Math.max(target.y, floorClearance);
      anchor.copy(target);
    },

    release: () => {
      held = false;
      idle = 0;
      const moved = dragged;
      dragged = false;
      return moved;
    },

    setCarryAnchor: (position: any) => {
      carryAnchor.copy(position);
    },

    isHeld: () => held,

    invalidateShadow: () => {
      if (shadows) light.shadow.needsUpdate = true;
    },

    dispose: () => {
      scatterEnabled = false;
      occlusionTarget.dispose();
      occluderMaterial.dispose();
      scatterMaterial.dispose();
      coreMaterial.dispose();
      haloMaterial.dispose();
      core.geometry.dispose();
      halo.geometry.dispose();
      composite.geometry.dispose();
    },
  };
}
