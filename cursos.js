// ════════════════════════════════════════════
// Cursos — Dynamic Course Player
// ════════════════════════════════════════════
"use strict";

function showToast(msg, type) {
  var toast = document.createElement('div');
  toast.textContent = msg;
  toast.style.cssText = 'position:fixed;bottom:1.5rem;right:1.5rem;padding:.7rem 1.3rem;border-radius:8px;font-size:.85rem;font-weight:600;color:#fff;z-index:9999;transition:opacity .4s;box-shadow:0 4px 16px rgba(0,0,0,.2);background:' + (type === 'red' ? '#B51E23' : type === 'green' ? '#16a34a' : '#333');
  document.body.appendChild(toast);
  setTimeout(function() { toast.style.opacity = '0'; setTimeout(function() { toast.remove(); }, 400); }, 3000);
}

const API = '/PHP_DEC2/api/cursos';

let LESSONS = [];
let MOD_START = [];
let completed = [];
let currentIdx = 0;
let fileSelected = false;
let playing = false, seekW = 0, timer = null;
const answers = {};
let quizCorrect = {};
let CURRENT_CURSO_ID = 0;
let USER_ROLE = '';

function saveAvance(claseId, completada, calificacion) {
  return fetch(API + '/avance_guardar.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clase_id: claseId, completada: completada, calificacion: calificacion || null })
  }).catch(function(e) { console.warn('Error guardando avance:', e); });
}

async function loadAvance(cursoId) {
  try {
    var res = await fetch(API + '/avance_listar.php?curso_id=' + cursoId);
    var json = await res.json();
    if (json.success && json.data) {
      var claseMap = {};
      LESSONS.forEach(function(l) { if (l.claseId) claseMap[l.claseId] = l.i; });
      json.data.forEach(function(av) {
        var idx = claseMap[av.clase_id];
        if (idx !== undefined && av.completada) {
          completed[idx] = true;
        }
      });
    }
  } catch (e) { console.warn('Error cargando avance:', e); }
}

// ── INIT ──
async function init() {
  const params = new URLSearchParams(window.location.search);
  const cursoId = params.get('id') || params.get('curso_id') || 1;
  CURRENT_CURSO_ID = parseInt(cursoId);

  const [cRes, mRes] = await Promise.all([
    fetch(`${API}/listar.php?tipo=cursos&id=${cursoId}`),
    fetch(`${API}/listar.php?tipo=modulos&curso_id=${cursoId}`),
  ]);

  const cJson = await cRes.json();
  if (!cJson.success) { document.body.innerHTML = '<p style="color:#fff;padding:2rem;font-family:sans-serif">Curso no encontrado</p>'; return; }
  const curso = cJson.data;
  const mJson = await mRes.json();
  const modulos = mJson.success ? mJson.data : [];

  document.getElementById('tbCourseName').textContent = curso.titulo;
  document.title = curso.titulo + ' – DEC COLITUR';

  fetch('/PHP_DEC2/api/auth/me.php').then(function(r){ return r.json(); }).then(function(d){
    if (d.success && (d.user || d.usuario)) {
      var u = d.user || d.usuario;
      USER_ROLE = u.rol || '';
      var ini = ((u.nombres||'')[0]||'') + ((u.apellidos||'')[0]||'');
      document.getElementById('tbAvatar').textContent = ini.toUpperCase() || '--';
      if (USER_ROLE === 'admin') {
        document.querySelectorAll('.lesson-item').forEach(function(li) { li.classList.remove('item-locked'); });
        document.querySelectorAll('.module-header').forEach(function(mh) { mh.classList.remove('mod-locked'); });
      } else {
        var matItem = document.getElementById('matriculadosItem');
        if (matItem) matItem.style.display = 'none';
      }
    }
  }).catch(function(){});

  const lessons = [];
  const modStart = [];

  for (const mod of modulos) {
    modStart.push(lessons.length);
    const clRes = await fetch(`${API}/listar.php?tipo=clases&modulo_id=${mod.id}`);
    const clJson = await clRes.json();
    const clases = clJson.success ? clJson.data : [];

    for (let ci = 0; ci < clases.length; ci++) {
      const cl = clases[ci];
      const t = cl.tipo_contenido || 'video';
      const type = t === 'quiz' ? 'quiz' : t === 'trabajo' ? 'work' : 'video';

      let preguntas = [];
      if (type === 'quiz' && cl.id) {
        try {
          const pRes = await fetch(`${API}/preguntas_listar.php?clase_id=${cl.id}`);
          const pJson = await pRes.json();
          preguntas = pJson.success ? pJson.data : [];
        } catch (e) {}
      }

      lessons.push({
        i: lessons.length,
        mod: modulos.indexOf(mod),
        type,
        title: cl.titulo,
        dur: cl.duracion || '',
        modLabel: escHtml(mod.titulo) + ' · Lección ' + (ci + 1),
        desc: cl.descripcion || '',
        desc2: '',
        meta: type === 'quiz' ? 'Cuestionario' : '',
        video: '',
        documento: '',
        preguntas,
        claseId: cl.id,
      });
    }
  }

  LESSONS = lessons;
  MOD_START = modStart;
  completed = new Array(LESSONS.length).fill(false);
  currentIdx = 0;

  await loadAvance(CURRENT_CURSO_ID);

  renderSyllabus(modulos);
  renderSidebar(curso);
  recalcProgress();
  if (LESSONS.length > 0) loadLesson(0);
}

