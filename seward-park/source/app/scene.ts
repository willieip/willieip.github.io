import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createFreeCamera } from './free-camera';
import { createParkWind } from './wind';
import { assetPath } from './asset-path';
import { createParkLighting } from './park-lighting';
import type { LightingMode, LightingStatus } from './solar';

type View = 'Overview' | 'Court' | 'Entrance' | 'Above';
const presets: Record<View, {position: number[]; target: number[]}> = {
  Overview: {position: [17.5,15.5,22], target: [0,3.2,0]},
  Court: {position: [6,6.1,10.6], target: [0,.9,-.1]},
  Entrance: {position: [5.2,5.1,1.9], target: [-2.5,.8,-1.3]},
  Above: {position: [.01,26,.2], target: [0,0,0]},
};
export async function createParkViewer(host: HTMLDivElement, progress: (p: number) => void, modelVersion: string, onLightingChange?: (status: LightingStatus) => void) {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const scene = new THREE.Scene();
  const bg = new THREE.Color('#eeeee7'); scene.background = bg;
  const camera = new THREE.PerspectiveCamera(37,host.clientWidth/host.clientHeight,.025,250);
  const renderer = new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
  renderer.setSize(host.clientWidth,host.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .90;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
  renderer.domElement.setAttribute('aria-hidden','true');host.appendChild(renderer.domElement);
  const controls = new OrbitControls(camera,renderer.domElement);
  controls.enableDamping=true;controls.dampingFactor=.085;
  controls.minDistance=.08;controls.maxDistance=65;controls.maxPolarAngle=Math.PI*.48;
  controls.zoomToCursor=true;
  controls.autoRotateSpeed=.45;controls.screenSpacePanning=true;
  const hemi = new THREE.HemisphereLight(0xf5f5e9,0x899382,1.7);scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff3db,2.6);sun.position.set(-6,15,8);sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-14,right:14,top:14,bottom:-14,near:.1,far:70});
  sun.shadow.bias=-.00015;sun.shadow.normalBias=.025;sun.shadow.radius=3;scene.add(sun);
  const fill=new THREE.DirectionalLight(0xd7e7ef,.7);fill.position.set(9,9,-6);scene.add(fill);
  const pmrem=new THREE.PMREMGenerator(renderer);const room=new RoomEnvironment();const env=pmrem.fromScene(room,.04);scene.environment=env.texture;scene.environmentIntensity=.22;room.dispose();pmrem.dispose();
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(160,160),new THREE.ShadowMaterial({opacity:.15}));ground.rotation.x=-Math.PI/2;ground.position.y=-.92;ground.receiveShadow=true;scene.add(ground);
  const draco=new DRACOLoader();draco.setDecoderPath(assetPath('/draco/'));draco.setWorkerLimit(2);
  const loader=new GLTFLoader();loader.setDRACOLoader(draco);
  const treeCanopy = new THREE.Group();treeCanopy.name='Tree canopy';scene.add(treeCanopy);
  const site = new THREE.Group();site.name='Park';scene.add(site);
  let destination: {position: THREE.Vector3; target: THREE.Vector3} | null=null;
  let autoRotate=false;let disposed=false;let dirty=true;let interacted=false;let fitToViewport: ((instant?:boolean) => void) | null=null;
  let fittedOverview: {position: THREE.Vector3; target: THREE.Vector3} | null=null;
  let wind: ReturnType<typeof createParkWind> | null=null;let shadowElapsed=0;
  function view(name: View, instant=false) {
    dirty=true;
    const p=presets[name];const position=name==='Overview'&&fittedOverview?fittedOverview.position.clone():new THREE.Vector3(...p.position as [number,number,number]);
    // Give the portrait view enough room to show the whole diorama.
    if(name==='Overview' && !fittedOverview && host.clientWidth<700)position.multiplyScalar(1.65);
    const target=name==='Overview'&&fittedOverview?fittedOverview.target.clone():new THREE.Vector3(...p.target as [number,number,number]);
    if(instant||reducedMotion){camera.position.copy(position);controls.target.copy(target);destination=null;controls.update();}
    else destination={position,target};
  }
  view('Overview',true);
  const freeCamera = createFreeCamera(host, renderer.domElement, camera, controls,
    () => { dirty=true; destination=null; interacted=true; }, () => resetView());
  function resetView() {
    freeCamera.reset();autoRotate=false;interacted=false;
    if(fitToViewport)fitToViewport(false);else view('Overview');
  }
  const glowing = new Set<THREE.MeshStandardMaterial>();
  const lamps: { light: THREE.Light; power: number }[] = [];
  const lighting = createParkLighting({ scene, background:bg, sun, hemisphere:hemi, fill, lamps, glowing, reducedMotion,
    onChange:(status, position)=>{
      host.dataset.night=String(status.isNight);host.dataset.lightingMode=status.mode;host.dataset.dayPhase=status.phase;
      host.dataset.sunAltitude=position.altitude.toFixed(3);host.dataset.sunAzimuth=position.azimuth.toFixed(3);
      host.dataset.newYorkTime=status.timeLabel;onLightingChange?.(status);
    },
  });
  function setLighting(mode:LightingMode) { lighting.setMode(mode);dirty=true;renderer.shadowMap.needsUpdate=true; }
  function night(on:boolean) { setLighting(on?'night':'day'); }
  function wakeLighting() { if(document.visibilityState==='visible'){lighting.refresh(true);dirty=true;renderer.shadowMap.needsUpdate=true;} }
  document.addEventListener('visibilitychange',wakeLighting);
  const focusRay=new THREE.Raycaster(),pointer=new THREE.Vector2();
  function focusDetail(event:MouseEvent) {
    const rect=renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
    focusRay.setFromCamera(pointer,camera);
    const hit=focusRay.intersectObjects([...site.children,...treeCanopy.children],false)[0];
    if(!hit)return;
    freeCamera.reset();autoRotate=false;interacted=true;
    const direction=camera.position.clone().sub(hit.point).normalize();
    const distance=Math.max(controls.minDistance,Math.min(camera.position.distanceTo(hit.point),2.2));
    const position=hit.point.clone().addScaledVector(direction,distance);
    if(reducedMotion){camera.position.copy(position);controls.target.copy(hit.point);controls.update();destination=null;}
    else destination={position,target:hit.point.clone()};
    dirty=true;
  }
  renderer.domElement.addEventListener('dblclick',focusDetail);
  const clock = new THREE.Clock();
  function render(){if(disposed)return;const dt=Math.min(clock.getDelta(),.05);
    if(destination){dirty=true;const t=1-Math.exp(-dt*7);camera.position.lerp(destination.position,t);controls.target.lerp(destination.target,t);if(camera.position.distanceTo(destination.position)<.005&&controls.target.distanceTo(destination.target)<.005){camera.position.copy(destination.position);controls.target.copy(destination.target);destination=null;}}
    freeCamera.update(dt);
    shadowElapsed+=dt;
    if(wind?.update(dt)){dirty=true;if(shadowElapsed>.10){renderer.shadowMap.needsUpdate=true;shadowElapsed=0;}}
    if(lighting.update(dt)){dirty=true;if(shadowElapsed>.10){renderer.shadowMap.needsUpdate=true;shadowElapsed=0;}}
    controls.autoRotate=autoRotate&&!destination&&!freeCamera.active;
    const changed=freeCamera.active?false:controls.update(dt);
    // Preserve depth precision in the overview while allowing millimeter-scale
    // clipping distances when inspecting the paddle or net hardware up close.
    const near=freeCamera.active ? .005 : Math.max(.0015,Math.min(.12,camera.position.distanceTo(controls.target)*.02));
    if(Math.abs(camera.near-near)>1e-5){camera.near=near;camera.updateProjectionMatrix();dirty=true;}
    if(changed||dirty||autoRotate){renderer.render(scene,camera);dirty=false;}
  }
  renderer.setAnimationLoop(render);
  const observer=new ResizeObserver(()=>{if(disposed)return;dirty=true;camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();renderer.setSize(host.clientWidth,host.clientHeight);if(!interacted)fitToViewport?.();});observer.observe(host);
  const cancelMove=()=>{destination=null;interacted=true;};controls.addEventListener('start',cancelMove);
  function zoom(factor:number){dirty=true;destination=null;camera.position.sub(controls.target).multiplyScalar(factor).add(controls.target);controls.update();}
  function dispose(){if(disposed)return;disposed=true;observer.disconnect();controls.dispose();renderer.setAnimationLoop(null);freeCamera.dispose();wind?.dispose();draco.dispose();env.dispose();document.removeEventListener('visibilitychange',wakeLighting);renderer.domElement.removeEventListener('dblclick',focusDetail);
    const materials=new Set<THREE.Material>();scene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});materials.forEach(m=>m.dispose());renderer.dispose();renderer.domElement.remove();}
  try{
    const gltf=await loader.loadAsync(assetPath('/park.glb')+'?v='+encodeURIComponent(modelVersion),e=>progress(e.total?Math.min(94,e.loaded/e.total*94):Math.min(90,e.loaded/14000000*90)));
    gltf.scene.updateMatrixWorld(true);
    const groundSurfaces: THREE.Mesh[]=[];
    const collisionMaterial=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
    // Merge static parts by material and attribute layout, keeping canopy independent.
    const batches=new Map<string,{geometry:THREE.BufferGeometry[]; material:THREE.Material; canopy:boolean}>();
    gltf.scene.traverse(o=>{if(!(o instanceof THREE.Mesh))return;
      const materials=Array.isArray(o.material)?o.material:[o.material];
      if(materials.length!==1){o.castShadow=true;o.receiveShadow=true;site.attach(o);return;}
      const material=materials[0] as THREE.MeshStandardMaterial;
      const objectName=o.name.replaceAll('_',' ');
      const canopy=/^Tree \d+ \|/.test(objectName)&&objectName.includes('individual leaf canopy');
      if(material.name.includes('Net |'))material.side=THREE.DoubleSide;
      material.envMapIntensity=.3;
      if(/warm frosted glass|warm lit lens|warm opal diffuser/.test(material.name)){
        glowing.add(material);material.emissiveIntensity=0;
      }
      const geometry=o.geometry.clone().applyMatrix4(o.matrixWorld);
      if(/^(Court flagstone \||Sidewalk \||Planted earth \||Side path \| planted edge|Garden \| soil|Rear path \||Bench \| large stone piece|Cornilleau PARK \| gray playing surface)/.test(objectName)){
        groundSurfaces.push(new THREE.Mesh(geometry.clone(),collisionMaterial));
      }
      const key=material.uuid+'|'+canopy+'|'+Object.keys(geometry.attributes).sort().map(a=>a+geometry.attributes[a].itemSize).join(',')+'|'+!!geometry.index;
      if(!batches.has(key))batches.set(key,{geometry:[],material,canopy});batches.get(key)!.geometry.push(geometry);
    });
    for(const batch of batches.values()){
      const merged=mergeGeometries(batch.geometry,false);
      if(merged){const mesh=new THREE.Mesh(merged,batch.material);mesh.castShadow=true;mesh.receiveShadow=true;(batch.canopy?treeCanopy:site).add(mesh);batch.geometry.forEach(g=>g.dispose());}
      else for(const geometry of batch.geometry){const mesh=new THREE.Mesh(geometry,batch.material);mesh.castShadow=true;mesh.receiveShadow=true;(batch.canopy?treeCanopy:site).add(mesh);}
    }
    gltf.scene.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});
    wind=createParkWind(scene,treeCanopy,groundSurfaces,reducedMotion);
    host.dataset.wind=reducedMotion?'still':'gentle';renderer.shadowMap.needsUpdate=true;
    const lantern=new THREE.PointLight(0xffc477,0,12,2);lantern.position.set(2.20,3.77,-4.52);scene.add(lantern);lamps.push({light:lantern,power:15});
    function spotlight(position:number[],target:number[],power:number,color:number,angle:number,shadows:boolean){
      const light=new THREE.SpotLight(color,0,22,angle,.65,2);
      light.position.fromArray(position);light.target.position.fromArray(target);light.castShadow=shadows;
      light.shadow.mapSize.set(1024,1024);light.shadow.bias=-.0002;light.shadow.normalBias=.018;
      scene.add(light,light.target);lamps.push({light,power});
    }
    spotlight([0,2.50,.15],[0,.3,.15],24,0xffecd0,1.02,true);
    spotlight([4.96,6.28,.05],[-1,.2,1.5],80,0xffdfa4,.9,true);
    spotlight([4.96,6.28,-.45],[-.8,.2,-3.0],70,0xffdfa4,.9,false);
    fitToViewport=(instant=true)=>{
    const bounds=new THREE.Box3().setFromObject(site).union(new THREE.Box3().setFromObject(treeCanopy));
    const center=bounds.getCenter(new THREE.Vector3());
    const direction=new THREE.Vector3(1.05,.82,1.35).normalize();
    const right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),direction).normalize();
    const up=new THREE.Vector3().crossVectors(direction,right).normalize();
    const tanV=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));const tanH=tanV*camera.aspect;
    let distance=0;
    for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
      const p=new THREE.Vector3(x,y,z).sub(center);distance=Math.max(distance,p.dot(direction)+Math.max(Math.abs(p.dot(right))/tanH,Math.abs(p.dot(up))/tanV)*1.10);
    }
    controls.maxDistance=Math.max(65,distance*1.5);
    fittedOverview={position:center.clone().addScaledVector(direction,distance),target:center};
    view('Overview',instant);
    dirty=true;};fitToViewport();
    progress(100);dirty=true;render();
  }catch(error){dispose();throw error;}
  return {
    night,lighting:setLighting,view,zoom,reset:resetView,canopy:(show:boolean)=>{treeCanopy.visible=show;dirty=true;renderer.shadowMap.needsUpdate=true;},rotate:(on:boolean)=>{autoRotate=on;},
    snapshot:()=>{renderer.render(scene,camera);const a=document.createElement('a');a.download='seward-park-view.png';a.href=renderer.domElement.toDataURL('image/png');a.click();},dispose,
  };
}
