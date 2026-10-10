import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../assets/vendor/three.module.js";
import { createBirdFlight } from "../scripts/bird-flight.js";
function setup(ground = () => ({height:0}), reduced = false) {
  const birds = new THREE.InstancedMesh(new THREE.BufferGeometry(),new THREE.MeshBasicMaterial(),14);
  const camera = new THREE.PerspectiveCamera(54,1.6,10,160000);
  camera.position.set(0,100,0);camera.lookAt(0,500,-1000);camera.updateMatrixWorld();
  return {birds,camera,update:createBirdFlight(birds,ground,reduced)};
}
function position(birds) {
  const matrix = new THREE.Matrix4();birds.getMatrixAt(0,matrix);
  return new THREE.Vector3().setFromMatrixPosition(matrix);
}
test("flocks start at two minutes, fade across visible sky, then repeat at four minutes",()=>{
  const {birds,camera,update}=setup();
  update(119.99,camera);assert.equal(birds.visible,false);
  update(120,camera);assert.equal(birds.visible,true);assert.equal(birds.material.opacity,0);
  let p=position(birds).project(camera);assert.ok(Math.abs(p.x)<0.8 && p.y>0);
  update(123,camera);assert.equal(birds.material.opacity,1);
  update(138,camera);assert.equal(birds.visible,false);
  update(239.99,camera);assert.equal(birds.visible,false);
  camera.lookAt(1000,500,0);camera.updateMatrixWorld();
  update(240,camera);assert.equal(birds.visible,true);
  p=position(birds).project(camera);assert.ok(Math.abs(p.x)<0.8 && p.y>0);
});
test("flocks wait for clear sky without stacking missed passes",()=>{
  let blocked=true;
  const {birds,camera,update}=setup(()=>({height:blocked?10000:0}));
  update(120,camera);assert.equal(birds.visible,false);
  blocked=false;camera.lookAt(0,-1000,0);
  update(240,camera);assert.equal(birds.visible,false);
  camera.lookAt(0,500,-1000);update(241,camera);assert.equal(birds.visible,true);
  update(360,camera);assert.equal(birds.visible,false);
  update(361,camera);assert.equal(birds.visible,true);
});
test("an active flock keeps its path when the camera moves; reduced motion hides birds",()=>{
  const a=setup(),b=setup();
  a.update(120,a.camera);b.update(120,b.camera);
  a.camera.position.set(900,1300,800);a.camera.lookAt(0,-1000,0);
  a.update(126,a.camera);b.update(126,b.camera);
  assert.ok(position(a.birds).distanceTo(position(b.birds))<1e-6);
  const still=setup(undefined,true);still.update(120,still.camera);
  assert.equal(still.birds.visible,false);
});
