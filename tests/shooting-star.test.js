import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../assets/vendor/three.module.js";
import { createShootingStarFlight } from "../scripts/shooting-star.js";
const setup = (ground = () => ({height: 0}), reduced = false) => {
  const streak = new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshBasicMaterial());
  const camera = new THREE.PerspectiveCamera(54, 1.6, 10, 160000);
  camera.position.set(0,100,0);
  camera.lookAt(0,500,-1000);
  return {streak,camera,update:createShootingStarFlight(streak,ground,reduced)};
};
test("stars start at 20s, repeat without backlog and vary across the current view",()=>{
  const {streak,camera,update}=setup();
  update(19.99,camera); assert.equal(streak.visible,false);
  const starts=[];
  for(const t of [20,40,60]) {
    camera.lookAt(t===40?1000:0,500,t===40?0:-1000);
    camera.updateMatrixWorld();
    update(t,camera); assert.equal(streak.visible,true);
    const projected=streak.position.clone().project(camera);
    assert.ok(Math.abs(projected.x)<0.81 && projected.y>0 && projected.y<0.9);
    starts.push(projected);
    update(t+0.5,camera); assert.ok(streak.material.opacity>0);
    update(t+1.2,camera); assert.equal(streak.visible,false);
  }
  assert.ok(starts[0].distanceTo(starts[1])>0.1);
});
test("a star keeps its trajectory after the viewer turns and moves",()=>{
  const {streak,camera,update}=setup();
  update(20,camera);const start=streak.position.clone(), rotation=streak.quaternion.clone();
  update(20.2,camera);const step=streak.position.clone().sub(start);
  camera.position.set(400,700,200);camera.lookAt(0,-500,1000);
  update(20.4,camera);
  assert.ok(streak.position.distanceTo(start.addScaledVector(step,2))<1e-6);
  assert.ok(streak.quaternion.angleTo(rotation)<1e-7);
});
test("looking down or at an obscuring mountain defers launch until sky is clear",()=>{
  let mountain=true;
  const {streak,camera,update}=setup(()=>({height:mountain?10000:0}));
  update(20,camera);assert.equal(streak.visible,false);
  mountain=false;camera.lookAt(0,-1000,-100);
  update(30,camera);assert.equal(streak.visible,false);
  camera.lookAt(0,500,-1000);
  update(31,camera);assert.equal(streak.visible,true);
  update(32.2,camera);assert.equal(streak.visible,false);
  update(50,camera);assert.equal(streak.visible,false);
  update(51,camera);assert.equal(streak.visible,true);
});
test("reduced motion suppresses stars and rewinding the clock resets scheduling",()=>{
  const still=setup(undefined,true);still.update(20,still.camera);assert.equal(still.streak.visible,false);
  const normal=setup();normal.update(20,normal.camera);normal.update(0,normal.camera);
  assert.equal(normal.streak.visible,false);
  normal.update(20,normal.camera);assert.equal(normal.streak.visible,true);
});
