import * as THREE from "three";

/**
 * The solar system, as the room the terminal floats in.
 *
 * Built from `.img2threejs/solar-system/solar-system-sculpt-spec.json`, which is the
 * authority for every number here — the spec passed the skill's strict-quality gate and
 * its component tree, material contracts and detail inventory are what this file
 * implements. The generated factory beside it is a blockout: generic spheres and flat
 * PBR. It cannot express the three things that actually distinguish these bodies from
 * nine recoloured balls — latitude banding, the Cassini division, and how hard the
 * terminator falls — because all three are one-dimensional functions evaluated in a
 * fragment shader, not texture channels. So the spec is implemented here instead.
 *
 * Two rules from the spec are load-bearing and easy to lose:
 *
 *   - **Everything angular is untouched canon.** Eccentricity, inclination, node,
 *     periapsis, phase at epoch, period ratio, obliquity and rotation sense are all
 *     J2000 values. Only the two radii are compressed, and both compressions are named
 *     constants below rather than magic numbers sprinkled through the table.
 *   - **The sun is a light the visitor can pick up.** Orbits are evaluated about its
 *     current position, so carrying it carries the system.
 */

/** Orbit radius = ORBIT_BASE * a^ORBIT_EXPONENT. A presentation choice, not canon. */
const ORBIT_BASE = 1.0;
const ORBIT_EXPONENT = 0.55;
/** Body radius = BODY_BASE * (R/Rearth)^BODY_EXPONENT. Also a presentation choice. */
const BODY_BASE = 0.098;
const BODY_EXPONENT = 0.5;
/**
 * Seconds of wall clock per Earth year. Every other period follows from the canonical
 * ratio, which is why Mercury visibly races and Neptune barely moves — that asymmetry is
 * the point, not a bug to tune away.
 */
const EARTH_YEAR_SECONDS = 18;
/** How far the ecliptic is tilted toward the camera, so orbits read as ellipses. */
const ECLIPTIC_TILT = 0.44;

const DEG = Math.PI / 180;

type BodyCanon = {
  id: string;
  name: string;
  /** Semi-major axis, AU. */
  a: number;
  e: number;
  /** Inclination, longitude of ascending node, longitude of periapsis, mean longitude. */
  i: number;
  node: number;
  periLon: number;
  l0: number;
  /** Sidereal period, Earth years. */
  period: number;
  /** Equatorial radius in Earth radii. */
  radius: number;
  /** Obliquity. Over 90 means the body spins retrograde about its orbital normal. */
  obliquity: number;
  /** Sidereal rotation, days. Negative is retrograde. */
  rotation: number;
  /** 0 rocky, 1 venus, 2 earth, 3 banded, 4 ice giant. Selects the surface branch. */
  kind: number;
  base: number;
  secondary: number;
  accent: number;
  /** Latitude bands, for the three that have them. */
  bands: number;
  bandContrast: number;
  /** How hard the day/night line falls. 0 is a knife edge; airless bodies sit there. */
  terminator: number;
};

/**
 * The canonical table. Every row is J2000 from IAU/JPL by way of
 * `.img2threejs/solar-system/evidence/planetary-canon.md`, and nothing in it is tuned by
 * eye. If a body looks wrong, the fix is in the shader or the scale constants, not here.
 */
