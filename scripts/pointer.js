// A pointer gesture ends on release, on cancellation, and when capture is lost
// after the pointer leaves the element. Overlays must handle all three or a
// drag outlives the press that started it.
export function onPointerRelease(target, handler) {
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
    target.addEventListener(type, handler);
}

// Dismiss only when a press both starts and ends outside the panel, so
// dragging a control past the edge never closes it. Backdrop events target
// the dialog itself, so compare against its own box.
export function closeOnOutsidePress(dialog) {
  const outside = (event) => {
    const bounds = dialog.getBoundingClientRect();
    return (
      event.target === dialog &&
      (event.clientX < bounds.left ||
        event.clientX > bounds.right ||
        event.clientY < bounds.top ||
        event.clientY > bounds.bottom)
    );
  };
  let pressedOutside = false;
  dialog.addEventListener("pointerdown", (event) => {
    pressedOutside = outside(event);
  });
  dialog.addEventListener("pointercancel", () => {
    pressedOutside = false;
  });
  dialog.addEventListener("click", (event) => {
    if (pressedOutside && outside(event)) dialog.close();
    pressedOutside = false;
  });
  dialog.addEventListener("close", () => {
    pressedOutside = false;
  });
}
