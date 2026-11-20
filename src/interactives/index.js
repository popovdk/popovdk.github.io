import './interactives.css';
import { clampNumber, bayesCounts, normalizeAllocation, rebalanceAllocation, allocationMetrics, maximumUtilityAllocation } from './calculations.js';

const number = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });
const percent = value => `${number.format(value)} %`;
const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const integer = (value, min, max, fallback) => Math.round(clampNumber(value, min, max, fallback));
const textValue = (value, max = 600) => typeof value === 'string' ? value.slice(0, max) : '';
const checked = value => value ? ' checked' : '';
const pressed = value => `aria-pressed="${Boolean(value)}"`;
let sequence = 0;

const widgetNames = {
  'argument-map': 'Соберите аргумент', bayes: 'Учитывайте исходную частоту', fallacy: 'Проверьте ход рассуждения',
  rhetoric: 'Соберите убедительную речь', framing: 'Посмотрите на другую рамку',
  justice: 'Распределите 100 единиц', veil: 'Выберите правила до своей роли', market: 'Проверьте границы рынка',
};

function rangeField(key, label, value, min, max, suffix = '') {
  return `<div class="ix-range-field"><label class="ix-number-label"><span>${escape(label)}</span><span class="ix-number-wrap"><input class="ix-number" type="number" data-number="${escape(key)}" value="${value}" min="${min}" max="${max}" step="1" inputmode="numeric" aria-label="${escape(label)}: число">${suffix ? `<span>${escape(suffix)}</span>` : ''}</span></label><input class="ix-range" type="range" data-range="${escape(key)}" min="${min}" max="${max}" step="1" value="${value}" aria-label="${escape(label)}: ползунок"></div>`;
}

// During typing, leave empty/incomplete/out-of-range drafts untouched. The change
// handler commits a clamped whole-number value after the user leaves the field.
function validNumberDraft(element, min, max) {
  if (element.value.trim() === '') return null;
  const value = Number(element.value);
  return Number.isFinite(value) && value >= min && value <= max ? value : null;
}

/**
 * Mount one explanatory widget. Each instance owns its DOM/listeners and returns a cleanup.
 * savedState is untrusted (for example an imported progress file); each widget sanitizes it.
 */
export function mountInteractive(container, config = {}, { savedState = {}, onSave = () => {} } = {}) {
  if (!(container instanceof Element)) throw new TypeError('Для интерактива нужен DOM-контейнер.');
  const type = Object.hasOwn(widgetNames, config.type) ? config.type : 'argument-map';
  const stateInput = savedState && typeof savedState === 'object' && !Array.isArray(savedState) ? savedState : {};
  const uid = `thinking-interactive-${++sequence}`;
  const controller = new AbortController();
  const embedded = config.embedded === true;
  const title = config.title || widgetNames[type];
  const accessibleLabel = embedded ? `aria-label="${escape(title)}"` : `aria-labelledby="${uid}-title"`;
  const header = embedded ? '' : `<header class="ix-header"><span class="ix-eyebrow">Попробуйте сами</span><h3 id="${uid}-title">${escape(title)}</h3>${config.prompt ? `<p>${escape(config.prompt)}</p>` : ''}</header>`;
  const reflection = embedded ? '' : `<details class="ix-reflection"><summary>Вопрос для размышления</summary><p>${escape(config.reflection || 'Какое допущение влияет на ваш вывод сильнее всего? Что изменилось бы, если бы оно оказалось неверным?')}</p></details>`;
  container.innerHTML = `<section class="interactive" data-interactive-type="${type}" ${accessibleLabel}>${header}<div class="ix-body"></div>${reflection}</section>`;
  const root = container.firstElementChild;
  const body = root.querySelector('.ix-body');
  const save = value => {
    if (typeof onSave === 'function') onSave(JSON.parse(JSON.stringify(value)));
  };
  const listen = (event, selector, callback) => root.addEventListener(event, currentEvent => {
    const target = currentEvent.target.closest?.(selector);
    if (target && root.contains(target)) callback(target, currentEvent);
  }, { signal: controller.signal });
  const context = { body, root, saved: stateInput, save, listen, uid };
  const builders = { 'argument-map': mountArgumentMap, bayes: mountBayes, fallacy: mountFallacy, rhetoric: mountRhetoric, framing: mountFraming, justice: mountJustice, veil: mountVeil, market: mountMarket };
  builders[type](context);
  return () => controller.abort();
}

