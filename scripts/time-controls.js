import { DAY_CYCLE_DURATION, dayCycleState } from "./sunset.js?v=5";
// Put sunset at the top, midnight right, sunrise bottom, and noon left.
// Using the solar angle keeps all four markers aligned with the actual sky.
const turn = Math.PI * 2;
const wrap = value => ((value % 1) + 1) % 1;
export function cycleToDial(fraction) {
  return wrap((dayCycleState(fraction * DAY_CYCLE_DURATION).angle - Math.PI / 2) / turn);
}
export function dialToCycle(fraction) {
  let angle = wrap(fraction) * turn + Math.PI / 2;
  const start = dayCycleState(0).angle;
  if (angle >= start + turn) angle -= turn;
  let low = 0, high = 1;
  for (let i = 0; i < 32; i++) {
    const middle = (low + high) / 2;
    if (dayCycleState(middle * DAY_CYCLE_DURATION).angle < angle) low = middle;
    else high = middle;
  }
  return (low + high) / 2;
}
export function createSkyClock(paused = false) {
  let time = 0, target = null, speed = 1;
  return {
    get time() { return time; },
    get paused() { return paused; },
    get speed() { return speed; },
    setSpeed(value) { if ([1, 2, 4, 8].includes(value)) speed = value; },
    toggle() { paused = !paused; },
    select(fraction) {
      const desired = Math.max(0, Math.min(1, fraction)) * DAY_CYCLE_DURATION;
      const current = ((time % DAY_CYCLE_DURATION) + DAY_CYCLE_DURATION) % DAY_CYCLE_DURATION;
      let difference = desired - current;
      if (difference > DAY_CYCLE_DURATION / 2) difference -= DAY_CYCLE_DURATION;
      if (difference < -DAY_CYCLE_DURATION / 2) difference += DAY_CYCLE_DURATION;
      target = time + difference;
      paused = true;
    },
    tick(dt) {
      if (!paused) { time += dt * speed; if (target !== null) target += dt * speed; }
      if (target !== null) {
        time += (target - time) * (1 - Math.exp(-dt * 6));
        if (Math.abs(target - time) < 0.01) { time = target; target = null; }
      }
      return time;
    },
  };
}
export function createTimeControls(clock) {
  const panel = document.querySelector('#time-panel');
  const trigger = document.querySelector('#time-open');
  const dial = document.querySelector('#time-dial');
  const handle = document.querySelector('#time-handle');
  let selected = 0, pointer = null;
  const toggle = document.querySelector('#time-pause');
  const status = document.querySelector('#time-status');
  const speeds = panel.querySelectorAll('[data-time-speed]');
  const syncSpeed = () => speeds.forEach(button =>
    button.setAttribute('aria-pressed', String(Number(button.dataset.timeSpeed) === clock.speed)));
  speeds.forEach(button => {
    button.onclick = () => { clock.setSpeed(Number(button.dataset.timeSpeed)); syncSpeed(); };
  });
  const label = fraction => fraction < .17 ? 'Sunset' : fraction < .49 ? 'Night' : fraction < .62 ? 'Sunrise' : fraction < .89 ? 'Daylight' : 'Golden hour';
  function syncToggle() {
    const name = clock.paused ? 'Resume cycle' : 'Pause time';
    toggle.setAttribute('aria-label', name);
    toggle.title = name;
    toggle.classList.toggle('is-paused', clock.paused);
  }
  function display(fraction) {
    selected = fraction;
    const angle = cycleToDial(fraction) * turn;
    handle.setAttribute('cx', 110 + 74 * Math.sin(angle));
    handle.setAttribute('cy', 110 - 74 * Math.cos(angle));
    dial.setAttribute('aria-valuenow', Math.round(fraction * 1000));
    dial.setAttribute('aria-valuetext', label(fraction));
    status.textContent = label(fraction);
  }
  function sync() {
    syncSpeed(); syncToggle();
    display(((clock.time % DAY_CYCLE_DURATION) + DAY_CYCLE_DURATION) % DAY_CYCLE_DURATION / DAY_CYCLE_DURATION);
  }
  function select(fraction) {
    const wrapped = ((fraction % 1) + 1) % 1;
    clock.select(wrapped); display(wrapped); syncToggle();
  }
  function fromPointer(event) {
    const bounds = dial.getBoundingClientRect();
    const x = event.clientX - bounds.left - bounds.width / 2;
    const y = event.clientY - bounds.top - bounds.height / 2;
    if (Math.hypot(x, y) < bounds.width * .18) return;
    select(dialToCycle(Math.atan2(x, -y) / turn));
  }
  dial.addEventListener('pointerdown', event => {
    if (event.button !== 0 || pointer !== null) return;
    pointer = event.pointerId;
    dial.focus(); dial.setPointerCapture(pointer); fromPointer(event);
  });
  dial.addEventListener('pointermove', event => { if (pointer === event.pointerId) fromPointer(event); });
  const release = event => { if (pointer === event.pointerId) pointer = null; };
  dial.addEventListener('pointerup', release);
  dial.addEventListener('pointercancel', release);
  dial.addEventListener('lostpointercapture', release);
  dial.addEventListener('keydown', event => {
    const steps = {ArrowRight:.005, ArrowUp:.005, ArrowLeft:-.005, ArrowDown:-.005, PageUp:.05, PageDown:-.05};
    if (event.key in steps) { event.preventDefault(); select(selected + steps[event.key]); }
    else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault(); select(event.key === 'Home' ? 0 : .999);
    }
  });
  trigger.onclick = () => { sync(); panel.showModal(); };
  document.querySelector('#time-close').onclick = () => panel.close();
  toggle.onclick = () => { clock.toggle(); syncToggle(); };
  // Require both ends of the gesture outside, so dragging the slider beyond
  // the panel does not dismiss it. Backdrop events target the dialog itself.
  const outside = event => {
    const bounds = panel.getBoundingClientRect();
    return event.target === panel && (event.clientX < bounds.left ||
      event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom);
  };
  let pressedOutside = false;
  panel.addEventListener('pointerdown', event => { pressedOutside = outside(event); });
  panel.addEventListener('pointercancel', () => { pressedOutside = false; });
  panel.addEventListener('click', event => {
    if (pressedOutside && outside(event)) panel.close();
    pressedOutside = false;
  });
  panel.addEventListener('close', () => { pressedOutside = false; trigger.focus(); });
  return { close: () => panel.close(), update: () => {
    if (panel.open && !clock.paused && pointer === null) sync();
  } };
}
