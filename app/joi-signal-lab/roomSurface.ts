import * as THREE from "three";

/**
 * One shading model for everything the room builds in code.
 *
 * It was written for the turntable and is shared now because a second code-built prop
 * arrived — the basketball. Two copies of this shader would have drifted the first time
 * either object was tuned, and the whole point of it is that a painted plinth, a turned
 * platter and a rubber ball agree with each other about what the room's daylight is.
 *
 * ## No lights, on purpose
 *
 * `room3d.ts` says it plainly: the room has no lights, because direct light, bounce and
 * contact shadow are all in the bake. Adding a light rig for the code-built props would
 * be the wrong kind of correct — the baked meshes could not receive it, so it would
 * light those props alone, and a PBR material would then also disagree with the room
 * about colour space. Rendering into a target forces linear output, which is what
 * `postfx` expects from the bake; a `MeshStandardMaterial` would write true linear into
 * the same target the baked shader writes sRGB-as-linear into, and the prop would sit in
 * the shot brighter and flatter than everything touching it.
 *
 * So the props are shaded by hand, here, writing the same space the bake does. It costs
 * no shadow map — which `quality.ts` deliberately does not spend on phones — and it
 * stays consistent in all three places the room renders: the bench, reel frame 05's
 * target, and the About stage.
 */

/**
 * The room's daylight, restated as three numbers.
 *
 * Not measured off a light — there is no light to measure. These were tuned against the
 * captured turntable in `/lab/room-preview` until the new one's top, front and shadow
 * side sat at the same values as the old one's, which is the only definition of "matches
 * the room" available when the room is a photograph.
 */
export const ROOM_KEY_DIR = new THREE.Vector3(0.38, 0.86, 0.34).normalize();
export const ROOM_FILL_DIR = new THREE.Vector3(-0.62, 0.34, -0.71).normalize();

/** Screen numbers, with no colour management in the way. See the textures module. */
export const screenColor = (hex: string) => new THREE.Color().setStyle(hex, THREE.NoColorSpace);

export type SurfaceOptions = {
  color?: string;
  /** Already a texture, so ownership stays with whoever made the canvas. */
  map?: any;
  /** Tiles the map. Handy on the plinth, whose faces are metres of one canvas. */
  repeat?: [number, number];
  /** 0 painted, 1 metal: takes the diffuse down and tints the highlight with the albedo. */
  metal?: number;
  /** Specular exponent. Low is a wide sheen, high is a tight glint. */
  gloss?: number;
  specular?: number;
  /** How much the fake environment shows in a metal. */
  env?: number;
  /** Fresnel lift at grazing angles. */
  rim?: number;
  opacity?: number;
  transparent?: boolean;
  depthWrite?: boolean;
  /**
   * Skip shading entirely. The contact shadows and the printed labels are marks on
   * another surface, not surfaces of their own: shading them means the ambient term
   * lifts a shadow towards grey and takes the black out of the lettering.
   */
  unlit?: boolean;
};