function mountArgumentMap({ body, saved, save, listen }) {
  const state = { evidence: saved.evidence !== false, constraint: saved.constraint !== false, bridge: saved.bridge === true, objection: saved.objection === true };
  body.innerHTML = `<p class="ix-intro">Гипотеза: предложение становится обоснованнее, когда мы видим основания, скрытый переход и возможное возражение.</p><p class="ix-note">Учебный кейс. Эти условия придуманы: включайте их, чтобы изучить устройство аргумента.</p><div class="ix-argument-controls"><label class="ix-check"><input type="checkbox" data-premise="evidence"${checked(state.evidence)}><span><strong>Результат пилота</strong>В соседнем отделе тихие часы сократили число переключений между задачами.</span></label><label class="ix-check"><input type="checkbox" data-premise="constraint"${checked(state.constraint)}><span><strong>Ограничение риска</strong>Для срочных запросов остаётся отдельный канал; пилот можно остановить.</span></label><label class="ix-check"><input type="checkbox" data-premise="bridge"${checked(state.bridge)}><span><strong>Скрытое допущение</strong>Работа отделов достаточно похожа, а измерение результата пригодно для сравнения.</span></label><label class="ix-check"><input type="checkbox" data-premise="objection"${checked(state.objection)}><span><strong>Возражение</strong>Сейчас сезонная нагрузка: условия отличаются от условий первого пилота.</span></label></div><div class="ix-argument-map" aria-label="Структура аргумента"><div class="ix-map-node ix-map-support" data-map-support></div><div class="ix-map-link"><span>при условии</span></div><div class="ix-map-node ix-map-bridge" data-map-bridge></div><div class="ix-map-link"><span>это поддерживает вывод</span></div><div class="ix-map-node ix-map-conclusion"><span class="ix-small-label">Вывод</span><strong>Стоит проверить тихие часы в нашем отделе на двухнедельном пилоте.</strong></div><div class="ix-map-objection" data-map-objection hidden></div></div><div class="ix-feedback" role="status" aria-live="polite" data-map-feedback></div>`;
  const update = () => {
    const support = [];
    if (state.evidence) support.push('Есть опыт другого отдела.');
    if (state.constraint) support.push('Риск пилота ограничен.');
    body.querySelector('[data-map-support]').textContent = support.length ? support.join(' ') : 'Основания пока не указаны.';
    body.querySelector('[data-map-bridge]').textContent = state.bridge ? 'Сходство отделов и качество измерения приняты как допущения.' : 'Переход к нашему отделу пока остаётся скрытым.';
    const objection = body.querySelector('[data-map-objection]');
    objection.hidden = !state.objection;
    objection.textContent = 'Возражение к переходу: сезонная нагрузка может сделать сравнение ненадёжным.';
    const observations = [];
    if (!state.evidence) observations.push('Ограниченный риск сам по себе не показывает, что идея полезна. Нужна причина ожидать результат.');
    if (!state.constraint) observations.push('Опыт другого отдела говорит о возможной пользе, но не обосновывает допустимость риска в вашем отделе.');
    if (!state.bridge) observations.push('Укажите, почему чужой опыт применим здесь. Без этого в рассуждении есть незаполненный переход.');
    if (state.objection) observations.push('Возражение ослабляет перенос результата. Ответом может стать отдельное сравнение в период похожей нагрузки.');
    if (state.evidence && state.constraint && state.bridge && !state.objection) observations.push('Структура аргумента стала явной. Вывод всё ещё вероятностный: основания поддерживают проверку идеи, а не гарантируют успех.');
    body.querySelector('[data-map-feedback]').innerHTML = `<strong>Что изменилось</strong>${observations.map(item => `<p>${escape(item)}</p>`).join('')}<p class="ix-note">Переключатель не делает посылку истинной. Здесь проверяется структура заданного примера, а не достоверность реальных данных.</p>`;
  };
  listen('change', '[data-premise]', element => { state[element.dataset.premise] = element.checked; update(); save(state); });
  update();
}

function mountBayes({ body, saved, save, listen }) {
  const state = { prevalence: integer(saved.prevalence, 1, 50, 1), sensitivity: integer(saved.sensitivity, 50, 100, 90), falsePositiveRate: integer(saved.falsePositiveRate, 0, 30, 5) };
  const limits = { prevalence: [1, 50], sensitivity: [50, 100], falsePositiveRate: [0, 30] };
  body.innerHTML = `<p class="ix-intro">Фильтр пометил письмо как спам. Насколько вероятно, что это действительно спам? Сначала попробуйте ответить, затем измените исходную частоту.</p><p class="ix-note">Учебная модель на 10 000 писем. Все параметры задаёте вы; это не статистика конкретного почтового сервиса.</p><div class="ix-controls">${rangeField('prevalence', 'Спам среди всех писем', state.prevalence, 1, 50, '%')}${rangeField('sensitivity', 'Обнаружение настоящего спама', state.sensitivity, 50, 100, '%')}${rangeField('falsePositiveRate', 'Ложные тревоги среди обычных писем', state.falsePositiveRate, 0, 30, '%')}</div><div class="ix-bayes-result" aria-live="polite" role="status"><span>Вероятность спама после сигнала</span><strong data-posterior></strong><p data-bayes-explanation></p></div><div class="ix-stacked-bar" aria-hidden="true"><span class="ix-bar-true" data-true-bar></span><span class="ix-bar-false" data-false-bar></span></div><div class="ix-legend"><span><i class="ix-swatch ix-swatch-true"></i>Настоящий спам среди помеченных</span><span><i class="ix-swatch ix-swatch-false"></i>Обычные письма среди помеченных</span></div><div class="ix-table-scroll"><table class="ix-bayes-table"><caption>Что произошло с 10 000 писем</caption><thead><tr><th scope="col">Письма</th><th scope="col">Сигнал</th><th scope="col">Нет сигнала</th></tr></thead><tbody><tr><th scope="row">Спам</th><td data-count="truePositive"></td><td data-count="falseNegative"></td></tr><tr><th scope="row">Обычные</th><td data-count="falsePositive"></td><td data-count="trueNegative"></td></tr></tbody></table></div><details class="ix-details"><summary>Откуда берётся ответ</summary><p>Вероятность = настоящие срабатывания ÷ все срабатывания. При редком спаме даже небольшой процент ошибок на большом числе обычных писем создаёт много ложных сигналов.</p><p data-formula class="ix-formula"></p></details>`;
  const update = (preserveNumberKey = null) => {
    const counts = bayesCounts(state.prevalence, state.sensitivity, state.falsePositiveRate);
    body.querySelector('[data-posterior]').textContent = counts.posterior === null ? 'Нет сигналов' : percent(counts.posterior * 100);
    body.querySelector('[data-bayes-explanation]').textContent = `Из ${number.format(counts.flagged)} помеченных писем спамом будут ${number.format(counts.truePositive)}, а обычными — ${number.format(counts.falsePositive)}.`;
    for (const key of ['truePositive', 'falseNegative', 'falsePositive', 'trueNegative']) body.querySelector(`[data-count="${key}"]`).textContent = number.format(counts[key]);
    body.querySelector('[data-true-bar]').style.width = `${(counts.posterior ?? 0) * 100}%`;
    body.querySelector('[data-false-bar]').style.width = `${counts.flagged ? (1 - counts.posterior) * 100 : 0}%`;
    body.querySelector('[data-formula]').textContent = `${number.format(counts.truePositive)} ÷ (${number.format(counts.truePositive)} + ${number.format(counts.falsePositive)}) = ${counts.posterior === null ? 'не определено' : percent(counts.posterior * 100)}`;
    for (const [key, value] of Object.entries(state)) {
      body.querySelector(`[data-range="${key}"]`).value = value;
      if (key !== preserveNumberKey) body.querySelector(`[data-number="${key}"]`).value = value;
    }
  };
  const handle = element => {
    if (element.value === '') { update(); return; }
    const key = element.dataset.range || element.dataset.number;
    state[key] = integer(element.value, ...limits[key], state[key]); update(); save(state);
  };
  listen('input', '[data-range]', handle);
  listen('input', '[data-number]', element => {
    const key = element.dataset.number;
    const value = validNumberDraft(element, ...limits[key]);
    if (value === null) return;
    state[key] = integer(value, ...limits[key], state[key]);
    update(key); save(state);
  });
  listen('change', '[data-number]', handle);
  update();
}

