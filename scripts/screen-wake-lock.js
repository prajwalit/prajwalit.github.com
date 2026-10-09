// Best-effort: unsupported browsers and battery-saving policies must never
// interfere with the journey. Only retry after a playback/visibility change.
export function createScreenWakeLock(browser, page) {
  let active = false;
  let wanted = false;
  let generation = 0;
  let pending = false;
  let lock = null;

  async function release(sentinel) {
    try {
      await sentinel?.release();
    } catch {
      /* Already revoked by the OS. */
    }
  }

  async function acquire() {
    if (!wanted || pending || lock || !browser.wakeLock?.request) return;
    pending = true;
    const requestGeneration = generation;
    try {
      const sentinel = await browser.wakeLock.request("screen");
      if (!wanted || requestGeneration !== generation) {
        await release(sentinel);
      } else if (!sentinel.released) {
        lock = sentinel;
        sentinel.addEventListener(
          "release",
          () => {
            if (lock === sentinel) lock = null;
          },
          { once: true },
        );
      }
    } catch {
      /* Unsupported, denied, or power saving: continue normally. */
    } finally {
      pending = false;
      if (requestGeneration !== generation) void acquire();
    }
  }

  function sync() {
    const next = active && !page.hidden;
    if (next === wanted) return;
    wanted = next;
    generation++;
    if (!wanted) {
      const previous = lock;
      lock = null;
      void release(previous);
    } else void acquire();
  }

  page.addEventListener("visibilitychange", sync);
  return {
    setActive(value) {
      active = Boolean(value);
      sync();
    },
  };
}
