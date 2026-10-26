export const GLSL_NOISE = /* glsl */ `
float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float valueNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash13(i + vec3(0, 0, 0)), hash13(i + vec3(1, 0, 0)), f.x),
        mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), f.x),
        mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), f.x), f.y),
    f.z
  );
}

float fbm(vec3 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int octave = 0; octave < 4; octave++) {
    value += valueNoise(p) * amplitude;
    p = p * 2.03 + 11.7;
    amplitude *= 0.5;
  }
  return value;
}
`

export const CORE_VERTEX = /* glsl */ `
uniform float uTime;
uniform float uDistortion;
uniform float uPulse;
varying vec3 vNormalW;
varying vec3 vPositionW;
varying float vNoise;

${GLSL_NOISE}

void main() {
  float broad = fbm(position * 1.72 + vec3(uTime * 0.09, -uTime * 0.07, uTime * 0.05));
  float detail = valueNoise(position * 7.6 - vec3(uTime * 0.2));
  float breath = sin(uTime * 0.78) * 0.5 + 0.5;
  float displacement = (broad - 0.5) * uDistortion + (detail - 0.5) * 0.055;
  displacement += breath * 0.035 + uPulse * 0.09;
  vec3 displaced = position + normal * displacement;
  vec4 world = modelMatrix * vec4(displaced, 1.0);
  vPositionW = world.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vNoise = broad;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`

export const CORE_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
uniform vec3 uCyan;
uniform vec3 uMagenta;
uniform vec3 uChrome;
varying vec3 vNormalW;
varying vec3 vPositionW;
varying float vNoise;

void main() {
  vec3 viewDirection = normalize(cameraPosition - vPositionW);
  float fresnel = pow(1.0 - max(dot(viewDirection, normalize(vNormalW)), 0.0), 2.35);
  float band = sin(vNormalW.y * 13.0 + vNormalW.x * 7.0 + uTime * 0.42) * 0.5 + 0.5;
  float spectral = sin((fresnel + vNoise * 0.5) * 16.0 - uTime * 0.35) * 0.5 + 0.5;
  vec3 iridescence = mix(uCyan, uMagenta, spectral);
  vec3 horizon = mix(vec3(0.015, 0.02, 0.026), uChrome, smoothstep(-0.45, 0.72, vNormalW.y));
  vec3 color = mix(horizon, iridescence, fresnel * 0.78 + band * 0.08);
  color += uCyan * pow(fresnel, 6.0) * 2.6;
  color += vec3(0.72, 0.84, 0.95) * smoothstep(0.81, 1.0, band) * 0.32;
  gl_FragColor = vec4(color, uOpacity);
}
`

export const PARTICLE_VERTEX = /* glsl */ `
uniform float uTime;
uniform float uSize;
uniform float uMotion;
uniform float uOpacity;
attribute float aScale;
attribute float aPhase;
varying float vAlpha;
varying float vPhase;

void main() {
  vec3 p = position;
  p.x += sin(uTime * 0.27 + aPhase * 9.0 + p.z * 0.17) * uMotion;
  p.y += cos(uTime * 0.21 + aPhase * 7.0 + p.x * 0.3) * uMotion;
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uSize * aScale * (1.0 / max(0.12, -mvPosition.z));
  gl_Position = projectionMatrix * mvPosition;
  vAlpha = uOpacity * (0.45 + aScale * 0.42);
  vPhase = aPhase;
}
`

export const PARTICLE_FRAGMENT = /* glsl */ `
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uTime;
varying float vAlpha;
varying float vPhase;

void main() {
  vec2 centered = gl_PointCoord - 0.5;
  float radius = length(centered);
  float core = smoothstep(0.48, 0.0, radius);
  float halo = smoothstep(0.5, 0.08, radius) * 0.45;
  vec3 color = mix(uColorA, uColorB, sin(vPhase * 17.0 + uTime * 0.4) * 0.5 + 0.5);
  color *= 0.8 + core * 2.5;
  gl_FragColor = vec4(color, (core + halo) * vAlpha);
}
`

export const TUNNEL_VERTEX = /* glsl */ `
uniform float uTime;
uniform float uTravel;
uniform float uVelocity;
uniform float uSize;
uniform float uOpacity;
attribute float aScale;
attribute float aPhase;
varying float vAlpha;
varying float vHeat;

