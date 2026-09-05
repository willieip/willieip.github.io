import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createFreeCamera } from '../app/free-camera.ts';
import { createParkWind } from '../app/wind.ts';

class Surface extends EventTarget {
  dataset = {};
  focus() {}
  setPointerCapture() {}
}
function key(target, type, value) {
  target.dispatchEvent(Object.assign(new Event(type, {cancelable:true}), {key:value, ctrlKey:false, altKey:false, metaKey:false}));
}
function cameraRig() {
  const host = new Surface(), canvas = new Surface(), windowTarget = new EventTarget();
  globalThis.window = windowTarget;
  const camera = new THREE.PerspectiveCamera();camera.position.set(0,2,10);camera.lookAt(0,2,0);
  const orbit = {enabled:true,autoRotate:false,target:new THREE.Vector3(0,2,0),update(){camera.lookAt(this.target);}};
  let resets = 0;
  const control = createFreeCamera(host,canvas,camera,orbit,()=>{},()=>{resets++;control.reset();});
  return {host,canvas,windowTarget,camera,orbit,control,get resets(){return resets;}};
}

test('keyboard navigation eases in and out, with consistent travel at different frame rates', () => {
  const distances = [];
  for (const fps of [30,60,144]) {
    const rig = cameraRig();key(rig.host,'keydown','ArrowUp');
    rig.control.update(1/fps);
    assert.ok(10-rig.camera.position.z < 2.8/fps*.15, 'first frame should accelerate gently');
    for(let frame=1;frame<fps;frame++)rig.control.update(1/fps);
    const releasedAt = rig.camera.position.z;
    key(rig.windowTarget,'keyup','ArrowUp');rig.control.update(1/fps);
    assert.ok(rig.camera.position.z < releasedAt, 'release should decelerate instead of stopping abruptly');
    for(let frame=1;frame<fps*2;frame++)rig.control.update(1/fps);
    const stoppedAt = rig.camera.position.clone();rig.control.update(1);
    assert.ok(rig.camera.position.distanceTo(stoppedAt)<1e-6);
    distances.push(10-rig.camera.position.z);rig.control.dispose();
  }
  assert.ok(Math.max(...distances)-Math.min(...distances)<.001);
});

test('reset and focus loss clear held keys and residual motion', () => {
  const rig=cameraRig();key(rig.host,'keydown','ArrowRight');
  for(let i=0;i<30;i++)rig.control.update(1/60);
  rig.windowTarget.dispatchEvent(new Event('blur'));
  const blurred=rig.camera.position.clone();rig.control.update(.2);
  assert.ok(blurred.distanceTo(rig.camera.position)<1e-8);
  key(rig.host,'keydown','ArrowUp');rig.control.update(.2);key(rig.host,'keydown','0');
  assert.equal(rig.resets,1);assert.equal(rig.host.dataset.cameraMode,'orbit');assert.equal(rig.orbit.enabled,true);
  const reset=rig.camera.position.clone();rig.control.update(.5);
  assert.ok(reset.distanceTo(rig.camera.position)<1e-8);rig.control.dispose();
});

function windRig(reduced=false) {
  const scene=new THREE.Scene(),canopies=new THREE.Group();scene.add(canopies);
  const canopy=new THREE.Mesh(new THREE.PlaneGeometry(2,2).translate(0,4,0),new THREE.MeshStandardMaterial());canopies.add(canopy);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(20,20).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
  const wind=createParkWind(scene,canopies,[ground],reduced);
  return {scene,canopy,wind,falling:scene.getObjectByName('Wind | falling and settled leaves')};
}

test('wind moves leaves from actual canopies to the ground and settles them flat', () => {
  const {wind,falling,canopy}=windRig();
  let sawFalling=false,sawResting=false;
  const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),quaternion=new THREE.Quaternion(),scale=new THREE.Vector3();
  for(let frame=0;frame<1800;frame++) {
    wind.update(1/60);
    if(frame%30)continue;
    for(let i=0;i<falling.count;i++) {
      falling.getMatrixAt(i,matrix);matrix.decompose(position,quaternion,scale);
      if(scale.x<.01)continue;
      assert.ok(position.y>=.0129,'leaves should not pass beneath their landing surface');
      if(position.y>.2)sawFalling=true;
      if(Math.abs(position.y-.013)<.0001){
        sawResting=true;
        assert.ok(new THREE.Vector3(0,0,1).applyQuaternion(quaternion).y>.999,'settled leaves should lie flat');
      }
    }
  }
  assert.ok(sawFalling);assert.ok(sawResting);
  const shader={uniforms:{},vertexShader:'#include <begin_vertex>'};canopy.material.onBeforeCompile(shader,{});
  assert.ok(shader.uniforms.uParkWindTime.value>29);assert.match(shader.vertexShader,/transformed\.x/);
  assert.ok(canopy.customDepthMaterial,'wind must also deform the shadow pass');
  wind.dispose();assert.equal(falling.parent,null);
});

test('reduced motion leaves the trees still and hides falling leaves', () => {
  const {wind,falling,canopy}=windRig(true);
  assert.equal(wind.update(20),false);assert.equal(falling.visible,false);
  assert.equal(canopy.customDepthMaterial,undefined);wind.dispose();
});