function escHtml(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// ── SYLLABUS ──
function renderSyllabus(modulos) {
  const syl = document.querySelector('.syllabus');
  const header = syl.querySelector('.syl-header');
  syl.innerHTML = '';
  syl.appendChild(header);

  modulos.forEach((mod, mi) => {
    const modLessons = LESSONS.filter(l => l.mod === mi);
    const group = document.createElement('div');
    group.className = 'module-group';
    const svgs = {
      video: '<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>',
      quiz: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
      work: '<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>',
    };
    group.innerHTML =
      '<div class="module-header' + (mi > 0 ? ' mod-locked' : ' expanded') + '" id="mh-' + mi + '" onclick="toggleModule(' + mi + ')">' +
        '<div class="mod-left">' +
          '<div class="mod-ico" id="mi-' + mi + '"></div>' +
          '<div><div class="mod-name">' + escHtml(mod.titulo) + '</div><div class="mod-meta" id="mm-' + mi + '">' + modLessons.length + ' sesiones' + (mi > 0 ? ' · 🔒 Bloqueado' : '') + '</div></div>' +
        '</div>' +
        '<div class="mod-arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg></div>' +
      '</div>' +
      '<div class="lessons-list' + (mi === 0 ? ' open' : '') + '" id="ml-' + mi + '">' +
        modLessons.map(l => {
          const typeLabels = { video: 'Video', quiz: 'Cuestionario', work: 'Trabajo' };
          const typeLabel = typeLabels[l.type] || 'Video';
          const dur = l.dur ? typeLabel + ' · ' + l.dur : typeLabel;
          return '<div class="lesson-item' + (l.i > 0 ? ' item-locked' : '') + '" id="li-' + l.i + '" onclick="loadLesson(' + l.i + ')">' +
            '<div class="lesson-ico ' + l.type + '" id="lico-' + l.i + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' + svgs[l.type] + '</svg></div>' +
            '<div class="lesson-info"><div class="lesson-name">' + escHtml(l.title) + '</div><div class="lesson-dur">' + dur + '</div></div>' +
            '<div class="lesson-check" id="lchk-' + l.i + '" style="display:none"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg></div>' +
          '</div>';
        }).join('') +
      '</div>';
    syl.appendChild(group);
  });
}

// ── SIDEBAR ──
function renderSidebar(curso) {
  if (curso.docente_nombre) {
    const avatar = document.getElementById('instrAvatar');
    const name = document.getElementById('instrName');
    const role = document.getElementById('instrRole');
    const bio = document.getElementById('instrBio');
    if (avatar) avatar.textContent = curso.docente_nombre.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    if (name) name.textContent = curso.docente_nombre;
    if (role) role.textContent = curso.docente_profesion || '';
    if (bio) bio.textContent = curso.docente_descripcion || '';
  }

  const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || '--'; };
  setTxt('detDuracion', curso.duracion);
  setTxt('detLecciones', (curso.cantidad_sesiones || LESSONS.length) + ' sesiones');
  setTxt('detNivel', curso.nivel);
  setTxt('detCertificado', curso.certificacion === 'Sí' ? 'Al completar' : (curso.certificacion || 'No'));
  setTxt('detMatriculados', (curso.matriculados || 0) + ' estudiantes');

  renderMateriales();
}

