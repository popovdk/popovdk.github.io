import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore, emptyState, normalizeState, STORAGE_KEY } from '../src/state.js';
import { escapeHTML, searchLessons, lessonCount } from '../src/utils.js';

const validIds = new Set(['logic-01', 'justice-01']);
const memoryStorage = () => { const map = new Map(); return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value) }; };

test('Progress, notes, quiz answers and lab controls survive a reload', () => {
  const storage = memoryStorage();
  const first = createStore(validIds, storage);
  assert.equal(first.update(state => {
    state.completed = ['logic-01'];
    state.notes['logic-01'] = 'Собственный аргумент: тезис и основание.';
    state.bookmarks = ['justice-01'];
    state.quiz['logic-01'] = { answers: [0, 1, 2], checked: true };
    state.labs['logic-01'] = { evidence: false, bridge: true };
    state.lastLesson = 'justice-01';
  }), true);
  const restored = createStore(validIds, storage);
  assert.deepEqual(restored.get(), first.get());
  assert.equal(restored.getError(), null);
});

test('Imported data cannot introduce unknown lesson IDs or prototype keys', () => {
  const input = JSON.parse('{"version":1,"completed":["logic-01","logic-01","untrusted"],"bookmarks":["justice-01"],"notes":{"logic-01":"<script>alert(1)</script>","__proto__":{"polluted":true}},"labs":{"__proto__":{"polluted":true},"logic-01":{"constructor":{"polluted":true}},"workshop-veil":{"role":1}},"quiz":{"logic-01":{"answers":[0,null,-1,"0",99],"checked":true}}}');
  const result = normalizeState(input, validIds);
  assert.deepEqual(result.completed, ['logic-01']);
  assert.equal(result.notes['logic-01'], '<script>alert(1)</script>');
  assert.equal(Object.hasOwn(result.notes, '__proto__'), false);
  assert.equal({}.polluted, undefined);
  assert.deepEqual(result.labs, { 'workshop-veil': { role: 1 } });
  assert.deepEqual(result.quiz['logic-01'].answers, [0, null, null, null, null]);
});

test('Invalid import leaves existing progress intact and reset is explicit', () => {
  const storage = memoryStorage();
  const store = createStore(validIds, storage);
  store.update(state => state.completed.push('logic-01'));
  assert.throws(() => store.replace({ version: 9 }), /версии 1/);
  assert.deepEqual(store.get().completed, ['logic-01']);
  assert.throws(() => normalizeState([], validIds));
  store.reset();
  assert.deepEqual(store.get().completed, []);
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).version, 1);
});

test('Unavailable or full browser storage keeps the session usable without claiming persistence', () => {
  const denied = createStore(validIds, { getItem() { throw Error('Denied'); }, setItem() { throw Error('Denied'); } });
  assert.match(denied.getError(), /Не удалось/);
  assert.equal(denied.update(state => state.notes['logic-01'] = 'Не потерять'), false);
  assert.equal(denied.get().notes['logic-01'], 'Не потерять');
  const full = createStore(validIds, { getItem: () => null, setItem() { throw Error('Quota'); } });
  assert.equal(full.update(state => state.completed.push('logic-01')), false);
  assert.match(full.getError(), /резервную копию/);
});

test('Search understands Russian ё/е, multiple words and text inside a lesson', () => {
  const courses = [{id:'logic',title:'Критическое мышление'}];
  const lessons = [{ id:'logic-01',courseId:'logic',title:'Учёт оснований',summary:'Проверим довод',sections:[{title:'Посылки',paragraphs:['Любое обобщение требует проверки альтернатив.']}]}];
  assert.equal(searchLessons(lessons, courses, 'учет').length, 1);
  assert.equal(searchLessons(lessons, courses, 'обобщение альтернатив').length, 1);
  assert.equal(searchLessons(lessons, courses, 'обобщение канта').length, 0);
  assert.equal(searchLessons(lessons, courses, ' ').length, 0);
  assert.equal(lessonCount(21), '21 урок');
  assert.equal(lessonCount(12), '12 уроков');
});

test('Saved user text is HTML-escaped before rendering', () => {
  assert.equal(escapeHTML('<img src=x onerror="alert(1)"> &'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp;');
  assert.deepEqual(emptyState().notes, {});
});