const BODIES: BodyCanon[] = [
  { id: "mercury", name: "Mercury", a: 0.38710, e: 0.20563, i: 7.005, node: 48.331, periLon: 77.457, l0: 252.251, period: 0.2408,
    radius: 0.383, obliquity: 0.034, rotation: 58.65, kind: 0, base: 0x8c8680, secondary: 0x6d6862, accent: 0x5a5550, bands: 0, bandContrast: 0, terminator: 0.02 },
  { id: "venus", name: "Venus", a: 0.72333, e: 0.00677, i: 3.395, node: 76.680, periLon: 131.564, l0: 181.980, period: 0.6152,
    radius: 0.950, obliquity: 177.36, rotation: -243.02, kind: 1, base: 0xe8cda2, secondary: 0xf5deb3, accent: 0xd9b98c, bands: 0, bandContrast: 0, terminator: 0.34 },
  { id: "earth", name: "Earth", a: 1.00000, e: 0.01671, i: 0.000, node: 174.873, periLon: 102.947, l0: 100.464, period: 1.0000,
    radius: 1.000, obliquity: 23.44, rotation: 0.9973, kind: 2, base: 0x2e5a88, secondary: 0x4f7942, accent: 0xffffff, bands: 0, bandContrast: 0, terminator: 0.16 },
  { id: "mars", name: "Mars", a: 1.52371, e: 0.09339, i: 1.850, node: 49.558, periLon: 336.041, l0: 355.453, period: 1.8808,
    radius: 0.532, obliquity: 25.19, rotation: 1.0260, kind: 0, base: 0xc1440e, secondary: 0xa0522d, accent: 0xe8e8e8, bands: 0, bandContrast: 0, terminator: 0.07 },
  { id: "jupiter", name: "Jupiter", a: 5.20288, e: 0.04839, i: 1.304, node: 100.464, periLon: 14.331, l0: 34.396, period: 11.862,
    radius: 10.973, obliquity: 3.13, rotation: 0.4136, kind: 3, base: 0xd8ca9d, secondary: 0xb07f5a, accent: 0xa0522d, bands: 10, bandContrast: 0.55, terminator: 0.3 },
  { id: "saturn", name: "Saturn", a: 9.53667, e: 0.05386, i: 2.486, node: 113.666, periLon: 93.057, l0: 49.954, period: 29.457,
    radius: 9.140, obliquity: 26.73, rotation: 0.4440, kind: 3, base: 0xead6b8, secondary: 0xd4bc95, accent: 0xc2a878, bands: 6, bandContrast: 0.28, terminator: 0.3 },
  { id: "uranus", name: "Uranus", a: 19.18916, e: 0.04726, i: 0.773, node: 74.006, periLon: 173.005, l0: 313.238, period: 84.011,
    radius: 3.981, obliquity: 97.77, rotation: -0.7183, kind: 4, base: 0x9fd3e0, secondary: 0x7fb8cc, accent: 0x9fd3e0, bands: 0, bandContrast: 0, terminator: 0.26 },
  { id: "neptune", name: "Neptune", a: 30.06992, e: 0.00859, i: 1.770, node: 131.784, periLon: 48.124, l0: 304.880, period: 164.79,
    radius: 3.865, obliquity: 28.32, rotation: 0.6713, kind: 4, base: 0x3f54ba, secondary: 0x2f42a0, accent: 0x5f74d0, bands: 4, bandContrast: 0.12, terminator: 0.26 },
];

/** The Moon rides Earth rather than the sun, so it is not a row of the table above. */
const MOON = { radius: 0.273, orbit: 0.13, period: 27.32 / 365.256, obliquity: 6.68, base: 0x9a9a95, secondary: 0x6d6862 };

const orbitRadius = (a: number) => ORBIT_BASE * Math.pow(a, ORBIT_EXPONENT);
const bodyRadius = (r: number) => BODY_BASE * Math.pow(r, BODY_EXPONENT);

/**
 * Kepler's equation, by Newton.
 *
 * `M = E - e·sinE` has no closed form, and the lazy substitute — advancing the true
 * anomaly at a constant rate — is exactly what makes an orbit look fake: a real body
 * accelerates through periapsis and loiters at apoapsis. Mercury's e = 0.206 makes that
 * sweep plainly visible, which is the whole reason for solving it properly.
 *
 * Five iterations is far past convergence for e < 0.21; the loop is cheap and runs eight
 * times a frame.
 */
function eccentricAnomaly(meanAnomaly: number, e: number) {
  let E = meanAnomaly;
  for (let index = 0; index < 5; index += 1) {
    const delta = (E - e * Math.sin(E) - meanAnomaly) / (1 - e * Math.cos(E));
    E -= delta;
    if (Math.abs(delta) < 1e-9) break;
  }
  return E;
}

/**
 * One shader for every body, branching on `uKind`.
 *
 * It does its own lighting rather than going through `MeshStandardMaterial`, for one
 * reason: terminator hardness is an identity feature here. An airless body has a knife
 * edge at the day/night line and an atmosphere smears it, and that difference is not
 * something a roughness value can express — it needs control over the falloff of N·L
 * itself. Doing the lighting here also means the phase is exact: a body between the
 * camera and the sun is a crescent, without anything being told to make it one.
 */
