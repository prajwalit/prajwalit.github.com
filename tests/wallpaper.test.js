import test from "node:test";
import assert from "node:assert/strict";
import { wallpaperSize, renderWallpaper } from "../scripts/wallpaper.js";

test("wallpapers keep their aspect ratio within the device limit", () => {
  assert.deepEqual(wallpaperSize("desktop", 3840), [3840, 2160]);
  assert.deepEqual(wallpaperSize("phone", 1920), [1080, 1920]);
  assert.deepEqual(wallpaperSize("phone", 3840, 2048), [1152, 2048]);
});

function fixture(fail = false) {
  const copies = [];
  const gl = { drawingBufferWidth: 0, drawingBufferHeight: 0, isContextLost: () => false };
  const renderer = {
    width: 1280, height: 800, ratio: 1.6, domElement: {},
    getSize: (v) => v.set(renderer.width, renderer.height),
    getPixelRatio: () => renderer.ratio,
    setPixelRatio: (r) => { renderer.ratio = r; },
    setSize: (w, h) => { renderer.width = w; renderer.height = h; gl.drawingBufferWidth = w; gl.drawingBufferHeight = h; },
    getContext: () => gl,
    render: () => { if (fail) throw new Error("render failed"); },
  };
  const canvas = { getContext: () => ({ drawImage: (...args) => copies.push(args) }) };
  return { renderer, canvas, copies, gl };
}

test("capture copies only the rendered canvas and restores display resolution", () => {
  const { renderer, canvas, copies } = fixture();
  assert.equal(renderWallpaper(renderer, {}, {}, 3840, 2160, canvas), canvas);
  assert.deepEqual(copies, [[renderer.domElement, 0, 0, 3840, 2160]]);
  assert.equal(canvas.width, 3840);
  assert.equal(canvas.height, 2160);
  assert.deepEqual([renderer.width, renderer.height, renderer.ratio], [1280, 800, 1.6]);
});

test("failed exports restore the live renderer and never copy a partial image", () => {
  for (const lost of [false, true]) {
    const { renderer, canvas, copies, gl } = fixture(!lost);
    gl.isContextLost = () => lost;
    assert.throws(() => renderWallpaper(renderer, {}, {}, 1080, 1920, canvas));
    assert.equal(copies.length, 0);
    assert.deepEqual([renderer.width, renderer.height, renderer.ratio], [1280, 800, 1.6]);
  }
});
