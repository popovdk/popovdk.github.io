export const STORAGE_KEY = 'thinking-school.v1';
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
export const emptyState = () => ({ version: 1, completed: [], bookmarks: [], notes: {}, quiz: {}, labs: {}, lastLesson: null, largeText: false, updatedAt: null });

export function normalizeState(raw, validIds) {
  if (!isRecord(raw) || raw.version !== 1) throw new Error('Этот файл не является резервной копией «Мастерской мысли» версии 1.');
  const result = emptyState();
  const ids = list => Array.isArray(list) ? [...new Set(list.filter(id => typeof id === 'string' && validIds.has(id)))] : [];
  result.completed = ids(raw.completed);
  result.bookmarks = ids(raw.bookmarks);
  result.lastLesson = validIds.has(raw.lastLesson) ? raw.lastLesson : null;
  result.largeText = raw.largeText === true;
  for (const id of validIds) {
    if (isRecord(raw.notes) && hasOwn(raw.notes, id) && typeof raw.notes[id] === 'string') result.notes[id] = raw.notes[id].slice(0, 20000);
    if (isRecord(raw.quiz) && hasOwn(raw.quiz, id) && isRecord(raw.quiz[id])) {
      const value = raw.quiz[id];
      result.quiz[id] = {
        answers: Array.isArray(value.answers) ? value.answers.slice(0, 20).map(a => Number.isInteger(a) && a >= 0 && a < 10 ? a : null) : [],
        checked: value.checked === true,
      };
    }
  }
  // Widget data is inert JSON. Its own renderer validates controls, never executes it.
  if (isRecord(raw.labs)) {
    for (const [key, value] of Object.entries(raw.labs).slice(0, 100)) {
      if (!/^(logic|rhetoric|justice|markets)-\d{2}$|^workshop-[a-z-]+$/.test(key)) continue;
      if (!isRecord(value)) continue;
      const serialized = JSON.stringify(value);
      if (serialized.length <= 16000 && !serialized.includes('"__proto__"') && !serialized.includes('"constructor"')) result.labs[key] = JSON.parse(serialized);
    }
  }
  result.updatedAt = typeof raw.updatedAt === 'string' ? raw.updatedAt.slice(0, 40) : null;
  return result;
}

export function createStore(validIds, storage) {
  let state = emptyState();
  let error = null;
  let storageReady = true;
  try {
    const saved = storage.getItem(STORAGE_KEY);
    if (saved) state = normalizeState(JSON.parse(saved), validIds);
  } catch {
    error = 'Не удалось прочитать сохранённый прогресс. Пока изменения сохраняются только на этой странице. Можно скачать резервную копию.';
    storageReady = false;
  }
  const persist = () => {
    state.updatedAt = new Date().toISOString();
    if (!storageReady) return false;
    try { storage.setItem(STORAGE_KEY, JSON.stringify(state)); error = null; return true; }
    catch { error = 'Браузер не разрешил сохранить данные. Скачайте резервную копию в разделе «Тетрадь».'; storageReady = false; return false; }
  };
  return {
    get: () => state,
    getError: () => error,
    update(fn) { fn(state); return persist(); },
    replace(value) { state = normalizeState(value, validIds); storageReady = true; return persist(); },
    reset() { state = emptyState(); storageReady = true; return persist(); },
  };
}