export const SURFACE_VERTEX = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vViewW;
  varying vec2 vSurfaceUv;
  uniform vec2 uRepeat;
  void main() {
    vSurfaceUv = uv * uRepeat;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vViewW = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

/*
 * Hemisphere plus a key and a fill, a Blinn highlight, a Fresnel edge, and — for metals
 * — the same hemisphere sampled along the reflection vector standing in for an
 * environment. It is not physically anything. It is the smallest model that makes a
 * turned aluminium platter, a painted plinth, a chrome arm tube and a pebbled rubber
 * ball read as four different materials under one daylight, which is all these objects
 * need.
 */
export const SURFACE_FRAGMENT = /* glsl */ `
  precision highp float;

  uniform vec3 uColor;
  uniform sampler2D uMap;
  uniform float uHasMap;
  uniform float uMetal;
  uniform float uGloss;
  uniform float uSpecular;
  uniform float uEnv;
  uniform float uRim;
  uniform float uOpacity;
  uniform float uUnlit;
  uniform vec3 uKeyDir;
  uniform vec3 uKeyColor;
  uniform vec3 uFillDir;
  uniform vec3 uFillColor;
  uniform vec3 uSkyColor;
  uniform vec3 uGroundColor;

  varying vec3 vNormalW;
  varying vec3 vViewW;
  varying vec2 vSurfaceUv;

  void main() {
    vec3 n = normalize(vNormalW);
    vec3 v = normalize(vViewW);
    // Backfaces (the underside of the lid, the inside of the plinth cutouts) would
    // otherwise shade as if lit from below and glow.
    if (!gl_FrontFacing) n = -n;

    vec4 sampled = texture2D(uMap, vSurfaceUv);
    vec3 albedo = uColor * mix(vec3(1.0), sampled.rgb, uHasMap);
    float alpha = uOpacity * mix(1.0, sampled.a, uHasMap);

    float hemi = n.y * 0.5 + 0.5;
    vec3 ambient = mix(uGroundColor, uSkyColor, hemi);
    float key = max(dot(n, uKeyDir), 0.0);
    float fill = max(dot(n, uFillDir), 0.0);
    vec3 diffuse = ambient + uKeyColor * key + uFillColor * fill;

    vec3 halfVec = normalize(uKeyDir + v);
    float spec = pow(max(dot(n, halfVec), 0.0), uGloss) * uSpecular;
    float fresnel = pow(1.0 - max(dot(n, v), 0.0), 4.0);

    vec3 reflected = reflect(-v, n);
    vec3 env = mix(uGroundColor, uSkyColor, reflected.y * 0.5 + 0.5) * uEnv;

    // A metal's highlight takes its colour from the metal; a painted surface's does not.
    vec3 tint = mix(vec3(1.0), albedo, uMetal);
    vec3 color = albedo * diffuse * mix(1.0, 0.34, uMetal)
      + tint * (env * uMetal + (spec + fresnel * uRim) * uKeyColor);

    gl_FragColor = vec4(mix(color, albedo, uUnlit), alpha);
  }
`;

/**
 * The white pixel an un-mapped surface samples.
 *
 * Module-level and never disposed on purpose: it is one texel, and the room can be built
 * and torn down repeatedly across a dev session. Handing it back with the first rig to
 * be disposed would leave the second one sampling a dead texture.
 */
let blankTexture: any = null;
export function blankSurfaceTexture() {
  if (blankTexture) return blankTexture;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, 1, 1);
  blankTexture = new THREE.CanvasTexture(canvas);
  return blankTexture;
}

/**
 * One surface. The caller owns the material — dispose it with the rig that made it.
 */
export function createSurfaceMaterial(options: SurfaceOptions = {}) {
  const material = new THREE.ShaderMaterial({
    vertexShader: SURFACE_VERTEX,
    fragmentShader: SURFACE_FRAGMENT,
    transparent: options.transparent ?? false,
    depthWrite: options.depthWrite ?? true,
    side: THREE.FrontSide,
    uniforms: {
      uColor: { value: screenColor(options.color ?? "#ffffff") },
      uMap: { value: options.map ?? blankSurfaceTexture() },
      uHasMap: { value: options.map ? 1 : 0 },
      uRepeat: { value: new THREE.Vector2(options.repeat?.[0] ?? 1, options.repeat?.[1] ?? 1) },
      uMetal: { value: options.metal ?? 0 },
      uGloss: { value: options.gloss ?? 18 },
      uSpecular: { value: options.specular ?? 0.18 },
      uEnv: { value: options.env ?? 0 },
      uRim: { value: options.rim ?? 0.06 },
      uOpacity: { value: options.opacity ?? 1 },
      uUnlit: { value: options.unlit ? 1 : 0 },
      uKeyDir: { value: ROOM_KEY_DIR },
      uKeyColor: { value: screenColor("#5c4e3c") },
      uFillDir: { value: ROOM_FILL_DIR },
      uFillColor: { value: screenColor("#191c22") },
      uSkyColor: { value: screenColor("#332f29") },
      uGroundColor: { value: screenColor("#141210") },
    },
  });
  material.toneMapped = false;
  return material;
}