function createPlanetMaterial(body: { kind: number; base: number; secondary: number; accent: number;
  bands: number; bandContrast: number; terminator: number; seed: number; ringShadow: boolean }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uSun: { value: new THREE.Vector3() },
      uBase: { value: new THREE.Color(body.base) },
      uSecondary: { value: new THREE.Color(body.secondary) },
      uAccent: { value: new THREE.Color(body.accent) },
      uKind: { value: body.kind },
      uBands: { value: body.bands },
      uBandContrast: { value: body.bandContrast },
      uTerminator: { value: body.terminator },
      uSeed: { value: body.seed },
      uTime: { value: 0 },
      /** Saturn only: the rings drop a real shadow band across the disc. */
      uRingShadow: { value: body.ringShadow ? 1 : 0 },
      uRingInner: { value: 1.15 },
      uRingOuter: { value: 2.35 },
      /** Damps high-frequency banding as the body shrinks on screen, against moire. */
      uApparent: { value: 1 },
      /**
       * How far out of focus this body is, 0 to 1. A real depth-of-field pass needs a
       * depth buffer the stage's slot targets do not keep, and adding one costs a full
       * extra target plus a blur pass. Softening the surface detail and lifting the limb
       * instead buys most of the read for nothing: what the eye actually uses to judge
       * focus at this size is whether the *detail* is crisp, not whether the edge is.
       */
      uDefocus: { value: 0 },
      /*
       * Doppler shift along the line of sight: -1 approaching, +1 receding.
       *
       * Be clear about what this is. A planet moves at some tens of km/s, so v/c is
       * around 1e-4 and the real shift is roughly a hundredth of a percent — far below
       * anything a screen can show or an eye can see. What is drawn here is that effect
       * deliberately exaggerated by four orders of magnitude so it is visible at all. The
       * *sign* and the *timing* are honest — a body really is approaching when this goes
       * negative, and it crosses zero exactly at the ansae of its orbit — but the
       * magnitude is a visualisation, not a measurement.
       *
       * It is also normalised per body rather than globally. Against one shared scale
       * Neptune, at 5 km/s, would never leave zero while Mercury saturated; against its
       * own mean speed every planet swings the full range once per orbit, which is what
       * makes the effect readable on all eight instead of just the inner two.
       */
      uDoppler: { value: 0 },
    },
    vertexShader: `
      varying vec3 vLocal;
      varying vec3 vWorld;
      varying vec3 vNormalW;
      void main() {
        vLocal = normalize(position);
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform vec3 uSun;
      uniform vec3 uBase;
      uniform vec3 uSecondary;
      uniform vec3 uAccent;
      uniform int uKind;
      uniform float uBands;
      uniform float uBandContrast;
      uniform float uTerminator;
      uniform float uSeed;
      uniform float uTime;
      uniform int uRingShadow;
      uniform float uRingInner;
      uniform float uRingOuter;
      uniform float uApparent;
      uniform float uDefocus;
      uniform float uDoppler;
      varying vec3 vLocal;
      varying vec3 vWorld;
      varying vec3 vNormalW;

      float hash(vec3 p) {
        p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }
      float noise(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
          mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
          f.z);
      }
      float fbm(vec3 p) {
        float v = 0.0, a = 0.5;
        for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.05; a *= 0.5; }
        return v;
      }

      void main() {
        vec3 n = normalize(vNormalW);
        vec3 unit = normalize(vLocal);
        // Latitude in the body's own frame, so banding follows the pole the obliquity
        // put there rather than world up.
        float lat = unit.y;
        vec3 seeded = unit * 3.1 + uSeed;
        vec3 albedo = uBase;

        if (uKind == 0) {
          // Rocky: broad highland/basin breakup, then crater pitting on top. Mars gets
          // its caps from the same latitude term the giants use for bands.
          float basin = fbm(seeded * 1.7);
          float pit = fbm(seeded * 9.0);
          albedo = mix(uSecondary, uBase, smoothstep(0.35, 0.72, basin));
          albedo *= 0.86 + 0.24 * pit;
          float cap = smoothstep(0.82, 0.95, abs(lat));
          albedo = mix(albedo, uAccent, cap * 0.85);
        } else if (uKind == 1) {
          // Venus: uniform on purpose. The absence of detail is the identity feature, so
          // this branch adds almost nothing and must stay that way.
          albedo = mix(uBase, uSecondary, 0.5 + 0.5 * fbm(seeded * 1.2) * 0.25);
        } else if (uKind == 2) {
          // Earth: three albedo populations, not one. Land is a thresholded field, cloud
          // is a separate higher-frequency field that does not follow the land mask.
          float land = fbm(seeded * 1.9);
          float isLand = smoothstep(0.48, 0.56, land);
          albedo = mix(uBase, uSecondary, isLand);
          float cloud = smoothstep(0.52, 0.78, fbm(seeded * 3.3 + vec3(uTime * 0.006, 0.0, 0.0)));
          albedo = mix(albedo, uAccent, cloud * 0.62);
          float ice = smoothstep(0.78, 0.94, abs(lat));
          albedo = mix(albedo, uAccent, ice * 0.9);
        } else if (uKind == 3) {
          // Gas giant: bands are a 1D function of latitude, which is why they cost
          // nothing. Turbulence is added to the latitude *before* the band lookup so the
          // band edges wander instead of ruling straight lines around the planet.
          float turbulence = (fbm(seeded * 2.6) - 0.5) * 0.12;
          float banded = sin((lat + turbulence) * uBands * 3.14159);
          float contrast = uBandContrast * uApparent;
          albedo = mix(uBase, uSecondary, smoothstep(-0.35, 0.35, banded) * contrast + (1.0 - contrast) * 0.5);
          // The Great Red Spot: an oval at 22 degrees south. Longitude drifts with the
          // body's own rotation because it is painted in body space.
          float spotLat = lat + 0.375;
          float spotLon = atan(unit.z, unit.x);
          vec2 spot = vec2(spotLon / 0.55, spotLat / 0.14);
          float grs = 1.0 - smoothstep(0.6, 1.0, length(spot));
          albedo = mix(albedo, uAccent, grs * uBandContrast * 1.4);
        } else {
          // Ice giant: near-uniform methane, faint bands for Neptune, none for Uranus.
          float banded = sin(lat * max(uBands, 1.0) * 3.14159);
          albedo = mix(uBase, uSecondary, 0.5 + 0.5 * banded * uBandContrast * uApparent);
          albedo = mix(albedo, uAccent, fbm(seeded * 2.2) * 0.12);
        }

        // --- illumination -------------------------------------------------
        vec3 toSun = normalize(uSun - vWorld);
        float lambert = dot(n, toSun);
        // uTerminator is the whole airless-vs-atmosphere distinction. At 0.02 this is a
        // hard step; at 0.34 it is a long soft wrap.
        float day = smoothstep(-uTerminator, uTerminator, lambert);
        // Atmospheres scatter light around the limb, so they keep a rim past the
        // terminator that an airless body does not have.
        float wrap = uTerminator > 0.1 ? pow(max(0.0, lambert + 0.32), 1.6) * 0.22 : 0.0;

        if (uRingShadow == 1) {
          // Saturn's rings throw a real band across the disc. Walk from the fragment
          // toward the sun to where that ray crosses the ring plane (the body's own
          // equator, y = 0 in local space) and test the crossing radius against the annulus.
          vec3 localSun = normalize(uSun - vWorld);
          float denom = dot(vec3(0.0, 1.0, 0.0), localSun);
          if (abs(denom) > 0.001) {
            float t = -unit.y / denom;
            if (t > 0.0) {
              vec3 crossing = unit + localSun * t;
              float radius = length(crossing.xz);
              if (radius > uRingInner && radius < uRingOuter) {
                // The Cassini division lets light through, so the shadow band is broken
                // in exactly the same place the rings are.
                float gap = smoothstep(2.02, 2.04, radius) * (1.0 - smoothstep(2.08, 2.10, radius));
                day *= mix(0.34, 1.0, gap);
              }
            }
          }
        }

        // Limb darkening: the edge of a lit disc is dimmer because the line of sight
        // grazes. Applied to every body, strongest on the ones with atmosphere.
        float facing = max(0.0, dot(n, normalize(cameraPosition - vWorld)));
        float limb = mix(1.0, pow(facing, 0.35), uTerminator > 0.1 ? 0.55 : 0.25);

        // Doppler tint. Applied to the albedo before lighting, so it colours the body
        // rather than the light falling on it.
        vec3 receding = vec3(1.30, 0.80, 0.66);
        vec3 approaching = vec3(0.68, 0.86, 1.34);
        vec3 shift = mix(vec3(1.0), uDoppler > 0.0 ? receding : approaching, abs(uDoppler) * 0.5);
        albedo *= shift;

        // Out-of-focus bodies lose their surface detail toward flat albedo and gain a
        // softer terminator, which is what defocus does to a lit sphere.
        vec3 flat_ = mix(uBase, uSecondary, 0.5);
        albedo = mix(albedo, flat_, uDefocus * 0.72);
        day = mix(day, smoothstep(-0.45, 0.45, lambert), uDefocus);

        vec3 lit = albedo * (day * limb + wrap);
        // Never quite black: the night side sits against a starfield, and pure black
        // reads as a hole cut in the sky rather than as an unlit body.
        lit += albedo * 0.022;
        gl_FragColor = vec4(lit, 1.0);
      }
    `,
  });
}

