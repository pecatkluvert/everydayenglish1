/* Everyday English — plain JavaScript, no build step or external services. */
(() => {
  'use strict';
  const $ = (s, root = document) => root.querySelector(s);
  const main = $('#main');
  const sections = ['overview', 'learn', 'practice', 'dialogue', 'story'];
  const names = ['Overview', 'Expressions', 'Practice', 'Dialogue', 'Story'];
  let catalog, lesson, state, section = 'overview', quizIds = [], showQuizResult = false;
  let hideMeanings = false, highlights = true, storageWarningShown = false, loadGeneration = 0;
  const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normal = x => String(x ?? '').normalize('NFKC').toLowerCase().trim().replace(/\s+/g, ' ').replace(/[.!?,]+$/, '');
  const button = (text, action, secondary = false, extra = '') => `<button class="button${secondary ? ' secondary' : ''}" data-action="${action}" ${extra}>${text}</button>`;
  const emptyState = () => ({known: [], practice: {}, dialogue: {}, storyRead: false, quizIndex: 0, quizFinished: false, quizQueue: null});
  const storageKey = () => `everyday-english:${lesson.id}:v${lesson.contentVersion}`;
  const announce = message => { $('#announcement').textContent = message; };
  const isCorrect = (q, record) => Boolean(record?.checked && normal(record.value) === normal(q.answer));
  function storageWarning(message) {
    if (storageWarningShown) return;
    storageWarningShown = true;
    const notice = document.createElement('div');
    notice.className = 'storage-warning'; notice.setAttribute('role', 'status'); notice.textContent = message;
    $('.topbar').after(notice);
  }
  function save() {
    try { localStorage.setItem(storageKey(), JSON.stringify(state)); }
    catch { storageWarning('Progress cannot be saved in this browser. You can keep practicing during this visit.'); }
    updateChrome();
  }
  function readState() {
    const fresh = emptyState();
    try {
      const raw = JSON.parse(localStorage.getItem(storageKey()) || 'null');
      if (!raw || typeof raw !== 'object') return fresh;
      fresh.known = Array.isArray(raw.known) ? [...new Set(raw.known.filter(id => lesson.expressions.some(e => e.id === id)))] : [];
      for (const [key, items] of [['practice', lesson.practice.questions], ['dialogue', lesson.dialogue.lines.filter(l => l.answer)]]) {
        for (const item of items) {
          const record = raw[key]?.[item.id];
          if (record && typeof record.value === 'string' && (key !== 'practice' || item.options.includes(record.value))) {
            fresh[key][item.id] = {value: record.value, checked: record.checked === true};
          }
        }
      }
      fresh.storyRead = raw.storyRead === true;
      fresh.quizIndex = Number.isInteger(raw.quizIndex) ? Math.max(0, Math.min(raw.quizIndex, lesson.practice.questions.length - 1)) : 0;
      fresh.quizQueue = Array.isArray(raw.quizQueue) && raw.quizQueue.length && new Set(raw.quizQueue).size === raw.quizQueue.length && raw.quizQueue.every(id => lesson.practice.questions.some(q => q.id === id)) ? raw.quizQueue : null;
      fresh.quizIndex = Math.min(fresh.quizIndex, (fresh.quizQueue || lesson.practice.questions).length - 1);
      fresh.quizFinished = raw.quizFinished === true && lesson.practice.questions.every(q => fresh.practice[q.id]?.checked);
      return fresh;
    } catch { storageWarning('Saved progress could not be loaded. A fresh practice session is ready.'); return fresh; }
  }
  async function jsonFile(path) {
    const backup = window.ENGLISH_WORKBOOK;
    if (location.protocol === 'file:') {
      if (backup?.[path]) return structuredClone(backup[path]);
      throw new Error('The offline lesson bundle is missing. Run scripts/package.py or serve this folder with a local HTTP server.');
    }
    const response = await fetch(path, {cache: 'no-cache'});
    if (!response.ok) throw new Error(`Could not load ${path} (HTTP ${response.status}). Check that the file was uploaded.`);
    return response.json();
  }
  function validateLesson(data, id) {
    if (!data || data.schemaVersion !== 1 || data.id !== id || !data.title || !Number.isInteger(data.contentVersion) ||
        !Array.isArray(data.expressions) || !data.expressions.length || !Array.isArray(data.practice?.questions) || !data.practice.questions.length ||
        !Array.isArray(data.dialogue?.lines) || !data.dialogue.lines.some(l => l.answer) || !Array.isArray(data.dialogue.wordBank) ||
        !Array.isArray(data.story?.paragraphs) || !data.story.paragraphs.length || !Array.isArray(data.story.highlights)) {
      throw new Error('This lesson has an unsupported or incomplete structure. Use data/lesson-template.json as your starting point.');
    }
    for (const q of data.practice.questions) {
      if (!q.id || !q.prompt?.includes('____') || !Array.isArray(q.options) || !q.options.includes(q.answer)) throw new Error('A practice question has missing options or an invalid answer.');
    }
  }
  function route() {
    const hash = new URLSearchParams(location.hash.slice(1));
    return {id: hash.get('lesson') || catalog.lessons[0].id, section: sections.includes(hash.get('section')) ? hash.get('section') : 'overview'};
  }
  function go(target, id = lesson.id) {
    const hash = `#lesson=${encodeURIComponent(id)}&section=${target}`;
    if (location.hash === hash) { section = target; render(true); } else location.hash = hash;
  }
  async function loadRoute() {
    const generation = ++loadGeneration;
    const target = route();
    const item = catalog.lessons.find(l => l.id === target.id);
    if (!item) { showError(new Error('This lesson is not in data/lessons.json. Choose an available lesson above.')); return; }
    if (lesson?.id !== item.id) {
      main.innerHTML = '<div class="loading">Opening your workbook…</div>';
      try {
        const next = await jsonFile(item.file);
        if (generation !== loadGeneration) return;
        validateLesson(next, item.id); lesson = next; state = readState();
        quizIds = state.quizQueue || lesson.practice.questions.map(q => q.id); showQuizResult = state.quizFinished;
        hideMeanings = false; highlights = true;
      } catch (error) { if (generation === loadGeneration) showError(error); return; }
    }
    $('#reset-progress').disabled = false;
    section = target.section;
    $('#lesson-select').value = item.id;
    document.title = `Lesson ${lesson.number} · ${lesson.title} | Everyday English`;
    render(true);
  }
  function stats() {
    const questions = lesson.practice.questions, blanks = lesson.dialogue.lines.filter(l => l.answer);
    const practice = questions.filter(q => isCorrect(q, state.practice[q.id])).length;
    const dialogue = blanks.filter(q => isCorrect(q, state.dialogue[q.id])).length;
    return {practice, dialogue, total: lesson.expressions.length + questions.length + blanks.length + 1,
      done: state.known.length + practice + dialogue + Number(state.storyRead),
      complete: [false, state.known.length === lesson.expressions.length, practice === questions.length, dialogue === blanks.length, state.storyRead]};
  }
  function updateChrome() {
    if (!lesson || !state) return;
    const s = stats();
    $('#navigation').innerHTML = sections.map((key, i) => `<button class="nav-button${section === key ? ' active' : ''}" data-section="${key}" ${section === key ? 'aria-current="page"' : ''}><span class="nav-num">${i === 0 ? '⌂' : `0${i}`}</span><span>${names[i]}</span>${s.complete[i] ? '<span class="nav-check" aria-label="completed">✓</span>' : ''}</button>`).join('');
    $('#progress-copy').textContent = s.done === s.total ? 'A whole lesson, one step at a time. Well done!' : s.done ? 'Keep going. Every expression adds up.' : 'Your next expression starts here.';
    $('#progress-bar').style.width = `${s.done / s.total * 100}%`;
    $('#progress-label').textContent = `${s.done} of ${s.total} steps complete`;
    $('.progress-track').setAttribute('role', 'progressbar');
    $('.progress-track').setAttribute('aria-valuemin', '0');
    $('.progress-track').setAttribute('aria-valuemax', String(s.total));
    $('.progress-track').setAttribute('aria-valuenow', String(s.done));
    $('.progress-track').setAttribute('aria-label', 'Lesson completion');
  }
  const intro = (tag, title, description) => `<div class="page-intro"><div class="eyebrow">${esc(tag)}</div><h1>${esc(title)}</h1><p>${esc(description)}</p></div>`;
  function render(focus = false) {
    const contents = {overview: overviewView, learn: learnView, practice: practiceView, dialogue: dialogueView, story: storyView};
    main.innerHTML = `<div class="breadcrumbs"><span>YOUR WORKBOOK</span><span>/</span><span>LESSON ${esc(lesson.number)}</span><span>/</span><span>${esc(names[sections.indexOf(section)].toUpperCase())}</span></div>${contents[section]()}`;
    updateChrome();
    if (focus) { main.focus({preventScroll: true}); window.scrollTo({top: 0, behavior: 'instant'}); }
  }
  function illustration() {
    return `<svg viewBox="0 0 270 290" role="img" aria-label="An illustrated open workbook, a pencil, and a speech bubble"><circle cx="136" cy="144" r="108" fill="#dbe2ce"/><path d="M34 96 Q86 76 132 104 Q179 81 233 99 L225 232 Q178 215 131 236 Q81 212 33 224Z" fill="#b5bfa4"/><path d="M28 84 Q82 65 132 96 L131 226 Q79 198 28 214Z" fill="#fffdf4" stroke="#788a6e" stroke-width="1.4"/><path d="M132 96 Q182 69 237 88 L229 217 Q181 201 131 226Z" fill="#f5efdc" stroke="#788a6e" stroke-width="1.4"/><path d="M132 96 L131 226" stroke="#c3bea7"/><g fill="none" stroke="#c9cbb6" stroke-width="3" stroke-linecap="round"><path d="M45 118 Q79 108 112 125 M45 133 Q79 123 112 140 M45 148 Q79 138 99 151 M45 178 Q79 168 112 185 M45 193 Q79 183 98 194 M153 121 Q181 109 216 118 M153 137 Q181 125 216 134 M153 153 Q181 141 205 148 M152 182 Q180 170 214 179 M152 198 Q180 186 201 191"/></g><path d="M156 109 L156 134 L168 126 L177 130 L179 102" fill="#cc6a4e"/><g transform="rotate(27 225 203)"><rect x="219" y="145" width="10" height="108" rx="2" fill="#d79a4f"/><path d="M219 253 L224 268 L229 253" fill="#eddbb5"/><path d="M222 262 L224 268 L226 262" fill="#355d50"/></g><path d="M54 38 Q54 21 71 21 H140 Q157 21 157 38 V58 Q157 75 140 75 H96 L81 89 L83 75 H71 Q54 75 54 58Z" fill="#25685b"/><text x="72" y="56" fill="#fffdf4" font-family="Georgia,serif" font-size="25">Hello!</text><g fill="#ca684d"><path d="M28 54 L32 43 L36 54 L47 58 L36 62 L32 73 L28 62 L17 58Z"/><circle cx="224" cy="51" r="5"/></g><path d="M53 255 Q134 277 212 253" fill="none" stroke="#bfc9b0" stroke-width="2" stroke-dasharray="3 6"/></svg>`;
  }
  function overviewView() {
    const s = stats(), next = !s.complete[1] ? 'learn' : !s.complete[2] ? 'practice' : !s.complete[3] ? 'dialogue' : 'story';
    const details = [`${state.known.length} / ${lesson.expressions.length} learned`, `${s.practice} / ${lesson.practice.questions.length} correct`, `${s.dialogue} / ${lesson.dialogue.lines.filter(l => l.answer).length} correct`, state.storyRead ? 'Reading complete' : 'Read at your own pace'];
    return `<section class="hero"><div class="hero-copy"><div class="eyebrow">LESSON ${String(lesson.number).padStart(2, '0')} · EVERYDAY EXPRESSIONS</div><h1>A little practice.<br><em>A lot to say.</em></h1><p>${esc(lesson.subtitle)} Learn useful expressions and put them into everyday conversations.</p>${button(`${s.done ? 'Continue your lesson' : 'Start learning'} <span aria-hidden="true">↗</span>`, 'go', false, `data-target="${next}"`)}</div><div class="hero-art">${illustration()}</div></section><div class="section-head"><h2>Your lesson, step by step</h2><span class="muted">Four ways to make it stick.</span></div><div class="route-grid">${[['Expressions','Learn the meanings & examples','Aa','learn'],['Choose the answer','Put expressions into practice','✓','practice'],['Complete the dialogue','A table for two, please','“ ”','dialogue'],['Read the story','See expressions in context','¶','story']].map((r, i) => `<button class="route-card" data-action="go" data-target="${r[3]}"><span class="route-icon" aria-hidden="true">${r[2]}</span><h3>${r[0]}</h3><p>${r[1]}</p><span class="route-bottom">${esc(details[i])}<span aria-hidden="true">↗</span></span></button>`).join('')}</div><div class="quote-strip"><p>“On the whole, a little practice goes a long way.”</p><span>Your everyday reminder</span></div><p class="notice">Includes every Lesson ${esc(lesson.number)} exercise in the supplied document. Answers and explanations are provided for self-study. ${esc(lesson.source.answerKey)} Progress is saved only in this browser.</p>`;
  }
  function learnView() {
    return `${intro('01 / BUILD YOUR VOCABULARY', 'Words for the everyday.', 'Read each expression, explore the examples, and mark the ones you know. Hide the meanings to test your memory.')}<div class="section-head"><span class="muted">${lesson.expressions.length} expressions · ${state.known.length} marked as learned</span><button class="button secondary" data-action="hide-meanings" aria-pressed="${hideMeanings}">${hideMeanings ? 'Show meanings' : 'Hide meanings'}</button></div><div class="expression-grid${hideMeanings ? ' hide-meanings' : ''}">${lesson.expressions.map((e, i) => `<article class="expression-card" id="expression-${esc(e.id)}"><div class="expression-heading"><span class="eyebrow">EXPRESSION ${String(i+1).padStart(2,'0')}</span>${'speechSynthesis' in window ? `<button class="listen" data-action="listen" data-id="${esc(e.id)}" aria-label="Listen to ${esc(e.phrase)}" title="Listen">♪</button>` : ''}</div><h2>${esc(e.phrase)}</h2><p class="definition">${esc(e.meaning)}</p><ul class="examples">${e.examples.map(t => `<li>${esc(t)}</li>`).join('')}</ul><div class="mini-dialogue">${e.dialogue.map(t => `<p>${esc(t)}</p>`).join('')}</div><label class="known"><input type="checkbox" data-known="${esc(e.id)}" ${state.known.includes(e.id) ? 'checked' : ''}> I know this expression</label>${hideMeanings ? `<button class="text-button reveal-button" data-action="reveal" aria-expanded="false">Reveal meaning & examples</button>` : ''}</article>`).join('')}</div><div class="actions" style="margin-top:28px">${button('Try the practice <span aria-hidden="true">→</span>', 'go', false, 'data-target="practice"')}</div>`;
  }
  function questionById(id) { return lesson.practice.questions.find(q => q.id === id); }
  function formatBlank(text, value = '') { return text.split('____').map(esc).join(`<span class="blank">${value ? esc(value) : '…'}</span>`); }
  function practiceView() {
    if (showQuizResult) return resultsView();
    state.quizIndex = Math.max(0, Math.min(state.quizIndex, quizIds.length-1));
    const q = questionById(quizIds[state.quizIndex]), record = state.practice[q.id], checked = record?.checked;
    const originalNumber = lesson.practice.questions.indexOf(q) + 1;
    return `${intro('02 / PUT IT INTO PRACTICE', 'Find the right expression.', 'Choose the best answer, then check it. Take your time — the explanation will help it stick.')}<div class="quiz-layout"><section class="question-card" aria-label="Question ${originalNumber}"><div class="question-top"><span>QUESTION ${originalNumber} OF ${lesson.practice.questions.length}</span><span>${checked ? (isCorrect(q, record) ? '✓ CORRECT' : 'KEEP PRACTICING') : 'CHOOSE ONE ANSWER'}</span></div><p class="question-text">${formatBlank(q.prompt, checked ? q.answer : '')}</p><form id="practice-form"><fieldset class="options"><legend class="sr-only">${esc(q.prompt)}</legend>${q.options.map((option, i) => `<label class="option${checked && option === q.answer ? ' correct' : checked && record.value === option ? ' wrong' : ''}"><input type="radio" name="answer" value="${esc(option)}" ${record?.value === option ? 'checked' : ''} ${checked ? 'disabled' : ''} required><span class="option-letter">${String.fromCharCode(65+i)}</span><span>${esc(option)}</span>${checked && option === q.answer ? '<span aria-label="correct answer">✓</span>' : ''}</label>`).join('')}</fieldset>${checked ? `<div class="feedback${isCorrect(q, record) ? '' : ' wrong'}" role="status"><strong>${isCorrect(q, record) ? 'That’s right.' : `The answer is “${esc(q.answer)}.”`}</strong><p>${esc(q.explanation)}</p></div>` : ''}<div class="quiz-controls">${button('← Previous', 'previous-question', true, state.quizIndex === 0 ? 'disabled type="button"' : 'type="button"')}${checked ? button(state.quizIndex === quizIds.length-1 ? 'See results →' : 'Next question →', 'next-question', false, 'type="button"') : `<button class="button" type="submit" ${record?.value ? '' : 'disabled'}>Check answer</button>`}</div></form></section><aside class="quiz-aside"><div class="eyebrow">YOUR QUESTIONS</div><div class="question-map">${quizIds.map((id, i) => {const item = questionById(id), r = state.practice[id]; return `<button class="map-button${i === state.quizIndex ? ' current' : ''}${r?.checked ? (isCorrect(item, r) ? ' right' : ' incorrect') : ''}" data-action="jump-question" data-index="${i}" aria-label="Question ${lesson.practice.questions.indexOf(item)+1}${r?.checked ? (isCorrect(item,r) ? ', correct' : ', incorrect') : ', unanswered'}" ${i === state.quizIndex ? 'aria-current="step"' : ''}>${lesson.practice.questions.indexOf(item)+1}</button>`;}).join('')}</div><p>${lesson.practice.questions.filter(q => state.practice[q.id]?.checked).length} of ${lesson.practice.questions.length} answers checked.</p><p>Green: correct<br>Peach: try again</p><button class="text-button" data-action="show-results">Review all answers</button></aside></div>`;
  }
  function resultsView() {
    const qs = lesson.practice.questions, checked = qs.filter(q => state.practice[q.id]?.checked).length, score = qs.filter(q => isCorrect(q,state.practice[q.id])).length;
    return `${intro('02 / YOUR PRACTICE', checked === qs.length ? 'A little more confident.' : 'Your practice so far.', 'Review your answers, then revisit any expression that needs another look.')}<section class="panel"><div class="eyebrow">YOUR SCORE</div><div class="result-score">${score}<span class="muted" style="font-size:28px"> / ${qs.length}</span></div><p class="muted">${checked} answers checked. ${qs.length-checked} unanswered.</p><div class="actions">${score < qs.length ? button('Practice mistakes & unanswered', 'retry-practice') : ''}${button('Start all questions again', 'restart-practice', true)}${button('Continue to dialogue →','go',true,'data-target="dialogue"')}</div><div class="result-list">${qs.map((q,i) => {const r=state.practice[q.id], right=isCorrect(q,r);return `<div class="result-row"><strong>${i+1}. ${r?.checked ? (right ? '✓ Correct' : '↻ Review this expression') : 'Not checked yet'}</strong><p>${r?.checked ? formatBlank(q.prompt,q.answer) : formatBlank(q.prompt)}</p>${r?.checked ? `<p class="muted">Your answer: ${esc(r.value)} · Answer: ${esc(q.answer)}</p><p>${esc(q.explanation)}</p>` : ''}</div>`;}).join('')}</div></section>`;
  }
  function dialogueView() {
    const blanks = lesson.dialogue.lines.filter(l => l.answer), allChecked = blanks.every(l => state.dialogue[l.id]?.checked), score = blanks.filter(l => isCorrect(l,state.dialogue[l.id])).length;
    return `${intro('03 / ENGLISH IN CONVERSATION', lesson.dialogue.title, 'Fill each blank with an expression from the word bank. Use each expression once. You can type your answer or choose a suggestion.')}<div class="word-bank" aria-label="Word bank">${lesson.dialogue.wordBank.map(t => `<span>${esc(t)}</span>`).join('')}</div><datalist id="word-bank-options">${lesson.dialogue.wordBank.map(t => `<option value="${esc(t)}"></option>`).join('')}</datalist><form id="dialogue-form" class="panel"><div class="dialogue-lines">${lesson.dialogue.lines.map(line => {
      const r=state.dialogue[line.id], parts=line.text.split('____');
      return `<div class="dialogue-line"><div class="speaker${line.speaker==='Waiter'?' waiter':''}">${esc(line.speaker)}</div><div><p>${line.answer ? `${esc(parts[0])}<input class="answer-input${r?.checked&&!isCorrect(line,r)?' invalid':''}" aria-label="Blank ${blanks.indexOf(line)+1}, ${esc(line.speaker)}: ${esc(line.text)}" ${r?.checked ? `readonly aria-describedby="feedback-${esc(line.id)}"` : ''} data-dialogue="${esc(line.id)}" list="word-bank-options" value="${esc(r?.value || '')}" required autocomplete="off" spellcheck="false">${esc(parts[1])}` : esc(line.text)}</p>${r?.checked ? `<p class="inline-feedback${isCorrect(line,r)?'':' wrong'}" id="feedback-${esc(line.id)}">${isCorrect(line,r)?'✓ Correct.':`↻ Answer: <strong>${esc(line.answer)}</strong>.`} ${esc(line.explanation)}</p>` : ''}</div></div>`;
    }).join('')}</div><div class="dialogue-actions"><div class="actions"><button class="button" type="submit" ${allChecked?'disabled':''}>Check dialogue</button>${blanks.some(l=>state.dialogue[l.id]?.checked&&!isCorrect(l,state.dialogue[l.id]))?button('Retry mistakes','retry-dialogue',true,'type="button"'):''}${button('Start dialogue again','restart-dialogue',true,'type="button"')}${allChecked?button('Read the story →','go',true,'data-target="story" type="button"'):''}</div><p class="muted small" style="margin:16px 0 0">${score} of ${blanks.length} blanks correct. Capitalization, extra spaces, and final punctuation do not affect your score.</p></div></form>`;
  }
  function storyText(text) {
    if (!highlights) return esc(text);
    const candidates = lesson.story.highlights.map((h,i)=>({...h,index:i})).sort((a,b)=>b.text.length-a.text.length);
    const matches=[];
    for (const h of candidates) {
      let position=0;
      while ((position=text.indexOf(h.text,position)) !== -1) {
        const end=position+h.text.length;
        if (!matches.some(m=>position<m.end&&end>m.start)) matches.push({start:position,end,h});
        position=end;
      }
    }
    matches.sort((a,b)=>a.start-b.start);
    let result='', offset=0;
    for (const m of matches) { result+=esc(text.slice(offset,m.start))+`<button class="highlight" data-action="definition" data-index="${m.h.index}" aria-label="Meaning of ${esc(m.h.text)}">${esc(text.slice(m.start,m.end))}</button>`; offset=m.end; }
    return result+esc(text.slice(offset));
  }
  function storyView() {
    return `${intro('04 / IDIOMS IN CONTEXT', 'Read it. Picture it. Remember it.', 'Read the complete story from the lesson. Tap a highlighted expression for its meaning.')}<div class="story-toolbar"><label><input id="toggle-highlights" type="checkbox" ${highlights?'checked':''}> Highlight expressions</label>${button(state.storyRead?'✓ Marked as read':'Mark story as read','read-story',true)}</div><article class="panel story-panel"><div class="story-kicker">THE LESSON STORY</div><h2>${esc(lesson.story.title)}</h2>${lesson.story.paragraphs.map(p=>`<p class="story-paragraph">${storyText(p)}</p>`).join('')}<div id="definition-tip" class="definition-tip" role="status" hidden></div></article><div class="actions" style="margin-top:26px">${button(state.storyRead?'✓ Reading complete':'I’ve finished reading','read-story')}${button('Back to your lesson →','go',true,'data-target="overview"')}</div>`;
  }
  function showError(error) {
    main.innerHTML = `<div class="error" role="alert"><h1 style="font-size:30px">Let’s get your workbook open.</h1><p>${esc(error.message)}</p><p>Make sure the HTML, CSS, JavaScript, and data folders are uploaded together. For a local copy, keep <code>data/lessons.bundle.js</code> beside the other lesson files.</p><button class="button" data-action="reload">Try again</button></div>`;
    $('#reset-progress').disabled=true;
  }
  document.addEventListener('click', event => {
    const nav=event.target.closest('[data-section]'); if(nav){go(nav.dataset.section);return;}
    if(event.target.closest('.brand')){event.preventDefault();if(lesson)go('overview');return;}
    const el=event.target.closest('[data-action]'); if(!el)return;
    const action=el.dataset.action;
    if(action==='reload'){location.reload();return;}
    if(!lesson)return;
    if(action==='go')go(el.dataset.target);
    if(action==='hide-meanings'){hideMeanings=!hideMeanings;render();$('[data-action="hide-meanings"]').focus();}
    if(action==='reveal'){
      const card=el.closest('.expression-card'), revealed=card.classList.toggle('revealed');
      el.setAttribute('aria-expanded',String(revealed));el.textContent=revealed?'Hide meaning & examples':'Reveal meaning & examples';
    }
    if(action==='listen'){
      const phrase=lesson.expressions.find(e=>e.id===el.dataset.id)?.phrase;
      if(phrase && 'speechSynthesis' in window){speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(phrase);utterance.lang='en-US';utterance.rate=.85;utterance.onerror=()=>announce('Audio is unavailable. You can still read and practice this expression.');speechSynthesis.speak(utterance);}
    }
    if(action==='previous-question'||action==='next-question'||action==='jump-question'){
      if(action==='previous-question')state.quizIndex--;
      if(action==='jump-question')state.quizIndex=Number(el.dataset.index);
      if(action==='next-question'){
        if(state.quizIndex===quizIds.length-1){showQuizResult=true;state.quizFinished=lesson.practice.questions.every(q=>state.practice[q.id]?.checked);}
        else state.quizIndex++;
      }
      save();render(true);
    }
    if(action==='show-results'){showQuizResult=true;render(true);}
    if(action==='retry-practice'||action==='restart-practice'){
      quizIds=lesson.practice.questions.filter(q=>action==='restart-practice'||!isCorrect(q,state.practice[q.id])).map(q=>q.id);
      quizIds.forEach(id=>delete state.practice[id]);state.quizQueue=quizIds;state.quizIndex=0;state.quizFinished=false;showQuizResult=false;save();render(true);
    }
    if(action==='retry-dialogue'||action==='restart-dialogue'){
      lesson.dialogue.lines.filter(l=>l.answer).forEach(l=>{if(action==='restart-dialogue'||!isCorrect(l,state.dialogue[l.id]))delete state.dialogue[l.id];});save();render();$('[data-dialogue]:not([readonly])')?.focus();
    }
    if(action==='read-story'){state.storyRead=true;save();render();announce('Story marked as read.');$('[data-action="read-story"]')?.focus();}
    if(action==='definition'){
      const h=lesson.story.highlights[Number(el.dataset.index)], e=lesson.expressions.find(t=>t.id===h.expressionId), tip=$('#definition-tip');
      if(e){tip.hidden=false;tip.innerHTML=`<button class="text-button" data-action="close-definition" aria-label="Close meaning">×</button><strong>${esc(e.phrase)}</strong> — ${esc(e.meaning)}`;}
    }
    if(action==='close-definition')$('#definition-tip').hidden=true;
  });
  document.addEventListener('change', event=>{
    const el=event.target;
    if(el.id==='lesson-select'){go('overview',el.value);return;}
    if(!lesson)return;
    if(el.dataset.known){state.known=state.known.filter(id=>id!==el.dataset.known);if(el.checked)state.known.push(el.dataset.known);save();$('.section-head .muted').textContent=`${lesson.expressions.length} expressions · ${state.known.length} marked as learned`;}
    if(el.name==='answer'){const id=quizIds[state.quizIndex];state.practice[id]={value:el.value,checked:false};save();$('#practice-form button[type="submit"]').disabled=false;}
    if(el.id==='toggle-highlights'){highlights=el.checked;render();$('#toggle-highlights').focus();}
  });
  document.addEventListener('input', event=>{
    const id=event.target.dataset.dialogue;
    if(id){state.dialogue[id]={value:event.target.value,checked:false};save();}
  });
  document.addEventListener('submit', event=>{
    if(event.target.id==='practice-form'){
      event.preventDefault();const q=questionById(quizIds[state.quizIndex]);const chosen=new FormData(event.target).get('answer');if(!chosen)return;
      state.practice[q.id]={value:chosen,checked:true};save();render();$('.feedback')?.scrollIntoView({block:'nearest'});announce(isCorrect(q,state.practice[q.id])?'Correct. '+q.explanation:'The answer is '+q.answer+'. '+q.explanation);$('[data-action="next-question"]')?.focus({preventScroll:true});
    }
    if(event.target.id==='dialogue-form'){
      event.preventDefault();
      for(const input of event.target.querySelectorAll('[data-dialogue]')){
        if(!normal(input.value)){input.setCustomValidity('Please enter an expression.');input.reportValidity();input.setCustomValidity('');return;}
      }
      event.target.querySelectorAll('[data-dialogue]').forEach(input=>{state.dialogue[input.dataset.dialogue]={value:input.value,checked:true};});
      save();render();announce(`${stats().dialogue} of ${lesson.dialogue.lines.filter(l=>l.answer).length} blanks correct.`);main.focus({preventScroll:true});
    }
  });
  $('#reset-progress').addEventListener('click',()=>{if(lesson)$('#reset-dialog').showModal();});
  $('#reset-dialog').addEventListener('close',()=>{
    if($('#reset-dialog').returnValue!=='reset')return;
    state=emptyState();quizIds=lesson.practice.questions.map(q=>q.id);showQuizResult=false;save();render(true);announce('Progress reset for this lesson.');
  });
  window.addEventListener('hashchange',()=>{if(catalog)loadRoute();});
  (async()=>{
    try{
      catalog=await jsonFile('data/lessons.json');
      if(catalog.schemaVersion!==1||!Array.isArray(catalog.lessons)||!catalog.lessons.length)throw new Error('Add at least one lesson to data/lessons.json.');
      $('#lesson-select').innerHTML=catalog.lessons.map(l=>`<option value="${esc(l.id)}">Lesson ${esc(l.number)} · ${esc(l.title)}</option>`).join('');
      await loadRoute();
    }catch(error){showError(error);}
  })();
})();
