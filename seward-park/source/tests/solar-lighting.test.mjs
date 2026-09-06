import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { sunPosition, sunDirection, lightingStatus } from '../app/solar.ts';
import { createParkLighting } from '../app/park-lighting.ts';

test('solar angles agree with the published NREL SPA reference case', () => {
  // SPA example: 2003-10-17 12:30:30 UTC-7, 39.742476 N, 105.1786 W.
  // SPA includes atmospheric refraction; geometric elevation is slightly lower.
  const position = sunPosition(new Date('2003-10-17T19:30:30Z'), 39.742476, -105.1786);
  assert.ok(Math.abs(position.azimuth - 194.340241) < .02);
  assert.ok(Math.abs(position.altitude - 39.888378) < .03);
});

test('Seward Park sunlight travels east to west and responds to the seasons', () => {
  const morning = sunPosition(new Date('2026-06-21T10:00:00Z'));
  const noon = sunPosition(new Date('2026-06-21T17:00:00Z'));
  const evening = sunPosition(new Date('2026-06-21T23:30:00Z'));
  const winter = sunPosition(new Date('2026-12-21T17:00:00Z'));
  assert.ok(morning.altitude > 0 && morning.altitude < 10 && morning.azimuth < 90);
  assert.ok(noon.altitude > 70 && noon.azimuth > 175 && noon.azimuth < 190);
  assert.ok(evening.altitude > 0 && evening.altitude < 10 && evening.azimuth > 270);
  assert.ok(winter.altitude > 24 && winter.altitude < 27);
  assert.ok(sunDirection(morning.altitude, morning.azimuth)[0] > 0);
  assert.ok(sunDirection(evening.altitude, evening.azimuth)[0] < 0);
});

test('UTC instants stay continuous across midnight and daylight-saving changes', () => {
  assert.deepEqual(sunPosition(new Date('2026-09-05T19:20:00-04:00')), sunPosition(new Date('2026-09-05T23:20:00Z')));
  for (const [before, after] of [
    ['2026-03-08T06:59:59Z', '2026-03-08T07:00:01Z'],
    ['2026-11-01T05:59:59Z', '2026-11-01T06:00:01Z'],
    ['2026-09-05T23:59:59Z', '2026-09-06T00:00:01Z'],
    ['2028-02-28T23:59:59Z', '2028-02-29T00:00:01Z'],
  ]) {
    const a = sunPosition(new Date(before)), b = sunPosition(new Date(after));
    assert.ok(Math.abs(a.altitude - b.altitude) < .02);
    assert.ok(Math.abs(a.azimuth - b.azimuth) < .02);
  }
  const before = new Date('2026-03-08T06:59:00Z'), after = new Date('2026-03-08T07:00:00Z');
  assert.equal(lightingStatus('live', sunPosition(before), before).timeLabel, '1:59 AM');
  assert.equal(lightingStatus('live', sunPosition(after), after).timeLabel, '3:00 AM');
});

function lightingRig(time, reducedMotion = false) {
  let currentTime = new Date(time).getTime();
  const scene = new THREE.Scene(), background = new THREE.Color(0xeeeee7);
  scene.background = background;
  const sun = new THREE.DirectionalLight(), hemisphere = new THREE.HemisphereLight(), fill = new THREE.DirectionalLight();
  const lamp = new THREE.PointLight(), glass = new THREE.MeshStandardMaterial();
  let status;
  const lighting = createParkLighting({ scene, background, sun, hemisphere, fill,
    lamps:[{light:lamp,power:24}], glowing:new Set([glass]), reducedMotion,
    now:()=>currentTime, onChange:value=>{status=value;} });
  lighting.update(2);
  return {lighting,scene,background,sun,hemisphere,lamp,glass,get status(){return status;},
    time(value){currentTime=new Date(value).getTime();} };
}

test('live sunlight is the default and catches up after the page has been idle', () => {
  const rig = lightingRig('2026-09-05T17:00:00Z');
  assert.equal(rig.status.mode, 'live');assert.equal(rig.status.phase, 'Daylight');
  assert.ok(rig.sun.intensity > 2.5);assert.equal(rig.lamp.intensity, 0);
  const day = rig.background.clone();
  rig.time('2026-09-06T02:00:00Z');rig.lighting.update(2);
  assert.equal(rig.status.mode, 'live');assert.equal(rig.status.phase, 'Night');
  assert.equal(rig.sun.intensity, 0);assert.equal(rig.lamp.intensity, 24);
  assert.equal(rig.glass.emissiveIntensity, 3.5);
  assert.ok(rig.background.r < day.r * .1 && rig.background.b < day.b * .1);
});

test('dusk warms the light and progressively switches on the park lamps', () => {
  const rig = lightingRig('2026-09-05T22:45:00Z');
  assert.ok(rig.sun.color.r > rig.sun.color.b * 1.5);
  const before = rig.lamp.intensity;
  rig.time('2026-09-05T23:40:00Z');rig.lighting.update(2);
  assert.equal(rig.status.phase, 'Dusk');assert.ok(rig.lamp.intensity > before);
  assert.equal(rig.sun.intensity, 0);
  assert.ok(rig.lamp.intensity > 12 && rig.lamp.intensity < 24);
});

test('manual day and night hold until live sunlight is selected again', () => {
  const rig = lightingRig('2026-09-06T02:00:00Z');
  rig.lighting.setMode('day');rig.lighting.update(2);
  assert.equal(rig.status.mode, 'day');assert.equal(rig.lamp.intensity, 0);
  const sun = rig.sun.position.clone();
  rig.time('2026-09-06T03:00:00Z');rig.lighting.update(2);
  assert.equal(rig.status.mode, 'day');assert.ok(rig.sun.position.equals(sun));
  rig.lighting.setMode('night');rig.lighting.update(2);
  assert.equal(rig.status.mode, 'night');assert.equal(rig.lamp.intensity, 24);
  rig.time('2026-09-06T17:00:00Z');rig.lighting.setMode('live');rig.lighting.update(2);
  assert.equal(rig.status.mode, 'live');assert.equal(rig.status.phase, 'Daylight');
  assert.equal(rig.lamp.intensity, 0);
});

test('reduced motion snaps to the requested lighting without a transition', () => {
  const rig = lightingRig('2026-09-06T02:00:00Z', true);
  rig.lighting.setMode('day');rig.lighting.update(0);
  assert.ok(rig.sun.intensity > 2.5);assert.equal(rig.lamp.intensity, 0);
});
