const SAVE_KEY = "lulu-explore-world-save";
const WIDE_SCREEN_SCALE = 4 / 3;
const WIDE_SCENE_HEIGHT_SCALE = 7 / 9;
export const DEFAULT_SAVE = { version: 4, sceneId: "home-living", x: 640, y: 500 };

export function validateExploreSave(value) {
  if (!value || typeof value.sceneId !== "string" || !Number.isFinite(value.x) || !Number.isFinite(value.y)) return null;
  if (value.x < -200 || value.x > 2000 || value.y < -200 || value.y > 1200) return null;
  if (value.version === 4) return { ...value, version: 4, x: Math.round(value.x), y: Math.round(value.y) };
  if (value.version === 3) return { ...value, version: 4, x: Math.round(value.x), y: Math.max(260, Math.min(640, Math.round(value.y + 90))) };
  if (value.version === 2) return { ...value, version: 4, x: Math.round(value.x), y: Math.max(260, Math.min(640, Math.round(value.y * WIDE_SCENE_HEIGHT_SCALE + 90))) };
  if (value.version === 1) return { ...value, version: 4, x: Math.round(value.x * WIDE_SCREEN_SCALE), y: Math.max(260, Math.min(640, Math.round(value.y * WIDE_SCENE_HEIGHT_SCALE + 90))) };
  return null;
}

export function loadSave(storage = localStorage) {
  try {
    const value = validateExploreSave(JSON.parse(storage.getItem(SAVE_KEY)));
    if (value) return value;
  } catch { /* Invalid saves safely fall back to home. */ }
  return { ...DEFAULT_SAVE };
}

export function savePosition(sceneId, x, y, storage = localStorage) {
  const value = { version: 4, sceneId, x: Math.round(x), y: Math.round(y), updatedAt: Date.now() };
  try { storage.setItem(SAVE_KEY, JSON.stringify(value)); }
  catch { /* The active page can continue even when persistence is unavailable. */ }
  return value;
}

export { SAVE_KEY };
