const button = document.querySelector("#sound-toggle");
const soundtrack = document.querySelector("#background-track");
const auroraTrack = document.querySelector("#aurora-track");
const FULL = 0.8;
// Whichever piece is currently the background. Everything below acts on this
// rather than on the soundtrack, so the aurora's music inherits the controls.
let current = soundtrack;
const preferenceKey = "prajwalit-sound-muted";
let muted = false;
let started = false;

try {
  muted = localStorage.getItem(preferenceKey) === "true";
} catch {
  // Sound still works when browser storage is unavailable; the choice is per visit.
}
soundtrack.volume = FULL;
soundtrack.muted = muted;
soundtrack.loop = true;
auroraTrack.volume = 0;
auroraTrack.muted = muted;

function updateButton(needsGesture = false) {
  const label = muted
    ? "Unmute background music"
    : needsGesture
      ? "Start background music"
      : "Mute background music";
  button.setAttribute("aria-pressed", String(started && !muted));
  button.setAttribute("aria-label", label);
  button.innerHTML = muted
    ? "♫ <span>Sound off</span>"
    : needsGesture || !started
      ? "♫ <span>Tap for sound</span>"
      : "♫ <span>Sound on</span>";
  if (needsGesture)
    button.title = "Your browser needs a click before it can play sound.";
  else button.removeAttribute("title");
}

function savePreference() {
  try {
    localStorage.setItem(preferenceKey, String(muted));
  } catch {
    /* optional persistence */
  }
}

async function startPlayback() {
  try {
    await current.play();
    started = true;
    updateButton();
  } catch {
    // Autoplay can be blocked. The footer control retries inside a user gesture.
    updateButton(true);
  }
}

button.addEventListener("click", async () => {
  if (!started) {
    muted = false;
    soundtrack.muted = auroraTrack.muted = false;
    savePreference();
    await startPlayback();
    return;
  }
  muted = !muted;
  soundtrack.muted = auroraTrack.muted = muted;
  savePreference();
  updateButton();
});

// The start button provides a direct user gesture, so use it to start the
// soundtrack before the automatic scroll begins. Preserve a saved mute choice.
document.addEventListener("journey:start", () => {
  if (muted) return;
  soundtrack.muted = auroraTrack.muted = false;
  startPlayback();
});

// Counted in frames rather than wall-clock, so the fade needs no timer and
// finishes deterministically under test.
function crossfade(to, frames = 150) {
  if (to === current) return;
  const from = current;
  current = to;
  to.muted = muted;
  to.volume = 0;
  // Play even when muted, as the soundtrack does: a muted element is still
  // running, which is what makes unmuting mid-piece instant rather than silent.
  if (started) to.play().catch(() => {});
  const level = from.volume;
  let frame = 0;
  const step = () => {
    frame += 1;
    const t = Math.min(1, frame / frames);
    from.volume = level * (1 - t);
    to.volume = FULL * t;
    if (t < 1) {
      requestAnimationFrame(step);
      return;
    }
    from.pause();
    // The aurora piece plays once through, so rewind it for the next night.
    if (from === auroraTrack) from.currentTime = 0;
  };
  requestAnimationFrame(step);
}
// The aurora brings its own music, and hands the soundtrack back afterwards.
document.addEventListener("aurora:start", () => crossfade(auroraTrack));
document.addEventListener("aurora:end", () => crossfade(soundtrack));

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    soundtrack.pause();
    auroraTrack.pause();
  } else if (started) startPlayback();
});

// Until play() succeeds, don't claim the music is audible. Most browsers
// require a click before they allow a page to start sound.
updateButton(!muted);
startPlayback();
