import * as THREE from "../assets/vendor/three.module.js";

const SPEED = 240;
const LIMITS = {
  left: -7800,
  right: 7800,
  near: 4200,
  far: -13500,
  ceiling: 3300,
};

// Check the camera's footprint against the rendered terrain, including shores.
export function explorerFloor(x, z, ground) {
  let floor = 40;
  for (const [dx, dz] of [
    [0, 0],
    [24, 0],
    [-24, 0],
    [0, 24],
    [0, -24],
  ])
    floor = Math.max(floor, ground(x + dx, z + dz) + 30);
  return floor;
}
export function constrainExplorer(position, ground) {
  position.x = THREE.MathUtils.clamp(position.x, LIMITS.left, LIMITS.right);
  position.z = THREE.MathUtils.clamp(position.z, LIMITS.far, LIMITS.near);
  position.y = THREE.MathUtils.clamp(
    position.y,
    explorerFloor(position.x, position.z, ground),
    LIMITS.ceiling,
  );
  return position;
}
export function moveExplorer(
  position,
  velocity,
  input,
  yaw,
  pitch,
  seconds,
  ground,
) {
  const dt = Math.min(Math.max(seconds, 0), 0.05);
  const forward = new THREE.Vector3(
    -Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    -Math.cos(yaw) * Math.cos(pitch),
  );
  const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const desired = forward
    .multiplyScalar(input.forward)
    .addScaledVector(right, input.right);
  desired.y += input.up;
  if (desired.lengthSq() > 1) desired.normalize();
  desired.multiplyScalar(SPEED);
  velocity.lerp(desired, 1 - Math.exp(-dt * 9));
  // Short substeps avoid skipping narrow ridges even after a slow frame.
  const steps = Math.max(1, Math.ceil((velocity.length() * dt) / 8));
  for (let i = 0; i < steps; i++) {
    position.addScaledVector(velocity, dt / steps);
    constrainExplorer(position, ground);
  }
}

