import './styles.css';
import { courses, lessons, getCourse, getLesson, lessonIds } from './content/index.js';
import { createStore, normalizeState } from './state.js';
import { escapeHTML as e, lessonCount, percent, safeURL, searchLessons } from './utils.js';
import { icon, logo } from './icons.js';

let storage;
try { storage = window.localStorage; } catch { storage = { getItem() { throw Error('Unavailable'); }, setItem() { throw Error('Unavailable'); } }; }
const store = createStore(lessonIds, storage);
const app = document.querySelector('#app');
let cleanupInteractive = () => {};
let routeVersion = 0;
let toastTimer;
let pendingImport = null;
let searchInvoker = null;
let saveFailureNotified = false;
const workshops = [
  { type: 'argument-map', title: 'Как устроен аргумент', category: 'Аргументация', description: 'Убирайте посылки и добавляйте возражения. Посмотрите, что происходит с выводом.', icon: 'logic', color: 'green' },
  { type: 'bayes', title: 'Вероятность без интуитивных ловушек', category: 'Критическое мышление', description: 'Измените частоту события и точность сигнала. Узнайте, почему убедительное число может вводить в заблуждение.', icon: 'logic', color: 'green' },
  { type: 'fallacy', title: 'Найдите ошибку в рассуждении', category: 'Аргументация', description: 'Разберите короткие споры и отличите плохой аргумент от просто неприятного мнения.', icon: 'logic', color: 'green' },
  { type: 'rhetoric', title: 'Соберите убедительную речь', category: 'Риторика', description: 'Сочетайте доверие, доказательства и эмоции. Прочитайте, как меняется обращение.', icon: 'rhetoric', color: 'coral' },
  { type: 'framing', title: 'Одни факты — разные рамки', category: 'Риторика', description: 'Сравните формулировки одного результата. Отделите способ подачи от изменения фактов.', icon: 'rhetoric', color: 'coral' },
  { type: 'justice', title: 'Что значит «справедливо»?', category: 'Справедливость', description: 'Распределите 100 единиц ресурсов и рассмотрите решение с трёх философских позиций.', icon: 'justice', color: 'blue' },
  { type: 'veil', title: 'За завесой неведения', category: 'Справедливость', description: 'Выберите правила, прежде чем узнаете своё положение. Сравните решение до и после.', icon: 'justice', color: 'blue' },
  { type: 'market', title: 'Всё ли можно купить?', category: 'Деньги и мораль', description: 'Меняйте условия сделки и исследуйте аргументы об эффективности, свободе выбора и общественных нормах.', icon: 'markets', color: 'gold' },
];

const progressFor = course => course.lessons.filter(lesson => store.get().completed.includes(lesson.id)).length;
const nextLesson = () => {
  const current = getLesson(store.get().lastLesson);
  return current && !store.get().completed.includes(current.id) ? current : lessons.find(lesson => !store.get().completed.includes(lesson.id)) || lessons[0];
};
const route = () => {
  const hash = location.hash.replace(/^#\/?/, '');
  if (hash === 'main') return ['home'];
  return hash.split('/').filter(Boolean);
};
const progressBar = (done, total, label) => `<div class="progress-track" role="progressbar" aria-label="${e(label)}" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}"><span style="width:${percent(done, total)}%"></span></div>`;
const sourceLink = source => `<a href="${safeURL(source.url)}" target="_blank" rel="noopener noreferrer">${e(source.label)}<span class="sr-only"> (откроется в новой вкладке)</span></a>`;

function toast(message) {
  const element = document.querySelector('#toast');
  element.textContent = message;
  element.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { element.hidden = true; }, 4500);
}
function save(change, announce = false) {
  const ok = store.update(change);
  if (!ok && (announce || !saveFailureNotified)) { toast(store.getError()); saveFailureNotified = true; }
  return ok;
}
function shell(content, active = 'home') {
  const nav = [['home', '', 'Главная', 'home'], ['courses', 'courses', 'Курсы', 'courses'], ['workshop', 'workshop', 'Практика', 'lab'], ['notebook', 'notebook', 'Тетрадь', 'notebook']];
  return `<header class="site-header"><div class="header-inner"><a class="brand" href="#/" aria-label="Мастерская мысли — главная">${logo}<span>Мастерская<span class="brand-second">мысли</span></span></a><nav class="desktop-nav" aria-label="Основная навигация">${nav.map(([id, path, label]) => `<a href="#/${path}" ${active === id ? 'aria-current="page"' : ''}>${label}</a>`).join('')}</nav><button type="button" class="icon-button search-trigger" data-action="search" aria-label="Поиск по урокам">${icon('search')}<span>Поиск</span><kbd>/</kbd></button></div></header>
    <main id="main" tabindex="-1" class="main-content">${content}</main>
    <footer class="site-footer"><a class="brand footer-brand" href="#/">${logo}<span>Мастерская мысли</span></a><p>Учиться. Пробовать. Понимать.</p><a href="#/sources">О программе и источниках</a><a href="https://github.com/popovdk/popovdk.github.io" target="_blank" rel="noopener noreferrer">Код проекта на GitHub</a></footer>
    <nav class="mobile-nav" aria-label="Мобильная навигация">${nav.map(([id, path, label, glyph]) => `<a href="#/${path}" ${active === id ? 'aria-current="page"' : ''}>${icon(glyph)}<span>${label}</span></a>`).join('')}</nav>
    <dialog id="search-dialog" class="search-dialog" aria-labelledby="search-title"><div class="dialog-head"><h2 id="search-title">Найти идею</h2><button type="button" class="icon-button" data-action="close-search" aria-label="Закрыть поиск">${icon('close')}</button></div><label class="search-field">${icon('search')}<input id="search-input" type="search" placeholder="Аргумент, свобода, справедливость…" autocomplete="off" maxlength="150" aria-label="Слова для поиска по урокам" /></label><p id="search-count" class="muted" role="status">Поиск по названиям и текстам всех ${lessons.length} уроков.</p><div id="search-results" class="search-results"></div></dialog>
    <dialog id="confirm-dialog" class="confirm-dialog" aria-labelledby="confirm-title"><h2 id="confirm-title"></h2><p id="confirm-text"></p><div class="button-row"><button type="button" class="button secondary" data-action="cancel-confirm">Отмена</button><button type="button" class="button" id="confirm-button">Подтвердить</button></div></dialog>`;
}

