export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
export const plural = (n, one, few, many) => n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? few : many;
export const lessonCount = n => `${n} ${plural(n, 'урок', 'урока', 'уроков')}`;
export const safeURL = url => { try { const u = new URL(url); return u.protocol === 'https:' ? escapeHTML(u.href) : '#'; } catch { return '#'; } };
export const percent = (a, b) => b ? Math.round(a / b * 100) : 0;
export const normalizeQuery = text => String(text).toLocaleLowerCase('ru').replaceAll('ё', 'е').trim();
export function searchLessons(lessons, courses, query) {
  const terms = normalizeQuery(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return lessons.filter(lesson => {
    const course = courses.find(item => item.id === lesson.courseId);
    const haystack = normalizeQuery([lesson.title, lesson.summary, course?.title, ...lesson.sections.flatMap(section => [section.title, ...section.paragraphs, ...(section.bullets || [])])].join(' '));
    return terms.every(term => haystack.includes(term));
  });
}