const fallacyCases = [
  { text: '«Ты предлагаешь выделить полосу для автобусов. Значит, хочешь совсем запретить людям ездить на машинах».', options: ['Подмена тезиса', 'Ложная причина', 'Нет явной ошибки'], answer: 0, explanation: 'Предложение об одной полосе заменено более радикальным утверждением. Опровергать запрет всех машин легче, но исходный тезис остался без ответа.', repair: 'Уточните реальное предложение: какие полосы, в какое время и с какими последствиями для остальных участников?' },
  { text: '«Мы поставили новый логотип, и через неделю выросли продажи. Значит, рост вызвал именно логотип».', options: ['Переход на личность', 'Подмена тезиса', 'Необоснованный вывод о причине'], answer: 2, explanation: 'Последовательность событий ещё не выделяет причину. Одновременно могли измениться цена, реклама, сезон или состав покупателей.', repair: 'Проверьте альтернативные объяснения и найдите сравнение, в котором условия различаются прежде всего логотипом.' },
  { text: '«Не слушайте его расчёт нагрузки: он однажды опоздал на встречу».', options: ['Ложная дилемма', 'Переход на личность', 'Нет явной ошибки'], answer: 1, explanation: 'Опоздание не показывает ошибку в расчёте. Сведения об авторе могут быть значимы для проверки надёжности, но здесь связь с расчётом не установлена.', repair: 'Обсудите входные данные, единицы измерения, формулу и допущения расчёта.' },
  { text: '«Либо переписываем весь сервис за месяц, либо навсегда остаёмся с неудобной системой».', options: ['Ложная дилемма', 'Ложная причина', 'Подмена тезиса'], answer: 0, explanation: 'Представлены только два исхода, хотя возможны постепенная замена, изоляция проблемного модуля или изменение сроков. Полнота списка вариантов не обоснована.', repair: 'Назовите хотя бы один промежуточный вариант, а затем сравните стоимость и риски вариантов.' },
  { text: '«В отчёте указана только сумма заявок за два месяца. По этой сумме нельзя восстановить точное число заявок в каждом месяце».', options: ['Ложная дилемма', 'Нет явной ошибки', 'Переход на личность'], answer: 1, explanation: 'Одной и той же сумме соответствуют разные пары чисел. Вывод указывает на реальную нехватку данных. Не каждое несогласие и не каждое ограничение — логическая ошибка.', repair: 'Запросите разбивку по месяцам или дополнительное условие, которое однозначно определяет каждое значение.' },
];

function mountFallacy({ body, saved, save, listen }) {
  const state = { caseIndex: integer(saved.caseIndex, 0, fallacyCases.length - 1, 0), answers: {} };
  if (saved.answers && typeof saved.answers === 'object') {
    for (let index = 0; index < fallacyCases.length; index++) {
      const value = saved.answers[index];
      if (Number.isInteger(value) && value >= 0 && value < fallacyCases[index].options.length) state.answers[index] = value;
    }
  }
  const render = () => {
    const current = fallacyCases[state.caseIndex];
    const answer = state.answers[state.caseIndex];
    body.innerHTML = `<p class="ix-intro">Найдите конкретный разрыв между основанием и выводом. Название ошибки полезно только вместе с объяснением.</p><div class="ix-case-heading"><span>Ситуация ${state.caseIndex + 1} из ${fallacyCases.length}</span><span>Разбор аргумента</span></div><blockquote class="ix-case">${escape(current.text)}</blockquote><div class="ix-choice-list" role="group" aria-label="Как устроено рассуждение">${current.options.map((item, index) => `<button type="button" class="ix-choice" data-fallacy-answer="${index}" ${pressed(answer === index)}><span class="ix-choice-letter">${['А', 'Б', 'В'][index]}</span>${escape(item)}</button>`).join('')}</div><div class="ix-feedback" aria-live="polite" role="status" ${answer === undefined ? 'hidden' : ''}>${answer === undefined ? '' : `<strong>${answer === current.answer ? 'Да, это описание подходит.' : 'Посмотрите, что именно следует из основания.'}</strong><p>${escape(current.explanation)}</p><p><strong>Как улучшить рассуждение:</strong> ${escape(current.repair)}</p>`}</div><div class="ix-button-row"><button type="button" class="ix-button ix-button-secondary" data-case-direction="-1" ${state.caseIndex === 0 ? 'disabled' : ''}>Предыдущая ситуация</button><button type="button" class="ix-button" data-case-direction="1" ${state.caseIndex === fallacyCases.length - 1 ? 'disabled' : ''}>Следующая ситуация</button></div>`;
  };
  listen('click', '[data-fallacy-answer]', element => {
    const answer = Number(element.dataset.fallacyAnswer);
    state.answers[state.caseIndex] = answer; render(); save(state);
    body.querySelector(`[data-fallacy-answer="${answer}"]`).focus({ preventScroll: true });
  });
  listen('click', '[data-case-direction]', element => {
    state.caseIndex = integer(state.caseIndex + Number(element.dataset.caseDirection), 0, fallacyCases.length - 1, 0);
    render(); save(state);
    body.querySelector('[data-fallacy-answer]').focus({ preventScroll: true });
  });
  render();
}