void main() {
  vec3 p = position;
  float depth = mod(-p.z + uTravel * 118.0 + uTime * (4.0 + uVelocity * 0.12), 124.0);
  p.z = 4.0 - depth;
  float spin = depth * 0.036 + uTime * 0.16 + aPhase * 6.2831;
  float radial = length(p.xy);
  p.xy = vec2(cos(spin), sin(spin)) * radial;
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  float speedStretch = 1.0 + min(2.6, abs(uVelocity) * 0.09);
  gl_PointSize = uSize * aScale * speedStretch / max(0.08, -mvPosition.z * 0.075);
  gl_Position = projectionMatrix * mvPosition;
  vAlpha = uOpacity * smoothstep(124.0, 92.0, depth) * smoothstep(0.0, 7.0, depth);
  vHeat = fract(aPhase * 4.7 + depth * 0.017);
}
`

export const TUNNEL_FRAGMENT = /* glsl */ `
uniform vec3 uColorA;
uniform vec3 uColorB;
varying float vAlpha;
varying float vHeat;

void main() {
  vec2 point = gl_PointCoord - 0.5;
  float radial = length(point);
  float alpha = smoothstep(0.5, 0.025, radial);
  vec3 color = mix(uColorA, uColorB, smoothstep(0.45, 0.8, vHeat));
  gl_FragColor = vec4(color * (1.1 + alpha * 2.8), alpha * vAlpha);
}
`

export const SIGNAL_VERTEX = /* glsl */ `
uniform float uTime;
uniform vec2 uPointer;
uniform float uFrequency;
uniform float uCoherence;
uniform float uEntropy;
uniform float uAlignment;
uniform float uFieldMode;
uniform float uOpacity;
uniform float uSize;
attribute float aScale;
attribute float aPhase;
varying float vEnergy;
varying float vAlpha;

void main() {
  vec3 p = position;
  float orbit = uTime * (0.08 + uFrequency * 0.34) + aPhase * 6.2831;
  float fieldSign = uFieldMode < 0.5 ? 1.0 : (uFieldMode < 1.5 ? -1.0 : 0.0);
  vec2 target = uPointer * 2.2;
  vec2 direction = target - p.xy;
  float distanceToField = max(0.18, length(direction));
  p.xy += normalize(direction) * fieldSign * (0.08 + uCoherence * 0.34) / distanceToField;
  p.xy += vec2(cos(orbit), sin(orbit)) * (0.12 + uEntropy * 0.42);
  if (uFieldMode > 1.5) {
    float cs = cos(0.45 + uTime * 0.08);
    float sn = sin(0.45 + uTime * 0.08);
    p.xy = mat2(cs, -sn, sn, cs) * p.xy;
  }
  p.z += sin(orbit * 1.7 + length(p.xy)) * (0.12 + uEntropy * 0.7);
  p *= mix(1.0, 0.62, uAlignment * 0.58);
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uSize * aScale * (1.0 + uAlignment * 1.8) / max(0.16, -mvPosition.z * 0.18);
  gl_Position = projectionMatrix * mvPosition;
  vEnergy = fract(aPhase + uAlignment + uTime * 0.03);
  vAlpha = uOpacity * (0.28 + uCoherence * 0.72);
}
`

export const SIGNAL_FRAGMENT = /* glsl */ `
uniform vec3 uColorA;
uniform vec3 uColorB;
varying float vEnergy;
varying float vAlpha;

void main() {
  float radius = length(gl_PointCoord - 0.5);
  float spark = smoothstep(0.49, 0.02, radius);
  vec3 color = mix(uColorA, uColorB, smoothstep(0.38, 0.82, vEnergy));
  gl_FragColor = vec4(color * (1.1 + spark * 3.4), spark * vAlpha);
}
`

export const OCEAN_VERTEX = /* glsl */ `
uniform float uTime;
uniform float uProgress;
uniform vec2 uPointer;
varying float vWave;
varying vec3 vPositionW;
varying vec3 vNormalW;

${GLSL_NOISE}

