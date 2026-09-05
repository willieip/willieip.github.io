import * as THREE from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function createFreeCamera(host: HTMLElement, canvas: HTMLCanvasElement, camera: THREE.PerspectiveCamera,
  orbit: OrbitControls, changed: () => void, reset: () => void) {
  let flying = false, dragging = false, lastX = 0, lastY = 0;
  const keys = new Set<string>();
  const rotation = new THREE.Euler(0, 0, 0, 'YXZ');
  const forward = new THREE.Vector3(), right = new THREE.Vector3(), movement = new THREE.Vector3();
  const velocity = new THREE.Vector3(), targetVelocity = new THREE.Vector3();
  const displacement = new THREE.Vector3();
  const navigation = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', 'q', 'e', 'shift'];
  function mode(on: boolean) {
    velocity.set(0, 0, 0);
    flying = on; orbit.enabled = !on; orbit.autoRotate = false;
    rotation.setFromQuaternion(camera.quaternion, 'YXZ');
    host.dataset.cameraMode = on ? 'free' : 'orbit';
    if (!on) {
      camera.getWorldDirection(forward); orbit.target.copy(camera.position).addScaledVector(forward, 4);
      orbit.update();
    }
    changed();
  }
  function down(event: KeyboardEvent) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === 'escape') { keys.clear(); mode(false); return; }
    if (key === '0') { event.preventDefault(); reset(); return; }
    if (!navigation.includes(key)) return;
    event.preventDefault(); if (!flying) mode(true); keys.add(key);
  }
  const release = (event: KeyboardEvent) => keys.delete(event.key.toLowerCase());
  const blur = () => { keys.clear(); velocity.set(0, 0, 0); dragging = false; };
  function pointerDown(event: PointerEvent) {
    host.focus({ preventScroll: true });
    if (!flying || event.button !== 0) return;
    dragging = true; lastX = event.clientX; lastY = event.clientY; canvas.setPointerCapture(event.pointerId);
  }
  function pointerMove(event: PointerEvent) {
    if (!flying || !dragging) return;
    rotation.y -= (event.clientX - lastX) * .003;
    rotation.x = THREE.MathUtils.clamp(rotation.x - (event.clientY - lastY) * .003, -Math.PI * .495, Math.PI * .495);
    camera.quaternion.setFromEuler(rotation); lastX = event.clientX; lastY = event.clientY; changed();
  }
  const pointerUp = () => { dragging = false; };
  function wheel(event: WheelEvent) {
    if (!flying) return;
    event.preventDefault(); camera.getWorldDirection(forward);
    camera.position.addScaledVector(forward, -event.deltaY * .005); changed();
  }
  host.addEventListener('keydown', down); window.addEventListener('keyup', release);
  window.addEventListener('blur', blur); host.addEventListener('blur', blur);
  canvas.addEventListener('pointerdown', pointerDown); canvas.addEventListener('pointermove', pointerMove);
  canvas.addEventListener('pointerup', pointerUp); canvas.addEventListener('pointercancel', pointerUp);
  canvas.addEventListener('wheel', wheel, { passive: false });
  host.dataset.cameraMode = 'orbit';
  return {
    get active() { return flying; },
    reset() { keys.clear(); dragging = false; mode(false); },
    update(dt: number) {
      if (!flying) return;
      camera.getWorldDirection(forward); right.set(1, 0, 0).applyQuaternion(camera.quaternion);
      movement.set(0, 0, 0);
      if (keys.has('arrowup') || keys.has('w')) movement.add(forward);
      if (keys.has('arrowdown') || keys.has('s')) movement.sub(forward);
      if (keys.has('arrowright') || keys.has('d')) movement.add(right);
      if (keys.has('arrowleft') || keys.has('a')) movement.sub(right);
      if (keys.has('e')) movement.y += 1;
      if (keys.has('q')) movement.y -= 1;
      const moving = movement.lengthSq() > 0;
      targetVelocity.copy(movement);
      if (moving) targetVelocity.normalize().multiplyScalar(keys.has('shift') ? 7 : 2.8);
      // Integrate the eased velocity, so acceleration and stopping feel the
      // same at different frame rates, including when reversing direction.
      const response = moving ? 7 : 9;
      const decay = Math.exp(-response * dt);
      displacement.copy(velocity).sub(targetVelocity).multiplyScalar((1 - decay) / response)
        .addScaledVector(targetVelocity, dt);
      velocity.lerp(targetVelocity, 1 - decay);
      if (!moving && velocity.lengthSq() < .000001) velocity.set(0, 0, 0);
      if (displacement.lengthSq() > 1e-12) { camera.position.add(displacement); changed(); }
    },
    dispose() {
      host.removeEventListener('keydown', down); window.removeEventListener('keyup', release);
      window.removeEventListener('blur', blur); host.removeEventListener('blur', blur);
      canvas.removeEventListener('pointerdown', pointerDown); canvas.removeEventListener('pointermove', pointerMove);
      canvas.removeEventListener('pointerup', pointerUp); canvas.removeEventListener('pointercancel', pointerUp);
      canvas.removeEventListener('wheel', wheel);
    },
  };
}
