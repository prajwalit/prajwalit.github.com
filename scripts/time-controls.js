import { DAY_CYCLE_DURATION } from "./sunset.js?v=4";
export function createSkyClock(paused = false) {
  let time = 0, target = null;
  return {
    get time() { return time; },
    get paused() { return paused; },
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
      if (!paused) { time += dt; if (target !== null) target += dt; }
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
  const slider = document.querySelector('#time-slider');
  const toggle = document.querySelector('#time-pause');
  const status = document.querySelector('#time-status');
  const label = fraction => fraction < .17 ? 'Sunset' : fraction < .49 ? 'Night' : fraction < .62 ? 'Sunrise' : fraction < .89 ? 'Daylight' : 'Golden hour';
  function sync() {
    const fraction = ((clock.time % DAY_CYCLE_DURATION) + DAY_CYCLE_DURATION) % DAY_CYCLE_DURATION / DAY_CYCLE_DURATION;
    slider.value = Math.round(fraction * 1000);
    slider.setAttribute('aria-valuetext', label(fraction));
    status.textContent = label(fraction);
    toggle.textContent = clock.paused ? 'Resume cycle' : 'Pause time';
  }
  trigger.onclick = () => { sync(); panel.showModal(); };
  document.querySelector('#time-close').onclick = () => panel.close();
  slider.oninput = () => {
    const fraction = Number(slider.value) / 1000;
    clock.select(fraction);
    status.textContent = label(fraction);
    slider.setAttribute('aria-valuetext', label(fraction));
    toggle.textContent = 'Resume cycle';
  };
  toggle.onclick = () => { clock.toggle(); toggle.textContent = clock.paused ? 'Resume cycle' : 'Pause time'; };
  panel.addEventListener('close', () => trigger.focus());
  return { close: () => panel.close() };
}
