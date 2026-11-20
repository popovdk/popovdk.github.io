import test from 'node:test';
import assert from 'node:assert/strict';
import { courses, lessons, lessonIds } from '../src/content/index.js';

const knownInteractives = new Set(['argument-map', 'bayes', 'fallacy', 'rhetoric', 'framing', 'justice', 'veil', 'market']);

test('The complete curriculum has 36 distinct lessons in four coherent courses', () => {
  assert.deepEqual(courses.map(course => [course.id, course.lessons.length]), [['logic',8],['rhetoric',8],['justice',12],['markets',8]]);
  assert.equal(lessons.length, 36);
  assert.equal(lessonIds.size, 36);
  assert.equal(lessons.reduce((n, lesson) => n + lesson.quiz.length, 0), 108);
});

test('Every lesson includes teaching, a worked example, an exercise, feedback and sources', () => {
  for (const lesson of lessons) {
    assert.ok(lesson.title && lesson.summary, lesson.id);
    assert.ok(lesson.sections.length >= 3, `${lesson.id}: needs explanation`);
    assert.ok(lesson.objectives.length >= 2, `${lesson.id}: needs objectives`);
    assert.ok(lesson.sections.every(section => section.paragraphs.length > 0), lesson.id);
    assert.ok(lesson.example.text && lesson.example.analysis && lesson.exercise.prompt && lesson.exercise.sampleAnswer, lesson.id);
    assert.ok(lesson.exercise.hints.length > 0 && lesson.takeaway, lesson.id);
    assert.ok(lesson.minutes >= 15 && lesson.minutes <= 90, lesson.id);
    assert.ok(lesson.sources.length >= 1, lesson.id);
    for (const source of lesson.sources) { assert.equal(new URL(source.url).protocol, 'https:'); assert.ok(source.label); }
    assert.ok(knownInteractives.has(lesson.interactive.type), `${lesson.id}: unrecognized widget`);
    assert.ok(lesson.interactive.title && lesson.interactive.prompt && lesson.interactive.reflection, lesson.id);
    const words = lesson.sections.flatMap(section => [...section.paragraphs, ...(section.bullets || [])]).join(' ').split(/\s+/).length;
    assert.ok(words >= 220, `${lesson.id}: only ${words} words of explanation`);
  }
});

test('Quiz answers are well-defined and explanations support independent learning', () => {
  for (const lesson of lessons) for (const question of lesson.quiz) {
    assert.ok(question.question.length > 10, lesson.id);
    assert.ok(question.options.length >= 3 && question.options.length <= 5, lesson.id);
    assert.equal(new Set(question.options).size, question.options.length, lesson.id);
    assert.ok(Number.isInteger(question.answer) && question.answer >= 0 && question.answer < question.options.length, lesson.id);
    assert.ok(question.explanation.length > 35, `${lesson.id}: explanation is too short`);
  }
});
