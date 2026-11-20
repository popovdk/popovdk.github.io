import { logicCourse } from './logic.js';
import { rhetoricCourse } from './rhetoric.js';
import { justiceCourse } from './justice.js';
import { marketsCourse } from './markets.js';

export const courses = [logicCourse, rhetoricCourse, justiceCourse, marketsCourse];
export const lessons = courses.flatMap(course => course.lessons.map((lesson, index) => ({ ...lesson, courseId: course.id, index })));
export const getCourse = id => courses.find(course => course.id === id);
export const getLesson = id => lessons.find(lesson => lesson.id === id);
export const lessonIds = new Set(lessons.map(lesson => lesson.id));
