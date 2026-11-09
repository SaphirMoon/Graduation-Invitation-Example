/** GLSL snippets for the prologue. Kept as plain strings so they're easy to tweak. */

export const NOISE_GLSL = /* glsl */ `
float hash21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
             mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++){ v += a * vnoise(p); p *= 2.02; a *= 0.5; }
  return v;
}
`;

/* ---------------- Sky dome ---------------- */

export const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main(){
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const SKY_FRAG = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uMid;
uniform float uMidAmt;
uniform vec3 uMist;
uniform float uMistAmt;
uniform float uMistHeight;
uniform vec3 uMistWarm;
uniform float uMistWarmAmt;
uniform vec3 uGlow;
uniform vec3 uMoonDir;
uniform float uGlowAmt;
uniform float uWave;      // 0 → 1: blue light front sweeping outward from the moon
uniform vec3 uWaveColor;
varying vec3 vDir;
void main(){
  vec3 d = normalize(vDir);
  vec3 col = mix(uHorizon, uTop, smoothstep(-0.02, 0.55, d.y));
  // Optional three-stop sky: top, middle, deep blue above the horizon.
  vec3 three = mix(mix(uHorizon, uMid, smoothstep(0.0, 0.3, d.y)), uTop, smoothstep(0.25, 0.75, d.y));
  col = mix(col, three, uMidAmt);
  // Pale mist right above the horizon: depth, and it separates the sky from the land.
  col = mix(col, uMist, (1.0 - smoothstep(-0.02, uMistHeight, d.y)) * uMistAmt);
  col = mix(col, uMistWarm, (1.0 - smoothstep(-0.02, 0.2, d.y)) * uMistWarmAmt);
  float m = max(dot(d, uMoonDir), 0.0);
  col += uGlow * (pow(m, 10.0) * 0.28 + pow(m, 60.0) * 0.35) * uGlowAmt;
  if (uWave > 0.0 && uWave < 1.0) {
    float ang = acos(clamp(dot(d, uMoonDir), -1.0, 1.0)) / 3.14159; // 0 at the moon, 1 opposite
    float front = uWave * 1.15;
    float band = exp(-pow((ang - front) / 0.035, 2.0));
    float behind = (1.0 - smoothstep(front - 0.02, front, ang)) * 0.18;
    col += uWaveColor * (band * 0.75 + behind) * (1.0 - uWave);
  }
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

/* ---------------- Stars ---------------- */

export const STAR_VERT = /* glsl */ `
attribute float aSize;
attribute float aBright;
attribute float aPhase;
attribute float aTwinkle;
uniform float uTime;
uniform float uPR;
uniform float uBoost;   // brief extra sparkle after the burst
varying float vB;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float twAmt = clamp(aTwinkle + uBoost * 0.8, 0.0, 1.0);
  float tw = mix(1.0, 0.45 + 0.55 * sin(uTime * (1.2 + aPhase * 2.0 + uBoost * 5.0) + aPhase * 40.0), twAmt);
  vB = aBright * tw * (1.0 + uBoost * 0.9);
  gl_PointSize = aSize * uPR * (0.85 + 0.3 * tw);
}
`;

export const STAR_FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vB;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = pow(smoothstep(0.5, 0.0, d), 1.8) * vB;
  gl_FragColor = vec4(uColor * 1.3, a);
}
`;

/* ---------------- Nebula patch ---------------- */

export const NEBULA_FRAG = /* glsl */ `
${NOISE_GLSL}
uniform float uTime;
uniform float uSeed;
uniform float uOpacity;
uniform vec3 uColor;
varying vec2 vUv;
void main(){
  vec2 c = (vUv - 0.5) * 2.0;
  float n = fbm(vUv * vec2(4.0, 3.0) + vec2(uSeed, uTime * 0.006 + uSeed * 0.4));
  float falloff = 1.0 - smoothstep(0.15, 1.0, length(c));
  gl_FragColor = vec4(uColor, smoothstep(0.32, 0.75, n) * falloff * uOpacity);
}
`;

/* ---------------- Cloud band ---------------- */

export const CLOUD_VERT = /* glsl */ `
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const CLOUD_FRAG = /* glsl */ `
${NOISE_GLSL}
uniform float uTime;
uniform float uSeed;
uniform float uOpacity;
uniform vec3 uColor;
varying vec2 vUv;
void main(){
  vec2 p = vUv * vec2(7.0, 1.4) + vec2(uTime * 0.012 + uSeed, uSeed * 0.3);
  float n = fbm(p);
  float band = smoothstep(0.0, 0.4, vUv.y) * smoothstep(1.0, 0.55, vUv.y)
             * smoothstep(0.0, 0.2, vUv.x) * smoothstep(1.0, 0.8, vUv.x);
  float a = smoothstep(0.42, 0.78, n) * band * uOpacity;
  gl_FragColor = vec4(uColor * (0.75 + 0.5 * n), a);
}
`;

/* ---------------- Volumetric light cone ---------------- */

export const CONE_VERT = /* glsl */ `
varying vec2 vUv;
varying float vFacing;
void main(){
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vec3 n = normalize(normalMatrix * normal);
  vFacing = abs(dot(n, normalize(-mv.xyz)));
  gl_Position = projectionMatrix * mv;
}
`;

export const CONE_FRAG = /* glsl */ `
${NOISE_GLSL}
uniform float uTime;
uniform float uOpacity;
uniform vec3 uColor;
varying vec2 vUv;
varying float vFacing;
void main(){
  float ang = vUv.x * 6.2831;
  vec2 q = vec2(cos(ang) * 2.5 + sin(ang) * 1.3, vUv.y * 70.0 - uTime * 0.9);
  float n = fbm(q);
  float breathe = 0.82 + 0.18 * sin(uTime * 1.35);
  float edge = pow(vFacing, 1.4);
  float ground = smoothstep(0.0, 0.006, vUv.y);
  float lenFade = mix(1.0, 0.5, smoothstep(0.02, 0.6, vUv.y));
  float a = edge * ground * lenFade * (0.4 + 0.6 * n) * breathe * uOpacity;
  gl_FragColor = vec4(uColor * 1.4, a * 0.8);
}
`;

/* ---------------- Floating particles (fireflies / dust) ---------------- */

export const MOTE_VERT = /* glsl */ `
attribute float aPhase;
attribute float aSize;
uniform float uTime;
uniform float uPR;
uniform float uDrift;
uniform float uScale;
uniform float uJitter;   // fast tremble (crystal lift-off)
varying float vA;
void main(){
  vec3 p = position;
  float t = uTime;
  p.x += sin(t * 0.55 + aPhase * 6.0) * uDrift;
  p.y += sin(t * 0.8 + aPhase * 11.0) * uDrift * 0.7 + mod(t * 0.05 * uDrift + aPhase, 1.0) * uDrift * 0.4;
  p.z += cos(t * 0.45 + aPhase * 7.0) * uDrift;
  p += vec3(sin(t * 37.0 + aPhase * 90.0), sin(t * 41.0 + aPhase * 70.0), cos(t * 33.0 + aPhase * 50.0)) * uJitter * 0.06;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float fl = 0.5 + 0.5 * sin(t * (1.1 + aPhase * 2.3) + aPhase * 20.0);
  vA = 0.2 + 0.8 * fl * fl;
  gl_PointSize = aSize * uPR * uScale / max(-mv.z, 0.5);
}
`;

export const MOTE_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vA;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float core = smoothstep(0.5, 0.0, d);
  float a = pow(core, 2.2) * vA * uOpacity;
  gl_FragColor = vec4(uColor, a);
}
`;

/* ---------------- Fresnel rim shell (crystal) ---------------- */

export const RIM_VERT = /* glsl */ `
varying float vFres;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vec3 n = normalize(normalMatrix * normal);
  vFres = 1.0 - abs(dot(n, normalize(-mv.xyz)));
  gl_Position = projectionMatrix * mv;
}
`;

export const RIM_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vFres;
void main(){
  gl_FragColor = vec4(uColor, pow(vFres, 2.0) * uOpacity);
}
`;