float oceanHeight(vec2 coordinate) {
  float distanceToPointer = length(coordinate - uPointer * vec2(7.0, 4.0));
  float ripple = sin(distanceToPointer * 3.1 - uTime * 2.4) * exp(-distanceToPointer * 0.2);
  float waveA = sin(coordinate.x * 0.54 + uTime * 0.62) * 0.23;
  float waveB = cos(coordinate.y * 0.73 - uTime * 0.42) * 0.18;
  float noiseWave = (fbm(vec3(coordinate * 0.17, uTime * 0.08)) - 0.5) * 0.72;
  return waveA + waveB + noiseWave + ripple * 0.18;
}

void main() {
  vec3 p = position;
  float wave = oceanHeight(p.xy);
  float displacementScale = 1.0 - uProgress * 0.72;
  p.z += wave * displacementScale;
  float normalStep = 0.075;
  float waveX = oceanHeight(p.xy + vec2(normalStep, 0.0));
  float waveY = oceanHeight(p.xy + vec2(0.0, normalStep));
  vec3 localNormal = normalize(vec3(
    -(waveX - wave) * displacementScale / normalStep,
    -(waveY - wave) * displacementScale / normalStep,
    1.0
  ));
  vec4 world = modelMatrix * vec4(p, 1.0);
  vPositionW = world.xyz;
  vWave = wave;
  vNormalW = normalize(mat3(modelMatrix) * localNormal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`

export const OCEAN_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uProgress;
uniform float uOpacity;
uniform vec3 uCyan;
uniform vec3 uPearl;
varying float vWave;
varying vec3 vPositionW;
varying vec3 vNormalW;

void main() {
  vec3 viewDirection = normalize(cameraPosition - vPositionW);
  float fresnel = pow(1.0 - abs(dot(viewDirection, normalize(vNormalW))), 2.2);
  float contour = smoothstep(0.87, 1.0, sin((vPositionW.x + vPositionW.z) * 1.3 - uTime) * 0.5 + 0.5);
  vec3 abyss = vec3(0.004, 0.022, 0.035);
  vec3 color = mix(abyss, uCyan * 0.44, fresnel);
  color = mix(color, uPearl, contour * 0.28 + smoothstep(0.34, 0.62, vWave) * 0.16);
  color *= 1.0 - uProgress * 0.45;
  gl_FragColor = vec4(color, uOpacity * (0.84 - uProgress * 0.38));
}
`

export const MORPH_VERTEX = /* glsl */ `
uniform float uTime;
uniform float uMorph;
uniform float uOpacity;
uniform float uSize;
attribute vec3 aDestination;
attribute float aScale;
attribute float aPhase;
varying float vAlpha;
varying float vColorMix;

void main() {
  float eased = uMorph * uMorph * (3.0 - 2.0 * uMorph);
  vec3 p = mix(position, aDestination, eased);
  p += normalize(p + vec3(0.001)) * sin(uTime * 0.32 + aPhase * 14.0) * 0.035;
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uSize * aScale * (0.62 + eased * 1.25) / max(0.12, -mvPosition.z * 0.1);
  gl_Position = projectionMatrix * mvPosition;
  vAlpha = uOpacity * (0.18 + eased * 0.82);
  vColorMix = fract(aPhase * 3.7 + eased * 0.21);
}
`

export const MORPH_FRAGMENT = /* glsl */ `
uniform vec3 uColorA;
uniform vec3 uColorB;
varying float vAlpha;
varying float vColorMix;

void main() {
  float radius = length(gl_PointCoord - 0.5);
  float alpha = smoothstep(0.5, 0.04, radius);
  vec3 color = mix(uColorA, uColorB, smoothstep(0.3, 0.8, vColorMix));
  gl_FragColor = vec4(color * (1.0 + alpha * 2.5), alpha * vAlpha);
}
`

export const NODE_VERTEX = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
varying vec3 vColor;
varying float vPulse;

void main() {
  vec3 transformed = position;
  vec4 instancePosition = instanceMatrix * vec4(transformed, 1.0);
  float pulse = sin(uTime * 2.1 + instancePosition.x * 1.7 + instancePosition.y * 0.8) * 0.5 + 0.5;
  vec4 mvPosition = modelViewMatrix * instancePosition;
  gl_Position = projectionMatrix * mvPosition;
  vColor = instanceColor;
  vPulse = pulse;
}
`

export const NODE_FRAGMENT = /* glsl */ `
uniform float uOpacity;
varying vec3 vColor;
varying float vPulse;

void main() {
  vec3 color = vColor * (1.45 + vPulse * 1.75);
  gl_FragColor = vec4(color, uOpacity);
}
`

export const CONNECTION_VERTEX = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
attribute float aAlong;
attribute float aPhase;
attribute float aStrength;
varying float vPulse;
varying float vStrength;

void main() {
  float travel = fract(uTime * 0.13 + aPhase);
  vPulse = exp(-pow((aAlong - travel) * 8.0, 2.0));
  vStrength = aStrength * uOpacity;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

export const CONNECTION_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
varying float vPulse;
varying float vStrength;

void main() {
  vec3 color = uColor * (0.28 + vPulse * 3.8);
  gl_FragColor = vec4(color, vStrength * (0.1 + vPulse * 0.8));
}
`

export const PORTAL_VERTEX = /* glsl */ `
uniform float uTime;
uniform float uCharge;
varying vec2 vUv;
varying float vWarp;

void main() {
  vUv = uv;
  vec3 p = position;
  float radius = length(uv - 0.5);
  float warp = sin(radius * 34.0 - uTime * (2.0 + uCharge * 7.0)) * (0.012 + uCharge * 0.035);
  p.z += warp;
  vWarp = warp;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`

export const PORTAL_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uCharge;
uniform float uOpacity;
uniform vec3 uAmber;
uniform vec3 uCyan;
varying vec2 vUv;
varying float vWarp;

void main() {
  vec2 p = vUv - 0.5;
  float radius = length(p) * 2.0;
  float angle = atan(p.y, p.x);
  float spiral = sin(angle * 9.0 - radius * 31.0 + uTime * (1.4 + uCharge * 5.0));
  float rings = sin(radius * 57.0 - uTime * 3.2) * 0.5 + 0.5;
  float edge = smoothstep(1.0, 0.62, radius);
  float aperture = smoothstep(0.46 + uCharge * 0.33, 0.04, radius);
  vec3 color = mix(uCyan * 0.22, uAmber, spiral * 0.5 + 0.5);
  color *= 0.38 + rings * 0.8 + aperture * (2.0 + uCharge * 4.0);
  color += vec3(0.9, 0.96, 1.0) * pow(max(0.0, 1.0 - radius), 8.0) * uCharge * 4.0;
  gl_FragColor = vec4(color, edge * uOpacity * (0.42 + uCharge * 0.58));
}
`

export const PORTAL_PARTICLE_VERTEX = /* glsl */ `
uniform float uTime;
uniform float uCharge;
uniform float uOpacity;
uniform float uSize;
attribute float aScale;
attribute float aPhase;
varying float vAlpha;
varying float vHeat;

void main() {
  vec3 p = position;
  float radius = max(0.001, length(p.xy));
  float angle = atan(p.y, p.x);
  float pull = uCharge * uCharge * (3.0 - 2.0 * uCharge);
  float targetRadius = 2.28 + sin(aPhase * 17.0 + uTime * 2.0) * 0.16;
  float currentRadius = mix(radius, targetRadius, pull * 0.88);
  angle += uTime * (0.08 + pull * 0.82) + (1.0 - pull) * p.z * 0.06;
  p.xy = vec2(cos(angle), sin(angle)) * currentRadius;
  p.z = mix(p.z, sin(aPhase * 31.0 + uTime * 3.0) * 0.16, pull * 0.9);
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uSize * aScale * (0.7 + pull * 1.8) / max(0.12, -mvPosition.z * 0.13);
  gl_Position = projectionMatrix * mvPosition;
  vAlpha = uOpacity * (0.28 + pull * 0.72);
  vHeat = fract(aPhase * 4.1 + pull * 0.45 + uTime * 0.025);
}
`

export const PORTAL_PARTICLE_FRAGMENT = /* glsl */ `
uniform vec3 uColorA;
uniform vec3 uColorB;
varying float vAlpha;
varying float vHeat;

void main() {
  float radius = length(gl_PointCoord - 0.5);
  float spark = smoothstep(0.5, 0.025, radius);
  vec3 color = mix(uColorA, uColorB, smoothstep(0.28, 0.78, vHeat));
  gl_FragColor = vec4(color * (0.8 + spark * 3.5), spark * vAlpha);
}
`
