const SAVE_KEY = "lulu-explore-world-save";
const WIDE_SCREEN_SCALE = 4 / 3;
const WIDE_SCENE_HEIGHT_SCALE = 7 / 9;
export const DEFAULT_SAVE = { version: 3, sceneId: "home-living", x: 640, y: 389 };

export function loadSave(storage = localStorage) {
  try {
    const value = JSON.parse(storage.getItem(SAVE_KEY));
    if (value?.version === 3 && typeof value.sceneId === "string" && Number.isFinite(value.x) && Number.isFinite(value.y)) return value;
    if (value?.version === 2 && typeof value.sceneId === "string" && Number.isFinite(value.x) && Number.isFinite(value.y)) {
      return { ...value, version: 3, y: Math.round(value.y * WIDE_SCENE_HEIGHT_SCALE) };
    }
    if (value?.version === 1 && typeof value.sceneId === "string" && Number.isFinite(value.x) && Number.isFinite(value.y)) {
      return { ...value, version: 3, x: Math.round(value.x * WIDE_SCREEN_SCALE), y: Math.round(value.y * WIDE_SCENE_HEIGHT_SCALE) };
    }
  } catch { /* Invalid saves safely fall back to home. */ }
  return { ...DEFAULT_SAVE };
}

export function savePosition(sceneId, x, y, storage = localStorage) {
  const value = { version: 3, sceneId, x: Math.round(x), y: Math.round(y), updatedAt: Date.now() };
  storage.setItem(SAVE_KEY, JSON.stringify(value));
  return value;
}

export { SAVE_KEY };