function courseCard(course) {
  const done = progressFor(course);
  return `<a class="course-card color-${course.color}" href="#/course/${course.id}"><div class="card-top"><span class="course-symbol">${icon(course.icon)}</span><span class="small-label">${lessonCount(course.lessons.length)}</span></div><h3>${e(course.shortTitle)}</h3><p>${e(course.subtitle)}</p><div class="card-bottom"><span>${done ? `${done} из ${course.lessons.length} пройдено` : 'Открыть курс'}</span>${icon('chevron')}</div>${progressBar(done, course.lessons.length, `Прогресс курса ${course.shortTitle}`)}</a>`;
}

function homeView() {
  const next = nextLesson();
  const course = getCourse(next.courseId);
  const done = store.get().completed.length;
  return `<section class="home-intro"><div class="section-kicker"><span class="tiny-line"></span>Пространство для самостоятельного обучения</div><div class="intro-heading"><h1>Большие идеи.<br><em>Ясные мысли.</em></h1><p>Учитесь разбирать аргументы, убеждать и задавать сложные вопросы. В своём темпе, на русском, через практику.</p></div></section>
    <section class="dashboard-grid" aria-label="Ваше обучение"><div class="continue-card"><div class="continue-copy"><span class="eyebrow light">${done === lessons.length ? 'Вся программа пройдена' : store.get().lastLesson ? 'Вернуться к размышлению' : 'Первый шаг к ясности'}</span><h2>${done === lessons.length ? 'Вернитесь к любимой идее' : e(next.title)}</h2><p>${e(next.summary)}</p><div class="continue-meta"><span>${icon('book')}${e(course.shortTitle)}</span><span>${icon('clock')}${next.minutes} мин с практикой</span></div><a class="button cream" href="#/lesson/${next.id}">${store.get().lastLesson ? 'Продолжить обучение' : 'Начать первый урок'}</a></div><div class="thought-graphic" aria-hidden="true"><div class="thought-label label-one">Основание</div><div class="thought-label label-two">Основание</div><div class="thought-connection"></div><div class="thought-result">Обоснованный<br><strong>вывод</strong></div><span class="orbit orbit-one"></span><span class="orbit orbit-two"></span></div></div><aside class="progress-card"><div class="card-top"><h2>Ваш маршрут</h2>${icon('spark')}</div><div class="progress-number">${done}<span> / ${lessons.length}</span></div><p>уроков пройдено</p>${progressBar(done, lessons.length, 'Общий прогресс обучения')}<div class="progress-courses">${courses.map(item => `<div><span class="course-dot color-${item.color}"></span><span>${e(item.shortTitle)}</span><strong>${progressFor(item)} / ${item.lessons.length}</strong></div>`).join('')}</div><p class="local-note">Прогресс сохраняется на этом устройстве.</p></aside></section>
    <section class="section"><div class="section-heading"><div><span class="eyebrow">Четыре направления</span><h2>От хорошего вопроса<br class="mobile-only"> к сильному решению</h2></div><a class="text-link" href="#/courses">Вся программа</a></div><div class="course-grid">${courses.map(courseCard).join('')}</div></section>
    <section class="experiment-feature"><div class="experiment-art" aria-hidden="true"><span class="scale-pole"></span><span class="scale-beam"></span><span class="scale-pan left"><i></i><i></i><i></i></span><span class="scale-pan right"><i></i><i></i></span><span class="scale-base"></span></div><div class="experiment-copy"><span class="eyebrow">Идеи оживают в эксперименте</span><h2>А что, если<br>изменить условия?</h2><p>Распределите ресурсы, поменяйте посылку или формулировку. Увидьте, как меняется результат, и разберите почему.</p><a class="button secondary" href="#/workshop/justice">Попробовать эксперимент</a></div><span class="experiment-stamp">8<br><small>интерактивных<br>разборов</small></span></section>
    <section class="learning-method section"><div><span class="eyebrow">Как учиться здесь</span><h2>Понимание начинается<br>с собственного ответа.</h2></div><div class="method-grid"><div>${icon('book')}<h3>Разберитесь в идее</h3><p>Прочитайте объяснение и пример из жизни.</p></div><div>${icon('lab')}<h3>Проверьте на опыте</h3><p>Измените условия в интерактивном разборе.</p></div><div>${icon('notebook')}<h3>Сформулируйте вывод</h3><p>Решите задачу и сохраните свои мысли.</p></div></div></section>
    <p class="attribution-note">Самостоятельная образовательная программа по темам открытых курсов Harvard. <a href="#/sources">Оригиналы, авторство и доступ</a>.</p>`;
}