function renderMateriales() {
  const container = document.getElementById('materialesContainer');
  if (!container) return;
  const docs = LESSONS.filter(l => l.documento);
  if (docs.length === 0) {
    container.innerHTML = '<div style="padding:0.5rem 0;color:var(--muted);font-size:0.82rem">No hay materiales descargables disponibles.</div>';
    return;
  }
  container.innerHTML = docs.map(l => {
    const ext = l.documento.split('.').pop().toUpperCase();
    const isLink = l.documento.startsWith('http');
    const iconClass = isLink ? 'link' : 'pdf';
    const label = isLink ? 'Enlace externo' : ext + ' · ' + l.title;
    return '<div class="resource-item" onclick="window.open(\'' + l.documento + '\',\'_blank\')" style="cursor:pointer">' +
      '<div class="res-icon ' + iconClass + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>' +
      '<div><div class="res-name">' + escHtml(l.title) + '</div><div class="res-size">' + label + '</div></div></div>';
  }).join('');
}

// ── UNLOCK LOGIC ──
function isUnlocked(i) {
  if (USER_ROLE === 'admin') return true;
  if (i === 0) return true;
  return completed[i - 1] === true;
}
function isModUnlocked(mod) {
  return isUnlocked(MOD_START[mod]);
}

// ── PROGRESS ──
function recalcProgress() {
  const total = LESSONS.length;
  if (!total) return;
  const done = completed.filter(Boolean).length;
  const pct = Math.round(done / total * 100);

  document.getElementById('tbFill').style.width = pct + '%';
  document.getElementById('tbPct').textContent = pct + '%';

  const vids = LESSONS.filter(l => l.type === 'video');
  const quizs = LESSONS.filter(l => l.type === 'quiz');
  const works = LESSONS.filter(l => l.type === 'work');
  const vidDone = vids.filter(l => completed[l.i]).length;
  const quizDone = quizs.filter(l => completed[l.i]).length;
  const workDone = works.filter(l => completed[l.i]).length;

  document.getElementById('sylFill').style.width = pct + '%';
  document.getElementById('sylTxt').textContent = done + '/' + total + ' lecciones';

  document.getElementById('progVids').textContent = vidDone + '/' + vids.length;
  document.getElementById('progVidsBar').style.width = Math.round(vidDone / vids.length * 100) + '%';
  document.getElementById('progQuizzes').textContent = quizDone + '/' + quizs.length;
  document.getElementById('progQuizzesBar').style.width = Math.round(quizDone / quizs.length * 100) + '%';
  document.getElementById('progWorks').textContent = workDone + '/' + works.length;
  document.getElementById('progWorksBar').style.width = Math.round(workDone / works.length * 100) + '%';
  document.getElementById('progPctLabel').textContent = pct + '%';

  for (let i = 0; i < LESSONS.length; i++) {
    const li = document.getElementById('li-' + i);
    if (!li) continue;
    if (isUnlocked(i)) li.classList.remove('item-locked');
    else li.classList.add('item-locked');
    const chk = document.getElementById('lchk-' + i);
    if (chk) chk.style.display = completed[i] ? 'block' : 'none';
  }

  for (let m = 0; m < MOD_START.length; m++) {
    const mh = document.getElementById('mh-' + m);
    const mm = document.getElementById('mm-' + m);
    const mi = document.getElementById('mi-' + m);
    if (!mh) continue;
    const modLessons = LESSONS.filter(l => l.mod === m);
    const modDone = modLessons.filter(l => completed[l.i]).length;
    const unlocked = isModUnlocked(m);

    if (unlocked) mh.classList.remove('mod-locked');
    else mh.classList.add('mod-locked');

    if (modDone === modLessons.length && modDone > 0) {
      if (mi) mi.className = 'mod-ico done';
      if (mm) mm.textContent = modLessons.length + ' sesiones · Completado';
    } else if (modDone > 0 || (unlocked && modDone < modLessons.length)) {
      if (mi) mi.className = 'mod-ico active';
      if (mm) mm.textContent = modLessons.length + ' sesiones · En progreso';
    } else if (unlocked) {
      if (mi) mi.className = 'mod-ico active';
      if (mm) mm.textContent = modLessons.length + ' sesiones · Por iniciar';
    } else {
      if (mi) mi.className = 'mod-ico';
      if (mm) mm.textContent = modLessons.length + ' sesiones · 🔒 Bloqueado';
    }
  }
}

