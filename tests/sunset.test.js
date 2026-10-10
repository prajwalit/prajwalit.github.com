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
test("48-minute cycle moves through night, sunrise, day and returns seamlessly",()=>{
  assert.equal(DAY_CYCLE_DURATION,2880);
  assert.ok(dayCycleState(0).elevation>0);
  assert.equal(dayCycleState(960).night,1);
  assert.ok(Math.abs(dayCycleState(1680).elevation)<1e-8);
  assert.equal(dayCycleState(2160).day,1);
  assert.deepEqual(dayCycleState(2880),dayCycleState(0));
  const {state,update}=fixture();
  for(let t=0;t<=5760;t++) {
    update(t);
    assert.ok(Math.abs(state.sunDirection.length()-1)<1e-8);
    assert.ok(state.ambient.intensity>=0.9);
    assert.ok(Number.isFinite(state.sun.intensity));
    assert.ok(state.sky.material.uniforms.moonDirection.value.dot(state.sunDirection)<-0.999);
  }
  update(960);assert.equal(state.sky.material.uniforms.uNight.value,1);
  update(2160);assert.equal(state.sky.material.uniforms.uNight.value,0);
});
test("initial light matches the existing scene and reduced motion keeps it still",()=>{
  const normal=fixture();normal.update(0);
  assert.ok(Math.abs(normal.state.sun.intensity-3.4)<1e-8);
  assert.equal(normal.state.ambient.intensity,1.35);
  const still=fixture(true);still.update(960);
  assert.equal(still.state.sky.material.uniforms.uDusk.value,0);
  assert.ok(still.state.sunDirection.distanceTo(normal.state.sunDirection)<1e-8);
});

test("moon reflection direction does not overwrite the shared solar direction",()=>{
  const {state}=fixture();
  state.water.material.uniforms.sunDirection.value=state.sunDirection;
  const update=createSunset(state);update(960);
  assert.ok(state.sunDirection.y<0);
  assert.ok(state.water.material.uniforms.sunDirection.value.y>0);
  assert.notEqual(state.water.material.uniforms.sunDirection.value,state.sunDirection);
});

test("the star sphere rotates coherently, loops after 48 minutes and respects reduced motion",()=>{
  const {state,update}=fixture();const direction=new THREE.Vector3(.3,.7,-.5).normalize();
  const at=t=>{update(t);return direction.clone().applyMatrix3(state.sky.material.uniforms.starRotation.value);};
  const start=at(0);assert.ok(start.distanceTo(at(480))>.3);
  assert.ok(start.distanceTo(at(2880))<1e-8);
  const still=fixture(true);still.update(960);
  assert.ok(direction.clone().applyMatrix3(still.state.sky.material.uniforms.starRotation.value).distanceTo(start)<1e-8);
});

// Inspect both sides of every phase boundary and the wrap, not just keyframes.
test("orbital motion stays positive and continuous throughout the cycle", () => {
  const step = .01;
  const angle = t => dayCycleState(t).angle;
  const delta = (a,b) => ((b-a) + Math.PI*2) % (Math.PI*2);
  for (let t=0;t<DAY_CYCLE_DURATION;t+=1) {
    assert.ok(delta(angle(t),angle(t+step))/step > .0003);
  }
  for (const fraction of [0, 1/6, 1/3, 1/2, 7/12, 3/4, 1]) {
    const t = fraction * DAY_CYCLE_DURATION;
    const before = delta(angle(t-step),angle(t))/step;
    const after = delta(angle(t),angle(t+step))/step;
    assert.ok(before > .0003);
    assert.ok(Math.abs(before-after) < 1e-6);
  }
});

test("water sunlight follows daylight while preserving sunset warmth", () => {
  const {state, update} = fixture();
  const glint = state.water.material.uniforms.sunColor.value;
  update(0);
  assert.ok(glint.equals(new THREE.Color(0xffd0a0)));
  update(DAY_CYCLE_DURATION * .75);
  assert.ok(glint.equals(new THREE.Color(0xfff1d7)));
  update(DAY_CYCLE_DURATION);
  assert.ok(glint.equals(new THREE.Color(0xffd0a0)));
});