function coursesView() {
  return `<div class="page-heading"><span class="eyebrow">Учебная программа</span><h1>Четыре способа<br><em>думать глубже.</em></h1><p>Начните с аргументации или выберите интересующую тему. Все уроки доступны сразу. Время указано вместе с заданиями и размышлением.</p></div><div class="course-list">${courses.map((course, i) => `<section class="course-overview color-${course.color}"><div class="overview-heading"><span class="course-symbol large">${icon(course.icon)}</span><div><span class="eyebrow">${lessonCount(course.lessons.length)} · самостоятельный курс</span><h2>${e(course.title)}</h2></div></div><p>${e(course.description)}</p><div class="overview-details"><ul class="outcomes">${course.outcomes.map(item => `<li>${icon('check')}${e(item)}</li>`).join('')}</ul><div class="overview-action">${progressBar(progressFor(course), course.lessons.length, `Прогресс ${course.shortTitle}`)}<p>${progressFor(course)} из ${course.lessons.length} пройдено</p><a class="button ${i === 0 ? '' : 'secondary'}" href="#/course/${course.id}">Открыть программу</a></div></div></section>`).join('')}</div>`;
}

function lessonRow(lesson, index, course) {
  const complete = store.get().completed.includes(lesson.id);
  return `<a class="lesson-row ${complete ? 'is-complete' : ''}" href="#/lesson/${lesson.id}"><span class="lesson-number">${complete ? icon('check') : String(index + 1).padStart(2, '0')}</span><div><h3>${e(lesson.title)}</h3><p>${e(lesson.summary)}</p><div class="lesson-row-meta"><span>${icon('clock')}${lesson.minutes} мин</span><span>${icon('lab')}Эксперимент</span>${complete ? '<span class="completed-label">Пройдено</span>' : ''}</div></div>${icon('chevron', 'row-chevron')}</a>`;
}

function courseView(id) {
  const course = getCourse(id);
  if (!course) return notFound();
  const current = course.lessons.find(item => !store.get().completed.includes(item.id)) || course.lessons[0];
  return `<a class="breadcrumb" href="#/courses">Все курсы</a><section class="course-hero color-${course.color}"><span class="course-symbol large">${icon(course.icon)}</span><div><span class="eyebrow">${lessonCount(course.lessons.length)} · на русском</span><h1>${e(course.title)}</h1><p>${e(course.description)}</p><a class="button" href="#/lesson/${current.id}">${progressFor(course) ? 'Продолжить курс' : 'Начать курс'}</a></div></section><div class="course-content-grid"><section class="lesson-list"><div class="section-heading"><h2>Программа курса</h2><span class="small-label">${progressFor(course)} / ${course.lessons.length}</span></div>${course.lessons.map((lesson, index) => lessonRow(lesson, index, course)).join('')}</section><aside class="course-aside"><h2>Чему вы научитесь</h2><ul class="outcomes">${course.outcomes.map(item => `<li>${icon('check')}${e(item)}</li>`).join('')}</ul><hr><h3>Открытый первоисточник</h3><p>${e(course.sourceTitle)}</p>${sourceLink({url: course.sourceUrl, label: 'Страница исходного курса'})}<p class="small-text">Наши уроки и задания — самостоятельные учебные материалы. Это не официальный перевод и не сертификационная программа Harvard.</p></aside></div>`;
}

function quizHTML(lesson) {
  const quizState = store.get().quiz[lesson.id] || { answers: [], checked: false };
  const checked = quizState.checked;
  const correct = lesson.quiz.filter((q, i) => quizState.answers[i] === q.answer).length;
  return `<div class="section-heading"><h2>Проверьте понимание</h2><span class="small-label">${lesson.quiz.length} вопроса</span></div><p class="muted">Здесь проверяются понятия и логика. В философских дилеммах оценивается понимание позиции, а не ваше согласие с ней.</p><div class="quiz-questions">${lesson.quiz.map((question, i) => `<fieldset class="quiz-question ${checked ? quizState.answers[i] === question.answer ? 'quiz-correct' : 'quiz-review' : ''}"><legend><span>${i + 1}.</span> ${e(question.question)}</legend>${question.options.map((option, j) => `<label class="quiz-option ${checked && j === question.answer ? 'answer-correct' : ''}"><input type="radio" name="quiz-${lesson.id}-${i}" value="${j}" data-quiz="${i}" data-lesson="${lesson.id}" ${quizState.answers[i] === j ? 'checked' : ''} ${checked ? 'disabled' : ''}><span>${e(option)}</span>${checked && j === question.answer ? icon('check') : ''}</label>`).join('')}${checked ? `<div class="quiz-explanation"><strong>${quizState.answers[i] === question.answer ? 'Верно.' : 'Разберёмся.'}</strong> ${e(question.explanation)}</div>` : ''}</fieldset>`).join('')}</div><div id="quiz-result" role="status">${checked ? `<p class="quiz-result"><strong>${correct} из ${lesson.quiz.length}</strong> ${correct === lesson.quiz.length ? '— основные идеи понятны.' : '— прочитайте пояснения и попробуйте ещё раз.'}</p>` : ''}</div><button type="button" class="button ${checked ? 'secondary' : ''}" data-action="${checked ? 'retry-quiz' : 'check-quiz'}" data-lesson="${lesson.id}">${checked ? 'Пройти ещё раз' : 'Проверить ответы'}</button>`;
}