/**
 * The rings, as the spec classifies them: a zero-thickness two-sided membrane. The
 * skill's validator refused this component until its material was marked double-sided,
 * which was the right call — Saturn's obliquity means we look at the underside of the
 * rings for half its orbit, and a one-sided membrane vanishes there.
 *
 * Radial density is a 1D function of radius and nothing else. The Cassini division is a
 * hole in that function, not a texture.
 */
function createRingMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    uniforms: {
      uSun: { value: new THREE.Vector3() },
      uInner: { value: 1.15 },
      uOuter: { value: 2.35 },
      uColor: { value: new THREE.Color(0xc9b899) },
      uShade: { value: new THREE.Color(0x9a8b70) },
      uOpacity: { value: 1 },
    },
    vertexShader: `
      varying vec3 vWorld;
      varying vec2 vLocal;
      varying vec3 vNormalW;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        vLocal = position.xy;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform vec3 uSun;
      uniform float uInner;
      uniform float uOuter;
      uniform vec3 uColor;
      uniform vec3 uShade;
      uniform float uOpacity;
      varying vec3 vWorld;
      varying vec2 vLocal;
      varying vec3 vNormalW;

      void main() {
        // RingGeometry is built in its own XY plane, so radius is planar here and the
        // mesh is rotated flat by the caller.
        float radius = length(vLocal);
        if (radius < uInner || radius > uOuter) discard;

        // Radial density: C ring faint, B ring densest, Cassini division empty, A ring
        // intermediate. One function of radius, exactly as the spec requires.
        float density = 0.32;
        density = mix(density, 0.95, smoothstep(1.24, 1.53, radius));
        density = mix(density, 0.62, smoothstep(1.92, 2.02, radius));
        float cassini = smoothstep(2.02, 2.045, radius) * (1.0 - smoothstep(2.075, 2.10, radius));
        density *= mix(1.0, 0.06, 1.0 - cassini);
        density *= 1.0 - smoothstep(2.24, 2.35, radius);
        // Fine ringlet structure, so the annulus is not a flat wash.
        density *= 0.86 + 0.14 * sin(radius * 210.0);

        // Particulate, not a surface: opacity rises at grazing view angles because the
        // line of sight crosses more particles.
        vec3 view = normalize(cameraPosition - vWorld);
        float grazing = 1.0 - abs(dot(normalize(vNormalW), view));
        float alpha = density * mix(0.55, 1.0, grazing) * uOpacity;

        // Forward scattering: the rings brighten rather than silhouette when the sun is
        // behind them, which is why Saturn's rings glow at high phase angles.
        vec3 toSun = normalize(uSun - vWorld);
        float forward = pow(max(0.0, -dot(toSun, view)), 3.0);
        vec3 colour = mix(uShade, uColor, density) * (0.72 + forward * 0.9);

        gl_FragColor = vec4(colour, alpha);
      }
    `,
  });
}

