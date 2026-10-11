// One deterministic hash behind every procedural placement, so the same seed
// yields the same landscape detail in every module and on every reload.
export function seededRandom(n) {
  const value = Math.sin(n * 127.1 + 19.7) * 43758.5453;
  return value - Math.floor(value);
}
