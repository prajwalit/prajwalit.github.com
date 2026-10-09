const button = document.querySelector('#sound-toggle');
const soundtrack = document.querySelector('#background-track');
const preferenceKey = 'prajwalit-sound-muted';
let muted = false;
let started = false;

try {
  muted = localStorage.getItem(preferenceKey) === 'true';
} catch {
  // Sound still works when browser storage is unavailable; the choice is per visit.
}
soundtrack.volume = 0.8;
soundtrack.muted = muted;
soundtrack.loop = true;

function updateButton(needsGesture = false) {
  const label = muted ? 'Unmute background music' : needsGesture ? 'Start background music' : 'Mute background music';
  button.setAttribute('aria-pressed', String(started && !muted));
  button.setAttribute('aria-label', label);
  button.innerHTML = muted
    ? '♫ <span>Sound off</span>'
    : needsGesture || !started
      ? '♫ <span>Tap for sound</span>'
      : '♫ <span>Sound on</span>';
  if (needsGesture) button.title = 'Your browser needs a click before it can play sound.';
  else button.removeAttribute('title');
}

function savePreference() {
  try { localStorage.setItem(preferenceKey, String(muted)); } catch { /* optional persistence */ }
}

async function startPlayback() {
  try {
    await soundtrack.play();
    started = true;
    updateButton();
  } catch {
    // Autoplay can be blocked. The footer control retries inside a user gesture.
    updateButton(true);
  }
}

button.addEventListener('click', async () => {
  if (!started) {
    muted = false;
    soundtrack.muted = false;
    savePreference();
    await startPlayback();
    return;
  }
  muted = !muted;
  soundtrack.muted = muted;
  savePreference();
  updateButton();
});

// The start button provides a direct user gesture, so use it to start the
// soundtrack before the automatic scroll begins. Preserve a saved mute choice.
document.addEventListener('journey:start', () => {
  if (muted) return;
  soundtrack.muted = false;
  startPlayback();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) soundtrack.pause();
  else if (started) startPlayback();
});

// Until play() succeeds, don't claim the music is audible. Most browsers
// require a click before they allow a page to start sound.
updateButton(!muted);
startPlayback();
