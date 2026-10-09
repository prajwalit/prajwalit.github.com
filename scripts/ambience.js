// Four original, gentle soundscapes synthesized locally with Web Audio.
const button = document.querySelector('#sound-toggle');
const styleButton = document.querySelector('#sound-style');
const soundtrack = document.querySelector('#background-track');
const styles = [
  { name: 'Silent Trail', file: true },
  { name: 'Soft pads', wave: 'sine', attack: 3.2, release: 15, volume: .055, filter: 2400, bell: true, spacing: 10 },
  { name: 'Felt piano', wave: 'triangle', attack: .045, release: 7, volume: .035, filter: 1500, bell: true, spacing: 8 },
  { name: 'Lo-fi soft beat', wave: 'triangle', attack: .65, release: 11, volume: .038, filter: 850, bell: false, spacing: 9, bpm: 72 },
  { name: 'Lo-fi brushed beat', wave: 'triangle', attack: .9, release: 12, volume: .032, filter: 720, bell: false, spacing: 10, bpm: 66 },
  { name: 'Low tide', wave: 'sine', attack: 5, release: 20, volume: .048, filter: 1300, bell: false, spacing: 14 },
];
let selected = 0;
let context, master, trackGain, trackSource, enabled = false, nextChord = 0, nextBeat = 0, beatCount = 0, step = 0, suspendTimer, pauseTimer;
const chords = [
  [50, 57, 61, 64, 69], // D major 9
  [47, 54, 57, 62, 66], // B minor 7
  [43, 55, 59, 62, 69], // G major 9
  [45, 57, 59, 64, 69], // A suspended 2
];
const frequency = midi => 440 * 2 ** ((midi - 69) / 12);
function note(midi, time, duration, level, pan = 0, bright = false) {
  const voice = styles[selected];
  const oscillator = context.createOscillator();
  const envelope = context.createGain();
  const filter = context.createBiquadFilter();
  const panner = context.createStereoPanner();
  oscillator.type = voice.wave;
  oscillator.frequency.value = frequency(midi);
  // A tiny drift softens the lo-fi preset without changing pitch noticeably.
  oscillator.detune.value = voice.bpm ? (step % 2 ? 2.5 : -2.5) : 0;
  filter.type = 'lowpass';
  filter.frequency.value = bright ? Math.min(voice.filter * 1.8, 4200) : voice.filter;
  filter.Q.value = .55;
  panner.pan.value = pan;
  envelope.gain.setValueAtTime(0, time);
  envelope.gain.linearRampToValueAtTime(level, time + (bright ? .09 : voice.attack));
  envelope.gain.exponentialRampToValueAtTime(.00001, time + duration);
  envelope.gain.linearRampToValueAtTime(0, time + duration + .1);
  oscillator.connect(filter).connect(envelope).connect(panner).connect(master);
  oscillator.start(time);
  oscillator.stop(time + duration + .2);
  oscillator.onended = () => { oscillator.disconnect(); filter.disconnect(); envelope.disconnect(); panner.disconnect(); };
}
function schedule() {
  if (!context || context.state !== 'running' || !enabled || document.hidden || styles[selected].file) return;
  nextChord = Math.max(nextChord, context.currentTime + .05);
  while (nextChord < context.currentTime + 1) {
    const voice = styles[selected];
    const chord = chords[step % chords.length];
    const stagger = voice.name === 'Felt piano' ? .16 : 0;
    chord.forEach((midi, i) => note(midi, nextChord + i * stagger, voice.release, voice.volume, (i - 2) * .18));
    if (voice.bell) {
      note(chord[3] + 12, nextChord + (voice.name === 'Felt piano' ? 1.5 : 2), 6, voice.volume * .85, -.3, true);
      note(chord[4] + 12, nextChord + (voice.name === 'Felt piano' ? 4.5 : 6), 7, voice.volume * .72, .3, true);
    } else if (voice.bpm) {
      note(chord[2] + 12, nextChord + 3.5, 5, voice.volume * .45, .25, true);
    }
    nextChord += voice.spacing;
    step++;
  }
  // A quiet 4/4 kick and snare with very soft eighth-note brushed hats.
  while (styles[selected].bpm && nextBeat < context.currentTime + 1) {
    const voice = styles[selected];
    const beat = 60 / voice.bpm;
    const t = nextBeat;
    const slot = beatCount % 4;
    if (slot === 0 || slot === 2) kick(t, selected === 3 ? .12 : .09);
    else snare(t, selected === 3 ? .045 : .035);
    hat(t, selected === 3 ? .012 : .009);
    hat(t + beat / 2, selected === 3 ? .008 : .006);
    nextBeat += beat;
    beatCount++;
  }
}
function kick(time, volume) {
  const osc = context.createOscillator(), gain = context.createGain();
  osc.type = 'sine'; osc.frequency.setValueAtTime(92, time);
  osc.frequency.exponentialRampToValueAtTime(48, time + .16);
  gain.gain.setValueAtTime(volume, time); gain.gain.exponentialRampToValueAtTime(.001, time + .24);
  osc.connect(gain).connect(master); osc.start(time); osc.stop(time + .25);
  osc.onended = () => { osc.disconnect(); gain.disconnect(); };
}
function noiseHit(time, duration, volume, cutoff) {
  const length = Math.max(1, Math.floor(context.sampleRate * duration));
  const buffer = context.createBuffer(1, length, context.sampleRate), data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  const source = context.createBufferSource(), filter = context.createBiquadFilter(), gain = context.createGain();
  source.buffer = buffer; filter.type = 'lowpass'; filter.frequency.value = cutoff;
  gain.gain.setValueAtTime(volume, time); gain.gain.exponentialRampToValueAtTime(.001, time + duration);
  source.connect(filter).connect(gain).connect(master); source.start(time);
  source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
}
function snare(time, volume) {
  noiseHit(time, .15, volume, 1800);
  const osc = context.createOscillator(), gain = context.createGain();
  osc.type = 'sine'; osc.frequency.value = 185; gain.gain.setValueAtTime(volume * .35, time);
  gain.gain.exponentialRampToValueAtTime(.001, time + .12);
  osc.connect(gain).connect(master); osc.start(time); osc.stop(time + .13);
  osc.onended = () => { osc.disconnect(); gain.disconnect(); };
}
function hat(time, volume) { noiseHit(time, .055, volume, 3800); }
function updateControls() {
  button.setAttribute('aria-pressed', String(enabled));
  button.setAttribute('aria-label', enabled ? 'Turn background music off' : 'Turn background music on');
  button.innerHTML = `♫ <span>Sound ${enabled ? 'on' : 'off'}</span>`;
  styleButton.innerHTML = `♪ <span>${styles[selected].name}</span>`;
  styleButton.setAttribute('aria-label', `Sound style: ${styles[selected].name}. Click to try another.`);
}
async function syncPlayback() {
  clearTimeout(suspendTimer);
  clearTimeout(pauseTimer);
  if (!context) return;
  if (enabled && !document.hidden) {
    await context.resume();
    if (!enabled || document.hidden) return;
    if (styles[selected].file) {
      master.gain.setTargetAtTime(0, context.currentTime, .2);
      trackGain.gain.setTargetAtTime(.8, context.currentTime, .8);
      await soundtrack.play();
    } else {
      soundtrack.pause();
      trackGain.gain.setTargetAtTime(0, context.currentTime, .15);
      master.gain.setTargetAtTime(.28, context.currentTime, .8);
      schedule();
    }
  } else {
    master.gain.setTargetAtTime(0, context.currentTime, .12);
    trackGain.gain.setTargetAtTime(0, context.currentTime, .12);
    pauseTimer = setTimeout(() => soundtrack.pause(), 500);
    suspendTimer = setTimeout(() => {
      if (!enabled || document.hidden) context.suspend();
    }, 700);
  }
}
styleButton.addEventListener('click', () => {
  selected = (selected + 1) % styles.length;
  updateControls();
  if (enabled) syncPlayback().catch(error => console.warn('Could not switch sound:', error));
});
button.addEventListener('click', async () => {
  enabled = !enabled;
  updateControls();
  try {
    if (enabled && !context) {
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0;
      trackGain = context.createGain();
      trackGain.gain.value = 0;
      trackSource = context.createMediaElementSource(soundtrack);
      trackSource.connect(trackGain).connect(context.destination);
      nextBeat = context.currentTime + .05;
      master.connect(context.destination);
      setInterval(schedule, 400);
    }
    await syncPlayback();
  } catch (error) {
    enabled = false;
    updateControls();
    button.title = 'Audio could not start. Click to try again.';
    console.warn('Background audio could not start:', error);
  }
});
document.addEventListener('visibilitychange', () => { if (context) syncPlayback().catch(() => {}); });
updateControls();