const rhetoricParts = {
  ethos: { label: 'Этос · почему вам можно доверять', options: ['Не добавлять', 'Сослаться только на должность', 'Обозначить опыт и границы знания'], text: ['', 'Я руководитель команды и лучше знаю, как всем работать.', 'Я участвую в поддержке сервиса и вижу, как срочные вопросы прерывают плановую работу. При этом у меня пока нет данных о том, поможет ли нашему отделу новый режим.'], explanation: ['', 'Должность даёт полномочия, но не заменяет основания. Читателю ещё нужно понять, что вы знаете и где можете ошибаться.', 'Вы показываете относящийся к делу опыт и честно ограничиваете уверенность. Это делает источник довода понятнее.'] },
  logos: { label: 'Логос · на чём держится предложение', options: ['Не добавлять', 'Обещать успех без проверки', 'Предложить проверяемый пилот'], text: ['', 'Тихие часы всегда повышают продуктивность, поэтому результат гарантирован.', 'Предлагаю двухнедельный пилот: сравним число прерываний и время ответа на срочные запросы с предыдущими двумя неделями. Сезонную нагрузку отметим отдельно. Если поддержка ухудшится, пересмотрим режим.'], explanation: ['', 'Слова «всегда» и «гарантирован» требуют сильных доказательств. Сейчас их нет, а альтернативные причины не учтены.', 'Появились срок, наблюдаемые показатели, ограничение сравнения и условие пересмотра. Пилот ещё не доказывает причинность, но делает проверку конкретнее.'] },
  pathos: { label: 'Пафос · почему это важно аудитории', options: ['Не добавлять', 'Давить на чувство вины', 'Назвать общую проблему'], text: ['', 'Если вы против тихих часов, значит, вам всё равно на коллег и качество работы.', 'Когда день дробится уведомлениями, трудно завершить сложную задачу и сохранить внимание. Хочется дать каждому время для сосредоточенной работы, сохранив помощь тем, кому она нужна срочно.'], explanation: ['', 'Несогласие приравнено к безразличию. Такое давление мешает обсуждать реальные риски и причины возражений.', 'Эмоциональный мотив связан с опытом аудитории и оставляет место для несогласия. Это не подменяет доводы, а объясняет значимость вопроса.'] },
};

function mountRhetoric({ body, saved, save, listen }) {
  const state = { ethos: integer(saved.ethos, 0, 2, 0), logos: integer(saved.logos, 0, 2, 0), pathos: integer(saved.pathos, 0, 2, 0), ending: typeof saved.ending === 'string' ? textValue(saved.ending) : 'Давайте обсудим условия пилота и критерии, по которым решим, стоит ли его продолжать.' };
  body.innerHTML = `<p class="ix-intro">Задача: предложить команде тихие часы для сложной работы. Подберите основания доверия, довод и человеческий смысл, затем сравните получившуюся речь.</p><div class="ix-controls">${Object.entries(rhetoricParts).map(([key, part]) => `<label class="ix-select-label"><span>${escape(part.label)}</span><select data-rhetoric="${key}">${part.options.map((option, index) => `<option value="${index}" ${state[key] === index ? 'selected' : ''}>${escape(option)}</option>`).join('')}</select></label>`).join('')}<label class="ix-text-label"><span>Ваше заключение</span><textarea data-rhetoric-ending rows="3" maxlength="600" placeholder="Предложите следующий шаг">${escape(state.ending)}</textarea><span class="ix-note">До 600 символов. Текст сохраняется с вашим прогрессом.</span></label></div><div class="ix-speech"><span class="ix-small-label">Получившаяся речь</span><div data-speech></div></div><div class="ix-feedback" data-rhetoric-feedback aria-live="polite" role="status"></div><p class="ix-note">Разбор основан на выбранных готовых блоках. Это прозрачные правила учебного примера: система не анализирует и не оценивает ваш свободный текст.</p>`;
  const update = () => {
    const paragraphs = Object.keys(rhetoricParts).map(key => rhetoricParts[key].text[state[key]]).filter(Boolean);
    if (state.ending.trim()) paragraphs.push(state.ending.trim());
    body.querySelector('[data-speech]').innerHTML = paragraphs.length ? paragraphs.map(item => `<p>${escape(item)}</p>`).join('') : '<p class="ix-note">Выберите блоки, чтобы собрать речь.</p>';
    const selected = Object.keys(rhetoricParts).filter(key => state[key] > 0);
    body.querySelector('[data-rhetoric-feedback]').innerHTML = `<strong>Что делают выбранные приёмы</strong>${selected.length ? selected.map(key => `<p><b>${escape(rhetoricParts[key].label.split(' · ')[0])}.</b> ${escape(rhetoricParts[key].explanation[state[key]])}</p>`).join('') : '<p>Начните с любого компонента. Все три приёма не обязаны встречаться в каждой фразе; их уместность зависит от ситуации.</p>'}`;
  };
  listen('change', '[data-rhetoric]', element => { state[element.dataset.rhetoric] = integer(element.value, 0, 2, 0); update(); save(state); });
  listen('input', '[data-rhetoric-ending]', element => { state.ending = textValue(element.value); update(); save(state); });
  update();
}