function lessonView(id) {
  const lesson = getLesson(id);
  if (!lesson) return notFound();
  const course = getCourse(lesson.courseId);
  const complete = store.get().completed.includes(id);
  const bookmarked = store.get().bookmarks.includes(id);
  const prev = course.lessons[lesson.index - 1];
  const next = course.lessons[lesson.index + 1];
  const nextCourse = courses[courses.indexOf(course) + 1];
  return `<div class="lesson-topbar"><a class="breadcrumb" href="#/course/${course.id}">${e(course.shortTitle)}</a><span class="small-label">Урок ${lesson.index + 1} из ${course.lessons.length}</span></div><div class="lesson-layout"><aside class="lesson-sidebar"><span class="eyebrow">В этом курсе</span><nav aria-label="Уроки курса">${course.lessons.map((item, index) => `<a href="#/lesson/${item.id}" ${item.id === id ? 'aria-current="page"' : ''}><span>${store.get().completed.includes(item.id) ? icon('check') : String(index + 1).padStart(2, '0')}</span>${e(item.title)}</a>`).join('')}</nav><a class="text-link" href="#/course/${course.id}">Программа курса</a></aside><article class="lesson-article ${store.get().largeText ? 'large-reading' : ''}" data-lesson-id="${id}"><header class="lesson-header"><span class="eyebrow color-text-${course.color}">Понять · исследовать · применить</span><h1>${e(lesson.title)}</h1><p class="lesson-summary">${e(lesson.summary)}</p><div class="lesson-toolbar"><span>${icon('clock')}${lesson.minutes} мин с практикой</span><div><button type="button" class="icon-button" data-action="font-size" aria-pressed="${store.get().largeText}" aria-label="Увеличить текст урока">Aа</button><button type="button" class="icon-button ${bookmarked ? 'active' : ''}" data-action="bookmark" data-lesson="${id}" aria-pressed="${bookmarked}" aria-label="${bookmarked ? 'Убрать урок из закладок' : 'Сохранить урок в закладки'}">${icon('bookmark')}</button><button type="button" class="icon-button" data-action="print" aria-label="Распечатать урок">${icon('print')}</button></div></div></header>
      <nav class="lesson-jumps" aria-label="Разделы урока"><button type="button" data-jump="theory">Материал</button><button type="button" data-jump="experiment">Эксперимент</button><button type="button" data-jump="practice">Практика</button><button type="button" data-jump="notes">Заметки</button></nav>
      <section id="theory" class="reading-section"><div class="learning-goals"><h2>После урока вы сможете</h2><ul>${lesson.objectives.map(item => `<li>${e(item)}</li>`).join('')}</ul></div>${lesson.sections.map(section => `<section class="theory-block"><h2>${e(section.title)}</h2>${section.paragraphs.map(paragraph => `<p>${e(paragraph)}</p>`).join('')}${section.bullets ? `<ul>${section.bullets.map(item => `<li>${e(item)}</li>`).join('')}</ul>` : ''}</section>`).join('')}<aside class="takeaway"><span>${icon('spark')}Главная мысль</span><p>${e(lesson.takeaway)}</p></aside><section class="worked-example"><span class="eyebrow">Разбор на примере</span><h2>${e(lesson.example.title)}</h2><p>${e(lesson.example.text)}</p><div class="example-analysis"><strong>Как это разобрать</strong><p>${e(lesson.example.analysis)}</p></div></section></section>
      <section id="experiment" class="reading-section experiment-section"><div class="section-label">${icon('lab')}Исследуем на практике</div><h2>${e(lesson.interactive.title)}</h2><p>${e(lesson.interactive.prompt)}</p><div id="interactive-mount" class="interactive-mount" aria-live="off"><p class="muted">Загружаем эксперимент…</p></div><div class="reflection"><strong>Вопрос для размышления</strong><p>${e(lesson.interactive.reflection)}</p></div></section>
      <section id="practice" class="reading-section"><div class="section-label">${icon('notebook')}От идеи к своему ответу</div><h2>Попробуйте самостоятельно</h2><p>${e(lesson.exercise.prompt)}</p><details class="learning-details"><summary>Подсказки к заданию</summary><ul>${lesson.exercise.hints.map(item => `<li>${e(item)}</li>`).join('')}</ul></details><details class="learning-details"><summary>Посмотреть пример разбора</summary><p>${e(lesson.exercise.sampleAnswer)}</p><p class="small-text">Это один из обоснованных вариантов. Сначала сформулируйте собственный ответ.</p></details><section id="quiz" class="quiz-section" aria-label="Проверка понимания">${quizHTML(lesson)}</section></section>
      <section id="notes" class="reading-section notes-section"><div class="section-heading"><h2>Ваши мысли</h2><span id="note-status" class="small-label" role="status">${store.getError() ? 'Только на этой странице' : 'Сохраняются автоматически'}</span></div><label for="lesson-note">Ответ на задание, вопрос к себе или пример из жизни</label><textarea id="lesson-note" data-note="${id}" rows="7" maxlength="20000" placeholder="Что я понял? С чем не согласен? Где применю эту идею?">${e(store.get().notes[id] || '')}</textarea><p class="small-text">Заметки остаются в этом браузере. Резервную копию можно скачать в <a href="#/notebook">тетради</a>.</p></section>
      <section class="lesson-sources"><h2>Источники и дальнейшее чтение</h2><ul>${lesson.sources.map(source => `<li>${sourceLink(source)}</li>`).join('')}</ul><p class="small-text">Русский текст и задания созданы для этой программы. Ссылки ведут к исходным курсам и текстам; язык оригинала может быть английским.</p></section>
      <div class="lesson-finish"><button type="button" class="button complete-button ${complete ? 'is-done' : ''}" data-action="complete" data-lesson="${id}" aria-pressed="${complete}">${icon('check')}${complete ? 'Урок пройден' : 'Отметить урок пройденным'}</button><p class="small-text">Отметка отражает ваше прохождение, а не получение сертификата.</p><nav class="lesson-pagination" aria-label="Предыдущий и следующий урок">${prev ? `<a href="#/lesson/${prev.id}"><span>Предыдущий урок</span><strong>${e(prev.title)}</strong></a>` : '<span></span>'}${next ? `<a href="#/lesson/${next.id}"><span>Следующий урок</span><strong>${e(next.title)}</strong></a>` : nextCourse ? `<a href="#/course/${nextCourse.id}"><span>Следующий курс</span><strong>${e(nextCourse.shortTitle)}</strong></a>` : '<a href="#/notebook"><span>Программа завершена</span><strong>Посмотреть свои результаты</strong></a>'}</nav></div>
    </article></div>`;
}

