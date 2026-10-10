import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../assets/vendor/three.module.js";
import { createSunset, dayCycleState, DAY_CYCLE_DURATION } from "../scripts/sunset.js";
function fixture(reduced = false) {
  const state = {
    sun: new THREE.DirectionalLight(), ambient: new THREE.HemisphereLight(),
    sunDirection: new THREE.Vector3(), fog: new THREE.FogExp2(),
    sky: {material:{uniforms:{starRotation:{value:new THREE.Matrix3()},uDusk:{value:0},uDay:{value:0},uNight:{value:0},moonDirection:{value:new THREE.Vector3()}}}},
    water: {material:{uniforms:{sunDirection:{value:new THREE.Vector3()},
      sunColor:{value:new THREE.Color()},waterColor:{value:new THREE.Color()}}}}, reduced,
  };
  return {state,update:createSunset(state)};
}
test("24-minute cycle moves through night, sunrise, day and returns seamlessly",()=>{
  assert.equal(DAY_CYCLE_DURATION,1440);
  assert.ok(dayCycleState(0).elevation>0);
  assert.equal(dayCycleState(480).night,1);
  assert.ok(Math.abs(dayCycleState(840).elevation)<1e-8);
  assert.equal(dayCycleState(1080).day,1);
  assert.deepEqual(dayCycleState(1440),dayCycleState(0));
  const {state,update}=fixture();
  for(let t=0;t<=2880;t++) {
    update(t);
    assert.ok(Math.abs(state.sunDirection.length()-1)<1e-8);
    assert.ok(state.ambient.intensity>=0.9);
    assert.ok(Number.isFinite(state.sun.intensity));
    assert.ok(state.sky.material.uniforms.moonDirection.value.dot(state.sunDirection)<-0.999);
  }
  update(480);assert.equal(state.sky.material.uniforms.uNight.value,1);
  update(1080);assert.equal(state.sky.material.uniforms.uNight.value,0);
});
test("initial light matches the existing scene and reduced motion keeps it still",()=>{
  const normal=fixture();normal.update(0);
  assert.ok(Math.abs(normal.state.sun.intensity-3.4)<1e-8);
  assert.equal(normal.state.ambient.intensity,1.35);
  const still=fixture(true);still.update(480);
  assert.equal(still.state.sky.material.uniforms.uDusk.value,0);
  assert.ok(still.state.sunDirection.distanceTo(normal.state.sunDirection)<1e-8);
});

test("moon reflection direction does not overwrite the shared solar direction",()=>{
  const {state}=fixture();
  state.water.material.uniforms.sunDirection.value=state.sunDirection;
  const update=createSunset(state);update(480);
  assert.ok(state.sunDirection.y<0);
  assert.ok(state.water.material.uniforms.sunDirection.value.y>0);
  assert.notEqual(state.water.material.uniforms.sunDirection.value,state.sunDirection);
});

test("the star sphere rotates coherently, loops after 24 minutes and respects reduced motion",()=>{
  const {state,update}=fixture();const direction=new THREE.Vector3(.3,.7,-.5).normalize();
  const at=t=>{update(t);return direction.clone().applyMatrix3(state.sky.material.uniforms.starRotation.value);};
  const start=at(0);assert.ok(start.distanceTo(at(240))>.3);
  assert.ok(start.distanceTo(at(1440))<1e-8);
  const still=fixture(true);still.update(480);
  assert.ok(direction.clone().applyMatrix3(still.state.sky.material.uniforms.starRotation.value).distanceTo(start)<1e-8);
});