/* ---------------- Velvet curtain ---------------- */

export const CURTAIN_VERT = /* glsl */ `
uniform float uTime;
uniform float uOpen;
varying vec2 vUv;
varying float vFold;
const float FOLDS = 7.0;
void main(){
  vUv = uv;
  float u = uv.x;   // 0 = outer edge, 1 = inner edge (center of screen)
  float v = uv.y;
  float g = uOpen;
  // Gather the fabric into a bunch at the outer edge; only at the very end does the bunch slide away.
  float gu = u * mix(1.0, 0.2, g) - smoothstep(0.7, 1.0, g) * 0.35;
  vec3 p = position;
  p.x = gu - 0.5;
  // Folds deepen as the fabric bunches up. Irregular widths so it doesn't look like a barcode.
  float phase = u * FOLDS * 6.2831 + sin(u * 11.0 + 1.3) * 1.1 + sin(u * 23.0) * 0.45;
  vFold = phase;
  p.z += cos(phase) * 0.03 * (1.0 + g * 0.8);
  // Soft breathing wave; the free inner edge ripples more, especially while moving.
  float sway = sin(v * 5.0 + uTime * 1.3 + u * 2.0);
  p.z += sway * 0.012 * (0.3 + u);
  p.x += sin(v * 4.0 + uTime * 1.1) * 0.006 * u * (1.0 + 4.0 * g);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

export const CURTAIN_FRAG = /* glsl */ `
uniform vec3 uDark;
uniform vec3 uMid;
uniform vec3 uLight;
uniform vec3 uHem;
uniform float uAlpha;
varying vec2 vUv;
varying float vFold;
void main(){
  float s = 0.5 + 0.5 * cos(vFold + 0.7);
  vec3 col = mix(uDark, uMid, smoothstep(0.0, 0.6, s));
  col = mix(col, uLight, pow(s, 6.0) * 0.8);
  // Darker toward the top and the floor
  col *= mix(0.45, 1.0, smoothstep(0.0, 0.3, vUv.y)) * mix(0.55, 1.0, smoothstep(1.0, 0.72, vUv.y));
  // Fine silver piping on the inner edge and a hem line near the bottom
  float piping = smoothstep(0.992, 0.998, vUv.x);
  float hem = smoothstep(0.003, 0.0, abs(vUv.y - 0.07));
  col = mix(col, uHem, max(piping * 0.45, hem * 0.6));
  // A darker valance band across the top
  col *= mix(1.0, 0.55, smoothstep(0.86, 0.9, vUv.y));
  gl_FragColor = vec4(col, uAlpha);
  #include <colorspace_fragment>
}
`;

/* ---------------- Glitter shed by the flying crystal ---------------- */

/**
 * Each spark is born at a fixed point of the crystal's path (position attribute) when the flight
 * progress uFly passes its aSpawn value, then drifts backward/outward and fades. Pure function of
 * uFly, so it also works when the timeline is scrubbed.
 */
export const SPARK_VERT = /* glsl */ `
attribute float aSpawn;
attribute vec3 aDir;
attribute float aSize;
uniform float uFly;
uniform float uLife;
uniform float uPR;
varying float vA;
void main(){
  float age = (uFly - aSpawn) / uLife;
  float alive = step(0.0, age) * step(age, 1.0);
  float grow = 1.0 + aSpawn * aSpawn * 6.0;     // matches the crystal's growth with distance
  vec3 p = position + aDir * age * 0.9 * grow + vec3(0.0, -0.25, 0.0) * age * age * grow;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  vA = alive * (1.0 - age) * (1.0 - age);
  // Never smaller than a few pixels, so the glitter still reads when the crystal is far away.
  gl_PointSize = alive * uPR * max(aSize * 3.0, aSize * 30.0 * grow / max(-mv.z, 0.5)) * (1.0 - age * 0.6);
}
`;

/* ---------------- Blue dust falling like snow (after the burst) ---------------- */

export const SNOW_VERT = /* glsl */ `
attribute float aPhase;
attribute float aSize;
uniform float uTime;
uniform float uPR;
uniform float uHeight;
varying float vA;
void main(){
  // position.y is the bottom of this flake's column; it falls from bottom+uHeight down to bottom.
  vec3 p = position;
  float fall = mod(aPhase * uHeight * 7.0 + uTime * (0.35 + aPhase * 0.35), uHeight);
  p.y = position.y + uHeight - fall;
  p.x += sin(uTime * 0.7 + aPhase * 12.0) * 0.35;
  p.z += cos(uTime * 0.5 + aPhase * 9.0) * 0.25;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float edge = smoothstep(0.0, 0.15, fall / uHeight) * smoothstep(1.0, 0.8, fall / uHeight);
  vA = edge * (0.55 + 0.45 * sin(uTime * 2.0 + aPhase * 30.0));
  gl_PointSize = aSize * uPR * 14.0 / max(-mv.z, 0.5);
}
`;

/* ---------------- Ribbon trail (crystal) ---------------- */

export const TRAIL_VERT = /* glsl */ `
attribute float aT;     // 0 = tail, 1 = head
attribute float aSide;  // -1 / +1 across the ribbon
varying float vT;
varying float vSide;
void main(){
  vT = aT;
  vSide = aSide;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const TRAIL_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vT;
varying float vSide;
void main(){
  float core = 1.0 - abs(vSide);
  float a = pow(vT, 1.6) * (0.35 + 0.65 * core) * uOpacity;
  gl_FragColor = vec4(uColor, a);
}
`;

/* ---------------- Per-point size/alpha sprites (shard trails) ---------------- */

export const GHOST_VERT = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
uniform float uPR;
varying float vA;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  vA = aAlpha;
  gl_PointSize = aSize * uPR * 900.0 / max(-mv.z, 1.0);
}
`;