function mountFraming({ body, saved, save, listen }) {
  const state = { success: integer(saved.success, 0, 100, 90), frame: saved.frame === 'negative' ? 'negative' : 'positive', revealed: saved.revealed === true, decision: ['consider', 'try', 'wait'].includes(saved.decision) ? saved.decision : '' };
  body.innerHTML = `<p class="ix-intro">Один и тот же результат можно описать через достигнутое и через недостигнутое. Меняется подача; числовые факты остаются одинаковыми.</p><p class="ix-note">Вымышленный пример: 100 участников учебного пилота. «Успех» означает только выполнение заранее заданного задания.</p>${rangeField('success', 'Выполнили задание', state.success, 0, 100, 'из 100')}<div class="ix-segment" role="group" aria-label="Рамка описания"><button type="button" data-frame="positive" ${pressed(state.frame === 'positive')}>Через успех</button><button type="button" data-frame="negative" ${pressed(state.frame === 'negative')}>Через неудачу</button></div><div class="ix-frame-card" aria-live="polite" role="status"><strong data-framed-number></strong><p data-framed-text></p></div><p class="ix-label">Какая первая реакция на предложение пройти такую программу?</p><div class="ix-choice-list ix-choice-list-compact" role="group" aria-label="Ваша первая реакция"><button type="button" class="ix-choice" data-framing-decision="try" ${pressed(state.decision === 'try')}>Хочу попробовать</button><button type="button" class="ix-choice" data-framing-decision="consider" ${pressed(state.decision === 'consider')}>Нужно больше данных</button><button type="button" class="ix-choice" data-framing-decision="wait" ${pressed(state.decision === 'wait')}>Пока воздержусь</button></div><button type="button" class="ix-button ix-button-secondary" data-reveal-frame>Показать обе формулировки</button><div class="ix-feedback" data-frame-feedback ${state.revealed ? '' : 'hidden'}></div>`;
  const update = (preserveNumber = false) => {
    body.querySelector('[data-range="success"]').value = state.success;
    if (!preserveNumber) body.querySelector('[data-number="success"]').value = state.success;
    body.querySelector('[data-framed-number]').textContent = `${state.frame === 'positive' ? state.success : 100 - state.success} из 100`;
    body.querySelector('[data-framed-text]').textContent = state.frame === 'positive' ? 'участников выполнили задание.' : 'участников не выполнили задание.';
    body.querySelectorAll('[data-frame]').forEach(element => element.setAttribute('aria-pressed', String(element.dataset.frame === state.frame)));
    body.querySelectorAll('[data-framing-decision]').forEach(element => element.setAttribute('aria-pressed', String(element.dataset.framingDecision === state.decision)));
    const feedback = body.querySelector('[data-frame-feedback]'); feedback.hidden = !state.revealed;
    feedback.innerHTML = `<strong>Два описания, один набор данных</strong><p>${state.success} участников выполнили задание. ${100 - state.success} участников не выполнили его.</p><p>Если реакция меняется при смене формулировки, спросите себя, что именно изменилось: факт, внимание к потерям или ожидание результата?</p><p>Для решения не хватает определения задания, исходного уровня участников, сравнения с другой программой и цены ошибки. Рамка сама по себе не ложь; проблема возникает, когда подача скрывает существенные сведения.</p>${state.decision ? '<p class="ix-note">Ваша реакция сохранена. У неё нет автоматической оценки: задача — заметить влияние формулировки.</p>' : ''}`;
    body.querySelector('[data-reveal-frame]').textContent = state.revealed ? 'Скрыть разбор' : 'Показать обе формулировки';
  };
  listen('input', '[data-range="success"]', element => { state.success = integer(element.value, 0, 100, 90); update(); save(state); });
  listen('input', '[data-number="success"]', element => {
    const value = validNumberDraft(element, 0, 100);
    if (value === null) return;
    state.success = integer(value, 0, 100, state.success); update(true); save(state);
  });
  listen('change', '[data-number="success"]', element => { if (element.value === '') { update(); return; } state.success = integer(element.value, 0, 100, 90); update(); save(state); });
  listen('click', '[data-frame]', element => { state.frame = element.dataset.frame; update(); save(state); });
  listen('click', '[data-framing-decision]', element => { state.decision = element.dataset.framingDecision; update(); save(state); });
  listen('click', '[data-reveal-frame]', () => { state.revealed = !state.revealed; update(); save(state); });
  update();
}