// ── MODULE TOGGLE ──
function toggleModule(mod) {
  const mh = document.getElementById('mh-' + mod);
  if (mh.classList.contains('mod-locked')) {
    showView('locked');
    document.querySelectorAll('.lesson-item').forEach(l => l.classList.remove('active'));
    document.getElementById('lockedMsg').textContent = 'Completa el módulo anterior para desbloquear este contenido.';
    return;
  }
  const list = document.getElementById('ml-' + mod);
  mh.classList.toggle('expanded');
  list.classList.toggle('open');
}

// ── SHOW VIEW ──
function showView(type) {
  ['video', 'quiz', 'work', 'locked'].forEach(v => {
    document.getElementById('view-' + v).style.display = 'none';
  });
  const el = document.getElementById('view-' + type);
  if (el) el.style.display = (type === 'video') ? 'flex' : (type === 'quiz' || type === 'work') ? 'block' : 'flex';
}

// ── LOAD LESSON ──
function loadLesson(i) {
  if (!isUnlocked(i)) {
    showView('locked');
    document.querySelectorAll('.lesson-item').forEach(l => l.classList.remove('active'));
    document.getElementById('lockedMsg').textContent = 'Completa la lección anterior para desbloquear este contenido.';
    return;
  }
  stopVideo();
  currentIdx = i;
  const lesson = LESSONS[i];
  if (!lesson) return;

  document.querySelectorAll('.lesson-item').forEach(l => l.classList.remove('active'));
  const li = document.getElementById('li-' + i);
  if (li) li.classList.add('active');

  const mh = document.getElementById('mh-' + lesson.mod);
  const ml = document.getElementById('ml-' + lesson.mod);
  if (mh && !mh.classList.contains('expanded')) {
    mh.classList.add('expanded');
    ml.classList.add('open');
  }

  showView(lesson.type);
  if (lesson.type === 'video') renderVideo(lesson);
  else if (lesson.type === 'quiz') renderQuiz(lesson);
  else if (lesson.type === 'work') renderWork(lesson);
}

// ── VIDEO ──
function renderVideo(lesson) {
  document.getElementById('videoLabel').textContent = lesson.title + ' — ' + lesson.dur;
  document.getElementById('videoOverlay').textContent = lesson.modLabel || '';
  document.getElementById('lessonTitle').textContent = lesson.title;
  document.getElementById('lessonDesc').textContent = lesson.desc || '';
  const d2 = document.getElementById('lessonDesc2');
  d2.textContent = lesson.desc2 || '';
  d2.style.display = lesson.desc2 ? 'block' : 'none';

  seekW = 0;
  document.getElementById('seekFill').style.width = '0%';
  const total = parseDur(lesson.dur);
  const dm = String(Math.floor(total / 60)).padStart(2, '0');
  const ds = String(total % 60).padStart(2, '0');
  document.getElementById('timeLabel').textContent = '00:00 / ' + dm + ':' + ds;

  const btn = document.getElementById('markDoneBtn');
  if (completed[lesson.i]) {
    btn.textContent = '✓ Lección completada';
    btn.disabled = true;
  } else {
    btn.textContent = 'Marcar como completada →';
    btn.disabled = false;
  }
}

function parseDur(str) {
  if (!str) return 0;
  const p = str.split(':');
  return parseInt(p[0]) * 60 + (parseInt(p[1]) || 0);
}

function stopVideo() {
  playing = false;
  if (timer) { clearInterval(timer); timer = null; }
  const big = document.getElementById('playBigBtn');
  const ctrl = document.getElementById('playPauseBtn');
  if (big) big.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
  if (ctrl) ctrl.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
}

function togglePlay(el) {
  playing = !playing;
  const pauseIcon = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
  const playIcon = '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
  el.innerHTML = playing ? pauseIcon : playIcon;
  const ctrl = document.getElementById('playPauseBtn');
  ctrl.innerHTML = playing
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
  if (playing) simulateProgress(); else { if (timer) clearInterval(timer); }
}

function togglePlayCtrl() { togglePlay(document.getElementById('playBigBtn')); }

