export function createSafeJsonStore(key, storage) {
  let memoryValue = null;
  let persistent = true;

  function read() {
    if (persistent) {
      try {
        const stored = storage.getItem(key);
        memoryValue = stored;
      } catch { persistent = false; }
    }
    if (memoryValue === null) return null;
    try { return JSON.parse(memoryValue); }
    catch { return null; }
  }

  function write(value) {
    memoryValue = JSON.stringify(value);
    if (!persistent) return false;
    try { storage.setItem(key, memoryValue); return true; }
    catch { persistent = false; return false; }
  }

  return { read, write, isPersistent: () => persistent };
}

function randomId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

export function createVersionedGameStore({ key, validate, storage, onConflict = () => {}, onStorageError = showSaveFailure }) {
  const jsonStore = createSafeJsonStore(key, storage);
  // Keep the identity in memory: browsers can clone sessionStorage when a tab is duplicated.
  const writerId = randomId();
  let revision = 0;
  let lastSeenWriterId = "";
  let conflicted = false;

  function parseStored(value) {
    if (!value) return null;
    if (value.envelopeVersion === 1) {
      const payload = validate(value.payload);
      if (!payload) return null;
      return { payload, revision: Number.isInteger(value.revision) ? Math.max(0, value.revision) : 0, writerId: typeof value.writerId === "string" ? value.writerId : "" };
    }
    const payload = validate(value);
    return payload ? { payload, revision: 0, writerId: "" } : null;
  }

  function load() {
    const stored = parseStored(jsonStore.read());
    if (!stored) return null;
    revision = stored.revision;
    lastSeenWriterId = stored.writerId;
    return stored.payload;
  }

  function save(payload) {
    const validPayload = validate(payload);
    if (!validPayload || conflicted) return false;
    const current = parseStored(jsonStore.read());
    const revisionAdvanced = current && current.revision > revision;
    const sameRevisionChangedOwner = current && current.revision === revision && current.writerId
      && current.writerId !== writerId && current.writerId !== lastSeenWriterId;
    if (revisionAdvanced || sameRevisionChangedOwner) {
      conflicted = true;
      onConflict();
      return false;
    }
    revision = Math.max(revision, current?.revision ?? 0) + 1;
    const persisted = jsonStore.write({ envelopeVersion: 1, revision, writerId, payload: validPayload });
    if (persisted) lastSeenWriterId = writerId;
    else onStorageError();
    return persisted;
  }

  return { load, save, hasConflict: () => conflicted, isPersistent: jsonStore.isPersistent };
}

export function showSaveConflict() {
  if (typeof document === "undefined" || document.querySelector(".save-conflict-notice")) return;
  const notice = document.createElement("div");
  notice.className = "save-conflict-notice";
  notice.setAttribute("role", "alert");
  notice.textContent = "这个游戏已在另一个标签页继续，当前标签页不会覆盖最新进度。";
  document.body.append(notice);
}

export function showSaveFailure() {
  if (typeof document === "undefined" || document.querySelector(".save-storage-notice")) return;
  const notice = document.createElement("div");
  notice.className = "save-storage-notice";
  notice.setAttribute("role", "alert");
  notice.textContent = "浏览器无法保存当前进度；请检查存储空间或隐私设置，刷新页面可能会丢失进度。";
  document.body.append(notice);
}