function mountJustice({ body, saved, save, listen }) {
  const state = { allocation: normalizeAllocation(saved.allocation), model: saved.model === 'different' ? 'different' : 'same', lens: ['equality', 'utility', 'minimum'].includes(saved.lens) ? saved.lens : 'equality' };
  const people = ['Аня', 'Борис', 'Вера'];
  body.innerHTML = `<p class="ix-intro">У вас 100 единиц ресурса для трёх людей. Измените долю любого человека: оставшиеся единицы перераспределятся между двумя другими пропорционально их прежним долям.</p><div class="ix-allocation-controls">${people.map((person, index) => rangeField(`person-${index}`, person, state.allocation[index], 0, 100)).join('')}</div><div class="ix-allocation-visual" aria-label="Распределение 100 единиц">${people.map((person, index) => `<div class="ix-person"><span>${escape(person)}</span><div class="ix-person-track"><span class="ix-person-fill ix-person-${index}" data-person-bar="${index}"></span></div><strong data-person-share="${index}"></strong></div>`).join('')}</div><label class="ix-select-label"><span>Допущение о полезности ресурса</span><select data-utility-model><option value="same" ${state.model === 'same' ? 'selected' : ''}>Одинаковая отдача для всех</option><option value="different" ${state.model === 'different' ? 'selected' : ''}>Разная отдача: 1 / 1,5 / 2</option></select></label><div class="ix-presets"><button type="button" class="ix-button ix-button-secondary" data-allocation-preset="equal">Почти поровну</button><button type="button" class="ix-button ix-button-secondary" data-allocation-preset="utility">Максимум по модели</button><button type="button" class="ix-button ix-button-secondary" data-allocation-preset="unequal">70 / 20 / 10</button></div><div class="ix-metrics" role="status" aria-live="polite"><div><strong data-utility></strong><span>сумма условной полезности</span></div><div><strong data-minimum></strong><span>минимальная доля</span></div><div><strong data-gap></strong><span>разрыв долей</span></div></div><div class="ix-segment" role="group" aria-label="Принцип оценки"><button type="button" data-justice-lens="equality" ${pressed(state.lens === 'equality')}>Равенство</button><button type="button" data-justice-lens="utility" ${pressed(state.lens === 'utility')}>Общая польза</button><button type="button" data-justice-lens="minimum" ${pressed(state.lens === 'minimum')}>Положение худшего</button></div><div class="ix-feedback" data-justice-feedback aria-live="polite"></div><details class="ix-details"><summary>Допущения и границы модели</summary><p>Полезность человека = √(его доля) × коэффициент. Коэффициенты задаёт пример, а не наблюдение за людьми. Эта формула изображает убывающую отдачу и позволяет увидеть различие принципов; она не измеряет настоящее счастье.</p><p>Кнопка «Максимум по модели» перебирает целочисленные распределения 100 единиц. Изменение формулы или коэффициентов может изменить результат. Сравнимость пользы разных людей — отдельное спорное допущение.</p><p>Минимальная доля здесь относится только к ресурсу. Принцип различия Ролза сложнее: он касается общественных институтов, первичных благ и действует вместе с требованиями основных свобод и справедливого равенства возможностей.</p></details>`;
  const coefficients = () => state.model === 'different' ? [1, 1.5, 2] : [1, 1, 1];
  const bestAllocations = { same: maximumUtilityAllocation([1, 1, 1]), different: maximumUtilityAllocation([1, 1.5, 2]) };
  const update = (preserveNumberKey = null) => {
    const metrics = allocationMetrics(state.allocation, coefficients());
    state.allocation.forEach((value, index) => {
      body.querySelector(`[data-range="person-${index}"]`).value = value;
      if (preserveNumberKey !== `person-${index}`) body.querySelector(`[data-number="person-${index}"]`).value = value;
      body.querySelector(`[data-person-bar="${index}"]`).style.width = `${value}%`;
      body.querySelector(`[data-person-share="${index}"]`).textContent = value;
    });
    body.querySelector('[data-utility]').textContent = number.format(metrics.utility);
    body.querySelector('[data-minimum]').textContent = metrics.minimum;
    body.querySelector('[data-gap]').textContent = metrics.gap;
    body.querySelectorAll('[data-justice-lens]').forEach(element => element.setAttribute('aria-pressed', String(element.dataset.justiceLens === state.lens)));
    const best = bestAllocations[state.model];
    const messages = {
      equality: `<strong>Равные доли</strong><p>${metrics.gap <= 1 ? 'Вы распределили ресурс настолько равномерно, насколько позволяют целые единицы.' : `Разница между наибольшей и наименьшей долей — ${metrics.gap}. Принцип равенства ресурсов предлагает объяснить, чем оправдано это различие.`}</p><p>Равные ресурсы могут давать разную пользу при разных потребностях. Это повод уточнить, равенства чего мы добиваемся.</p>`,
      utility: `<strong>Сумма условной полезности</strong><p>По выбранной формуле сумма составляет ${number.format(metrics.utility)}. Максимум при целых единицах даёт распределение ${best.join(' / ')}.</p><p>Этот подход учитывает суммарный результат. Сам по себе он не запрещает жертвовать долей одного человека ради большей общей суммы. Права и ограничения придётся задать отдельно.</p>`,
      minimum: `<strong>Минимальная доля</strong><p>Человек с самой маленькой долей получает ${metrics.minimum} ${metrics.minimum === 1 ? 'единицу' : 'ед.'} У фиксированных 100 целых единиц максимальный возможный минимум равен 33.</p><p>Здесь мы смотрим прежде всего на положение получившего меньше всех. В реальной политике сначала надо определить, какие блага сравниваются и кого считать наименее обеспеченным.</p>`,
    };
    body.querySelector('[data-justice-feedback]').innerHTML = messages[state.lens];
  };
  const changeAllocation = element => { if (element.value === '') { update(); return; } const key = element.dataset.range || element.dataset.number; const index = Number(key.split('-')[1]); state.allocation = rebalanceAllocation(state.allocation, index, element.value); update(); save(state); };
  listen('input', '[data-range]', changeAllocation);
  listen('input', '[data-number]', element => {
    const value = validNumberDraft(element, 0, 100);
    if (value === null) return;
    const key = element.dataset.number;
    state.allocation = rebalanceAllocation(state.allocation, Number(key.split('-')[1]), value);
    update(key); save(state);
  });
  listen('change', '[data-number]', changeAllocation);
  listen('change', '[data-utility-model]', element => { state.model = element.value === 'different' ? 'different' : 'same'; update(); save(state); });
  listen('click', '[data-justice-lens]', element => { state.lens = element.dataset.justiceLens; update(); save(state); });
  listen('click', '[data-allocation-preset]', element => { state.allocation = element.dataset.allocationPreset === 'equal' ? [33, 33, 34] : element.dataset.allocationPreset === 'utility' ? [...bestAllocations[state.model]] : [70, 20, 10]; update(); save(state); });
  update();
}

const societies = [
  { title: 'Равные доли', shares: [30, 30, 30], description: 'Все получают одинаково; общий ресурс меньше.' },
  { title: 'Рост с более высоким минимумом', shares: [75, 55, 35], description: 'Доли различаются, но минимум выше, чем в первом варианте.' },
  { title: 'Самый высокий потолок', shares: [140, 40, 10], description: 'Общий ресурс максимален, разброс и риск для нижней позиции тоже выше.' },
];