function simulateProgress() {
  if (timer) clearInterval(timer);
  const lesson = LESSONS[currentIdx];
  const totalSecs = parseDur(lesson.dur || '19:00');
  timer = setInterval(() => {
    if (!playing) { clearInterval(timer); return; }
    seekW = Math.min(seekW + 0.3, 100);
    document.getElementById('seekFill').style.width = seekW + '%';
    const curr = Math.floor(seekW / 100 * totalSecs);
    const m = String(Math.floor(curr / 60)).padStart(2, '0');
    const s = String(curr % 60).padStart(2, '0');
    const dm = String(Math.floor(totalSecs / 60)).padStart(2, '0');
    const ds = String(totalSecs % 60).padStart(2, '0');
    document.getElementById('timeLabel').textContent = m + ':' + s + ' / ' + dm + ':' + ds;
    if (seekW >= 100) { clearInterval(timer); playing = false; }
  }, 200);
}

function markVideoDone() {
  const lesson = LESSONS[currentIdx];
  if (lesson.type !== 'video' || completed[lesson.i]) return;
  completed[lesson.i] = true;
  if (lesson.claseId) saveAvance(lesson.claseId, 1, null);
  const btn = document.getElementById('markDoneBtn');
  btn.textContent = '✓ Lección completada';
  btn.disabled = true;
  recalcProgress();
  const next = lesson.i + 1;
  if (next < LESSONS.length) setTimeout(() => loadLesson(next), 600);
}

function navigateLesson(dir) {
  const next = currentIdx + dir;
  if (next >= 0 && next < LESSONS.length && isUnlocked(next)) loadLesson(next);
}

function goToFirstUnlocked() {
  for (let i = 0; i < LESSONS.length; i++) {
    if (isUnlocked(i) && !completed[i]) { loadLesson(i); return; }
  }
  loadLesson(0);
}

// ── QUIZ ──
function renderQuiz(lesson) {
  document.getElementById('quizTitle').textContent = lesson.title;
  document.getElementById('quizMeta').textContent = lesson.meta || '';
  resetQuiz();

  const container = document.getElementById('quiz-questions');
  const preguntas = lesson.preguntas || [];

  if (preguntas.length === 0) {
    container.innerHTML = '<p style="color:var(--muted);padding:1rem 0">Este cuestionario no tiene preguntas configuradas.</p>';
    const btn = document.getElementById('submitQuizBtn');
    btn.textContent = '✓ Aprobado';
    btn.disabled = true;
    return;
  }

  // Build quizCorrect map
  quizCorrect = {};
  preguntas.forEach((p, pi) => {
    const correcta = (p.opciones || []).findIndex(o => o.es_correcta == 1);
    quizCorrect['q' + pi] = String.fromCharCode(97 + correcta);
  });

  container.innerHTML = preguntas.map((p, pi) => {
    const qid = 'q' + pi;
    return '<div class="question" id="' + qid + '">' +
      '<div class="q-text">' + (pi + 1) + '. ' + escHtml(p.texto) + '</div>' +
      '<div class="q-options">' +
      (p.opciones || []).map((o, oi) => {
        const letters = ['a', 'b', 'c', 'd', 'e', 'f'];
        return '<div class="q-option" onclick="selectOption(this,\'' + qid + '\',\'' + letters[oi] + '\')">' +
          '<div class="q-radio"></div>' + escHtml(o.texto) +
          '</div>';
      }).join('') +
      '</div></div>';
  }).join('');

  const btn = document.getElementById('submitQuizBtn');
  if (completed[lesson.i]) {
    btn.textContent = '✓ Aprobado — Reintentar';
  } else {
    btn.textContent = 'Enviar respuestas';
  }
}

function selectOption(el, qid, opt) {
  document.getElementById(qid).querySelectorAll('.q-option').forEach(o => {
    o.classList.remove('selected');
    const r = o.querySelector('.q-radio');
    if (r) r.style.background = '';
  });
  el.classList.add('selected');
  answers[qid] = opt;
}