/**
 * The galaxy behind everything.
 *
 * An inverted sphere well outside the outermost orbit, so it is a backdrop rather than a
 * place — the camera can never reach it and nothing ever passes in front of it. It paints
 * three things a real sky has and a plain starfield does not: a bright band concentrated
 * about the galactic plane, emission clouds warm on one side of the band and cool on the
 * other, and dark dust lanes cutting the band where cold gas blocks what is behind it.
 *
 * The dust lanes are the part that matters. Without them the band is a smooth glow and
 * reads as a lens flare; the broken silhouette is what makes it read as something with
 * structure at an enormous distance.
 */
function createNebulaMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    transparent: true,
    uniforms: {
      uOpacity: { value: 1 },
      /** Pole of the galactic plane. The band is bright where a direction is normal to it. */
      uPole: { value: new THREE.Vector3(0.34, 0.86, 0.38).normalize() },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      uniform vec3 uPole;
      varying vec3 vDir;

      float hash(vec3 p) {
        p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }
      float noise(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
          mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
          f.z);
      }
      float fbm(vec3 p) {
        float v = 0.0, a = 0.5;
        for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.07; a *= 0.5; }
        return v;
      }

      void main() {
        vec3 dir = normalize(vDir);
        // Concentration toward the galactic plane: bright at the equator of uPole, gone
        // at its poles.
        // Tight. A wide band spreads into an even haze over the whole sky, which reads
        // as a dirty lens rather than as a galaxy — the concentration is the whole point.
        float band = 1.0 - smoothstep(0.0, 0.34, abs(dot(dir, uPole)));
        band = pow(band, 2.4);

        float clouds = fbm(dir * 2.3);
        float fine = fbm(dir * 6.4 + 13.7);
        float lanes = fbm(dir * 3.6 - 7.1);

        // Warm emission toward the core, cool scattered light away from it. Which side is
        // which is decided by the cloud field, not by screen position, so the split
        // survives the camera moving.
        vec3 warm = vec3(0.46, 0.26, 0.15);
        vec3 cool = vec3(0.10, 0.15, 0.34);
        vec3 colour = mix(cool, warm, smoothstep(0.35, 0.72, clouds));
        colour *= 0.45 + fine * 0.9;
        colour *= band;

        // Dust lanes: cold gas in front of the band, so they only darken where there is
        // band to darken.
        colour *= 1.0 - smoothstep(0.42, 0.76, lanes) * band * 0.82;

        // Held well down. This is the furthest thing in the scene and it competes with
        // eight lit bodies and a sun; at full strength it washes the planets out.
        colour *= 0.58;

        // A very faint floor, so deep space is not pure black but is still unmistakably
        // dark between the clouds.
        colour += vec3(0.005, 0.007, 0.015);

        gl_FragColor = vec4(colour * uOpacity, 1.0);
      }
    `,
  });
}

export type SolarSystem = {
  group: any;
  /**
   * The starfield. Kept out of `group` because `group` carries the ecliptic tilt, and a
   * sky that tilts with the orbits swings when they do.
   */
  sky: any;
  /** Every body mesh, so the caller can put them on the sun's occluder layer. */
  bodies: any[];
  /** Move the system's focus. The sun is draggable, so this runs every frame. */
  setSunPosition: (position: any) => void;
  /**
   * `camera` drives the stand-in depth of field: how far each body is from the plane the
   * terminal sits on decides how much of its surface detail dissolves.
   */
  update: (delta: number, time: number, visibility: number, camera: any, focusDistance: number) => void;
  dispose: () => void;
};

export function createSolarSystem(options: {
  isMobile: boolean;
  reducedMotion: boolean;
  /** Where the system is anchored in the scene. Fixed — the sun does not carry it. */
  origin: any;
}): SolarSystem {
  const { isMobile, reducedMotion } = options;
  const group = new THREE.Group();
  group.position.copy(options.origin);
  /*
   * The ecliptic is the XZ plane, which from a camera on +Z would be edge-on — a line.
   * Tilting the whole system toward the viewer is what turns the orbits into the
   * ellipses that read as "solar system" rather than "row of dots".
   */
  group.rotation.x = -ECLIPTIC_TILT;

  const segments = isMobile ? 20 : 32;
  const rings = isMobile ? 14 : 20;
  const sphere = new THREE.SphereGeometry(1, segments, rings);

  type Runtime = {
    canon: BodyCanon;
    orbit: any;
    tilt: any;
    spin: any;
    mesh: any;
    material: any;
    radius: number;
    n: number;
    m0: number;
    argPeri: number;
    /** Mean orbital speed in scene units per second, for normalising the Doppler tint. */
    meanSpeed: number;
    /** Last frame's world position, so velocity can be differenced from it. */
    previous: any;
    hasPrevious: boolean;
  };

  const runtime: Runtime[] = [];
  const bodies: any[] = [];
  /** Ring materials need the sun for forward scattering, so they are tracked separately. */
  const ringMaterials: any[] = [];

  BODIES.forEach((canon, index) => {
    const radius = orbitRadius(canon.a);
    const bodyR = bodyRadius(canon.radius);

    // orbit -> tilt -> spin, three frames, because the three rotations are independent:
    // the orbit is in the ecliptic, the obliquity is fixed relative to the stars, and the
    // spin runs inside that. Collapsing them is what makes a tilted planet wobble.
    const orbit = new THREE.Group();
    const tilt = new THREE.Group();
    const spin = new THREE.Group();
    tilt.rotation.z = canon.obliquity * DEG;
    orbit.add(tilt);
    tilt.add(spin);
    group.add(orbit);

    const material = createPlanetMaterial({
      kind: canon.kind, base: canon.base, secondary: canon.secondary, accent: canon.accent,
      bands: canon.bands, bandContrast: canon.bandContrast, terminator: canon.terminator,
      seed: index * 17.13, ringShadow: canon.id === "saturn",
    });
    const mesh = new THREE.Mesh(sphere, material);
    mesh.scale.setScalar(bodyR);
    spin.add(mesh);
    bodies.push(mesh);

    if (canon.id === "saturn") {
      const ringGeometry = new THREE.RingGeometry(bodyR * 1.15, bodyR * 2.35, 96, 2);
      const ringMaterial = createRingMaterial();
      ringMaterial.uniforms.uInner.value = bodyR * 1.15;
      ringMaterial.uniforms.uOuter.value = bodyR * 2.35;
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      // RingGeometry is built in XY; the rings lie in Saturn's equatorial plane, so they
      // go flat and then inherit the obliquity from the tilt frame they hang under.
      ring.rotation.x = -Math.PI / 2;
      ring.renderOrder = 2;
      tilt.add(ring);
      ringMaterials.push(ringMaterial);
    }

    if (canon.id === "earth") {
      const moonOrbit = new THREE.Group();
      const moonMaterial = createPlanetMaterial({
        kind: 0, base: MOON.base, secondary: MOON.secondary, accent: MOON.secondary,
        bands: 0, bandContrast: 0, terminator: 0.02, seed: 91.7, ringShadow: false,
      });
      const moon = new THREE.Mesh(sphere, moonMaterial);
      moon.scale.setScalar(bodyRadius(MOON.radius));
      moon.position.x = MOON.orbit;
      moonOrbit.add(moon);
      tilt.add(moonOrbit);
      bodies.push(moon);
      runtime.push({
        canon: { ...canon, id: "luna", period: MOON.period } as BodyCanon,
        orbit: moonOrbit, tilt: moonOrbit, spin: moonOrbit,
        mesh: moon, material: moonMaterial, radius: MOON.orbit,
        n: (Math.PI * 2) / (MOON.period * EARTH_YEAR_SECONDS), m0: 0, argPeri: 0,
        meanSpeed: (Math.PI * 2 * MOON.orbit) / (MOON.period * EARTH_YEAR_SECONDS),
        previous: new THREE.Vector3(), hasPrevious: false,
      });
    }

    runtime.push({
      canon, orbit, tilt, spin, mesh, material, radius,
      n: (Math.PI * 2) / (canon.period * EARTH_YEAR_SECONDS),
      m0: (canon.l0 - canon.periLon) * DEG,
      argPeri: (canon.periLon - canon.node) * DEG,
      meanSpeed: (Math.PI * 2 * radius) / (canon.period * EARTH_YEAR_SECONDS),
      previous: new THREE.Vector3(), hasPrevious: false,
    });
  });

  /** Place a point given its distance and true anomaly, in the ecliptic frame. */
  function orbitalToEcliptic(r: number, trueAnomaly: number, canon: BodyCanon, target: any) {
    const argPeri = (canon.periLon - canon.node) * DEG;
    const node = canon.node * DEG;
    const inc = canon.i * DEG;
    const u = trueAnomaly + argPeri;
    const cosU = Math.cos(u);
    const sinU = Math.sin(u);
    const cosN = Math.cos(node);
    const sinN = Math.sin(node);
    const cosI = Math.cos(inc);
    return target.set(
      r * (cosN * cosU - sinN * sinU * cosI),
      r * (sinU * Math.sin(inc)),
      r * (sinN * cosU + cosN * sinU * cosI),
    );
  }

  // --- starfield ------------------------------------------------------------
  const starCount = isMobile ? 1400 : 4200;
  const starPositions = new Float32Array(starCount * 3);
  const starSizes = new Float32Array(starCount);
  /** 0 cool blue-white, 1 warm amber. Real starfields are not one colour. */
  const starTints = new Float32Array(starCount);
  let seed = 20260827;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let index = 0; index < starCount; index += 1) {
    // Uniform on a sphere, not uniform in angle — otherwise they crowd the poles.
    const u = random() * 2 - 1;
    const theta = random() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u);
    const distance = 40 + random() * 30;
    starPositions[index * 3] = r * Math.cos(theta) * distance;
    starPositions[index * 3 + 1] = u * distance;
    starPositions[index * 3 + 2] = r * Math.sin(theta) * distance;
    // A few bright ones carry the field; a uniform field reads as noise.
    starSizes[index] = Math.pow(random(), 3.2) * 3.1 + 0.3;
    // Skewed warm: most stars read neutral-to-amber, a minority blue-white. A field of
    // uniformly white points looks like sensor noise rather than sky.
    starTints[index] = Math.pow(random(), 0.7);
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
  starGeometry.setAttribute("aSize", new THREE.BufferAttribute(starSizes, 1));
  starGeometry.setAttribute("aTint", new THREE.BufferAttribute(starTints, 1));
  const starMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uScale: { value: 300 }, uOpacity: { value: 1 }, uTime: { value: 0 } },
    vertexShader: `
      attribute float aSize;
      attribute float aTint;
      uniform float uScale;
      uniform float uTime;
      varying float vTwinkle;
      varying float vTint;
      varying float vBright;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        // Scintillation, keyed off position so every star has its own phase.
        vTwinkle = 0.72 + 0.28 * sin(uTime * 1.7 + position.x * 0.7 + position.z * 1.3);
        vTint = aTint;
        // The brightest few earn diffraction spikes in the fragment shader. Spikes on
        // every star would read as a filter; on a handful they read as a lens.
        vBright = smoothstep(2.4, 3.2, aSize);
        gl_PointSize = aSize * (uScale / max(0.001, -mv.z)) * 0.075;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      varying float vTwinkle;
      varying float vTint;
      varying float vBright;
      void main() {
        vec2 offset = gl_PointCoord - 0.5;
        float core = smoothstep(0.5, 0.0, length(offset));
        // A thin cross, tight in one axis and long in the other, added only for the
        // brightest stars.
        float spike = (smoothstep(0.06, 0.0, abs(offset.x)) + smoothstep(0.06, 0.0, abs(offset.y)))
                    * smoothstep(0.5, 0.1, length(offset)) * vBright * 0.55;
        float alpha = (core + spike) * vTwinkle * uOpacity;
        if (alpha <= 0.003) discard;
        vec3 cool = vec3(0.72, 0.82, 1.0);
        vec3 warm = vec3(1.0, 0.88, 0.7);
        gl_FragColor = vec4(mix(cool, warm, vTint), alpha);
      }
    `,
  });
  const starfield = new THREE.Points(starGeometry, starMaterial);
  starfield.frustumCulled = false;

  const nebulaMaterial = createNebulaMaterial();
  // Outside the starfield's 40–70 unit shell, so stars sit in front of the galaxy rather
  // than inside it. Low segment counts: it is all fragment work, the sphere is only a
  // surface to run it on.
  const nebula = new THREE.Mesh(new THREE.SphereGeometry(88, 32, 20), nebulaMaterial);
  nebula.frustumCulled = false;
  nebula.renderOrder = -100;
  // The starfield is the far wall. It must never be tilted with the ecliptic or the sky
  // would swing when the orbits do, so it hangs outside the tilted group.
  const sky = new THREE.Group();
  sky.add(nebula);
  sky.add(starfield);

  const sunWorld = new THREE.Vector3();
  const scratch = new THREE.Vector3();
  const focusScratch = new THREE.Vector3();
  const velocityScratch = new THREE.Vector3();
  const lineOfSight = new THREE.Vector3();
  let elapsed = 0;

  return {
    group,
    sky,
    bodies,

    /**
     * Tell the system where the light is — and *only* that.
     *
     * The orbits deliberately do not follow. The sun is the one thing on this page a
     * visitor can pick up, and if the eight bodies came with it the drag would carry the
     * whole diagram around like a sticker and nothing about it would change. Leaving the
     * orbits anchored turns the same drag into something worth doing: the bodies hold
     * their paths while the light moves across them, so phases swing, crescents flip to
     * the other limb and Saturn's ring shadow sweeps over its own disc.
     */
    setSunPosition: (position: any) => {
      sunWorld.copy(position);
    },

    update: (delta: number, time: number, visibility: number, camera: any, focusDistance: number) => {
      if (!reducedMotion) elapsed += delta;
      starMaterial.uniforms.uTime.value = time;
      starMaterial.uniforms.uOpacity.value = visibility;
      nebulaMaterial.uniforms.uOpacity.value = visibility;
      /*
       * A fully transparent nebula is not a cheap nebula.
       *
       * It is a sphere the size of the sky, `frustumCulled = false`, running a
       * fifteen-octave fbm per fragment — the most expensive shader in the scene — and
       * multiplying the whole thing by an opacity of zero at the very end. The field
       * itself is static; only the fade moves. So once it has faded out, stop drawing it
       * rather than paying full price to render nothing.
       */
      nebula.visible = visibility > 0.01;
      ringMaterials.forEach((material: any) => {
        material.uniforms.uSun.value.copy(sunWorld);
        material.uniforms.uOpacity.value = visibility;
      });

      runtime.forEach((entry) => {
        const { canon } = entry;
        if (entry.canon.id === "luna") {
          // The Moon is parented to Earth's tilt frame, so it only needs its own angle.
          entry.orbit.rotation.y = -elapsed * entry.n;
          entry.material.uniforms.uSun.value.copy(sunWorld);
          entry.material.uniforms.uTime.value = time;
          return;
        }

        const meanAnomaly = entry.m0 + elapsed * entry.n;
        const E = eccentricAnomaly(meanAnomaly, canon.e);
        // True anomaly from eccentric anomaly. The half-angle form is used because it is
        // the one that stays correct across all four quadrants.
        const trueAnomaly = 2 * Math.atan2(
          Math.sqrt(1 + canon.e) * Math.sin(E / 2),
          Math.sqrt(1 - canon.e) * Math.cos(E / 2),
        );
        const r = entry.radius * (1 - canon.e * Math.cos(E));
        orbitalToEcliptic(r, trueAnomaly, canon, scratch);
        entry.tilt.position.copy(scratch);

        // Rotation sense comes straight from the sign of the canonical period, which is
        // how Venus and Uranus end up spinning backwards without a special case.
        entry.spin.rotation.y = (elapsed / (canon.rotation / 365.256 * EARTH_YEAR_SECONDS)) * Math.PI * 2;

        const uniforms = entry.material.uniforms;
        uniforms.uSun.value.copy(sunWorld);
        uniforms.uTime.value = time;
        // Damp band contrast as a body gets small on screen, or the high-frequency term
        // aliases into moire. Distance is a good enough proxy for apparent size here.
        uniforms.uApparent.value = THREE.MathUtils.clamp(1.4 - r * 0.06, 0.45, 1);
        // Defocus grows with distance from the focal plane in both directions, so a body
        // that swings toward the camera goes soft the same way a far one does.
        entry.mesh.getWorldPosition(focusScratch);
        const depth = focusScratch.distanceTo(camera.position);
        uniforms.uDefocus.value = THREE.MathUtils.clamp(
          Math.abs(depth - focusDistance) / 9.5, 0, 0.88);

        /*
         * Radial velocity, differenced from last frame's position rather than derived
         * analytically. Differencing is what keeps the sign honest through every part of
         * the orbit — including the two points where the body is moving fastest but
         * straight across the line of sight, and the shift correctly passes through zero.
         */
        if (entry.hasPrevious && delta > 1e-5) {
          velocityScratch.subVectors(focusScratch, entry.previous).divideScalar(delta);
          lineOfSight.subVectors(focusScratch, camera.position).normalize();
          const radial = velocityScratch.dot(lineOfSight);
          uniforms.uDoppler.value = THREE.MathUtils.clamp(
            radial / Math.max(1e-6, entry.meanSpeed), -1, 1);
        }
        entry.previous.copy(focusScratch);
        entry.hasPrevious = true;
      });
    },

    dispose: () => {
      sphere.dispose();
      starGeometry.dispose();
      starMaterial.dispose();
      nebula.geometry.dispose();
      nebulaMaterial.dispose();
      group.traverse((object: any) => {
        object.geometry?.dispose?.();
        if (Array.isArray(object.material)) object.material.forEach((m: any) => m.dispose?.());
        else object.material?.dispose?.();
      });
    },
  };
}