function workshopView(type) {
  if (type) {
    const workshop = workshops.find(item => item.type === type);
    if (!workshop) return notFound();
    const related = lessons.filter(lesson => lesson.interactive.type === type);
    return `<div class="workshop-page"><a class="breadcrumb" href="#/workshop">Все эксперименты</a><div class="page-heading compact"><span class="eyebrow">${e(workshop.category)} · интерактивный разбор</span><h1>${e(workshop.title)}</h1><p>${e(workshop.description)}</p></div><div id="interactive-mount" class="interactive-mount standalone"><p class="muted">Загружаем эксперимент…</p></div><section class="section related-lessons"><div class="section-heading"><h2>Разобраться глубже</h2><span class="small-label">Уроки по теме</span></div>${related.slice(0, 4).map(lesson => lessonRow(lesson, lesson.index, getCourse(lesson.courseId))).join('')}</section></div>`;
  }
  return `<div class="page-heading"><span class="eyebrow">Лаборатория идей</span><h1>Не просто прочитать.<br><em>Проверить самому.</em></h1><p>Восемь интерактивных разборов. Изменяйте условия, сравнивайте результаты и формулируйте свои объяснения.</p></div><div class="workshop-grid">${workshops.map(item => `<a href="#/workshop/${item.type}" class="workshop-card color-${item.color}"><div class="card-top"><span class="course-symbol">${icon(item.icon)}</span><span class="small-label">${e(item.category)}</span></div><h2>${e(item.title)}</h2><p>${e(item.description)}</p><span class="card-bottom">Открыть эксперимент ${icon('chevron')}</span></a>`).join('')}</div><p class="attribution-note">Числовые сценарии — учебные модели. Они показывают логику подхода и не заменяют исследование реальной ситуации.</p>`;
}