function submitQuiz() {
  const preguntas = LESSONS[currentIdx].preguntas || [];
  const total = preguntas.length;
  if (Object.keys(answers).length < total) { alert('Por favor responde todas las preguntas.'); return; }
  let score = 0;
  preguntas.forEach((p, pi) => {
    const qid = 'q' + pi;
    const question = document.getElementById(qid);
    if (!question) return;
    const opts = question.querySelectorAll('.q-option');
    const letters = ['a', 'b', 'c', 'd', 'e', 'f'];
    opts.forEach((opt, i) => {
      opt.classList.remove('selected', 'correct', 'wrong');
      if (letters[i] === quizCorrect[qid]) opt.classList.add('correct');
      else if (answers[qid] === letters[i] && answers[qid] !== quizCorrect[qid]) opt.classList.add('wrong');
    });
    if (answers[qid] === quizCorrect[qid]) score++;
  });
  const pct = Math.round(score / total * 100);
  const passed = pct >= 70;
  const result = document.getElementById('quiz-result');
  result.style.display = 'block';
  result.innerHTML = '<div style="background:' + (passed ? 'var(--green-bg)' : 'rgba(181,30,35,.08)') + ';border-radius:var(--radius);padding:1rem 1.2rem;border:1px solid ' + (passed ? 'rgba(22,163,74,.3)' : 'rgba(181,30,35,.2)') + '">' +
    '<div style="font-size:1rem;font-weight:600;color:' + (passed ? 'var(--green)' : 'var(--red)') + '">' +
    (passed ? '✓ ¡Aprobado!' : '✗ No aprobado') + ' — ' + pct + '/100</div>' +
    '<div style="font-size:.82rem;color:var(--muted);margin-top:.3rem">' + score + ' de ' + total + ' correctas. ' + (passed ? 'Excelente, puedes continuar.' : 'Revisa el material y vuelve a intentarlo.') + '</div></div>';

  if (passed && !completed[currentIdx]) {
    completed[currentIdx] = true;
    var lesson = LESSONS[currentIdx];
    if (lesson.claseId) saveAvance(lesson.claseId, 1, pct);
    document.getElementById('submitQuizBtn').textContent = '✓ Aprobado — Reintentar';
    recalcProgress();
    const next = currentIdx + 1;
    if (next < LESSONS.length) setTimeout(() => loadLesson(next), 900);
  }
}

function resetQuiz() {
  Object.keys(answers).forEach(k => delete answers[k]);
  document.querySelectorAll('.q-option').forEach(o => o.classList.remove('selected', 'correct', 'wrong'));
  const r = document.getElementById('quiz-result');
  if (r) r.style.display = 'none';
}

// ── WORK ──
let currentWorkData = null;

function renderFilePreview(fileUrl, prefix) {
  if (!fileUrl) return;
  var proxyUrl = 'api/ver_archivo.php?file=' + encodeURIComponent(fileUrl);
  var ext = fileUrl.split('.').pop().toLowerCase().split('?')[0];

  var viewerEl = document.getElementById(prefix + 'FileViewer');
  var frameEl = document.getElementById(prefix + 'Frame');
  var noPrevEl = document.getElementById(prefix + 'NoPreview');
  var nameEl = document.getElementById(prefix + 'FileName');
  var downloadBtn = document.getElementById(prefix + 'DownloadBtn');
  var downloadLink = document.getElementById(prefix + 'DownloadLink2');
  var labelEl = document.getElementById(prefix + 'FileLabel');

  if (!viewerEl) return;
  viewerEl.style.display = 'block';

  var parts = fileUrl.split('/');
  var lastPart = parts[parts.length - 1];
  var underScoreIdx = lastPart.indexOf('_');
  var displayName = underScoreIdx > -1 ? lastPart.substring(underScoreIdx + 1) : lastPart;
  if (nameEl) nameEl.textContent = displayName;
  if (labelEl) labelEl.textContent = 'Tu archivo enviado — ' + displayName;

  if (downloadBtn) downloadBtn.href = proxyUrl;
  if (downloadLink) downloadLink.href = proxyUrl;

  if (ext === 'pdf') {
    if (frameEl) { frameEl.src = proxyUrl; frameEl.style.display = 'block'; }
    if (noPrevEl) noPrevEl.style.display = 'none';
  } else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].indexOf(ext) > -1) {
    if (frameEl) { frameEl.src = proxyUrl; frameEl.style.display = 'block'; }
    if (noPrevEl) noPrevEl.style.display = 'none';
  } else {
    if (frameEl) frameEl.style.display = 'none';
    if (noPrevEl) noPrevEl.style.display = 'block';
  }
}

