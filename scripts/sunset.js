import * as THREE from "../assets/vendor/three.module.js";

export const DAY_CYCLE_DURATION = 1440;
const keys = [[0,Math.acos(0.24)], [60,1.85], [120,Math.PI],
  [180,4.4], [210,Math.PI*1.5], [270,Math.PI*2], [360,Math.PI*2+Math.acos(0.24)]];
export function dayCycleState(seconds) {
  const t = ((seconds % DAY_CYCLE_DURATION) + DAY_CYCLE_DURATION) % DAY_CYCLE_DURATION / DAY_CYCLE_DURATION * 360;
  let i = 1;
  while(t > keys[i][0]) i++;
  const [a, start] = keys[i-1], [b, end] = keys[i];
  const angle = THREE.MathUtils.lerp(start,end,THREE.MathUtils.smootherstep(t,a,b));
  const elevation = Math.cos(angle);
  return { angle, elevation,
    night: 1-THREE.MathUtils.smoothstep(elevation,-0.2,0.02),
    day: THREE.MathUtils.smoothstep(elevation,0.26,0.65),
    dusk: 1-THREE.MathUtils.smoothstep(elevation,-0.16,0.24) };
}
export function createSunset({sun,ambient,sunDirection,sky,water,fog,reduced}) {
  const rotationAxis = new THREE.Vector3(0.1, 0.87, 0.49).normalize();
  const rotationMatrix = new THREE.Matrix4();
  const color = hex => new THREE.Color(hex);
  const warm=color(0xffc397), noon=color(0xfff1d7), moon=color(0xa7b8e3);
  const ambWarm=color(0xbacff1), ambDay=color(0xc2ddff), ambNight=color(0x8197c5);
  const groundDay=color(0x203c49), groundNight=color(0x182739);
  const fogWarm=color(0xc49aa2), fogDay=color(0x9cbac9), fogNight=color(0x303e5e);
  const waterDay=color(0x165a62), waterNight=color(0x101e36);
  const glintDay=color(0xffd0a0), glintNight=color(0x657ea8);
  const moonDirection=sky.material.uniforms.moonDirection.value;
  // Water keeps the supplied vector by reference; give its active light a
  // separate vector so moon reflections cannot overwrite the solar orbit.
  water.material.uniforms.sunDirection.value = sunDirection.clone();
  return seconds => {
    const time = reduced ? 0 : seconds;
    const state=dayCycleState(time);
    const {angle,night,day,dusk}=state;
    sunDirection.set(0.158*Math.sin(angle),Math.cos(angle),-0.9874*Math.sin(angle)).normalize();
    moonDirection.copy(sunDirection).negate();
    // Reuse the existing shadowed key light for the sun and moon. The switch
    // happens at near-zero intensity while both sources cross the horizon.
    const moonlit=state.elevation<0;
    sun.position.copy(moonlit?moonDirection:sunDirection).multiplyScalar(10000);
    sun.color.copy(warm).lerp(noon,day).lerp(moon,night);
    sun.intensity=moonlit ? 0.65*night : 3.4*THREE.MathUtils.smoothstep(state.elevation,0,0.24);
    ambient.color.copy(ambWarm).lerp(ambDay,day).lerp(ambNight,night);
    ambient.groundColor.copy(groundDay).lerp(groundNight,night);
    ambient.intensity=THREE.MathUtils.lerp(1.35,0.9,night);
    fog.color.copy(fogWarm).lerp(fogDay,day).lerp(fogNight,night);
    const u=sky.material.uniforms;
    // One coherent celestial sphere; horizon, atmosphere and moon stay separate.
    rotationMatrix.makeRotationAxis(rotationAxis, (time / DAY_CYCLE_DURATION - 100 / 360) * Math.PI * 2);
    u.starRotation.value.setFromMatrix4(rotationMatrix);
    u.uDusk.value=dusk;u.uNight.value=night;u.uDay.value=day;
    water.material.uniforms.sunDirection.value.copy(moonlit?moonDirection:sunDirection);
    water.material.uniforms.sunColor.value.copy(glintDay).lerp(glintNight,night)
      .multiplyScalar(moonlit?0.45*night:THREE.MathUtils.smoothstep(state.elevation,0,0.15));
    water.material.uniforms.waterColor.value.copy(waterDay).lerp(waterNight,night);
  };
}
