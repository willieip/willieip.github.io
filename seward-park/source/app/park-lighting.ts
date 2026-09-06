import * as THREE from 'three';
import { lightingPalette, lightingStatus, sunDirection, sunPosition } from './solar.ts';
import type { LightingMode, LightingStatus, SolarPosition } from './solar.ts';

type Lights = {
  scene: THREE.Scene; background: THREE.Color; sun: THREE.DirectionalLight;
  hemisphere: THREE.HemisphereLight; fill: THREE.DirectionalLight;
  lamps: { light: THREE.Light; power: number }[];
  glowing: Set<THREE.MeshStandardMaterial>; reducedMotion: boolean;
  onChange?: (status: LightingStatus, position: SolarPosition) => void;
  now?: () => number;
};

export function createParkLighting(lights: Lights) {
  const { scene, background, sun, hemisphere, fill, lamps, glowing } = lights;
  const now = lights.now ?? (() => Date.now());
  let mode: LightingMode = 'live';
  let lastUpdate = 0, transition = 1, lampAmount = 0, pending = true;
  sun.target.position.set(0, 1.5, 0);
  scene.add(sun.target);

  function capture() {
    return { background: background.clone(), sky: hemisphere.color.clone(), ground: hemisphere.groundColor.clone(),
      sunColor: sun.color.clone(), sunPosition: sun.position.clone(), sunPower: sun.intensity,
      hemisphere: hemisphere.intensity, fill: fill.intensity, environment: scene.environmentIntensity, lamps: lampAmount };
  }
  let from = capture(), target = capture();

  function apply(amount: number) {
    background.copy(from.background).lerp(target.background, amount);
    hemisphere.color.copy(from.sky).lerp(target.sky, amount);
    hemisphere.groundColor.copy(from.ground).lerp(target.ground, amount);
    sun.color.copy(from.sunColor).lerp(target.sunColor, amount);
    sun.position.copy(from.sunPosition).lerp(target.sunPosition, amount);
    sun.intensity = THREE.MathUtils.lerp(from.sunPower, target.sunPower, amount);
    hemisphere.intensity = THREE.MathUtils.lerp(from.hemisphere, target.hemisphere, amount);
    fill.intensity = THREE.MathUtils.lerp(from.fill, target.fill, amount);
    scene.environmentIntensity = THREE.MathUtils.lerp(from.environment, target.environment, amount);
    lampAmount = THREE.MathUtils.lerp(from.lamps, target.lamps, amount);
  }

  function refresh(instant = false) {
    lastUpdate = now();
    const date = new Date(lastUpdate);
    const position = sunPosition(date);
    const altitude = mode === 'live' ? position.altitude : mode === 'day' ? 45 : -18;
    const palette = lightingPalette(altitude);
    const color = (key: 'background' | 'sky' | 'ground' | 'sun') =>
      new THREE.Color(palette.from[key]).lerp(new THREE.Color(palette.to[key]), palette.blend);
    const scalar = (key: 'sunPower' | 'hemisphere' | 'fill' | 'environment' | 'lamps') =>
      THREE.MathUtils.lerp(palette.from[key], palette.to[key], palette.blend);
    from = capture();
    target = { background: color('background'), sky: color('sky'), ground: color('ground'), sunColor: color('sun'),
      sunPosition: mode === 'live'
        ? new THREE.Vector3(...sunDirection(position.altitude, position.azimuth)).multiplyScalar(32).add(sun.target.position)
        : new THREE.Vector3(-6, 15, 8),
      sunPower: altitude <= -.833 ? 0 : scalar('sunPower'), hemisphere: scalar('hemisphere'),
      fill: scalar('fill'), environment: scalar('environment'), lamps: scalar('lamps') };
    transition = instant || lights.reducedMotion ? 1 : 0;
    if (transition === 1) apply(1);
    pending = true;
    lights.onChange?.(lightingStatus(mode, position, date), position);
  }

  refresh(true);
  return {
    setMode(next: LightingMode) { mode = next; refresh(); },
    refresh,
    update(dt: number) {
      // Use the wall clock, not accumulated frame time. Resuming a sleeping
      // tab or changing the device clock immediately catches up to the sun.
      if (mode === 'live' && Math.abs(now() - lastUpdate) >= 30000) refresh();
      let changed = pending;
      pending = false;
      if (transition < 1) {
        transition = Math.min(1, transition + dt / 1.4);
        apply(transition * transition * (3 - 2 * transition));
        changed = true;
      }
      for (const { light, power } of lamps) {
        const intensity = power * lampAmount;
        if (light.intensity !== intensity) { light.intensity = intensity; changed = true; }
      }
      for (const material of glowing) {
        const intensity = lampAmount * 3.5;
        if (material.emissiveIntensity !== intensity) { material.emissiveIntensity = intensity; changed = true; }
      }
      return changed;
    },
  };
}