async function renderWork(lesson) {
  document.getElementById('workTitle').textContent = '📤 ' + lesson.title;

  var descHtml = lesson.desc || '';
  descHtml = descHtml.replace(/<br\s*\/?>/gi, '<br>');
  document.getElementById('workDesc').innerHTML = descHtml || '<em style="color:var(--muted)">Sin descripción.</em>';

  fileSelected = false;
  document.getElementById('fileSelectedName').textContent = '';
  document.getElementById('fileInput').value = '';

  var submitBtn = document.getElementById('submitWorkBtn');
  var uploadSection = document.getElementById('uploadSection');
  var sentCard = document.getElementById('workSentCard');
  var gradedCard = document.getElementById('workGradedCard');
  var instructionsCard = document.getElementById('workInstructionsCard');

  if (instructionsCard) instructionsCard.style.display = 'none';
  if (gradedCard) gradedCard.style.display = 'none';

  if (lesson.claseId) {
    try {
      var res = await fetch(API + '/trabajo_estado.php?clase_id=' + lesson.claseId);
      var json = await res.json();
      if (json.success && json.enviado && json.data) {
        currentWorkData = json.data;
        uploadSection.style.display = 'none';
        sentCard.style.display = 'none';
        completed[lesson.i] = true;
        if (json.data.calificacion !== null && gradedCard) {
          document.getElementById('gradedNota').textContent = json.data.calificacion + '/20';
          document.getElementById('gradedFeedback').textContent = json.data.comentario || 'Sin retroalimentación.';
          var gradedDate = new Date(json.data.fecha);
          document.getElementById('gradedDate').textContent = 'Entregado el ' + gradedDate.toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });
          var gradeCircle = document.getElementById('gradedCircle');
          if (gradeCircle) {
            var nota = parseFloat(json.data.calificacion);
            gradeCircle.textContent = nota;
            gradeCircle.className = 'grade-circle ' + (nota >= 14 ? 'high' : nota >= 11 ? 'mid' : 'low');
          }
          if (json.data.archivo) renderFilePreview(json.data.archivo, 'graded');
          gradedCard.style.display = 'block';
        } else {
          if (json.data.archivo) renderFilePreview(json.data.archivo, 'student');
          sentCard.style.display = 'block';
        }
      } else if (completed[lesson.i]) {
        uploadSection.style.display = 'block';
        sentCard.style.display = 'none';
        submitBtn.disabled = true;
        submitBtn.style.opacity = '.5';
        submitBtn.style.cursor = 'not-allowed';
      } else {
        uploadSection.style.display = 'block';
        sentCard.style.display = 'none';
        submitBtn.disabled = true;
        submitBtn.style.opacity = '.5';
        submitBtn.style.cursor = 'not-allowed';
      }
    } catch (e) {
      uploadSection.style.display = 'none';
      sentCard.style.display = 'block';
    }
  } else {
    uploadSection.style.display = 'block';
    sentCard.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.style.opacity = '.5';
    submitBtn.style.cursor = 'not-allowed';
  }
}

function handleFileSelect(input) {
  if (input.files && input.files[0]) {
    fileSelected = true;
    document.getElementById('fileSelectedName').textContent = '📎 ' + input.files[0].name;
    const btn = document.getElementById('submitWorkBtn');
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.style.cursor = 'pointer';
  }
}

async function submitWork() {
  if (!fileSelected) return;
  if (!confirm('¿Confirmas el envío de tu trabajo?')) return;

  var lesson = LESSONS[currentIdx];
  var fileInput = document.getElementById('fileInput');
  var file = fileInput.files[0];
  if (!file) return;

  var submitBtn = document.getElementById('submitWorkBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Subiendo archivo...';
  submitBtn.style.opacity = '.5';

  try {
    var formData = new FormData();
    formData.append('clase_id', lesson.claseId);
    formData.append('archivo', file);

    var uploadRes = await fetch(API + '/trabajo_upload.php', {
      method: 'POST',
      body: formData
    });
    console.log('Upload status:', uploadRes.status);
    var uploadText = await uploadRes.text();
    console.log('Upload response:', uploadText);
    var uploadJson = JSON.parse(uploadText);

    if (!uploadJson.success) {
      showToast('Error al guardar: ' + uploadJson.message, 'red');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Enviar trabajo';
      submitBtn.style.opacity = '1';
      return;
    }

    completed[currentIdx] = true;
    if (lesson.claseId) await saveAvance(lesson.claseId, 1, null);
    document.getElementById('uploadSection').style.display = 'none';
    document.getElementById('workSentCard').style.display = 'block';
    recalcProgress();
    showToast('Trabajo enviado correctamente ✓', 'green');

    var next = currentIdx + 1;
    if (next < LESSONS.length) setTimeout(function() { loadLesson(next); }, 900);
  } catch (e) {
    console.error('Error subiendo trabajo:', e);
    showToast('Error al subir el archivo. Intenta de nuevo.', 'red');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Enviar trabajo';
    submitBtn.style.opacity = '1';
  }
}

init();