function notebookView() {
  const state = store.get();
  const bookmarked = lessons.filter(lesson => state.bookmarks.includes(lesson.id));
  const notes = lessons.filter(lesson => state.notes[lesson.id]?.trim());
  const checked = Object.values(state.quiz).filter(quiz => quiz.checked).length;
  return `<div class="page-heading"><span class="eyebrow">Личная тетрадь</span><h1>Мысли, к которым<br><em>хочется вернуться.</em></h1><p>Заметки, закладки и ваш путь по программе. Всё хранится в этом браузере; перенос на другое устройство — через резервную копию.</p></div>${store.getError() ? `<div class="storage-warning" role="alert">${e(store.getError())}</div>` : ''}<div class="notebook-stats"><div><strong>${state.completed.length}<span> / ${lessons.length}</span></strong><p>уроков пройдено</p></div><div><strong>${checked}</strong><p>тестов разобрано</p></div><div><strong>${notes.length}</strong><p>уроков с заметками</p></div></div><section class="backup-panel"><div><h2>Сохраните свой путь</h2><p>Скачайте JSON-файл с прогрессом и загрузите его на другом устройстве. Очистка данных браузера удаляет локальную копию.</p></div><div class="button-row"><button type="button" class="button" data-action="export">${icon('download')}Скачать прогресс</button><button type="button" class="button secondary" data-action="import">${icon('upload')}Загрузить</button><input type="file" id="import-file" accept="application/json,.json" hidden></div></section><section class="section"><div class="section-heading"><h2>Закладки</h2><span class="small-label">${bookmarked.length}</span></div>${bookmarked.length ? `<div class="lesson-list">${bookmarked.map(lesson => lessonRow(lesson, lesson.index, getCourse(lesson.courseId))).join('')}</div>` : `<div class="empty-state">${icon('bookmark')}<h3>Хорошие идеи стоит сохранять</h3><p>Нажмите на закладку в шапке урока, чтобы быстро вернуться к нему.</p><a class="text-link" href="#/courses">Выбрать урок</a></div>`}</section><section class="section"><div class="section-heading"><h2>Заметки по урокам</h2><button class="text-button" type="button" data-action="export-notes" ${notes.length ? '' : 'disabled'}>Скачать текстом</button></div>${notes.length ? `<div class="notes-grid">${notes.map(lesson => `<article class="note-card color-${getCourse(lesson.courseId).color}"><span class="eyebrow">${e(getCourse(lesson.courseId).shortTitle)}</span><h3><a href="#/lesson/${lesson.id}">${e(lesson.title)}</a></h3><p class="note-preview">${e(state.notes[lesson.id])}</p><a class="text-link" href="#/lesson/${lesson.id}" data-open-notes>Продолжить запись</a></article>`).join('')}</div>` : `<div class="empty-state">${icon('notebook')}<h3>Здесь будут ваши размышления</h3><p>В каждом уроке есть поле для ответов, вопросов и собственных примеров.</p></div>`}</section><details class="reset-details"><summary>Управление данными</summary><p>Сброс удалит прогресс, ответы, закладки и заметки на этом устройстве. Сначала скачайте резервную копию.</p><button type="button" class="text-button danger" data-action="reset">Сбросить прогресс</button></details>`;
}

function sourcesView() {
  return `<div class="page-heading"><span class="eyebrow">Открытые идеи и честное авторство</span><h1>На чём основана<br><em>эта программа.</em></h1><p>«Мастерская мысли» — самостоятельная русскоязычная образовательная программа по четырём направлениям, представленным в открытых курсах Harvard.</p></div><div class="about-grid"><section class="about-card"><h2>Что вы изучаете здесь</h2><p>Авторские объяснения на русском, примеры, упражнения, проверочные вопросы и интерактивные модели. Структура рассчитана на самостоятельное обучение и не повторяет расписание или объём исходных курсов.</p><p>Это не официальный продукт Harvard или edX, не полный перевод лекций и не замена оригинальному курсу. Программа не выдаёт университетские сертификаты.</p></section><section class="about-card"><h2>Как работать с оригиналами</h2><p>Открывайте исходный курс из списка ниже. В бесплатном режиме edX могут быть доступны только отдельные материалы; правила, сроки доступа и состав заданий меняются. Публичность страницы не означает открытой лицензии на всё содержание.</p><p>Материалы на английском можно изучать параллельно с нашими объяснениями. Для курса «Justice» есть открытая коллекция лекций. Доступность русского перевода на сторонних площадках отдельно не гарантируется.</p></section></div><section class="section"><h2>Исходные курсы</h2><div class="source-list">${courses.map(course => `<article class="source-card color-${course.color}"><span class="course-symbol">${icon(course.icon)}</span><div><h3>${e(course.sourceTitle)}</h3><p>Направление в нашей программе: ${e(course.title)}.</p>${sourceLink({label:'Официальная страница курса',url:course.sourceUrl})}${course.id === 'justice' ? `<p>${sourceLink({label:'Открытая коллекция лекций Justice',url:'https://justiceharvard.org/justicecourse/'})}</p>` : ''}</div></article>`).join('')}</div></section><section class="about-card section"><h2>Как устроен интерактив</h2><p>Сначала сформулируйте предположение, затем измените одно условие и посмотрите на результат. В конце объясните, почему он изменился. Интерактивы доступны внутри уроков и в отдельной лаборатории.</p><p>Расчёты вероятностей следуют заданным формулам. В моральных экспериментах числовые параметры условны: разные философские подходы сравниваются, но сайт не определяет единственно правильную этическую позицию. Конструктор речи проверяет видимые структурные признаки, не заменяя оценку человека.</p><a class="button secondary" href="#/workshop">Открыть лабораторию</a></section><section class="about-card section"><h2>Приватность и сохранение</h2><p>У сайта нет регистрации, серверной базы, встроенной рекламы и аналитики. Учебные записи и прогресс сохраняются локально с помощью localStorage. Между устройствами они автоматически не синхронизируются. Экспортируйте данные в тетради, если хотите их перенести.</p><p>Ссылки на источники открывают внешние сайты, у которых собственные правила обработки данных.</p></section>`;
}

function notFound() {
  return `<div class="empty-state page-heading"><span class="eyebrow">Страница не найдена</span><h1>Вернёмся к программе.</h1><p>Такого урока или эксперимента нет. Выберите его в каталоге.</p><a class="button" href="#/courses">Открыть курсы</a></div>`;
}

