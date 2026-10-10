import * as THREE from "../assets/vendor/three.module.js";

export function wallpaperSize(format, requestedEdge, deviceLimit = 4096) {
  const edge = Math.max(16, Math.floor(Math.min(requestedEdge, deviceLimit)));
  const short = Math.round((edge * 9) / 16);
  return format === "phone" ? [short, edge] : [edge, short];
}

// Render directly into the drawing buffer and copy immediately. This keeps
// preserveDrawingBuffer off during normal browsing and exports only WebGL art.
export function renderWallpaper(renderer, scene, view, width, height, canvas) {
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image export is unavailable on this device.");
  const size = renderer.getSize(new THREE.Vector2());
  const ratio = renderer.getPixelRatio();
  try {
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    renderer.render(scene, view);
    const gl = renderer.getContext();
    if (
      gl.isContextLost() ||
      gl.drawingBufferWidth !== width ||
      gl.drawingBufferHeight !== height
    )
      throw new Error("This image is too large for the device.");
    context.drawImage(renderer.domElement, 0, 0, width, height);
    return canvas;
  } finally {
    renderer.setSize(size.x, size.y, false);
    renderer.setPixelRatio(ratio);
  }
}

export function createWallpaper({ renderer, scene, camera, available }) {
  const dialog = document.querySelector("#wallpaper-dialog");
  const preview = document.querySelector("#wallpaper-preview");
  const status = document.querySelector("#wallpaper-status");
  const resolution = document.querySelector("#wallpaper-resolution");
  const create = document.querySelector("#wallpaper-create");
  const download = document.querySelector("#wallpaper-download");
  const share = document.querySelector("#wallpaper-share");
  const close = document.querySelector("#wallpaper-close");
  const trigger = document.querySelector("#wallpaper-open");
  const formats = [...dialog.querySelectorAll("[data-wallpaper-format]")];
  const gl = renderer.getContext();
  const viewportLimit = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
  const deviceLimit = Math.min(
    renderer.capabilities.maxTextureSize,
    ...viewportLimit,
    4096,
  );
  let format = "desktop",
    photoCamera,
    drag = null,
    pendingFrame = null;
  let file = null,
    url = null,
    busy = false,
    revision = 0;
  const rotation = new THREE.Euler(0, 0, 0, "YXZ");

  function discard() {
    revision++;
    if (url) URL.revokeObjectURL(url);
    url = file = null;
    download.hidden = share.hidden = true;
    download.removeAttribute("href");
    create.hidden = false;
  }
  function dimensions() {
    return wallpaperSize(format, Number(resolution.value), deviceLimit);
  }
  function showDimensions() {
    const [w, h] = dimensions();
    status.textContent = `${w} × ${h} · PNG · No text or controls`;
  }
  function renderPreview() {
    pendingFrame = null;
    if (!dialog.open || !photoCamera) return;
    try {
      const [w, h] = wallpaperSize(format, 960, deviceLimit);
      photoCamera.aspect = w / h;
      photoCamera.updateProjectionMatrix();
      renderWallpaper(renderer, scene, photoCamera, w, h, preview);
      // Restore the visible scene before the browser paints this frame.
      renderer.render(scene, camera);
      create.disabled = false;
    } catch {
      create.disabled = true;
      status.textContent =
        "The preview could not be created. Close this window and try again.";
    }
  }
  function schedulePreview() {
    if (pendingFrame === null)
      pendingFrame = requestAnimationFrame(renderPreview);
  }
  function choose(next) {
    if (busy) return;
    format = next;
    discard();
    for (const button of formats)
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.wallpaperFormat === format),
      );
    showDimensions();
    schedulePreview();
  }
  for (const button of formats)
    button.onclick = () => choose(button.dataset.wallpaperFormat);
  resolution.onchange = () => {
    discard();
    showDimensions();
  };
  trigger.onclick = () => {
    if (!available()) return;
    photoCamera = camera.clone();
    rotation.setFromQuaternion(camera.quaternion, "YXZ");
    resolution.value =
      matchMedia("(pointer: coarse)").matches || navigator.deviceMemory <= 4
        ? "1920"
        : "3840";
    dialog.showModal();
    choose(innerHeight > innerWidth ? "phone" : "desktop");
  };
  close.onclick = () => dialog.close();
  dialog.addEventListener("close", () => {
    discard();
    drag = null;
    if (pendingFrame !== null) cancelAnimationFrame(pendingFrame);
    pendingFrame = null;
    trigger.focus({ preventScroll: true });
  });
  preview.addEventListener("pointerdown", (event) => {
    if (busy || drag || (event.pointerType === "mouse" && event.button !== 0))
      return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    preview.setPointerCapture(event.pointerId);
  });
  preview.addEventListener("pointermove", (event) => {
    if (busy || !drag || event.pointerId !== drag.id) return;
    const scale =
      0.003 * Math.min(2, 600 / preview.getBoundingClientRect().width);
    rotation.y -= (event.clientX - drag.x) * scale;
    rotation.x = THREE.MathUtils.clamp(
      rotation.x - (event.clientY - drag.y) * scale,
      -1.35,
      1.35,
    );
    photoCamera.quaternion.setFromEuler(rotation);
    drag.x = event.clientX;
    drag.y = event.clientY;
    discard();
    showDimensions();
    schedulePreview();
  });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
    preview.addEventListener(type, (event) => {
      if (drag?.id === event.pointerId) drag = null;
    });
  preview.addEventListener("keydown", (event) => {
    if (
      busy ||
      !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)
    )
      return;
    event.preventDefault();
    rotation.y +=
      event.code === "ArrowLeft"
        ? 0.04
        : event.code === "ArrowRight"
          ? -0.04
          : 0;
    rotation.x = THREE.MathUtils.clamp(
      rotation.x +
        (event.code === "ArrowUp"
          ? 0.04
          : event.code === "ArrowDown"
            ? -0.04
            : 0),
      -1.35,
      1.35,
    );
    photoCamera.quaternion.setFromEuler(rotation);
    discard();
    showDimensions();
    schedulePreview();
  });
  function setBusy(value) {
    busy = value;
    if (value) drag = null;
    trigger.disabled = value;
    create.disabled = value;
    resolution.disabled = value;
    for (const button of formats) button.disabled = value;
    create.textContent = value ? "Creating image…" : "Create wallpaper";
  }
  async function encode(width, height) {
    const canvas = document.createElement("canvas");
    const view = photoCamera.clone();
    view.aspect = width / height;
    view.updateProjectionMatrix();
    try {
      renderWallpaper(renderer, scene, view, width, height, canvas);
      renderer.render(scene, camera);
      return await new Promise((resolve, reject) =>
        canvas.toBlob(
          (blob) =>
            blob ? resolve(blob) : reject(new Error("Unable to encode image.")),
          "image/png",
        ),
      );
    } finally {
      canvas.width = canvas.height = 1;
    }
  }
  create.onclick = async () => {
    if (busy || !photoCamera) return;
    discard();
    const request = revision;
    setBusy(true);
    status.textContent = "Preparing your wallpaper…";
    try {
      let [w, h] = dimensions(),
        blob;
      try {
        blob = await encode(w, h);
      } catch (error) {
        if (Number(resolution.value) <= 1920 || gl.isContextLost()) throw error;
        [w, h] = wallpaperSize(format, 1920, deviceLimit);
        blob = await encode(w, h);
      }
      if (request !== revision || !dialog.open) return;
      file = new File([blob], `prajwalit-${format}-${w}x${h}.png`, {
        type: "image/png",
      });
      url = URL.createObjectURL(file);
      download.href = url;
      download.download = file.name;
      download.hidden = false;
      create.hidden = true;
      try {
        share.hidden = !(
          navigator.share && navigator.canShare?.({ files: [file] })
        );
      } catch {
        share.hidden = true;
      }
      status.textContent = `Ready · ${w} × ${h} PNG. Save it, then set it as your wallpaper.`;
    } catch {
      if (dialog.open && request === revision)
        status.textContent =
          "Could not create this image. Try Standard resolution or another view.";
    } finally {
      setBusy(false);
    }
  };
  share.onclick = async () => {
    if (!file) return;
    try {
      await navigator.share({ files: [file], title: "A view of my own" });
    } catch (error) {
      if (error.name !== "AbortError")
        status.textContent =
          "Sharing is unavailable. Use Download wallpaper instead.";
    }
  };
  return {
    close() {
      if (dialog.open) dialog.close();
    },
  };
}