export function createExplorer(camera, ground, { reduced, onChange }) {
  const ui = document.querySelector("#explore-ui");
  const surface = document.querySelector("#explore-look");
  const exit = document.querySelector("#explore-exit");
  const stick = document.querySelector("#explore-stick");
  const knob = stick.querySelector("span");
  const keys = new Set();
  const altitude = new Map();
  const eye = new THREE.Vector3(),
    velocity = new THREE.Vector3();
  const rotation = new THREE.Euler(0, 0, 0, "YXZ");
  const orientation = new THREE.Quaternion();
  const returnEye = new THREE.Vector3(),
    returnRotation = new THREE.Quaternion();
  let mode = "off",
    yaw = 0,
    pitch = 0,
    targetYaw = 0,
    targetPitch = 0,
    returnTime = 0;
  let drag = null,
    joystick = null,
    axisX = 0,
    axisY = 0;

  function clearInput() {
    keys.clear();
    altitude.clear();
    drag = null;
    joystick = null;
    axisX = axisY = 0;
    velocity.set(0, 0, 0);
    knob.style.transform = "translate(0, 0)";
  }
  function finish() {
    mode = "off";
    ui.hidden = true;
    document.body.classList.remove("exploring");
    clearInput();
    onChange(false);
    document.querySelector("#explore-toggle").focus({ preventScroll: true });
  }
  function leave(immediate = false) {
    if (mode === "off") return;
    clearInput();
    if (immediate || reduced) {
      finish();
      return;
    }
    returnEye.copy(eye);
    returnRotation.copy(orientation);
    returnTime = 0;
    mode = "return";
    exit.textContent = "Returning to summit…";
    exit.disabled = true;
  }
  exit.onclick = () => leave();
  function enter() {
    if (mode !== "off") return;
    eye.copy(camera.position);
    rotation.setFromQuaternion(camera.quaternion, "YXZ");
    yaw = targetYaw = rotation.y;
    pitch = targetPitch = rotation.x;
    orientation.copy(camera.quaternion);
    clearInput();
    mode = "free";
    ui.hidden = false;
    exit.disabled = false;
    exit.textContent = "Return to summit";
    document.body.classList.add("exploring");
    onChange(true);
    surface.focus({ preventScroll: true });
  }
  surface.addEventListener("pointerdown", (event) => {
    if (
      mode !== "free" ||
      drag ||
      (event.pointerType === "mouse" && event.button !== 0)
    )
      return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    surface.setPointerCapture(event.pointerId);
  });
  surface.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    targetYaw -= (event.clientX - drag.x) * 0.003;
    targetPitch = THREE.MathUtils.clamp(
      targetPitch - (event.clientY - drag.y) * 0.003,
      -1.35,
      1.35,
    );
    drag.x = event.clientX;
    drag.y = event.clientY;
  });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
    surface.addEventListener(type, (event) => {
      if (drag?.id === event.pointerId) drag = null;
    });
  surface.addEventListener(
    "wheel",
    (event) => {
      if (!event.ctrlKey) event.preventDefault();
    },
    { passive: false },
  );
  function steer(event) {
    const rect = stick.getBoundingClientRect();
    let x = (event.clientX - rect.left - rect.width / 2) / 38,
      y = (event.clientY - rect.top - rect.height / 2) / 38;
    const length = Math.hypot(x, y);
    if (length > 1) {
      x /= length;
      y /= length;
    }
    axisX = x;
    axisY = -y;
    knob.style.transform = `translate(${x * 30}px, ${y * 30}px)`;
  }
  stick.addEventListener("pointerdown", (event) => {
    if (mode !== "free" || joystick !== null) return;
    joystick = event.pointerId;
    stick.setPointerCapture(joystick);
    steer(event);
  });
  stick.addEventListener("pointermove", (event) => {
    if (joystick === event.pointerId) steer(event);
  });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
    stick.addEventListener(type, (event) => {
      if (joystick === event.pointerId) {
        joystick = null;
        axisX = axisY = 0;
        knob.style.transform = "translate(0, 0)";
      }
    });
  for (const [id, direction] of [
    ["#explore-up", 1],
    ["#explore-down", -1],
  ]) {
    const button = document.querySelector(id);
    button.addEventListener("pointerdown", (event) => {
      if (mode !== "free") return;
      button.setPointerCapture(event.pointerId);
      altitude.set(event.pointerId, direction);
    });
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
      button.addEventListener(type, (event) =>
        altitude.delete(event.pointerId),
      );
    button.addEventListener("keydown", (event) => {
      if (event.code === "Space" || event.code === "Enter") {
        event.preventDefault();
        keys.add(direction > 0 ? "KeyE" : "KeyQ");
      }
    });
    button.addEventListener("keyup", () => {
      keys.delete(direction > 0 ? "KeyE" : "KeyQ");
    });
    button.addEventListener("blur", () => {
      keys.delete(direction > 0 ? "KeyE" : "KeyQ");
    });
  }
  const movementKeys = new Set([
    "KeyW",
    "KeyA",
    "KeyS",
    "KeyD",
    "KeyQ",
    "KeyE",
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
  ]);
  addEventListener("keydown", (event) => {
    if (
      mode !== "free" ||
      document.querySelector("dialog[open]") ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    )
      return;
    if (event.code === "Escape") {
      event.preventDefault();
      leave();
      return;
    }
    if (movementKeys.has(event.code)) {
      event.preventDefault();
      keys.add(event.code);
    }
  });
  addEventListener("keyup", (event) => keys.delete(event.code));
  addEventListener("blur", clearInput);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clearInput();
  });
  return {
    get active() {
      return mode !== "off";
    },
    get canCapture() { return mode === "free"; },
    enter,
    leave,
    update(seconds) {
      if (mode === "off") return;
      if (document.querySelector("dialog[open]")) clearInput();
      if (mode === "return") {
        returnTime += seconds;
        const t = THREE.MathUtils.smootherstep(returnTime, 0, 1.8);
        eye.lerpVectors(returnEye, camera.position, t);
        eye.y = Math.max(eye.y, explorerFloor(eye.x, eye.z, ground));
        orientation.copy(returnRotation).slerp(camera.quaternion, t);
        camera.position.copy(eye);
        camera.quaternion.copy(orientation);
        if (t === 1) finish();
        return;
      }
      const blend = reduced ? 1 : 1 - Math.exp(-Math.min(seconds, 0.05) * 16);
      yaw = THREE.MathUtils.lerp(yaw, targetYaw, blend);
      pitch = THREE.MathUtils.lerp(pitch, targetPitch, blend);
      const pressed = (...codes) =>
        codes.some((code) => keys.has(code)) ? 1 : 0;
      moveExplorer(
        eye,
        velocity,
        {
          forward:
            axisY + pressed("KeyW", "ArrowUp") - pressed("KeyS", "ArrowDown"),
          right:
            axisX +
            pressed("KeyD", "ArrowRight") -
            pressed("KeyA", "ArrowLeft"),
          up:
            [...altitude.values()].reduce((a, b) => a + b, 0) +
            pressed("KeyE") -
            pressed("KeyQ"),
        },
        yaw,
        pitch,
        seconds,
        ground,
      );
      rotation.set(pitch, yaw, 0, "YXZ");
      orientation.setFromEuler(rotation);
      camera.position.copy(eye);
      camera.quaternion.copy(orientation);
    },
  };
}