async function render({ preserveScroll = false } = {}) {
  const version = ++routeVersion;
  cleanupInteractive();
  cleanupInteractive = () => {};
  const [page = 'home', id] = route();
  let content;
  let active = page;
  let interactive;
  let labKey;
  if (page === 'course') { content = courseView(id); active = 'courses'; }
  else if (page === 'lesson') {
    const lesson = getLesson(id);
    if (lesson) {
      if (store.get().lastLesson !== id) save(state => { state.lastLesson = id; });
      interactive = { ...lesson.interactive, embedded: true };
      labKey = id;
    }
    content = lessonView(id); active = 'courses';
  } else if (page === 'courses') content = coursesView();
  else if (page === 'workshop') {
    content = workshopView(id);
    const selected = workshops.find(item => item.type === id);
    if (selected) { interactive = { ...selected, prompt: selected.description, reflection: '' }; labKey = `workshop-${id}`; }
  } else if (page === 'notebook') content = notebookView();
  else if (page === 'sources') content = sourcesView();
  else if (page === 'home') content = homeView();
  else content = notFound();
  app.innerHTML = shell(content, active);
  const heading = document.querySelector('h1')?.innerText || 'Мастерская мысли';
  document.title = `${heading.replace(/\s+/g, ' ').trim()} — Мастерская мысли`;
  document.querySelector('#announcer').textContent = heading;
  if (!preserveScroll) { window.scrollTo({ top: 0, behavior: 'instant' }); document.querySelector('#main').focus({ preventScroll: true }); }
  if (interactive) {
    try {
      const { mountInteractive } = await import('./interactives/index.js');
      if (version !== routeVersion) return;
      const mount = document.querySelector('#interactive-mount');
      cleanupInteractive = mountInteractive(mount, interactive, { savedState: store.get().labs[labKey] || {}, onSave: value => save(state => { state.labs[labKey] = value; }) }) || (() => {});
    } catch (error) {
      console.error('Interactive loading failed', error);
      if (version === routeVersion) document.querySelector('#interactive-mount').innerHTML = '<p role="alert">Не удалось загрузить эксперимент. Проверьте соединение и обновите страницу. Текст и задания урока доступны выше и ниже.</p>';
    }
  }
}

function download(filename, data, type) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement('a');
  link.href = url; link.download = filename;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

app.addEventListener('click', event => {
  if (event.target.closest('.search-result')) {
    document.querySelector('#search-dialog')?.close();
    document.querySelector('#main')?.focus({ preventScroll: true });
  }
  const jump = event.target.closest('[data-jump]');
  if (jump) {
    const section = document.getElementById(jump.dataset.jump);
    section?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    section?.setAttribute('tabindex', '-1'); section?.focus({ preventScroll: true }); return;
  }
  if (event.target.closest('[data-open-notes]')) {
    try { sessionStorage.setItem('thinking-school.jump', 'notes'); } catch { /* Notes remain reachable by the section button. */ }
  }
  const action = event.target.closest('[data-action]');
  if (!action) return;
  const id = action.dataset.lesson;
  switch (action.dataset.action) {
    case 'search': searchInvoker = action; document.querySelector('#search-dialog').showModal(); document.querySelector('#search-input').focus(); break;
    case 'close-search': document.querySelector('#search-dialog').close(); searchInvoker?.focus(); break;
    case 'font-size': save(state => { state.largeText = !state.largeText; }); document.querySelector('.lesson-article').classList.toggle('large-reading', store.get().largeText); action.setAttribute('aria-pressed', String(store.get().largeText)); break;
    case 'bookmark': {
      const ok = save(state => { state.bookmarks = state.bookmarks.includes(id) ? state.bookmarks.filter(x => x !== id) : [...state.bookmarks, id]; }, true);
      const selected = store.get().bookmarks.includes(id);
      action.classList.toggle('active', selected); action.setAttribute('aria-pressed', String(selected)); action.setAttribute('aria-label', selected ? 'Убрать урок из закладок' : 'Сохранить урок в закладки');
      if (ok) toast(selected ? 'Урок добавлен в закладки' : 'Закладка удалена'); break;
    }
    case 'complete': {
      const ok = save(state => { state.completed = state.completed.includes(id) ? state.completed.filter(x => x !== id) : [...state.completed, id]; }, true);
      const complete = store.get().completed.includes(id);
      action.classList.toggle('is-done', complete); action.setAttribute('aria-pressed', String(complete)); action.innerHTML = `${icon('check')}${complete ? 'Урок пройден' : 'Отметить урок пройденным'}`;
      const navNumber = document.querySelector(`.lesson-sidebar a[href="#/lesson/${id}"] span`);
      if (navNumber) navNumber.innerHTML = complete ? icon('check') : String(getLesson(id).index + 1).padStart(2, '0');
      if (ok) toast(complete ? 'Прогресс обновлён. Можно переходить к следующему уроку.' : 'Отметка о прохождении снята'); break;
    }
    case 'check-quiz': {
      const lesson = getLesson(id); const answers = store.get().quiz[id]?.answers || [];
      if (lesson.quiz.some((_, i) => !Number.isInteger(answers[i]))) { document.querySelector('#quiz-result').innerHTML = '<p class="form-message">Ответьте на все вопросы, затем нажмите «Проверить ответы».</p>'; return; }
      save(state => { state.quiz[id].checked = true; }, true);
      document.querySelector('#quiz').innerHTML = quizHTML(lesson);
      const result = document.querySelector('#quiz-result'); result.tabIndex = -1; result.focus({preventScroll:true}); result.scrollIntoView({ block: 'center', behavior: 'instant' }); break;
    }
    case 'retry-quiz': save(state => { state.quiz[id] = { answers: [], checked: false }; }); document.querySelector('#quiz').innerHTML = quizHTML(getLesson(id)); document.querySelector('#quiz input')?.focus({preventScroll:true}); break;
    case 'print': window.print(); break;
    case 'export': download('thinking-school-progress.json', JSON.stringify(store.get(), null, 2), 'application/json'); toast('Резервная копия подготовлена для скачивания'); break;
    case 'import': document.querySelector('#import-file').click(); break;
    case 'export-notes': {
      const text = lessons.filter(lesson => store.get().notes[lesson.id]?.trim()).map(lesson => `${getCourse(lesson.courseId).title}\n${lesson.title}\n${'—'.repeat(30)}\n${store.get().notes[lesson.id]}`).join('\n\n\n');
      download('thinking-school-notes.txt', `МОИ ЗАМЕТКИ · МАСТЕРСКАЯ МЫСЛИ\n\n${text}`, 'text/plain;charset=utf-8'); break;
    }
    case 'reset': openConfirm('Сбросить прогресс на этом устройстве?', 'Заметки, ответы и отметки будут удалены. Если вы ещё не скачали резервную копию, нажмите «Отмена» и сохраните её.', 'confirm-reset', 'Сбросить данные'); break;
    case 'cancel-confirm': pendingImport = null; document.querySelector('#confirm-dialog').close(); break;
    case 'confirm-reset': { const ok = store.reset(); render(); toast(ok ? 'Локальный прогресс сброшен' : store.getError()); break; }
    case 'confirm-import': {
      if (!pendingImport) break;
      const ok = store.replace(pendingImport); pendingImport = null; render(); toast(ok ? 'Прогресс из резервной копии восстановлен' : store.getError()); break;
    }
  }
});