function mountVeil({ body, saved, save, listen }) {
  const state = {
    choice: Number.isInteger(saved.choice) && saved.choice >= 0 && saved.choice < societies.length ? saved.choice : null,
    role: Number.isInteger(saved.role) && saved.role >= 0 && saved.role <= 2 ? saved.role : null,
    reaction: ['yes', 'no', 'unsure'].includes(saved.reaction) ? saved.reaction : '',
  };
  if (state.choice === null) state.role = null;
  const render = () => {
    const revealed = state.role !== null;
    body.innerHTML = `<p class="ix-intro">Выберите общество, пока не знаете своего места в нём. Одинаковые свободы и доступ к возможностям условно считаем заданными; сейчас сравниваем только распределение благ.</p><p class="ix-note">Все числа вымышлены. Разные суммы означают разные допущения о производстве. Случайное раскрытие роли — учебный приём, а не описание полной теории Ролза.</p><div class="ix-societies" role="group" aria-label="Выберите распределение благ">${societies.map((society, index) => `<button type="button" class="ix-society" data-society="${index}" ${pressed(state.choice === index)} ${revealed ? 'disabled' : ''}><strong>${escape(society.title)}</strong><span class="ix-society-values">${society.shares.join(' / ')}</span><span>${escape(society.description)}</span><span class="ix-society-meta">Всего: ${society.shares.reduce((sum, item) => sum + item, 0)} · Минимум: ${Math.min(...society.shares)}</span></button>`).join('')}</div>${revealed ? `<div class="ix-reveal" role="status"><span>Ваша случайная позиция</span><strong>${['Верхняя доля', 'Средняя доля', 'Нижняя доля'][state.role]}</strong><p>В выбранном обществе вы получаете <b>${societies[state.choice].shares[state.role]} ед.</b></p></div><p class="ix-label">После раскрытия роли ваше отношение к выбору изменилось?</p><div class="ix-segment" role="group" aria-label="Отношение к выбору">${[['yes', 'Изменилось'], ['no', 'Не изменилось'], ['unsure', 'Пока не знаю']].map(([value, label]) => `<button type="button" data-veil-reaction="${value}" ${pressed(state.reaction === value)}>${label}</button>`).join('')}</div><div class="ix-feedback"><strong>Вернитесь к основаниям выбора</strong><p>Можно предпочесть равенство, наибольший минимум, высокий ожидаемый результат или иной принцип. Объясните, почему выбранные правила приемлемы для людей в каждой позиции.</p><p>«Рост с более высоким минимумом» показывает, почему предпочтение положения наименее обеспеченного не всегда означает равные доли. Но одного такого сравнения недостаточно для полной оценки справедливости институтов.</p><p class="ix-note">Роли здесь раскрываются с равной вероятностью. Завеса неведения не сводится к такой лотерее: она также исключает знания о собственных способностях, убеждениях и социальном положении.</p></div><button type="button" class="ix-button ix-button-secondary" data-veil-reset>Начать снова без своей роли</button>` : `<button type="button" class="ix-button" data-veil-reveal ${state.choice === null ? 'disabled' : ''}>Зафиксировать выбор и открыть роль</button><p class="ix-note">Перед раскрытием сформулируйте свой принцип: что вы хотите защитить, ещё не зная, кем окажетесь?</p>`}`;
  };
  listen('click', '[data-society]', element => { if (state.role !== null) return; state.choice = Number(element.dataset.society); render(); save(state); body.querySelector(`[data-society="${state.choice}"]`).focus({ preventScroll: true }); });
  listen('click', '[data-veil-reveal]', () => { if (state.choice === null) return; state.role = Math.floor(Math.random() * 3); render(); save(state); body.querySelector('[data-veil-reset]').focus({ preventScroll: true }); });
  listen('click', '[data-veil-reset]', () => { state.choice = null; state.role = null; state.reaction = ''; render(); save(state); body.querySelector('[data-society]').focus({ preventScroll: true }); });
  listen('click', '[data-veil-reaction]', element => { state.reaction = element.dataset.veilReaction; body.querySelectorAll('[data-veil-reaction]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.veilReaction === state.reaction))); save(state); });
  render();
}

const marketCases = {
  queue: { title: 'Продажа мест в очереди', context: 'На бесплатную публичную лекцию есть ограниченное число мест. Организатор разрешает людям продавать свою очередь.', gain: 'Передача места может помочь человеку, который особенно ценит время или событие. Но цена отражает одновременно желание и платёжеспособность.', inequality: 'При сильном неравенстве покупка доступа может вытеснить людей с меньшим доходом, даже если интерес к лекции у них выше.', meaning: 'Очередь может выражать правило «кто раньше пришёл». Торговля меняет это правило на «кто готов и способен заплатить». Нужно обсудить, какой принцип подходит именно этому благу.' },
  reading: { title: 'Оплата детям за чтение', context: 'Школа предлагает небольшую денежную выплату за каждую прочитанную книгу. Оценки не зависят от участия.', gain: 'Оплата может привлечь внимание к чтению в начале. Сохранится ли интерес после отмены выплат, из условий примера неизвестно: это эмпирический вопрос.', inequality: 'Одна и та же сумма может означать очень разное для детей из разных семей. Это влияет на силу стимула и смысл участия.', meaning: 'Если чтение воспринимается только как оплачиваемая задача, его образовательный смысл может измениться. Это риск для обсуждения, а не неизбежный доказанный эффект.' },
  donation: { title: 'Выплата за донорство', context: 'Рассматривается денежная выплата донорам. Все медицинские критерии и проверки условно считаем неизменными. Обсуждаем только этическую сторону стимула.', gain: 'Выплата может компенсировать время и расходы. Увеличится ли число подходящих доноров и что произойдёт с мотивацией, нельзя вывести из самого наличия цены.', inequality: 'При экономическом давлении согласие требует особенно внимательной оценки. Формальная подпись сама по себе не показывает наличие приемлемых альтернатив.', meaning: 'Нужно различить возмещение затрат, вознаграждение и торговлю. Они могут по-разному влиять на представление о взаимопомощи и обязанности.' },
};

function mountMarket({ body, saved, save, listen }) {
  const state = {
    scenario: Object.hasOwn(marketCases, saved.scenario) ? saved.scenario : 'queue',
    inequality: saved.inequality !== false, alternative: saved.alternative === true,
    refusal: saved.refusal === true, transparent: saved.transparent !== false,
    stance: ['allow', 'limit', 'reject'].includes(saved.stance) ? saved.stance : '',
    reason: textValue(saved.reason, 800),
  };
  body.innerHTML = `<p class="ix-intro">Можно ли разрешить обмен, если обе стороны согласны? Измените условия и проследите, какие доводы становятся сильнее или слабее.</p><label class="ix-select-label"><span>Ситуация</span><select data-market-scenario>${Object.entries(marketCases).map(([key, value]) => `<option value="${key}" ${state.scenario === key ? 'selected' : ''}>${escape(value.title)}</option>`).join('')}</select></label><p class="ix-market-context" data-market-context></p><div class="ix-market-conditions"><label class="ix-check"><input type="checkbox" data-market-condition="inequality"${checked(state.inequality)}><span>Сильное неравенство доходов</span></label><label class="ix-check"><input type="checkbox" data-market-condition="alternative"${checked(state.alternative)}><span>Есть доступная бесплатная альтернатива</span></label><label class="ix-check"><input type="checkbox" data-market-condition="refusal"${checked(state.refusal)}><span>Можно отказаться без серьёзных потерь</span></label><label class="ix-check"><input type="checkbox" data-market-condition="transparent"${checked(state.transparent)}><span>Правила и последствия понятны участникам</span></label></div><div class="ix-perspectives" data-market-perspectives aria-live="polite"></div><p class="ix-label">Ваша предварительная позиция</p><div class="ix-segment" role="group" aria-label="Позиция по ситуации"><button type="button" data-market-stance="allow" ${pressed(state.stance === 'allow')}>Разрешить</button><button type="button" data-market-stance="limit" ${pressed(state.stance === 'limit')}>Разрешить с условиями</button><button type="button" data-market-stance="reject" ${pressed(state.stance === 'reject')}>Не разрешать</button></div><label class="ix-text-label"><span>Какое основание для вас решающее?</span><textarea data-market-reason rows="3" maxlength="800" placeholder="Укажите принцип, условие и возможное возражение">${escape(state.reason)}</textarea></label><p class="ix-note">Позиция и текст сохраняются с прогрессом. Автоматической моральной оценки нет: условия меняют аргументы, а итог требует обоснования. Последний разбор не является прогнозом поведения людей.</p>`;
  const update = () => {
    const scenario = marketCases[state.scenario];
    body.querySelector('[data-market-context]').textContent = scenario.context;
    const alternativeLabels = {
      queue: 'Есть доступная бесплатная альтернатива',
      reading: 'Есть равноценное учебное занятие без выплат',
      donation: 'Расходы отдельно возмещаются и без награды',
    };
    body.querySelector('[data-market-condition="alternative"]').nextElementSibling.textContent = alternativeLabels[state.scenario];
    const consent = state.refusal && state.transparent
      ? 'В заданных условиях участники понимают правила и могут отказаться без серьёзных потерь. Это усиливает довод о добровольности, но не решает вопрос о справедливости самого правила.'
      : `${state.refusal ? '' : 'Если отказ связан с серьёзными потерями, формальное согласие может отражать нужду. '}${state.transparent ? '' : 'Если последствия неясны, информированность согласия остаётся под вопросом. '}Уточните, какие реальные альтернативы есть у человека.`;
    const alternativeEffects = {
      queue: state.alternative ? 'Доступная бесплатная альтернатива ослабляет риск полного исключения. Проверьте, сопоставимы ли её качество и условия.' : 'Без доступной бесплатной альтернативы цена может стать единственным входным барьером. Выясните, кого этот барьер исключает.',
      reading: state.alternative ? 'Равноценное занятие без выплат даёт реальный выбор способа учиться. Проверьте, не получают ли участники денежной схемы скрытых преимуществ в оценках или доступе к учителю.' : 'Если равноценного занятия нет, отказ от выплат может оставить ребёнка без сопоставимой учебной возможности. Само обещание не снижать оценки ещё не обеспечивает равенство опыта.',
      donation: state.alternative ? 'Отдельное возмещение затрат помогает отличить устранение расходов от дополнительного стимула. Остальные возражения к покупке участия всё ещё требуют обсуждения.' : 'Если расходы не возмещаются отдельно, часть денежной выплаты может лишь покрывать дорогу и потерянное время. Нельзя автоматически считать всю сумму покупкой мотивации.',
    };
    const fairness = `${state.inequality ? scenario.inequality : 'По условию различия доходов невелики. Возражение о неравных экономических возможностях ослабевает, но основания участия и смысл блага всё ещё требуют обсуждения.'} ${alternativeEffects[state.scenario]}`;
    body.querySelector('[data-market-perspectives]').innerHTML = `<section><h4>Возможная польза</h4><p>${escape(scenario.gain)}</p></section><section><h4>Согласие и возможности</h4><p>${escape(consent)}</p><p>${escape(fairness)}</p></section><section><h4>Смысл самого блага</h4><p>${escape(scenario.meaning)}</p><p>Даже более равное распределение денег не устраняет это возражение автоматически: речь идёт о том, что именно покупается.</p></section>`;
    body.querySelectorAll('[data-market-stance]').forEach(element => element.setAttribute('aria-pressed', String(element.dataset.marketStance === state.stance)));
  };
  listen('change', '[data-market-scenario]', element => { state.scenario = element.value; state.stance = ''; state.reason = ''; body.querySelector('[data-market-reason]').value = ''; update(); save(state); });
  listen('change', '[data-market-condition]', element => { state[element.dataset.marketCondition] = element.checked; update(); save(state); });
  listen('click', '[data-market-stance]', element => { state.stance = element.dataset.marketStance; update(); save(state); });
  listen('input', '[data-market-reason]', element => { state.reason = textValue(element.value, 800); save(state); });
  update();
}
