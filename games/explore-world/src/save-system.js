const SAVE_KEY = "lulu-explore-world-save";
export const DEFAULT_SAVE = { version: 1, sceneId: "home-living", x: 480, y: 500 };

export function loadSave(storage = localStorage) {
  try {
    const value = JSON.parse(storage.getItem(SAVE_KEY));
    if (value?.version === 1 && typeof value.sceneId === "string" && Number.isFinite(value.x) && Number.isFinite(value.y)) return value;
  } catch { /* Invalid saves safely fall back to home. */ }
  return { ...DEFAULT_SAVE };
}

export function savePosition(sceneId, x, y, storage = localStorage) {
  const value = { version: 1, sceneId, x: Math.round(x), y: Math.round(y), updatedAt: Date.now() };
  storage.setItem(SAVE_KEY, JSON.stringify(value));
  return value;
}

export { SAVE_KEY };