function openConfirm(title, text, action, label) {
  document.querySelector('#confirm-title').textContent = title;
  document.querySelector('#confirm-text').textContent = text;
  const button = document.querySelector('#confirm-button'); button.dataset.action = action; button.textContent = label;
  document.querySelector('#confirm-dialog').showModal();
}

app.addEventListener('input', event => {
  const target = event.target;
  if (target.dataset.note) {
    const ok = save(state => { state.notes[target.dataset.note] = target.value.slice(0, 20000); });
    document.querySelector('#note-status').textContent = ok ? 'Сохранено на устройстве' : 'Только на этой странице';
  }
  if (target.id === 'search-input') {
    const query = target.value.trim();
    const found = searchLessons(lessons, courses, query);
    document.querySelector('#search-count').textContent = query ? found.length ? `Найдено: ${lessonCount(found.length)}` : 'Ничего не найдено. Попробуйте другое слово.' : `Поиск по названиям и текстам всех ${lessons.length} уроков.`;
    document.querySelector('#search-results').innerHTML = found.map(lesson => `<a href="#/lesson/${lesson.id}" class="search-result"><span class="small-label">${e(getCourse(lesson.courseId).shortTitle)}</span><strong>${e(lesson.title)}</strong><p>${e(lesson.summary)}</p></a>`).join('');
  }
});

app.addEventListener('change', async event => {
  const target = event.target;
  if (target.dataset.quiz !== undefined) {
    save(state => { const record = state.quiz[target.dataset.lesson] ||= { answers: [], checked: false }; record.answers[Number(target.dataset.quiz)] = Number(target.value); record.checked = false; });
  }
  if (target.id === 'import-file' && target.files[0]) {
    try {
      if (target.files[0].size > 2000000) throw new Error('Файл больше 2 МБ. Выберите резервную копию прогресса из этого сайта.');
      pendingImport = normalizeState(JSON.parse(await target.files[0].text()), lessonIds);
      openConfirm('Восстановить прогресс из файла?', `В копии: ${pendingImport.completed.length} пройденных уроков, ${Object.keys(pendingImport.notes).length} заметок. Текущие записи будут заменены. Сначала скачайте их, если хотите сохранить отдельно.`, 'confirm-import', 'Восстановить');
    } catch (error) { pendingImport = null; toast(error instanceof SyntaxError ? 'Не удалось прочитать JSON. Выберите файл резервной копии.' : error.message); }
    target.value = '';
  }
});

document.addEventListener('keydown', event => {
  if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.target.closest('input,textarea,select,[contenteditable]')) {
    event.preventDefault(); document.querySelector('[data-action="search"]').click();
  }
});
document.querySelector('.skip-link').addEventListener('click', event => { event.preventDefault(); document.querySelector('#main').focus(); });
window.addEventListener('hashchange', async () => {
  await render();
  try { if (sessionStorage.getItem('thinking-school.jump') === 'notes') { sessionStorage.removeItem('thinking-school.jump'); document.querySelector('#notes')?.scrollIntoView({block:'start'}); } } catch { /* Storage is optional. */ }
});
window.addEventListener('storage', event => {
  if (event.key === 'thinking-school.v1') toast('Прогресс изменился в другой вкладке. Обновите страницу, чтобы увидеть изменения.');
});
render();
if (store.getError()) { toast(store.getError()); saveFailureNotified = true; }
