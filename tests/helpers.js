import { readFileSync } from "node:fs";
import vm from "node:vm";

export const read = (file) =>
  readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
export const settle = () => new Promise((resolve) => setImmediate(resolve));

// Minimal browser boundaries; tests run the actual application code.
export class Element extends EventTarget {
  attributes = new Map();
  classes = new Set();
  hidden = false;
  innerHTML = "";
  textContent = "";
  inert = false;
  classList = {
    add: (value) => this.classes.add(value),
    remove: (value) => this.classes.delete(value),
    toggle: (value, enabled) =>
      enabled ? this.classes.add(value) : this.classes.delete(value),
    contains: (value) => this.classes.has(value),
  };
  setAttribute(key, value) {
    this.attributes.set(key, value);
  }
  getAttribute(key) {
    return this.attributes.get(key);
  }
  removeAttribute(key) {
    this.attributes.delete(key);
  }
}

export function environment({
  storedMute = null,
  blockedAudio = false,
  storageUnavailable = false,
  reduced = false,
} = {}) {
  const elements = new Map();
  const animations = [];
  const get = (selector) => {
    if (!elements.has(selector)) {
      const element = new Element();
      element.animate = (frames, options) => {
        let finish;
        const animation = {
          frames,
          options,
          finished: new Promise((resolve) => (finish = resolve)),
          cancel() {},
          finish: () => finish(),
        };
        animations.push(animation);
        return animation;
      };
      elements.set(selector, element);
    }
    return elements.get(selector);
  };
  const modal = get("#about");
  modal.open = false;
  modal.showModal = () => {
    modal.open = true;
  };
  modal.close = () => {
    modal.open = false;
  };
  modal.querySelector = () => get(".close");
  const document = new EventTarget();
  document.body = new Element();
  document.body.classList.add("no-webgl");
  document.hidden = false;
  document.documentElement = { scrollHeight: 4000 };
  document.querySelector = (selector) =>
    selector === "dialog[open]" ? (modal.open ? modal : null) : get(selector);
  const inertPanel = new Element();
  inertPanel.inert = true;
  document.querySelectorAll = (selector) =>
    selector === "[inert]" ? [inertPanel] : [];
  const audio = get("#background-track");
  audio.playCount = 0;
  audio.pauseCount = 0;
  audio.blocked = blockedAudio;
  audio.play = async () => {
    audio.playCount++;
    if (audio.blocked) throw new Error("Autoplay blocked");
  };
  audio.pause = () => {
    audio.pauseCount++;
  };
  const storage = new Map(
    storedMute === null ? [] : [["prajwalit-sound-muted", storedMute]],
  );
  const events = new EventTarget();
  const scrolls = [];
  const context = vm.createContext({
    document,
    Event,
    location: { hash: "" },
    localStorage: {
      getItem: (key) => {
        if (storageUnavailable) throw new Error("Unavailable");
        return storage.get(key) ?? null;
      },
      setItem: (key, value) => {
        if (storageUnavailable) throw new Error("Unavailable");
        storage.set(key, value);
      },
    },
    matchMedia: () => ({ matches: reduced }),
    addEventListener: events.addEventListener.bind(events),
    requestAnimationFrame: (callback) => callback(),
    window: { scrollTo: (options) => scrolls.push(options) },
    scrollY: 0,
    innerHeight: 800,
    innerWidth: 1200,
    THREE: {
      WebGLRenderer: class {
        constructor() {
          throw new Error("WebGL unavailable");
        }
      },
    },
    console: { error() {} },
  });
  return {
    context,
    document,
    get,
    audio,
    storage,
    events,
    scrolls,
    inertPanel,
    animations,
    run: (source) => vm.runInContext(source, context),
    load: (file) =>
      vm.runInContext(read(file).replace(/^import .*;\n/gm, ""), context),
  };
}
