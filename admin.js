/* ========================================
   DEC COLITUR — admin.js
   Panel administrativo conectado a PHP API
   ======================================== */

const API_AUTH = '/PHP_DEC2/api/auth';
const API_CURSOS = '/PHP_DEC2/api/cursos';
const API_ADMIN = '/PHP_DEC2/api/admin';

let cursosData = [];
let usuariosData = [];
let categoriasData = [];
let docentesData = [];
let matriculasData = [];
let trabajosData = [];
let editingCursoId = null;
let filterText = '';
let filterStatus = '';
let currentTrabajoId = null;

/* ══════════════════════════════════════════
   AUTH CHECK
   ══════════════════════════════════════════ */
fetch(`${API_AUTH}/me.php`)
    .then(r => r.json())
    .then(data => {
        if (!data.success || data.usuario.rol !== 'admin') {
            window.location.href = 'index.html';
            return;
        }
        const u = data.usuario;
        document.getElementById('sbAvatar').textContent = (u.nombres?.charAt(0) || '') + (u.apellidos?.charAt(0) || '');
        document.getElementById('sbNombre').textContent = u.nombres + ' ' + u.apellidos;
        document.getElementById('sbRol').textContent = 'Administrador';
        initAdmin();
    })
    .catch(() => { window.location.href = 'index.html'; });

/* ══════════════════════════════════════════
   INIT
   ══════════════════════════════════════════ */
async function initAdmin() {
    await Promise.all([
        cargarDashboard(),
        cargarCursos(),
        cargarUsuarios(),
        cargarCategorias(),
        cargarDocentes(),
        cargarMatriculas(),
        cargarReportes(),
        cargarCertificados(),
        cargarCertEstudiantes(),
    ]);
    renderCourses();
    renderUsers();
    renderMatriculas();
    await loadClasesData();
    renderClasesCursoList();
    renderCerts();
    populateConfigSelects();
    await cargarTrabajos();
    populateTrabajosFilter();
}

/* ══════════════════════════════════════════
   NAVIGATION
   ══════════════════════════════════════════ */
function nav(id) {
    document.querySelectorAll('.pg').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.sb-a').forEach(l => l.classList.remove('active'));
    document.getElementById('pg-' + id)?.classList.add('active');
    const link = document.querySelector(`[data-page="${id}"]`);
    if (link) link.classList.add('active');
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('sbOverlay')?.classList.remove('open');
    window.scrollTo(0, 0);
    if (id === 'cursos') renderCourses();
    if (id === 'contenido') renderClasesCursoList();
    if (id === 'certificados') { renderCerts(); cargarCertificados(); }
    if (id === 'usuarios') renderUsers();
    if (id === 'matriculas') renderMatriculas();
    if (id === 'trabajos') cargarTrabajos();
    if (id === 'reportes') cargarReportes();
}

/* ══════════════════════════════════════════
   TOAST
   ══════════════════════════════════════════ */
let toastTimer;
function showToast(msg, type = '') {
    const t = document.getElementById('toast');
    const m = document.getElementById('toastMsg');
    if (!t || !m) return;
    t.className = 'toast' + (type ? ' toast-' + type : '');
    m.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}

/* ══════════════════════════════════════════
   MODAL HELPERS
   ══════════════════════════════════════════ */
function openModal(id) {
    const el = typeof id === 'string' ? document.getElementById(id) : id;
    if (!el) return;
    el.classList.add('open');
    document.body.style.overflow = 'hidden';
}
function closeModal(id) {
    const el = typeof id === 'string' ? document.getElementById(id) : id;
    if (!el) return;
    el.classList.remove('open');
    document.body.style.overflow = '';
}
document.querySelectorAll('.modal-overlay').forEach(el => {
    el.addEventListener('click', function (e) { if (e.target === this) closeModal(this.id); });
});

function confirmAction(title, msg, onConfirm) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMsg').textContent = msg || 'Esta acción no se puede deshacer.';
    document.getElementById('confirmOkBtn').onclick = () => { closeModal('confirmModal'); onConfirm(); };
    openModal('confirmModal');
}

/* ══════════════════════════════════════════
   DASHBOARD
   ══════════════════════════════════════════ */
async function cargarDashboard() {
    try {
        const res = await fetch(`${API_ADMIN}/dashboard.php`);
        const json = await res.json();
        if (!json.success) return;
        const d = json.data;

        // Stats cards
        const els = document.querySelectorAll('.sc-val');
        if (els[0]) els[0].textContent = d.total_usuarios || 0;
        if (els[1]) els[1].textContent = d.total_matriculas || 0;
        if (els[2]) els[2].textContent = 'S/ ' + (d.ingresos_mes || 0).toFixed(2);
        if (els[3]) els[3].textContent = d.total_certificados || 0;

        // Labels
        const labels = document.querySelectorAll('.sc-label');
        if (labels[0]) labels[0].textContent = 'Usuarios registrados';
        if (labels[1]) labels[1].textContent = 'Matrículas registradas';
        if (labels[2]) labels[2].textContent = 'Ingresos del mes';
        if (labels[3]) labels[3].textContent = 'Certificados emitidos';

        // Trends
        const trends = document.querySelectorAll('.sc-trend');
        if (trends[0]) trends[0].innerHTML = '↑ +' + (d.usuarios_mes || 0) + ' este mes';
        if (trends[1]) trends[1].innerHTML = '↑ +' + (d.matriculas_mes || 0) + ' este mes';
        if (trends[3]) trends[3].innerHTML = '↑ +' + (d.cert_semana || 0) + ' esta semana';

        // Dynamic date
        const now = new Date();
        const monthNames = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
        const dateEl = document.getElementById('dashboardDate');
        if (dateEl) dateEl.textContent = 'Datos actualizados al ' + now.getDate() + ' de ' + monthNames[now.getMonth()] + ', ' + now.getFullYear();

        // Bar chart — always show 4 months ending at current month, fill missing with 0
        const monthShort = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        const chartWrap = document.querySelector('.chart-mock');
        const chartLabels = document.querySelector('.chart-labels');
        const chartTitle = document.getElementById('chartTitleMat');
        if (chartTitle) chartTitle.textContent = 'Matrículas por mes — ' + now.getFullYear();
        if (chartWrap && chartLabels) {
            const currentMonth = now.getMonth(); // 0-indexed
            const monthsToShow = [];
            for (var i = 3; i >= 0; i--) {
                var mIdx = currentMonth - i;
                if (mIdx < 0) mIdx += 12;
                monthsToShow.push(mIdx + 1); // 1-indexed
            }
            const apiData = d.matriculas_por_mes || [];
            const dataMap = {};
            apiData.forEach(function(m) { dataMap[m.mes] = m.total; });
            const maxVal = Math.max.apply(null, monthsToShow.map(function(m) { return dataMap[m] || 0; }).concat([1]));
            chartWrap.innerHTML = monthsToShow.map(function(m) {
                var total = dataMap[m] || 0;
                var pct = Math.round((total / maxVal) * 100);
                var opacity = total > 0 ? (0.5 + (pct / 100) * 0.5) : 0.15;
                return '<div class="bar" style="flex:1;height:' + (total > 0 ? pct : 4) + '%;background:linear-gradient(180deg,var(--red-light),var(--red));opacity:' + opacity.toFixed(2) + '" data-val="' + total + '"></div>';
            }).join('');
            chartLabels.innerHTML = monthsToShow.map(function(m) {
                return '<div class="chart-label">' + monthShort[m - 1] + '</div>';
            }).join('');
        }

        // Matriculas por curso (donut)
        if (d.matriculas_por_curso && d.matriculas_por_curso.length) {
            const donut = document.getElementById('donut-total');
            if (donut) donut.textContent = d.total_matriculas;
            const colors = ['var(--red)', 'var(--navy)', '#f59e0b', '#10b981', '#8b5cf6'];
            const legendWrap = document.querySelector('.donut-legend');
            if (legendWrap) {
                legendWrap.innerHTML = d.matriculas_por_curso.map((item, i) => {
                    const c = colors[i % colors.length];
                    return `<div class="dl-item"><div class="dl-dot" style="background:${c}"></div><span>${escHtml(item.titulo || 'Curso')} — <strong>${item.total}</strong></span></div>`;
                }).join('');
            }
        }

        // Activity list
        if (d.actividad_reciente && d.actividad_reciente.length) {
            const actHtml = d.actividad_reciente.map(a => {
                const iconMap = {
                    'usuario': { cls: 'blue', svg: '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>' },
                    'matricula': { cls: 'green', svg: '<path d="M9 11l3 3L22 4"/>' },
                    'certificado': { cls: 'amber', svg: '<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>' },
                };
                const ic = iconMap[a.tipo] || iconMap['usuario'];
                const fecha = a.fecha ? timeAgo(new Date(a.fecha)) : '';
                return `<div class="act-item"><div class="act-ico ${ic.cls}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${ic.svg}</svg></div><div class="act-body"><strong>${escHtml(a.descripcion)}</strong></div><span class="act-t">${fecha}</span></div>`;
            }).join('');
            const actWrap = document.querySelector('.card .act-item')?.parentElement;
            if (actWrap) actWrap.innerHTML = actHtml;
        }
    } catch (e) {
        console.error('Error dashboard:', e);
    }
}

function timeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return 'Ahora';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return 'Hace ' + minutes + 'min';
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return 'Hace ' + hours + 'h';
    const days = Math.floor(hours / 24);
    return 'Hace ' + days + 'd';
}

/* ══════════════════════════════════════════
   CURSOS — CRUD
   ══════════════════════════════════════════ */
async function cargarCursos() {
    try {
        const res = await fetch(`${API_CURSOS}/listar.php?tipo=admin`);
        const json = await res.json();
        if (json.success) cursosData = json.data;
    } catch (e) { console.error('Error cargando cursos:', e); }
}

function renderCourses() {
    const grid = document.getElementById('courseGrid');
    const noMsg = document.getElementById('noCoursesMsg');
    const label = document.getElementById('courseCountLabel');
    if (!grid) return;

    let filtered = cursosData.filter(c => {
        const txt = filterText.toLowerCase();
        const matchTxt = !txt || c.titulo?.toLowerCase().includes(txt) || (c.docente_nombre || '').toLowerCase().includes(txt) || (c.categoria_nombre || '').toLowerCase().includes(txt);
        const matchSt = !filterStatus || c.estado === filterStatus || (filterStatus === 'published' && c.estado === 'Publicado') || (filterStatus === 'draft' && c.estado === 'Borrador');
        return matchTxt && matchSt;
    });

    if (label) label.textContent = cursosData.length + ' curso(s) en la plataforma';

    if (filtered.length === 0) {
        grid.innerHTML = '';
        if (noMsg) noMsg.style.display = 'block';
        return;
    }
    if (noMsg) noMsg.style.display = 'none';

    grid.innerHTML = filtered.map(c => {
        const pub = c.estado === 'Publicado';
        return `
        <div class="cac" data-id="${c.id}">
            <div class="cac-img" style="background-image:url('${c.imagen || 'curso1.png'}')">
                <div class="cac-img-overlay"></div>
                <div class="cac-status"><span class="badge ${pub ? 'green' : 'amber'}">${pub ? '● Publicado' : '◌ Borrador'}</span></div>
                ${c.badge ? `<div class="cac-drafted"><span class="badge blue">${c.badge}</span></div>` : ''}
            </div>
            <div class="cac-body">
                <div style="font-size:.68rem;color:var(--red);font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:.25rem">${c.categoria_nombre || 'Sin categoría'}</div>
                <div class="cac-title">${escHtml(c.titulo)}</div>
                <div class="cac-meta">
                    <span>💰 ${c.precio ? 'S/ ' + parseFloat(c.precio).toFixed(2) : '—'}</span>
                    <span>📹 ${c.cantidad_sesiones || c.lecciones || 0} sesiones · ${c.duracion || '—'}</span>
                    <span>👨‍🏫 ${c.docente_nombre || '—'}</span>
                    <span>📊 ${c.nivel || '—'}</span>
                </div>
                <div class="cac-actions">
                    <button class="tbl-btn view" onclick="abrirDetalleCurso(${c.id})">Ver detalle</button>
                    ${pub ? `<button class="tbl-btn pub" onclick="window.open('cursos.html?curso_id=${c.id}','_blank')" title="Ver como lo ve el estudiante">Ver publicación</button>` : ''}
                    <button class="tbl-btn edit" onclick="abrirCrudCurso(${c.id})">Editar</button>
                    <button class="tbl-btn ${pub ? 'del' : 'pub'}" onclick="togglePublish(${c.id})">${pub ? 'Despublicar' : 'Publicar'}</button>
                    <button class="tbl-btn del" onclick="confirmDeleteCurso(${c.id})" title="Eliminar">🗑</button>
                </div>
            </div>
        </div>`;
    }).join('');
}

function filterCourses(val) { filterText = val; renderCourses(); }
function filterByStatus(val) { filterStatus = val; renderCourses(); }

async function togglePublish(id) {
    const c = cursosData.find(x => x.id == id);
    if (!c) return;
    const nuevoEstado = c.estado === 'Publicado' ? 'Borrador' : 'Publicado';
    try {
        const res = await fetch(`${API_CURSOS}/actualizar.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, estado: nuevoEstado, titulo: c.titulo, descripcion_breve: c.descripcion_breve || '', descripcion_ampliada: c.descripcion_ampliada || '', aprenderas: c.aprenderas || '', descripcion_curriculum: c.descripcion_curriculum || '', precio: c.precio, categoria_id: c.categoria_id, docente_id: c.docente_id, duracion: c.duracion, cantidad_sesiones: c.cantidad_sesiones || 0, nivel: c.nivel || '', certificacion: c.certificacion || '', badge: c.badge || '', badge_descripcion: c.badge_descripcion || '', imagen: c.imagen || '' })
        });
        const json = await res.json();
        if (json.success) {
            c.estado = nuevoEstado;
            renderCourses();
            showToast(`"${c.titulo}" ${nuevoEstado === 'Publicado' ? 'publicado ✓' : 'despublicado'}`, nuevoEstado === 'Publicado' ? 'green' : '');
        } else showToast('Error: ' + json.message, 'red');
    } catch (e) { showToast('Error de conexión', 'red'); }
}

async function confirmDeleteCurso(id) {
    const c = cursosData.find(x => x.id == id);
    confirmAction(`¿Eliminar "${c?.titulo}"?`, 'Esta acción es permanente.', async () => {
        try {
            const res = await fetch(`${API_CURSOS}/eliminar.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            const json = await res.json();
            if (json.success) {
                cursosData = cursosData.filter(x => x.id != id);
                closeModal('courseDetailModal');
                renderCourses();
                showToast('Curso eliminado', 'red');
            } else showToast('Error: ' + json.message, 'red');
        } catch (e) { showToast('Error de conexión', 'red'); }
    });
}

/* ══════════════════════════════════════════
   CURSO DETALLE MODAL
   ══════════════════════════════════════════ */
async function abrirDetalleCurso(id) {
    const c = cursosData.find(x => x.id == id);
    if (!c) return;
    const pub = c.estado === 'Publicado';

    document.getElementById('cdHero').style.backgroundImage = `url('${c.imagen || 'curso1.png'}')`;
    document.getElementById('cdCat').textContent = c.categoria_nombre || 'General';
    document.getElementById('cdTitle').textContent = c.titulo;
    document.getElementById('cdStatusStrip').innerHTML = `
        <span class="badge ${pub ? 'green' : 'amber'}">${pub ? '● Publicado' : '◌ Borrador'}</span>
        ${c.badge ? `<span class="badge blue">${c.badge}</span>` : ''}
        <span style="font-size:.75rem;color:var(--muted)">ID #${c.id}</span>`;
    document.getElementById('cdDescText').textContent = c.descripcion_breve || '';
    document.getElementById('cdDescExtra').textContent = c.descripcion_ampliada || '';

    const learnItems = (c.aprenderas || '').split('<br>').filter(Boolean);
    document.getElementById('cdLearnList').innerHTML = learnItems.length
        ? learnItems.map(item => `<li>${escHtml(item.trim())}</li>`).join('')
        : '<li style="color:var(--muted)">No hay contenido disponible.</li>';

    document.getElementById('cdCurrDesc').textContent = c.descripcion_curriculum || '';

    document.getElementById('cdPrice').textContent = c.precio ? 'S/ ' + parseFloat(c.precio).toFixed(2) : '—';

    document.getElementById('cdDetails').innerHTML = `
        <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            <div><strong>Instructor:</strong> <span>${c.docente_nombre || '—'}</span></div></li>
        <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <div><strong>Duración:</strong> <span>${c.duracion || '—'}</span></div></li>
        <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/></svg>
            <div><strong>Sesiones:</strong> <span>${c.cantidad_sesiones || c.lecciones || 0}</span></div></li>
        <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>
            <div><strong>Certificación:</strong> <span>${c.certificacion || '—'}</span></div></li>
        <li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            <div><strong>Nivel:</strong> <span>${c.nivel || '—'}</span></div></li>`;

    document.getElementById('cdStats').innerHTML = `
        <div style="display:flex;justify-content:space-between;font-size:.78rem"><span style="color:var(--muted)">Módulos</span><strong>${c.cantidad_modulos || 0}</strong></div>
        <div style="display:flex;justify-content:space-between;font-size:.78rem"><span style="color:var(--muted)">Sesiones totales</span><strong>${c.cantidad_sesiones || 0}</strong></div>
        <div style="display:flex;justify-content:space-between;font-size:.78rem"><span style="color:var(--muted)">Inscritos</span><strong>${c.total_matriculas || 0}</strong></div>`;

    document.getElementById('cdEditBtn').onclick = () => { closeModal('courseDetailModal'); abrirCrudCurso(c.id); };
    const toggleBtn = document.getElementById('cdToggleBtn');
    toggleBtn.textContent = pub ? '🔒 Despublicar' : '✅ Publicar';
    toggleBtn.onclick = async () => { await togglePublish(c.id); closeModal('courseDetailModal'); };
    document.getElementById('cdDelBtn').onclick = () => { closeModal('courseDetailModal'); confirmDeleteCurso(c.id); };

    try {
        const res = await fetch(`${API_CURSOS}/listar.php?tipo=modulos&curso_id=${c.id}`);
        const json = await res.json();
        const mw = document.getElementById('cdModules');
        if (json.success && json.data.length) {
            mw.innerHTML = json.data.map(m => `<div class="cm-module"><span>${escHtml(m.titulo || m.nombre)}</span><span>${m.sesiones || ''} sesiones</span></div>`).join('');
        } else {
            mw.innerHTML = '<p style="color:var(--muted);font-size:.85rem">Sin módulos aún.</p>';
        }
    } catch (e) { console.error(e); }

    document.querySelectorAll('#courseDetailModal .cm-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('#courseDetailModal .cm-panel').forEach(p => p.classList.remove('active'));
    document.querySelector('#courseDetailModal .cm-tab')?.classList.add('active');
    document.getElementById('cdDesc')?.classList.add('active');

    openModal('courseDetailModal');
}
function switchCmTab(panelId, btn) {
    const modal = btn.closest('.modal-box');
    modal.querySelectorAll('.cm-tab').forEach(t => t.classList.remove('active'));
    modal.querySelectorAll('.cm-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(panelId)?.classList.add('active');
}

/* ══════════════════════════════════════════
   CRUD CURSO — MODAL
   ══════════════════════════════════════════ */
async function abrirCrudCurso(id) {
    try {
        editingCursoId = id;
        const isNew = !id;
        document.getElementById('crudModalTitle').textContent = isNew ? 'Nuevo Curso' : 'Editar Curso';
        document.getElementById('crudModalSub').textContent = isNew ? 'Completa la información para crear un curso.' : 'Modifica la información del curso.';
        document.getElementById('crudSaveBtn').textContent = isNew ? 'Crear curso' : 'Guardar cambios';

        switchCrudTab('ct-info', document.querySelector('#crudModal .crud-tab'));

        const catSel = document.getElementById('cf-cat');
        catSel.innerHTML = '<option value="">Seleccionar...</option>' + categoriasData.map(c => `<option value="${c.id}">${escHtml(c.nombre)}</option>`).join('');
        const docSel = document.getElementById('cf-instructor');
        docSel.innerHTML = '<option value="">Seleccionar...</option>' + docentesData.map(d => `<option value="${d.id}">${escHtml(d.nombres)}</option>`).join('');

        const c = isNew ? {} : cursosData.find(x => x.id == id);
        if (!c && !isNew) { showToast('Curso no encontrado en datos locales', 'red'); return; }
        console.log('abrirCrudCurso id=', id, 'curso=', c, 'cursosData.length=', cursosData.length);
        document.getElementById('cf-title').value = c?.titulo || '';
        catSel.value = c?.categoria_id || '';
        document.getElementById('cf-price').value = c?.precio || '';
        document.getElementById('cf-level').value = c?.nivel || 'Intermedio';
        docSel.value = c?.docente_id || '';
        document.getElementById('cf-duration').value = c?.duracion || '';
        document.getElementById('cf-lessons').value = c?.cantidad_sesiones || c?.lecciones || '';
        document.getElementById('cf-cert').value = c?.certificacion || 'Sí';
        document.getElementById('cf-desc').value = c?.descripcion_breve || '';
        document.getElementById('cf-descextra').value = c?.descripcion_ampliada || '';
        document.getElementById('cf-currdesc').value = c?.descripcion_curriculum || '';
        document.getElementById('cf-img').value = c?.imagen || '';
        document.getElementById('cf-badge').value = c?.badge || '';
        document.getElementById('cf-badge-desc').value = c?.badge_descripcion || '';
        console.log('badge=', c?.badge, 'badge_descripcion=', c?.badge_descripcion);
        document.getElementById('cf-draft').checked = c?.estado === 'Borrador';
        document.getElementById('cf-published').checked = c?.estado !== 'Borrador';

        previewImg(c?.imagen || '');

        const rawAprenderas = c?.aprenderas;
        const learnItems = rawAprenderas
            ? (Array.isArray(rawAprenderas) ? rawAprenderas : rawAprenderas.split('<br>').filter(Boolean))
            : [];
        buildLearnEditor(learnItems);
        const rawMods = modulosData[c?.id];
        const cursoMods = isNew || !rawMods ? [] : rawMods.map(m => ({ nombre: m.nombre || m.titulo || '', sessions: m.sesiones || m.sessions || '' }));
        buildModulesEditor(cursoMods);

        openModal('crudModal');
    } catch (e) {
        console.error('Error en abrirCrudCurso:', e);
        showToast('Error al abrir el editor: ' + e.message, 'red');
    }
}

function switchCrudTab(panelId, btn) {
    const modal = btn?.closest('.modal-box') || btn?.closest('.modal-overlay');
    const scope = modal || document;
    scope.querySelectorAll('.crud-tab').forEach(t => t.classList.remove('active'));
    scope.querySelectorAll('.crud-panel').forEach(p => p.classList.remove('active'));
    btn?.classList.add('active');
    document.getElementById(panelId)?.classList.add('active');
}

function buildLearnEditor(items) {
    const el = document.getElementById('learnEditor');
    el.innerHTML = '';
    (items || []).forEach(it => addLearnItem(it));
}
function addLearnItem(val = '') {
    const el = document.getElementById('learnEditor');
    const row = document.createElement('div');
    row.className = 'learn-row';
    row.innerHTML = `<input type="text" placeholder="Ej: Diseño de rutas..." value="${escHtml(val)}"/><button class="mod-del-btn" onclick="this.parentNode.remove()">✕</button>`;
    el.appendChild(row);
}

function buildModulesEditor(mods) {
    const el = document.getElementById('modulesEditor');
    el.innerHTML = '';
    (mods || []).forEach(m => addModuleRow(m.name || m.nombre, m.sessions || ''));
}
function addModuleRow(name = '', sessions = '') {
    const el = document.getElementById('modulesEditor');
    const idx = el.children.length + 1;
    const row = document.createElement('div');
    row.className = 'mod-row';
    row.innerHTML = `<span class="mod-drag">⠿</span>
        <input type="text" placeholder="Módulo ${idx}: Nombre" value="${escHtml(name)}"/>
        <input type="text" class="mod-sessions" placeholder="N sesiones" value="${escHtml(sessions)}"/>
        <button class="mod-del-btn" onclick="this.parentNode.remove()">✕</button>`;
    el.appendChild(row);
}

function previewImg(url) {
    const area = document.getElementById('imgPreviewArea');
    const prev = document.getElementById('imgPreview');
    if (url) { prev.src = url; area?.classList.add('has-img'); }
    else { prev.src = ''; area?.classList.remove('has-img'); }
}
function handleImgFile(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = e => { document.getElementById('cf-img').value = e.target.result; previewImg(e.target.result); };
        reader.readAsDataURL(input.files[0]);
    }
}

async function saveCourse() {
    const title = document.getElementById('cf-title').value.trim();
    if (!title) { showToast('El título es obligatorio', 'red'); switchCrudTab('ct-info', document.querySelector('#crudModal .crud-tab')); return; }

    const estado = document.querySelector('input[name="cf-status"]:checked')?.value === 'published' ? 'Publicado' : 'Borrador';

    const learnItems = Array.from(document.querySelectorAll('#learnEditor .learn-row input'))
        .map(i => i.value.trim()).filter(Boolean);

    const data = {
        id: editingCursoId,
        titulo: title,
        categoria_id: parseInt(document.getElementById('cf-cat').value) || 0,
        docente_id: parseInt(document.getElementById('cf-instructor').value) || 0,
        descripcion_breve: document.getElementById('cf-desc').value,
        descripcion_ampliada: document.getElementById('cf-descextra').value,
        aprenderas: learnItems.join('<br>'),
        descripcion_curriculum: document.getElementById('cf-currdesc')?.value || '',
        precio: parseFloat(document.getElementById('cf-price').value) || 0,
        nivel: document.getElementById('cf-level')?.value || 'Intermedio',
        duracion: document.getElementById('cf-duration').value,
        cantidad_sesiones: parseInt(document.getElementById('cf-lessons').value) || 0,
        certificacion: document.getElementById('cf-cert').value === 'Sí' ? 'Sí' : 'No',
        imagen: document.getElementById('cf-img').value || 'curso1.png',
        badge: document.getElementById('cf-badge').value,
        badge_descripcion: document.getElementById('cf-badge-desc')?.value || '',
        estado,
    };

    try {
        const url = editingCursoId ? `${API_CURSOS}/actualizar.php` : `${API_CURSOS}/crear.php`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const json = await res.json();
        if (json.success) {
            const cursoId = json.id || editingCursoId;
            const modRows = document.querySelectorAll('#modulesEditor .mod-row');
            const modulos = Array.from(modRows).map(row => {
                const inputs = row.querySelectorAll('input');
                return {
                    titulo: (inputs[0]?.value || '').trim(),
                    sesiones: parseInt(inputs[1]?.value) || 0,
                };
            }).filter(m => m.titulo);

            if (cursoId && modulos.length > 0) {
                await fetch(`${API_CURSOS}/sync_modulos.php`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ curso_id: cursoId, modulos })
                });
            }

            showToast(editingCursoId ? 'Curso actualizado ✓' : 'Curso creado ✓', 'green');
            closeModal('crudModal');
            await cargarCursos();
            await loadClasesData();
            renderCourses();
        } else {
            showToast('Error: ' + json.message, 'red');
        }
    } catch (e) {
        showToast('Error de conexión', 'red');
    }
}

/* ══════════════════════════════════════════
   USUARIOS — CRUD
   ══════════════════════════════════════════ */
async function cargarUsuarios() {
    try {
        const res = await fetch(`${API_ADMIN}/usuarios.php?action=listar`);
        const json = await res.json();
        if (json.success) usuariosData = json.data;
    } catch (e) { console.error('Error cargando usuarios:', e); }
}

function renderUsers() {
    const tbody = document.getElementById('usersTbody');
    const label = document.getElementById('userCountLabel');
    if (label) label.textContent = usuariosData.length + ' usuarios registrados';
    if (!tbody) return;
    if (usuariosData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--muted)">No hay usuarios registrados.</td></tr>';
        return;
    }
    tbody.innerHTML = usuariosData.map(u => {
        const ini = (u.nombres?.charAt(0) || '') + (u.apellidos?.charAt(0) || '');
        const esAdmin = u.rol === 'admin';
        return `<tr>
            <td><div style="display:flex;align-items:center;gap:.65rem">
                <div class="td-avatar" style="background:${esAdmin ? 'var(--red)' : '#7c3aed'}">${ini}</div>
                <div><div class="td-name">${escHtml(u.nombres + ' ' + u.apellidos)}</div><div class="td-email">${escHtml(u.email)}</div></div></div></td>
            <td>${u.dni || '—'}</td>
            <td>${u.colegiado || '—'}</td>
            <td><span class="badge ${esAdmin ? 'blue' : 'green'}">${esAdmin ? '● Admin' : '● Activo'}</span></td>
            <td>${u.total_cursos || 0}</td>
            <td>${u.telefono || '—'}</td>
            <td style="font-size:.78rem;color:var(--muted)">${u.created_at ? new Date(u.created_at).toLocaleDateString('es-PE') : '—'}</td>
            <td><div class="td-actions">
                <button class="tbl-btn edit" onclick="abrirEditarUsuario(${u.id})">Editar</button>
                <button class="tbl-btn del" onclick="eliminarUsuario(${u.id},'${escHtml(u.nombres + ' ' + u.apellidos)}')">Eliminar</button>
            </div></td>
        </tr>`;
    }).join('');
}

function filterUsers(val) {
    const txt = val.toLowerCase();
    const rows = document.querySelectorAll('#usersTbody tr');
    rows.forEach(r => {
        r.style.display = r.textContent.toLowerCase().includes(txt) ? '' : 'none';
    });
}

async function eliminarUsuario(id, name) {
    confirmAction(`¿Eliminar a ${name}?`, 'El usuario y sus datos serán eliminados.', async () => {
        try {
            const res = await fetch(`${API_ADMIN}/usuarios.php?action=eliminar`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            const json = await res.json();
            if (json.success) {
                usuariosData = usuariosData.filter(u => u.id != id);
                renderUsers();
                showToast('Usuario eliminado', 'red');
            } else showToast('Error: ' + json.message, 'red');
        } catch (e) { showToast('Error de conexión', 'red'); }
    });
}

/* ══════════════════════════════════════════
   MATRÍCULAS — CRUD
   ══════════════════════════════════════════ */
async function cargarMatriculas() {
    try {
        const res = await fetch(`${API_ADMIN}/matriculas.php?action=listar`);
        const json = await res.json();
        if (json.success) matriculasData = json.data;
    } catch (e) { console.error('Error cargando matrículas:', e); }
}

function renderMatriculas() {
    const tbody = document.getElementById('matTbody');
    const label = document.getElementById('matCountLabel');
    if (label) label.textContent = matriculasData.length + ' matrículas registradas';
    if (!tbody) return;
    if (matriculasData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--muted)">No hay matrículas registradas.</td></tr>';
        return;
    }
    tbody.innerHTML = matriculasData.map(m => {
        const pagado = m.estado === 'Pagado';
        const prog = m.total_clases > 0 ? Math.round((m.clases_completadas || 0) / m.total_clases * 100) : 0;
        const progClass = prog >= 80 ? 'green' : prog >= 40 ? 'amber' : 'red';
        return `<tr>
            <td><div class="td-name">${escHtml(m.usuario_nombres + ' ' + m.usuario_apellidos)}</div><div class="td-email">${m.colegiado || m.usuario_email}</div></td>
            <td style="font-size:.8rem">${escHtml(m.curso_titulo)}</td>
            <td style="font-size:.78rem;color:var(--muted)">${m.fecha ? new Date(m.fecha).toLocaleDateString('es-PE') : (m.created_at ? new Date(m.created_at).toLocaleDateString('es-PE') : '—')}</td>
            <td style="font-weight:600">S/ ${parseFloat(m.monto).toFixed(2)}</td>
            <td style="font-size:.78rem">${escHtml(m.medio_pago || '—')}</td>
            <td><span class="badge ${pagado ? 'green' : 'amber'}">${pagado ? 'Pagado' : 'Pendiente'}</span></td>
            <td><div class="mini-prog"><div class="mini-prog-bar"><div class="mini-prog-fill ${progClass}" style="width:${prog}%"></div></div><span>${prog}%</span></div></td>
            <td><div class="td-actions">
                <button class="tbl-btn ${pagado ? 'view' : 'approve'}" onclick="togglePagoMatricula(${m.id}, '${m.estado}')">${pagado ? 'Detalle' : 'Confirmar pago'}</button>
                <button class="tbl-btn del" onclick="eliminarMatricula(${m.id})">🗑</button>
            </div></td>
        </tr>`;
    }).join('');
}

async function togglePagoMatricula(id, estadoActual) {
    if (estadoActual === 'Pagado') {
        showToast('Pago ya confirmado', '');
        return;
    }
    try {
        const res = await fetch(`${API_ADMIN}/matriculas.php?action=actualizar_pago`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, estado: 'Pagado' })
        });
        const json = await res.json();
        if (json.success) {
            const m = matriculasData.find(x => x.id == id);
            if (m) m.estado = 'Pagado';
            renderMatriculas();
            showToast('Pago confirmado ✓', 'green');
        }
    } catch (e) { showToast('Error de conexión', 'red'); }
}

async function eliminarMatricula(id) {
    confirmAction('¿Eliminar esta matrícula?', 'Esta acción es permanente.', async () => {
        try {
            const res = await fetch(`${API_ADMIN}/matriculas.php?action=eliminar`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            const json = await res.json();
            if (json.success) {
                matriculasData = matriculasData.filter(m => m.id != id);
                renderMatriculas();
                showToast('Matrícula eliminada', 'red');
            }
        } catch (e) { showToast('Error de conexión', 'red'); }
    });
}

function openNewMatriculaModal() {
    // Poblar selects
    const userSel = document.getElementById('nm-user');
    const cursoSel = document.getElementById('nm-curso');
    if (userSel) {
        userSel.innerHTML = '<option value="">Seleccionar usuario...</option>' +
            usuariosData.map(u => `<option value="${u.id}">${escHtml(u.nombres + ' ' + u.apellidos)} (${u.email})</option>`).join('');
    }
    if (cursoSel) {
        cursoSel.innerHTML = '<option value="">Seleccionar curso...</option>' +
            cursosData.map(c => `<option value="${c.id}">${escHtml(c.titulo)} — S/ ${parseFloat(c.precio).toFixed(2)}</option>`).join('');
    }
    const fechaInput = document.getElementById('nm-fecha');
    if (fechaInput) fechaInput.value = new Date().toISOString().split('T')[0];
    openModal('newMatriculaModal');
}

async function saveMatricula() {
    const usuario_id = parseInt(document.getElementById('nm-user').value) || 0;
    const curso_id = parseInt(document.getElementById('nm-curso').value) || 0;
    const monto = parseFloat(document.getElementById('nm-monto').value) || 0;
    const medio_pago = document.getElementById('nm-pago').value;
    const estado = document.getElementById('nm-estado').value;
    const fecha = document.getElementById('nm-fecha')?.value || '';

    if (!usuario_id || !curso_id) {
        showToast('Selecciona usuario y curso', 'red');
        return;
    }

    try {
        const res = await fetch(`${API_ADMIN}/matriculas.php?action=crear`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario_id, curso_id, monto, medio_pago, estado, fecha })
        });
        const json = await res.json();
        if (json.success) {
            showToast('Matrícula registrada ✓', 'green');
            closeModal('newMatriculaModal');
            await cargarMatriculas();
            renderMatriculas();
        } else {
            showToast('Error: ' + json.message, 'red');
        }
    } catch (e) { showToast('Error de conexión', 'red'); }
}

/* ══════════════════════════════════════════
   CATEGORÍAS / DOCENTES
   ══════════════════════════════════════════ */
async function cargarCategorias() {
    try {
        const res = await fetch(`${API_ADMIN}/categorias.php?action=listar`);
        const json = await res.json();
        if (json.success) categoriasData = json.data;
    } catch (e) { console.error(e); }
}

async function cargarDocentes() {
    try {
        const res = await fetch(`${API_ADMIN}/docentes.php?action=listar`);
        const json = await res.json();
        if (json.success) docentesData = json.data;
    } catch (e) { console.error(e); }
}

function renderCategoriasList() {
    const el = document.getElementById('categoriasList');
    if (!el) return;
    if (categoriasData.length === 0) {
        el.innerHTML = '<p style="font-size:.82rem;color:var(--muted);padding:.5rem 0">Sin categorías.</p>';
        return;
    }
    el.innerHTML = categoriasData.map(c => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:.5rem .75rem;background:var(--cream);border-radius:8px;border:1px solid var(--warm-grey);margin-bottom:.4rem">
            <span style="font-size:.85rem;font-weight:500;color:var(--navy)">${escHtml(c.nombre)}</span>
            <div style="display:flex;gap:4px">
                <button class="tbl-btn edit" onclick="abrirEditarCategoria(${c.id})">Editar</button>
                <button class="tbl-btn del" onclick="eliminarCategoria(${c.id})">✕</button>
            </div>
        </div>
    `).join('');
}

async function eliminarCategoria(id) {
    confirmAction('¿Eliminar esta categoría?', '', async () => {
        try {
            await fetch(`${API_ADMIN}/categorias.php?action=eliminar`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            categoriasData = categoriasData.filter(c => c.id != id);
            renderCategoriasList();
            showToast('Categoría eliminada', 'red');
        } catch (e) { showToast('Error de conexión', 'red'); }
    });
}

async function crearCategoria() {
    const id = document.getElementById('cfgCatId')?.value || '';
    const nombre = document.getElementById('cfgCatNombre')?.value.trim();
    if (!nombre) { showToast('Ingresa el nombre de la categoría', 'red'); return; }
    try {
        const action = id ? 'actualizar' : 'crear';
        const body = id ? { id: parseInt(id), nombre } : { nombre };
        const res = await fetch(`${API_ADMIN}/categorias.php?action=${action}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const json = await res.json();
        if (json.success) {
            showToast(id ? 'Categoría actualizada ✓' : 'Categoría creada ✓', 'green');
            document.getElementById('cfgCatNombre').value = '';
            if (document.getElementById('cfgCatId')) document.getElementById('cfgCatId').value = '';
            const btn = document.querySelector('#pg-config .btn-green');
            if (btn) btn.textContent = 'Registrar';
            await cargarCategorias();
        } else showToast('Error: ' + json.message, 'red');
    } catch (e) { showToast('Error de conexión', 'red'); }
}

function abrirEditarCategoria(id) {
    const c = categoriasData.find(x => x.id == id);
    if (!c) return;
    document.getElementById('cfgCatNombre').value = c.nombre || '';
    let idInput = document.getElementById('cfgCatId');
    if (!idInput) {
        idInput = document.createElement('input');
        idInput.type = 'hidden';
        idInput.id = 'cfgCatId';
        document.getElementById('cfgCatNombre').closest('.form-section')?.prepend(idInput);
    }
    idInput.value = c.id;
    const btn = document.querySelector('#pg-config .btn-green');
    if (btn) btn.textContent = 'Guardar cambios';
    document.getElementById('cfgCatNombre').focus();
}

function limpiarCategoria() {
    document.getElementById('cfgCatNombre').value = '';
    if (document.getElementById('cfgCatId')) document.getElementById('cfgCatId').value = '';
    const btn = document.querySelector('#pg-config .btn-green');
    if (btn) btn.textContent = 'Registrar';
}

function limpiarDocente() {
    document.getElementById('cfgDocNombre').value = '';
    document.getElementById('cfgDocProfesion').value = '';
    document.getElementById('cfgDocDescripcion').value = '';
    if (document.getElementById('cfgDocId')) document.getElementById('cfgDocId').value = '';
    const btn = document.querySelectorAll('#pg-config .btn-red')[0];
    if (btn) btn.textContent = 'Registrar docente';
}

async function crearDocente() {
    const id = document.getElementById('cfgDocId')?.value || '';
    const nombres = document.getElementById('cfgDocNombre')?.value.trim();
    const profesion = document.getElementById('cfgDocProfesion')?.value.trim();
    const descripcion = document.getElementById('cfgDocDescripcion')?.value.trim();
    if (!nombres) { showToast('Ingresa el nombre del docente', 'red'); return; }
    try {
        const action = id ? 'actualizar' : 'crear';
        const body = id ? { id: parseInt(id), nombres, profesion, descripcion } : { nombres, profesion, descripcion };
        const res = await fetch(`${API_ADMIN}/docentes.php?action=${action}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const json = await res.json();
        if (json.success) {
            showToast(id ? 'Docente actualizado ✓' : 'Docente registrado ✓', 'green');
            document.getElementById('cfgDocNombre').value = '';
            document.getElementById('cfgDocProfesion').value = '';
            document.getElementById('cfgDocDescripcion').value = '';
            if (document.getElementById('cfgDocId')) document.getElementById('cfgDocId').value = '';
            const btn = document.querySelector('#pg-config .btn-red');
            if (btn) btn.textContent = 'Registrar docente';
            await cargarDocentes();
        } else showToast('Error: ' + json.message, 'red');
    } catch (e) { showToast('Error de conexión', 'red'); }
}

function abrirEditarDocente(id) {
    const d = docentesData.find(x => x.id == id);
    if (!d) return;
    document.getElementById('cfgDocNombre').value = d.nombres || '';
    document.getElementById('cfgDocProfesion').value = d.profesion || '';
    document.getElementById('cfgDocDescripcion').value = d.descripcion || '';
    let idInput = document.getElementById('cfgDocId');
    if (!idInput) {
        idInput = document.createElement('input');
        idInput.type = 'hidden';
        idInput.id = 'cfgDocId';
        document.getElementById('cfgDocNombre').closest('.form-section')?.prepend(idInput);
    }
    idInput.value = d.id;
    const btn = document.querySelector('#pg-config .btn-red');
    if (btn) btn.textContent = 'Guardar cambios';
    document.getElementById('cfgDocNombre').focus();
}

function renderDocentesList() {
    const el = document.getElementById('docentesList');
    if (!el) return;
    if (docentesData.length === 0) {
        el.innerHTML = '<p style="font-size:.82rem;color:var(--muted);padding:.5rem 0">Sin docentes.</p>';
        return;
    }
    el.innerHTML = docentesData.map(d => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:.6rem .75rem;background:var(--cream);border-radius:8px;border:1px solid var(--warm-grey);margin-bottom:.4rem">
            <div style="flex:1;min-width:0">
                <div style="font-size:.85rem;font-weight:500;color:var(--navy)">${escHtml(d.nombres)}</div>
                <div style="font-size:.75rem;color:var(--muted)">${escHtml(d.profesion || 'Sin profesión')}</div>
                ${d.descripcion ? `<div style="font-size:.72rem;color:var(--muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(d.descripcion)}</div>` : ''}
            </div>
            <div style="display:flex;gap:4px;margin-left:8px;flex-shrink:0">
                <button class="tbl-btn edit" onclick="abrirEditarDocente(${d.id})">Editar</button>
                <button class="tbl-btn del" onclick="eliminarDocente(${d.id})">✕</button>
            </div>
        </div>
    `).join('');
}

async function eliminarDocente(id) {
    confirmAction('¿Eliminar este docente?', '', async () => {
        try {
            await fetch(`${API_ADMIN}/docentes.php?action=eliminar`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            docentesData = docentesData.filter(d => d.id != id);
            renderDocentesList();
            showToast('Docente eliminado', 'red');
        } catch (e) { showToast('Error de conexión', 'red'); }
    });
}

function populateConfigSelects() {
    renderCategoriasList();
    renderDocentesList();
}

/* ══════════════════════════════════════════
   CLASES & CONTENIDO
   ══════════════════════════════════════════ */
let modulosData = {};
let selectedClasesCursoId = null;
let editingModuloIdx = -1;
let editingClaseIdx = -1;
let nextClaseId = 100;
let nextModuloId = 100;

async function loadClasesData() {
    for (const c of cursosData) {
        try {
            const res = await fetch(`${API_CURSOS}/listar.php?tipo=modulos&curso_id=${c.id}`);
            const json = await res.json();
            if (json.success && json.data) {
                const mods = [];
                for (const m of json.data) {
                    const clasesRes = await fetch(`${API_CURSOS}/listar.php?tipo=clases&modulo_id=${m.id}`);
                    const clasesJson = await clasesRes.json();
                    const clases = clasesJson.success ? clasesJson.data : [];
                    for (const cl of clases) {
                        if (cl.tipo_contenido === 'quiz' && cl.cuestionario) {
                            try {
                                const pqRes = await fetch(`${API_CURSOS}/preguntas_listar.php?clase_id=${cl.id}`);
                                const pqJson = await pqRes.json();
                                cl.num_preguntas = pqJson.success ? (pqJson.data || []).length : 0;
                            } catch (e) { cl.num_preguntas = 0; }
                        }
                    }
                    mods.push({ ...m, clases });
                }
                modulosData[c.id] = mods;
            }
        } catch (e) { console.error(e); }
    }
}

function renderClasesCursoList() {
    const el = document.getElementById('clasesCursoList');
    if (!el) return;
    el.innerHTML = '<div class="csl-head">Selecciona un curso</div>';
    cursosData.forEach(c => {
        const mods = modulosData[c.id] || [];
        const totalClases = mods.reduce((a, m) => a + (m.clases?.length || 0), 0);
        const div = document.createElement('div');
        div.className = 'csl-item' + (selectedClasesCursoId == c.id ? ' active' : '');
        div.onclick = () => selectClasesCurso(c.id);
        div.innerHTML = `<div class="csl-thumb" style="background-image:url('${c.imagen || 'curso1.png'}')"></div>
            <div><div class="csl-name">${escHtml(c.titulo)}</div><div class="csl-cnt">${mods.length} módulos · ${totalClases} clases</div></div>`;
        el.appendChild(div);
    });
}

function selectClasesCurso(id) {
    selectedClasesCursoId = id;
    renderClasesCursoList();
    renderClasesPanel();
    updateClasesHeader();
}

function updateClasesHeader() {
    const el = document.getElementById('clasesHeaderActions');
    if (!el) return;
    if (!selectedClasesCursoId) { el.innerHTML = ''; return; }
    const curso = cursosData.find(c => c.id == selectedClasesCursoId);
    if (!curso) { el.innerHTML = ''; return; }
    const pub = curso.estado === 'Publicado';
    el.innerHTML = pub
        ? `<button class="btn-red" style="font-size:.8rem" onclick="window.open('cursos.html?curso_id=${curso.id}','_blank')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            Ver publicación
           </button>`
        : '';
}

function renderClasesPanel() {
    const wrap = document.getElementById('clasesPanelWrap');
    if (!wrap || !selectedClasesCursoId) return;
    const curso = cursosData.find(c => c.id == selectedClasesCursoId);
    if (!curso) return;
    let mods = modulosData[curso.id] || [];

    let html = `<div class="clase-panel">
        <div class="clase-panel-head">
            <h3>${escHtml(curso.titulo)}</h3>
            <div style="display:flex;gap:.5rem">
                <button class="btn-ghost" style="font-size:.78rem" onclick="openStudentView(${curso.id})">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    Ver curso
                </button>
                <button class="btn-ghost" style="font-size:.78rem" onclick="openEnrolledModal(${curso.id})">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                    Inscritos
                </button>
                <button class="btn-ghost" style="font-size:.78rem" onclick="openModCrudModal(-1)">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Módulo
                </button>
            </div>
        </div>`;

    if (mods.length === 0) {
        html += `<div class="empty-clases"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg><p>Este curso no tiene módulos todavía.<br/>Crea el primer módulo con el botón de arriba.</p></div>`;
    } else {
        mods.forEach((mod, mi) => {
            html += `<div class="modulo-section">
                <div class="modulo-header">
                    <div class="modulo-titulo">
                        <div class="modulo-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg></div>
                        ${escHtml(mod.nombre || mod.titulo)}
                        <span class="badge grey" style="font-size:.64rem">${(mod.clases || []).length} clases</span>
                    </div>
                    <div style="display:flex;gap:.3rem">
                        <button class="tbl-btn view" onclick="openNewClaseModal(${mi})">+ Clase</button>
                        <button class="tbl-btn edit" onclick="openModCrudModal(${mi})">Editar</button>
                        <button class="tbl-btn del" onclick="deleteModulo(${mi})">Eliminar</button>
                    </div>
                </div>`;
            const clases = mod.clases || [];
            if (clases.length === 0) {
                html += `<div style="padding:.5rem .75rem;font-size:.8rem;color:var(--muted);font-style:italic">Sin clases aún.</div>`;
            } else {
                clases.forEach((cl, ci) => {
                    const tc = cl.tipo_contenido || 'video';
                    const tipoMap = { video: '▶ Video', quiz: '📝 Cuestionario', trabajo: '📤 Trabajo' };
                    const tipoLabel = tipoMap[tc] || '▶ Video';
                    const descPreview = renderDescPreview(cl.descripcion);
                    let extraMeta = '';
                    if (tc === 'quiz' && cl.num_preguntas !== undefined) {
                        extraMeta = `<span class="clase-tipo quiz" style="background:rgba(181,30,35,.06);color:var(--red)">${cl.num_preguntas} preguntas</span>`;
                    } else if (tc === 'trabajo' && descPreview) {
                        extraMeta = `<span style="font-size:.7rem;color:var(--muted);max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block;vertical-align:middle">${descPreview}</span>`;
                    }
                    html += `<div class="clase-item">
                        <div class="clase-orden">${ci + 1}</div>
                        <div class="clase-info">
                            <div class="clase-titulo">${escHtml(cl.titulo)}</div>
                            <div class="clase-meta">
                                <span class="clase-tipo ${tc}">${tipoLabel}</span>
                                ${cl.duracion ? '· ' + escHtml(cl.duracion) : ''}
                                ${extraMeta}
                            </div>
                        </div>
                        <div class="td-actions">
                            ${tc === 'quiz' ? `<button class="tbl-btn view" onclick="openPreguntasModal(${cl.id}, '${escHtml(cl.titulo).replace(/'/g, "\\'")}')">📝 Preguntas</button>` : ''}
                            <button class="tbl-btn edit" onclick="openEditClaseModal(${mi}, ${ci})">Editar</button>
                            <button class="tbl-btn del" onclick="eliminarClase(${mi}, ${ci})">Eliminar</button>
                        </div>
                    </div>`;
                });
            }
            html += '</div>';
        });
    }
    html += '</div>';
    wrap.innerHTML = html;
}

function openModCrudModal(modIdx) {
    if (!selectedClasesCursoId) { showToast('Selecciona un curso primero', 'red'); return; }
    editingModuloIdx = modIdx;
    document.getElementById('mod-curso-idx').value = selectedClasesCursoId;
    if (modIdx >= 0) {
        const mod = (modulosData[selectedClasesCursoId] || [])[modIdx];
        document.getElementById('modModalTitle').textContent = 'Editar Módulo';
        document.getElementById('mod-nombre').value = mod?.nombre || mod?.titulo || '';
        document.getElementById('mod-desc').value = mod?.descripcion || '';
    } else {
        document.getElementById('modModalTitle').textContent = 'Nuevo Módulo';
        document.getElementById('mod-nombre').value = '';
        document.getElementById('mod-desc').value = '';
    }
    openModal('modCrudModal');
}

async function saveModulo() {
    const nombre = document.getElementById('mod-nombre').value.trim();
    if (!nombre) { showToast('El nombre del módulo es obligatorio', 'red'); return; }
    const cursoId = parseInt(document.getElementById('mod-curso-idx').value);
    if (editingModuloIdx >= 0) {
        const mod = modulosData[cursoId][editingModuloIdx];
        mod.nombre = nombre;
        mod.titulo = nombre;
        mod.descripcion = document.getElementById('mod-desc').value.trim();
        showToast('Módulo actualizado ✓', 'green');
    } else {
        if (!modulosData[cursoId]) modulosData[cursoId] = [];
        modulosData[cursoId].push({ id: nextModuloId++, nombre, titulo: nombre, descripcion: document.getElementById('mod-desc').value.trim(), clases: [] });
        showToast('Módulo creado ✓', 'green');
    }
    closeModal('modCrudModal');
    renderClasesPanel();
    renderClasesCursoList();
}

function deleteModulo(modIdx) {
    if (!confirm('¿Eliminar este módulo?')) return;
    if (modulosData[selectedClasesCursoId]) {
        modulosData[selectedClasesCursoId].splice(modIdx, 1);
    }
    showToast('Módulo eliminado', '');
    renderClasesPanel();
    renderClasesCursoList();
}

/* ══════════════════════════════════════════
   CERTIFICADOS (local)
   ══════════════════════════════════════════ */
let certificadosData = [];
let certEstudiantesData = [];
let certElegiblesData = [];
let certEmisionesData = [];
let certStatsData = { emitidos: 0, descargados: 0, pendientes: 0 };

async function cargarCertificados() {
    try {
        const res = await fetch(`${API_ADMIN}/certificados.php?action=listar`);
        const json = await res.json();
        if (json.success) certificadosData = json.data || [];
    } catch (e) { console.error('Error cargando certificados:', e); }

    try {
        const res = await fetch(`${API_ADMIN}/certificados.php?action=listar_emisiones`);
        const json = await res.json();
        if (json.success) {
            certEmisionesData = json.data || [];
            certStatsData = json.stats || { emitidos: 0, descargados: 0, pendientes: 0 };
        }
    } catch (e) { console.error('Error cargando emisiones:', e); }
}

async function cargarCertEstudiantes() {
    try {
        const res = await fetch(`${API_ADMIN}/certificados.php?action=listar_estudiantes`);
        const json = await res.json();
        if (json.success) certEstudiantesData = json.data || [];
    } catch (e) { console.error('Error cargando estudiantes para certificados:', e); }
}

function renderCerts() {
    const el = document.getElementById('certListEl');
    const badge = document.getElementById('certTotalBadge');
    const total = cursosData.length || 3;
    if (badge) badge.textContent = total + ' plantillas';

    if (!el) return;

    if (cursosData.length === 0) {
        el.innerHTML = '<div class="empty-clases"><p>Sin cursos disponibles. Los certificados se generan por curso.</p></div>';
    } else {
        el.innerHTML = cursosData.map(curso => {
            const cert = certificadosData.find(c => c.curso_id == curso.id);
            const emitidos = cert ? (cert.emitidos || 0) : 0;
            const firmante = cert ? (cert.firma1_nombre || 'Lic. Oscar Gamarra Dominguez') : 'Lic. Oscar Gamarra Dominguez';
            const estado = 'activo';
            const docente = curso.docente_nombre || '';
            return `<div class="cert-item">
                <div class="cert-medal"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg></div>
                <div class="cert-info">
                    <div class="cert-curso">${escHtml(curso.titulo)}</div>
                    <div class="cert-sub">${docente ? 'Docente: ' + escHtml(docente) + ' · ' : ''}${emitidos} emitidos · ${estado} · ${curso.horas_duracion || 40}h</div>
                </div>
                <div class="cert-actions">
                    <button class="tbl-btn view" onclick="previewCertAndSidebar(${curso.id})" title="Vista previa del certificado">Preview</button>
                    <button class="tbl-btn edit" onclick="${cert ? 'editCertTemplate(' + cert.id + ')' : 'openNewCertModal()'}" title="Editar plantilla">Editar</button>
                    <button class="tbl-btn del" onclick="${cert ? 'deleteCert(' + cert.id + ')' : 'showToast(\'No hay plantilla que eliminar\',\'red\')'}" title="Eliminar plantilla">Eliminar</button>
                </div>
            </div>`;
        }).join('');
    }

    renderCertRecientes();
    renderCertStats();
    updateSidebarCertPreview(cursosData.length > 0 ? cursosData[0].id : null);
}

function renderCertRecientes() {
    const container = document.getElementById('certRecentList');
    if (!container) return;

    if (certEmisionesData.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:1.5rem;color:var(--muted);font-size:.82rem">Sin emisiones recientes.<br>Genera un certificado para verlo aquí.</div>';
        return;
    }

    const avatarColors = ['#1A1A2E', 'var(--red)', '#1d4ed8', '#7c3aed', '#0891b2', '#c2410c', '#4338ca', '#15803d'];
    const recent = certEmisionesData.slice(0, 10);

    container.innerHTML = recent.map(e => {
        const ini = ((e.nombres || '')[0] || '') + ((e.apellidos || '')[0] || '');
        const colorIdx = (e.usuario_id || 0) % avatarColors.length;
        const descargado = e.fecha_descarga !== null;
        const statusColor = descargado ? 'var(--green)' : 'var(--amber)';
        const statusText = descargado ? '✓ Descargado' : '⏳ Pendiente';
        const time = e.fecha_emision ? timeAgo(new Date(e.fecha_emision)) : '';

        return `<div class="cert-send-row">
            <div class="cert-send-av" style="background:${avatarColors[colorIdx]}">${escHtml(ini.toUpperCase())}</div>
            <div class="cert-send-info">
                <div class="cert-send-name">${escHtml(e.nombres + ' ' + e.apellidos)}</div>
                <div class="cert-send-status">${escHtml(e.curso_titulo)} — ${time} · <span style="color:${statusColor}">${statusText}</span></div>
            </div>
        </div>`;
    }).join('');
}

function renderCertStats() {
    const elTotal = document.getElementById('certStatTotal');
    const elDown = document.getElementById('certStatDown');
    const elPend = document.getElementById('certStatPend');
    if (elTotal) elTotal.textContent = certStatsData.emitidos;
    if (elDown) elDown.textContent = certStatsData.descargados;
    if (elPend) elPend.textContent = certStatsData.pendientes;
}

function previewCertA4(cursoId) {
    const curso = cursosData.find(c => c.id == cursoId);
    const cert = certificadosData.find(c => c.curso_id == cursoId);

    document.getElementById('pvCertCurso').textContent = curso?.titulo || 'Nombre del Curso';
    document.getElementById('pvCertNombre').textContent = 'Nombre del Estudiante';
    document.getElementById('pvCertDni').textContent = 'D.N.I. N° 00000000';
    document.getElementById('pvCertHoras').textContent = curso?.horas_duracion || 40;

    // Firma 1
    document.getElementById('pvFirma1Name').textContent = cert?.firma1_nombre || 'Lic. Oscar Gamarra Dominguez';
    document.getElementById('pvFirma1Cargo').innerHTML = (cert?.firma1_cargo || 'Decano') + '<br>COLITUR Lima';
    if (cert?.firma1_imagen) document.getElementById('pvFirma1Img').src = cert.firma1_imagen;
    // Firma 2
    document.getElementById('pvFirma2Name').textContent = cert?.firma2_nombre || 'Lic. Heber Olavarría Bustios';
    document.getElementById('pvFirma2Cargo').innerHTML = (cert?.firma2_cargo || 'Vicedecano') + '<br>COLITUR Lima';
    if (cert?.firma2_imagen) document.getElementById('pvFirma2Img').src = cert.firma2_imagen;
    // Firma 3
    document.getElementById('pvFirma3Name').textContent = cert?.firma3_nombre || 'Lic. Cleyde Flores Flores';
    document.getElementById('pvFirma3Cargo').innerHTML = (cert?.firma3_cargo || 'Directora Secretaria') + '<br>COLITUR Lima';
    if (cert?.firma3_imagen) document.getElementById('pvFirma3Img').src = cert.firma3_imagen;

    const now = new Date();
    const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    document.getElementById('pvCertFecha').textContent = now.getDate() + ' de ' + meses[now.getMonth()] + ' de ' + now.getFullYear();

    openModal('certPreviewModal');
}

function editCertTemplate(certId) {
    const cert = certificadosData.find(c => c.id == certId);
    if (!cert) return;

    editingCertId = certId;
    document.getElementById('certModalTitle').textContent = 'Editar Certificado';
    document.getElementById('certModalSub').textContent = 'Edita la plantilla del certificado de ' + (cert.curso_titulo || 'curso');

    document.getElementById('cert-curso-new').style.display = 'none';
    document.getElementById('cert-curso-edit').style.display = '';
    document.getElementById('cert-curso-nombre').textContent = cert.curso_titulo || 'Curso sin nombre';

    document.getElementById('cert-firma1-nombre').value = cert.firma1_nombre || '';
    document.getElementById('cert-firma1-cargo').value = cert.firma1_cargo || '';
    document.getElementById('cert-firma2-nombre').value = cert.firma2_nombre || '';
    document.getElementById('cert-firma2-cargo').value = cert.firma2_cargo || '';
    document.getElementById('cert-firma3-nombre').value = cert.firma3_nombre || '';
    document.getElementById('cert-firma3-cargo').value = cert.firma3_cargo || '';

    [1,2,3].forEach(n => {
        const img = cert['firma' + n + '_imagen'] || '';
        document.getElementById('cert-firma' + n + '-imagen').value = img;
        const preview = document.getElementById('cert-firma' + n + '-preview');
        if (preview) {
            preview.innerHTML = img
                ? '<img src="' + escHtml(img) + '" style="width:100%;height:100%;object-fit:contain"/>'
                : '<span style="font-size:.6rem;color:var(--muted)">Sin img</span>';
        }
        const fileInput = document.getElementById('cert-firma' + n + '-file');
        if (fileInput) fileInput.value = '';
    });

    document.getElementById('certSaveBtn').textContent = 'Guardar cambios';
    openModal('certCrudModal');
}

function deleteCert(id) {
    confirmAction('¿Eliminar esta plantilla?', 'El certificado será eliminado permanentemente.', async () => {
        try {
            const res = await fetch(`${API_ADMIN}/certificados.php?action=eliminar`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            const json = await res.json();
            if (json.success) {
                certificadosData = certificadosData.filter(c => c.id != id);
                renderCerts();
                showToast('Certificado eliminado', 'red');
            } else showToast('Error: ' + json.message, 'red');
        } catch (e) { showToast('Error de conexión', 'red'); }
    });
}

/* ══════════════════════════════════════════
   CERTIFICADO — Generar A4
   ══════════════════════════════════════════ */
async function abrirGenerarCert(cursoIdPre) {
    await cargarCertEstudiantes();

    const sel = document.getElementById('cg-estudiante');
    sel.innerHTML = '<option value="">Seleccionar estudiante...</option>';

    if (cursoIdPre) {
        try {
            const res = await fetch(`${API_ADMIN}/certificados.php?action=listar_elegibles&curso_id=${cursoIdPre}`);
            const json = await res.json();
            if (json.success && json.data.length > 0) {
                certElegiblesData = json.data;
                json.data.forEach(e => {
                    sel.innerHTML += '<option value="' + e.id + '-' + e.curso_id + '">' + escHtml(e.apellidos + ', ' + e.nombres) + '</option>';
                });
            } else {
                certElegiblesData = [];
                sel.innerHTML = '<option value="" disabled>No hay estudiantes elegibles para este curso</option>';
            }
        } catch (e) {
            certElegiblesData = [];
            sel.innerHTML = '<option value="" disabled>Error al cargar estudiantes</option>';
        }
    } else {
        sel.innerHTML = '<option value="" disabled>Selecciona un curso primero...</option>';
        certElegiblesData = [];
    }

    const selCurso = document.getElementById('cg-curso');
    selCurso.innerHTML = '<option value="">Seleccionar curso...</option>';
    cursosData.forEach(c => {
        selCurso.innerHTML += '<option value="' + c.id + '">' + escHtml(c.titulo) + '</option>';
    });

    // Set default date
    const now = new Date();
    const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    document.getElementById('cg-fecha').value = now.getDate() + ' de ' + meses[now.getMonth()] + ' de ' + now.getFullYear();

    // Pre-select course if provided
    if (cursoIdPre) {
        selCurso.value = cursoIdPre;
    }

    // Reset certificate
    document.getElementById('certD-nombre').textContent = 'Nombre del Estudiante';
    document.getElementById('certD-dni').textContent = 'D.N.I. N° 00000000';
    document.getElementById('certD-curso').textContent = 'Nombre del Curso';
    document.getElementById('certD-horas').textContent = '40';
    document.getElementById('certD-fecha').textContent = document.getElementById('cg-fecha').value;
    document.getElementById('cg-dni').value = '';
    document.getElementById('cg-horas').value = '40';

    // Load firmas for the selected course
    if (cursoIdPre) loadCertFirmasIntoGenModal(cursoIdPre);

    openModal('certGenModal');
}

function onCertEstudianteChange() {
    const val = document.getElementById('cg-estudiante').value;
    if (!val) {
        document.getElementById('certD-nombre').textContent = 'Nombre del Estudiante';
        document.getElementById('certD-dni').textContent = 'D.N.I. N° 00000000';
        document.getElementById('cg-dni').value = '';
        updateCertMiniPreview('Nombre del Estudiante', 'D.N.I. N° 00000000', 'Nombre del Curso', '40', document.getElementById('cg-fecha').value);
        return;
    }
    const [uid, cid] = val.split('-');
    const est = certElegiblesData.find(e => e.id == uid && e.curso_id == cid) || certEstudiantesData.find(e => e.id == uid && e.curso_id == cid);
    if (!est) return;

    const fullName = est.nombres + ' ' + est.apellidos;
    document.getElementById('certD-nombre').textContent = fullName;

    let dniText = 'D.N.I. N° _________';
    if (est.dni) {
        document.getElementById('cg-dni').value = 'D.N.I. N° ' + est.dni;
        document.getElementById('certD-dni').textContent = 'D.N.I. N° ' + est.dni;
        document.getElementById('cg-dni-hint').textContent = 'DNI cargado del registro del estudiante';
        dniText = 'D.N.I. N° ' + est.dni;
    } else {
        document.getElementById('cg-dni').value = '';
        document.getElementById('certD-dni').textContent = 'D.N.I. N° _________';
        document.getElementById('cg-dni-hint').textContent = '⚠ Sin DNI registrado. Edita el usuario para agregarlo.';
    }

    let cursoName = 'Nombre del Curso';
    if (est.curso_id) {
        document.getElementById('cg-curso').value = est.curso_id;
        document.getElementById('certD-curso').textContent = est.curso_titulo || 'Curso';
        cursoName = est.curso_titulo || 'Curso';
    }

    let horas = '40';
    if (est.total_clases) {
        horas = Math.max(est.total_clases * 3, 20);
        document.getElementById('cg-horas').value = horas;
        document.getElementById('certD-horas').textContent = horas;
    }

    updateCertMiniPreview(fullName, dniText, cursoName, horas, document.getElementById('cg-fecha').value);
}

function onCertCursoChange() {
    const cid = document.getElementById('cg-curso').value;
    const sel = document.getElementById('cg-estudiante');
    if (!cid) {
        document.getElementById('certD-curso').textContent = 'Nombre del Curso';
        sel.innerHTML = '<option value="" disabled>Selecciona un curso primero...</option>';
        certElegiblesData = [];
        updateCertMiniPreview(
            document.getElementById('certD-nombre').textContent,
            document.getElementById('certD-dni').textContent,
            'Nombre del Curso',
            document.getElementById('cg-horas').value,
            document.getElementById('cg-fecha').value
        );
        return;
    }
    const curso = cursosData.find(c => c.id == cid);
    if (curso) {
        document.getElementById('certD-curso').textContent = curso.titulo;
        loadCertFirmasIntoGenModal(cid);
        updateCertMiniPreview(
            document.getElementById('certD-nombre').textContent,
            document.getElementById('certD-dni').textContent,
            curso.titulo,
            document.getElementById('cg-horas').value,
            document.getElementById('cg-fecha').value
        );
        loadElegiblesForCurso(cid);
    }
}

async function loadElegiblesForCurso(cursoId) {
    const sel = document.getElementById('cg-estudiante');
    sel.innerHTML = '<option value="">Cargando estudiantes...</option>';
    document.getElementById('certD-nombre').textContent = 'Nombre del Estudiante';
    document.getElementById('certD-dni').textContent = 'D.N.I. N° 00000000';
    document.getElementById('cg-dni').value = '';
    document.getElementById('cg-dni-hint').textContent = '';
    try {
        const res = await fetch(`${API_ADMIN}/certificados.php?action=listar_elegibles&curso_id=${cursoId}`);
        const json = await res.json();
        if (json.success && json.data.length > 0) {
            certElegiblesData = json.data;
            sel.innerHTML = '<option value="">Seleccionar estudiante...</option>';
            json.data.forEach(e => {
                sel.innerHTML += '<option value="' + e.id + '-' + e.curso_id + '">' + escHtml(e.apellidos + ', ' + e.nombres) + '</option>';
            });
        } else {
            certElegiblesData = [];
            sel.innerHTML = '<option value="" disabled>No hay estudiantes elegibles (100% + trabajos calificados)</option>';
        }
    } catch (err) {
        certElegiblesData = [];
        sel.innerHTML = '<option value="" disabled>Error al cargar estudiantes</option>';
    }
}

function onCertFieldChange() {
    const dni = document.getElementById('cg-dni').value.trim();
    document.getElementById('certD-dni').textContent = dni || 'D.N.I. N° _________';

    const horas = document.getElementById('cg-horas').value || '40';
    document.getElementById('certD-horas').textContent = horas;

    const fecha = document.getElementById('cg-fecha').value;
    document.getElementById('certD-fecha').textContent = fecha || '___ de ________ de ____';

    const firmante = document.getElementById('cg-firmante1').value;
    const cargo = document.getElementById('cg-cargo1').value;
    document.getElementById('certD-firma1-nombre').textContent = firmante || 'Nombre del Firmante';
    document.getElementById('certD-firma1-cargo').innerHTML = (cargo || 'Cargo') + '<br>COLITUR Lima';

    updateCertMiniPreview(
        document.getElementById('certD-nombre').textContent,
        dni,
        document.getElementById('certD-curso').textContent,
        horas,
        fecha
    );
}

function loadCertFirmasIntoGenModal(cursoId) {
    const cert = certificadosData.find(c => c.curso_id == cursoId);
    const defaults = {
        firma1: { nombre: 'Lic. Oscar Gamarra Dominguez', cargo: 'Decano', img: 'firma1.png' },
        firma2: { nombre: 'Lic. Heber Olavarría Bustios', cargo: 'Vicedecano', img: 'firma2.jpg' },
        firma3: { nombre: 'Lic. Cleyde Flores Flores', cargo: 'Directora Secretaria', img: 'firma3.jpg' }
    };

    for (let i = 1; i <= 3; i++) {
        const d = defaults['firma' + i];
        const nameEl = document.getElementById('certD-firma' + i + '-nombre');
        const cargoEl = document.getElementById('certD-firma' + i + '-cargo');
        const imgEl = document.getElementById('certD-firma' + i + '-img');
        if (nameEl) nameEl.textContent = cert ? (cert['firma' + i + '_nombre'] || d.nombre) : d.nombre;
        if (cargoEl) cargoEl.innerHTML = (cert ? (cert['firma' + i + '_cargo'] || d.cargo) : d.cargo) + '<br>COLITUR Lima';
        if (imgEl && cert && cert['firma' + i + '_imagen']) {
            imgEl.src = cert['firma' + i + '_imagen'];
        } else if (imgEl) {
            imgEl.src = d.img;
        }
    }
}

function imprimirCertA4() {
    window.print();
}

function updateCertMiniPreview(nombre, dni, curso, horas, fecha) {
    const elNombre = document.getElementById('certMiniNombre');
    const elDni = document.getElementById('certMiniDni');
    const elCurso = document.getElementById('certMiniCurso');
    const elHoras = document.getElementById('certMiniHoras');
    const elFecha = document.getElementById('certMiniFecha');
    if (elNombre) elNombre.textContent = nombre || 'Nombre del Estudiante';
    if (elDni) elDni.textContent = dni || 'D.N.I. N° 00000000';
    if (elCurso) elCurso.textContent = curso || 'Nombre del Curso';
    if (elHoras) elHoras.textContent = horas || '40';
    if (elFecha) elFecha.textContent = fecha || '15 de Julio de 2026';
}

let certZoomLevel = 56;
const certZoomStep = 10;
const certZoomMin = 30;
const certZoomMax = 120;

function certZoomIn() {
    if (certZoomLevel >= certZoomMax) return;
    certZoomLevel += certZoomStep;
    applyCertZoom();
}

function certZoomOut() {
    if (certZoomLevel <= certZoomMin) return;
    certZoomLevel -= certZoomStep;
    applyCertZoom();
}

function applyCertZoom() {
    const el = document.getElementById('certA4Preview');
    const label = document.getElementById('certZoomLabel');
    if (el) el.style.transform = 'scale(' + (certZoomLevel / 100) + ')';
    if (label) label.textContent = certZoomLevel + '%';
}

let certGenZoomLevel = 58;
const certGenZoomStep = 5;
const certGenZoomMin = 20;
const certGenZoomMax = 100;

function certGenZoomIn() {
    if (certGenZoomLevel >= certGenZoomMax) return;
    certGenZoomLevel += certGenZoomStep;
    applyCertGenZoom();
}

function certGenZoomOut() {
    if (certGenZoomLevel <= certGenZoomMin) return;
    certGenZoomLevel -= certGenZoomStep;
    applyCertGenZoom();
}

function applyCertGenZoom() {
    const el = document.getElementById('certGenPage');
    const label = document.getElementById('certGenZoomLabel');
    if (el) el.style.transform = 'scale(' + (certGenZoomLevel / 100) + ')';
    if (label) label.textContent = certGenZoomLevel + '%';
}

let sidebarCursoId = null;

function openSidebarA4Modal() {
    if (sidebarCursoId) {
        previewCertA4(sidebarCursoId);
    } else {
        showToast('Selecciona un curso primero', 'red');
    }
}

function updateSidebarCertPreview(cursoId) {
    if (!cursoId && cursosData.length === 0) return;

    let curso, cert;
    if (cursoId) {
        curso = cursosData.find(c => c.id == cursoId);
        cert = certificadosData.find(c => c.curso_id == cursoId);
    } else {
        curso = cursosData[0];
        cert = certificadosData.find(c => c.curso_id == curso?.id);
    }
    if (!curso) return;
    sidebarCursoId = curso.id;

    const now = new Date();
    const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const fecha = meses[now.getMonth()] + ' ' + now.getFullYear();

    const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || ''; };

    setTxt('certPrevMiniCurso', curso.titulo || 'Nombre del Curso');
    setTxt('certPrevMiniNombre', 'Nombre del Estudiante');
    setTxt('certPrevMiniHoras', curso.horas_duracion || 40);
    setTxt('certPrevMiniFecha', fecha);
    setTxt('certPrevDocente', curso.docente_nombre ? 'Docente: ' + curso.docente_nombre : '');

    if (cert) {
        setTxt('certPrevMiniCargo1', cert.firma1_cargo || 'Decano');
        setTxt('certPrevMiniCargo2', cert.firma2_cargo || 'Vicedecano');
        setTxt('certPrevMiniCargo3', cert.firma3_cargo || 'Dir. Secretaria');
        if (cert.firma1_imagen) { const el = document.getElementById('certPrevMiniFirma1'); if (el) el.src = cert.firma1_imagen; }
        if (cert.firma2_imagen) { const el = document.getElementById('certPrevMiniFirma2'); if (el) el.src = cert.firma2_imagen; }
        if (cert.firma3_imagen) { const el = document.getElementById('certPrevMiniFirma3'); if (el) el.src = cert.firma3_imagen; }
    } else {
        setTxt('certPrevMiniCargo1', 'Decano');
        setTxt('certPrevMiniCargo2', 'Vicedecano');
        setTxt('certPrevMiniCargo3', 'Dir. Secretaria');
    }
}

function previewCertAndSidebar(cursoId) {
    updateSidebarCertPreview(cursoId);
}

function sendCertFromModal() {
    showToast('Usa el botón "Registrar emisión" en la sección de certificados para enviar individualmente', 'amber');
    closeModal('sendCertModal');
}

async function registrarEmision() {
    const val = document.getElementById('cg-estudiante').value;
    if (!val) { showToast('Selecciona un estudiante', 'red'); return; }

    const [uid, cid] = val.split('-');
    const curso_id = parseInt(document.getElementById('cg-curso').value) || parseInt(cid);

    // Find the certificado template for this course
    const cert = certificadosData.find(c => c.curso_id == curso_id);
    const certificado_id = cert ? cert.id : 0;

    try {
        const res = await fetch(`${API_ADMIN}/certificados.php?action=registrar_emision`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ certificado_id, usuario_id: parseInt(uid), curso_id })
        });
        const json = await res.json();
        if (json.success) {
            showToast('Emisión registrada ✓', 'green');
            closeModal('certGenModal');
            await cargarCertificados();
            renderCerts();
        } else {
            showToast('Error: ' + json.message, 'red');
        }
    } catch (e) {
        showToast('Error de conexión', 'red');
    }
}

async function cargarTrabajos() {
    try {
        var cursoId = document.getElementById('trabajosFilterCurso')?.value || '';
        var estado = document.getElementById('trabajosFilterEstado')?.value || '';
        var url = `${API_ADMIN}/trabajos.php?action=listar`;
        if (cursoId) url += '&curso_id=' + cursoId;
        if (estado) url += '&estado=' + estado;
        var res = await fetch(url);
        var json = await res.json();
        if (json.success) {
            trabajosData = json.data || [];
            var resumen = json.resumen || {};
            var el = document.getElementById('trabajosResumen');
            if (el) el.textContent = (resumen.total || 0) + ' trabajo(s) · ' + (resumen.pendientes || 0) + ' pendiente(s) · ' + (resumen.calificados || 0) + ' calificado(s)';
            renderTrabajos();
        }
    } catch (e) {
        console.error('Error cargando trabajos:', e);
    }
}

function populateTrabajosFilter() {
    var sel = document.getElementById('trabajosFilterCurso');
    if (!sel) return;
    var current = sel.value;
    sel.innerHTML = '<option value="">Todos los cursos</option>';
    cursosData.forEach(function(c) {
        sel.innerHTML += '<option value="' + c.id + '">' + escHtmlAdmin(c.titulo) + '</option>';
    });
    sel.value = current;
}

function escHtmlAdmin(s) {
    if (!s) return '';
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

function renderTrabajos() {
    var container = document.getElementById('trabajosContainer');
    if (!container) return;

    if (trabajosData.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:2.5rem;color:var(--muted)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:40px;height:40px;margin:0 auto .75rem;opacity:.3"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><p>No hay trabajos para mostrar.</p></div>';
        return;
    }

    var avatarColors = ['#1A1A2E', 'var(--red)', '#1d4ed8', '#7c3aed', '#0891b2', '#c2410c', '#4338ca', '#15803d'];

    container.innerHTML = trabajosData.map(function(t) {
        var ini = ((t.nombres || '')[0] || '') + ((t.apellidos || '')[0] || '');
        var colorIdx = (t.usuario_id || 0) % avatarColors.length;
        var isPendiente = t.calificacion === null;
        var badgeClass = isPendiente ? 'amber' : 'green';
        var badgeText = isPendiente ? 'Pendiente' : '✓ Calificado';
        var fecha = t.fecha ? new Date(t.fecha).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' }) : '--';
        var archivoNombre = '--';
        if (t.archivo) {
            var parts = t.archivo.split('/');
            var lastPart = parts[parts.length - 1];
            var underScoreIdx = lastPart.indexOf('_');
            archivoNombre = underScoreIdx > -1 ? lastPart.substring(underScoreIdx + 1) : lastPart;
        }
        var claseDesc = t.clase_descripcion || '';
        var shortDesc = claseDesc.replace(/<br\s*\/?>/gi, ' ').substring(0, 150);

        var gradeSection = '';
        if (isPendiente) {
            gradeSection = '<div class="grade-input">' +
                '<input type="number" min="0" max="20" step="0.5" placeholder="Nota (0-20)" id="grade-' + t.id + '"/>' +
                '<textarea rows="2" placeholder="Retroalimentación para el estudiante..." id="feedback-' + t.id + '"></textarea>' +
                '<button class="btn-red" onclick="gradeWork(' + t.id + ')">Calificar</button>' +
                '</div>';
        } else {
            gradeSection = '<div style="background:var(--green-bg);color:var(--green);padding:.55rem 1rem;border-radius:8px;font-size:.83rem;font-weight:600">✓ Calificado con ' + t.calificacion + '/20' + (t.comentario ? ' — Retroalimentación enviada' : '') + '</div>';
        }

        return '<div class="assignment-item" id="work-' + t.id + '">' +
            '<div class="ai-head">' +
                '<div class="ai-head-left"><div class="ai-avatar" style="background:' + avatarColors[colorIdx] + '">' + ini.toUpperCase() + '</div><div><div class="ai-name">' + escHtmlAdmin(t.nombres + ' ' + t.apellidos) + '</div><div class="ai-course">' + escHtmlAdmin(t.curso_titulo) + ' — ' + escHtmlAdmin(t.modulo_titulo) + '</div></div></div>' +
                '<div style="display:flex;align-items:center;gap:.65rem"><span style="font-size:.72rem;color:var(--muted)">Entregado el ' + fecha + '</span><span class="badge ' + badgeClass + '">' + badgeText + '</span></div>' +
            '</div>' +
            '<div class="ai-body">' +
                (shortDesc ? '<div class="ai-task"><strong>Trabajo:</strong> ' + escHtmlAdmin(shortDesc) + '</div>' : '') +
                '<div style="display:flex;gap:.65rem;margin-top:.6rem"><button class="tbl-btn view" onclick="verTrabajo(' + t.id + ')">Ver envío</button><span style="font-size:.75rem;color:var(--muted);align-self:center">' + escHtmlAdmin(archivoNombre) + '</span></div>' +
                gradeSection +
            '</div>' +
        '</div>';
    }).join('');
}

async function verTrabajo(id) {
    var trabajo = trabajosData.find(function(t) { return t.id == id; });
    if (!trabajo) return;

    currentTrabajoId = id;

    var ini = ((trabajo.nombres || '')[0] || '') + ((trabajo.apellidos || '')[0] || '');
    var avatarColors = ['#1A1A2E', 'var(--red)', '#1d4ed8', '#7c3aed', '#0891b2', '#c2410c', '#4338ca', '#15803d'];
    var colorIdx = (trabajo.usuario_id || 0) % avatarColors.length;

    document.getElementById('tdAvatar').textContent = ini.toUpperCase();
    document.getElementById('tdAvatar').style.background = avatarColors[colorIdx];
    document.getElementById('tdNombre').textContent = trabajo.nombres + ' ' + trabajo.apellidos;
    document.getElementById('tdCurso').textContent = trabajo.curso_titulo;
    document.getElementById('tdModulo').textContent = trabajo.modulo_titulo + ' — ' + trabajo.clase_titulo;

    var isPendiente = trabajo.calificacion === null;
    var badge = document.getElementById('tdBadge');
    badge.className = 'badge ' + (isPendiente ? 'amber' : 'green');
    badge.textContent = isPendiente ? 'Pendiente' : '✓ Calificado';

    var fecha = trabajo.fecha ? new Date(trabajo.fecha).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '--';
    document.getElementById('tdFecha').textContent = 'Entregado el ' + fecha;

    var url = trabajo.archivo || '';
    var proxyUrl = 'api/ver_archivo.php?file=' + encodeURIComponent(url);
    var ext = url.split('.').pop().toLowerCase().split('?')[0];
    var frame = document.getElementById('tdFrame');
    var img = document.getElementById('tdImage');
    var noPrev = document.getElementById('tdNoPreview');
    var viewer = document.getElementById('tdViewer');

    frame.style.display = 'none';
    img.style.display = 'none';
    noPrev.style.display = 'none';
    viewer.style.display = 'block';
    frame.style.height = '400px';

    if (ext === 'pdf') {
        frame.src = proxyUrl;
        frame.style.display = 'block';
    } else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].indexOf(ext) > -1) {
        img.src = proxyUrl;
        img.style.display = 'block';
    } else if (['doc', 'docx'].indexOf(ext) > -1) {
        document.getElementById('tdDownloadBtn').href = proxyUrl;
        noPrev.style.display = 'block';
    } else {
        document.getElementById('tdDownloadBtn').href = proxyUrl;
        noPrev.style.display = 'block';
    }

    document.getElementById('tdDownloadLink').href = proxyUrl;
    var fileNameParts = url.split('/');
    var lastPart = fileNameParts[fileNameParts.length - 1];
    var underScoreIdx = lastPart.indexOf('_');
    document.getElementById('tdFileName').textContent = underScoreIdx > -1 ? lastPart.substring(underScoreIdx + 1) : lastPart;

    var gradeForm = document.getElementById('tdGradeForm');
    var gradedInfo = document.getElementById('tdGradedInfo');

    if (isPendiente) {
        gradeForm.style.display = 'block';
        gradedInfo.style.display = 'none';
        document.getElementById('tdGradeInput').value = '';
        document.getElementById('tdFeedbackInput').value = '';
    } else {
        gradeForm.style.display = 'none';
        gradedInfo.style.display = 'block';
        document.getElementById('tdGradedBadge').textContent = '✓ Calificado con ' + trabajo.calificacion + '/20';
        document.getElementById('tdGradedFeedback').textContent = trabajo.comentario || 'Sin retroalimentación.';
    }

    openModal('trabajoDetailModal');
}

async function gradeWork(id) {
    var nota = document.getElementById('grade-' + id)?.value;
    var fb = document.getElementById('feedback-' + id)?.value;
    if (!nota || nota < 0 || nota > 20) { showToast('Ingresa una nota (0–20)', 'red'); return; }
    if (!fb?.trim()) { showToast('Escribe retroalimentación', 'red'); return; }

    try {
        var res = await fetch(`${API_ADMIN}/trabajos.php?action=calificar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: id, calificacion: parseFloat(nota), comentario: fb.trim() })
        });
        var json = await res.json();
        if (json.success) {
            showToast('Trabajo calificado ✓', 'green');
            await cargarTrabajos();
        } else {
            showToast('Error: ' + json.message, 'red');
        }
    } catch (e) {
        showToast('Error al calificar', 'red');
    }
}

async function calificarTrabajo() {
    if (!currentTrabajoId) return;
    var nota = document.getElementById('tdGradeInput')?.value;
    var fb = document.getElementById('tdFeedbackInput')?.value;
    if (!nota || nota < 0 || nota > 20) { showToast('Ingresa una nota (0–20)', 'red'); return; }
    if (!fb?.trim()) { showToast('Escribe retroalimentación', 'red'); return; }

    try {
        var res = await fetch(`${API_ADMIN}/trabajos.php?action=calificar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: currentTrabajoId, calificacion: parseFloat(nota), comentario: fb.trim() })
        });
        var json = await res.json();
        if (json.success) {
            showToast('Trabajo calificado ✓', 'green');
            closeModal('trabajoDetailModal');
            await cargarTrabajos();
        } else {
            showToast('Error: ' + json.message, 'red');
        }
    } catch (e) {
        showToast('Error al calificar', 'red');
    }
}

/* ══════════════════════════════════════════
   HELPERS VARIOS
   ══════════════════════════════════════════ */
function switchVidTab(panelId, btn) {
    const wrap = btn.closest('.fg');
    wrap.querySelectorAll('.vst').forEach(b => b.classList.remove('active'));
    wrap.querySelectorAll('.vid-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(panelId)?.classList.add('active');
}

function switchContenidoTipo(tipo, btn) {
    document.querySelectorAll('.tct').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.ct-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const panelId = tipo === 'video' ? 'ct-video' : tipo === 'quiz' ? 'ct-quiz' : 'ct-trabajo';
    document.getElementById(panelId)?.classList.add('active');
}

function previewYT(url) {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([^&?#]+)/);
    if (!match) return;
    const vid = match[1];
    const box = document.getElementById('ytPreviewBox');
    const thumb = document.getElementById('ytThumb');
    const vidEl = document.getElementById('ytVideoId');
    if (box) box.classList.add('visible');
    if (thumb) thumb.src = `https://img.youtube.com/vi/${vid}/hqdefault.jpg`;
    if (vidEl) vidEl.textContent = vid;
}

function handleVideoFile(input) {
    if (input.files && input.files[0]) {
        const display = document.getElementById('clFileNameDisplay');
        if (display) { display.textContent = '📎 ' + input.files[0].name; display.style.display = 'block'; }
    }
}

function handleRecursoFile(input) {
    if (input.files && input.files[0]) {
        const display = document.getElementById('cl-recurso-name');
        if (display) display.textContent = input.files[0].name;
    }
}

function openNewClaseModal(modIdx) {
    if (!selectedClasesCursoId) { showToast('Selecciona un curso primero', 'red'); return; }
    const mods = modulosData[selectedClasesCursoId] || [];
    document.getElementById('cl-curso-idx').value = selectedClasesCursoId;
    document.getElementById('cl-mod-idx').value = modIdx >= 0 ? modIdx : 0;
    document.getElementById('cl-clase-idx').value = '';
    document.getElementById('cl-orden').value = '0';
    document.getElementById('cl-titulo').value = '';
    document.getElementById('cl-duracion').value = '';
    document.getElementById('cl-desc').value = '';
    document.getElementById('cl-yt-url').value = '';
    document.getElementById('ytPreviewBox').classList.remove('visible');
    document.getElementById('clFileNameDisplay').style.display = 'none';
    document.getElementById('cl-recurso-name').textContent = 'Sin archivo adjunto';
    document.getElementById('cl-instrucciones').value = '';
    const modSel = document.getElementById('cl-modulo');
    if (modSel) {
        modSel.innerHTML = mods.map((m, i) => `<option value="${i}" ${i === modIdx ? 'selected' : ''}>${escHtml(m.nombre || m.titulo)}</option>`).join('');
    }
    // Reset tipo to video
    const tctBtns = document.querySelectorAll('.tct');
    tctBtns.forEach(b => b.classList.remove('active'));
    document.querySelector('.tct[data-tipo="video"]')?.classList.add('active');
    document.querySelectorAll('.ct-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('ct-video')?.classList.add('active');
    document.getElementById('claseModalTitle').textContent = 'Nueva Clase';
    document.getElementById('claseModalSub').textContent = 'Agrega una clase al módulo seleccionado.';
    // Reset questions
    window.preguntasData = [];
    document.getElementById('preguntas-container').innerHTML = '';
    document.getElementById('preguntas-status').textContent = '';
    openModal('claseCrudModal');
}

function openEditClaseModal(modIdx, claseIdx) {
    if (!selectedClasesCursoId) { showToast('Selecciona un curso primero', 'red'); return; }
    const mods = modulosData[selectedClasesCursoId] || [];
    const mod = mods[modIdx];
    if (!mod) return;
    const cl = mod.clases[claseIdx];
    if (!cl) return;
    document.getElementById('cl-curso-idx').value = selectedClasesCursoId;
    document.getElementById('cl-mod-idx').value = modIdx;
    document.getElementById('cl-clase-idx').value = cl.id || '';
    document.getElementById('cl-orden').value = cl.orden ?? 0;
    document.getElementById('cl-titulo').value = cl.titulo || '';
    document.getElementById('cl-duracion').value = cl.duracion || '';
    document.getElementById('cl-desc').value = cl.descripcion || '';
    document.getElementById('cl-yt-url').value = (cl.video && (cl.video.includes('youtube') || cl.video.includes('youtu.be'))) ? cl.video : '';
    document.getElementById('ytPreviewBox').classList.remove('visible');
    document.getElementById('clFileNameDisplay').style.display = 'none';
    document.getElementById('cl-recurso-name').textContent = cl.documento || 'Sin archivo adjunto';
    document.getElementById('cl-instrucciones').value = '';
    const modSel = document.getElementById('cl-modulo');
    if (modSel) {
        modSel.innerHTML = mods.map((m, i) => `<option value="${i}" ${i === modIdx ? 'selected' : ''}>${escHtml(m.nombre || m.titulo)}</option>`).join('');
    }
    // Set tipo_contenido
    const tipo = cl.tipo_contenido || 'video';
    const tctBtns = document.querySelectorAll('.tct');
    tctBtns.forEach(b => b.classList.remove('active'));
    document.querySelector(`.tct[data-tipo="${tipo}"]`)?.classList.add('active');
    document.querySelectorAll('.ct-panel').forEach(p => p.classList.remove('active'));
    const panelMap = { video: 'ct-video', quiz: 'ct-quiz', trabajo: 'ct-trabajo' };
    document.getElementById(panelMap[tipo])?.classList.add('active');
    document.getElementById('claseModalTitle').textContent = 'Editar Clase';
    document.getElementById('claseModalSub').textContent = 'Modifica los datos de la clase.';
    // Load questions if quiz
    window.preguntasData = [];
    document.getElementById('preguntas-container').innerHTML = '';
    document.getElementById('preguntas-status').textContent = '';
    if (tipo === 'quiz' && cl.id) {
        loadPreguntas(cl.id);
    }
    openModal('claseCrudModal');
}

async function saveClase() {
    const cursoId = parseInt(document.getElementById('cl-curso-idx').value);
    const modIdx = parseInt(document.getElementById('cl-modulo').value);
    const claseId = document.getElementById('cl-clase-idx').value;
    const mods = modulosData[cursoId] || [];
    const mod = mods[modIdx];
    if (!mod) { showToast('Módulo no encontrado', 'red'); return; }

    const titulo = document.getElementById('cl-titulo').value.trim();
    if (!titulo) { showToast('El título de la clase es obligatorio', 'red'); return; }

    const tipoBtn = document.querySelector('.tct.active');
    const tipo = tipoBtn ? tipoBtn.dataset.tipo : 'video';
    const esVideo = tipo === 'video';
    const esQuiz = tipo === 'quiz';
    const esTrabajo = tipo === 'trabajo';

    const ytUrl = esVideo ? document.getElementById('cl-yt-url').value.trim() : '';
    const video = ytUrl || '';

    const data = {
        modulo_id: mod.id,
        titulo,
        tipo_contenido: tipo,
        descripcion: document.getElementById('cl-desc').value.trim(),
        video,
        documento: esTrabajo ? '' : (document.getElementById('cl-recurso-name').textContent !== 'Sin archivo adjunto' ? document.getElementById('cl-recurso-name').textContent : ''),
        cuestionario: esQuiz ? 1 : 0,
        duracion: esVideo ? document.getElementById('cl-duracion').value.trim() : '',
        orden: parseInt(document.getElementById('cl-orden').value) || 0,
    };

    try {
        let json;
        if (claseId) {
            const res = await fetch(`${API_CURSOS}/clases_actualizar.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...data, id: parseInt(claseId) })
            });
            json = await res.json();
        } else {
            const res = await fetch(`${API_CURSOS}/clases_crear.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            json = await res.json();
        }
        if (json.success) {
            const savedId = claseId ? parseInt(claseId) : (json.id || 0);
            if (tipo === 'quiz' && savedId && window.preguntasData && window.preguntasData.length > 0) {
                await savePreguntasToApi(savedId, window.preguntasData);
            }
            showToast(claseId ? 'Clase actualizada ✓' : 'Clase creada ✓', 'green');
            closeModal('claseCrudModal');
            await loadClasesData();
            renderClasesPanel();
        } else {
            showToast('Error: ' + json.message, 'red');
        }
    } catch (e) {
        showToast('Error de conexión', 'red');
    }
}

async function eliminarClase(modIdx, claseIdx) {
    if (!selectedClasesCursoId) return;
    const mods = modulosData[selectedClasesCursoId] || [];
    const mod = mods[modIdx];
    if (!mod) return;
    const cl = mod.clases[claseIdx];
    if (!cl) return;
    if (!confirm('¿Eliminar la clase "' + cl.titulo + '"?')) return;
    try {
        const res = await fetch(`${API_CURSOS}/clases_eliminar.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: cl.id })
        });
        const json = await res.json();
        if (json.success) {
            showToast('Clase eliminada', '');
            await loadClasesData();
            renderClasesPanel();
        } else {
            showToast('Error: ' + json.message, 'red');
        }
    } catch (e) {
        showToast('Error de conexión', 'red');
    }
}

let editingCertId = null;

function openNewCertModal() {
    editingCertId = null;
    document.getElementById('certModalTitle').textContent = 'Nuevo Certificado';
    document.getElementById('certModalSub').textContent = 'Configura el certificado de finalización para un curso.';
    document.getElementById('cert-edit-idx').value = '';

    document.getElementById('cert-curso-new').style.display = '';
    document.getElementById('cert-curso-edit').style.display = 'none';
    const certCursoSel = document.getElementById('cert-curso');
    certCursoSel.innerHTML = '<option value="">Selecciona un curso...</option>';
    cursosData.forEach(c => {
        certCursoSel.innerHTML += '<option value="' + c.id + '">' + escHtml(c.titulo) + '</option>';
    });

    document.getElementById('cert-firma1-nombre').value = '';
    document.getElementById('cert-firma1-cargo').value = '';
    document.getElementById('cert-firma2-nombre').value = '';
    document.getElementById('cert-firma2-cargo').value = '';
    document.getElementById('cert-firma3-nombre').value = '';
    document.getElementById('cert-firma3-cargo').value = '';

    [1,2,3].forEach(n => {
        document.getElementById('cert-firma' + n + '-imagen').value = '';
        const preview = document.getElementById('cert-firma' + n + '-preview');
        if (preview) preview.innerHTML = '<span style="font-size:.6rem;color:var(--muted)">Sin img</span>';
        const fileInput = document.getElementById('cert-firma' + n + '-file');
        if (fileInput) fileInput.value = '';
    });

    document.getElementById('certSaveBtn').textContent = 'Crear certificado';
    openModal('certCrudModal');
}

async function uploadFirma(num, input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    if (file.size > 5 * 1024 * 1024) { showToast('Archivo supera 5 MB', 'red'); return; }

    const fd = new FormData();
    fd.append('archivo', file);
    try {
        const res = await fetch(`${API_ADMIN}/upload_firma.php`, { method: 'POST', body: fd });
        const json = await res.json();
        if (json.success) {
            document.getElementById('cert-firma' + num + '-imagen').value = json.url;
            document.getElementById('cert-firma' + num + '-preview').innerHTML = '<img src="' + escHtml(json.url) + '" style="width:100%;height:100%;object-fit:contain"/>';
            showToast('Imagen de firma ' + num + ' subida ✓', 'green');
        } else {
            showToast('Error: ' + json.message, 'red');
        }
    } catch (e) {
        showToast('Error de conexión al subir imagen', 'red');
    }
}

async function saveCert() {
    let cursoId;
    if (editingCertId) {
        const cert = certificadosData.find(c => c.id == editingCertId);
        cursoId = cert ? cert.curso_id : 0;
    } else {
        cursoId = parseInt(document.getElementById('cert-curso').value);
    }
    if (!cursoId) { showToast('Selecciona un curso', 'red'); return; }

    const payload = {
        curso_id: cursoId,
        firma1_nombre: document.getElementById('cert-firma1-nombre').value.trim(),
        firma1_cargo: document.getElementById('cert-firma1-cargo').value.trim(),
        firma1_imagen: document.getElementById('cert-firma1-imagen').value.trim(),
        firma2_nombre: document.getElementById('cert-firma2-nombre').value.trim(),
        firma2_cargo: document.getElementById('cert-firma2-cargo').value.trim(),
        firma2_imagen: document.getElementById('cert-firma2-imagen').value.trim(),
        firma3_nombre: document.getElementById('cert-firma3-nombre').value.trim(),
        firma3_cargo: document.getElementById('cert-firma3-cargo').value.trim(),
        firma3_imagen: document.getElementById('cert-firma3-imagen').value.trim()
    };

    try {
        const url = editingCertId
            ? `${API_ADMIN}/certificados.php?action=actualizar`
            : `${API_ADMIN}/certificados.php?action=crear`;
        if (editingCertId) payload.id = editingCertId;
        const res = await fetch(url, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (json.success) {
            showToast(editingCertId ? 'Certificado actualizado ✓' : 'Certificado creado ✓', 'green');
            editingCertId = null;
            closeModal('certCrudModal');
            await cargarCertificados();
            renderCerts();
        } else {
            showToast('Error: ' + json.message, 'red');
        }
    } catch (e) {
        showToast('Error de conexión', 'red');
    }
}



/* ══════════════════════════════════════════
   HELPER
   ══════════════════════════════════════════ */
function escHtml(str) {
    if (str == null) return '';
    if (typeof str !== 'string') str = String(str);
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderDescHtml(html) {
    if (!html) return '';
    return html.replace(/<br\s*\/?>/gi, '\n').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
}

function renderDescPreview(html) {
    if (!html) return '';
    var txt = html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').trim();
    return txt.length > 80 ? txt.substring(0, 80) + '...' : txt;
}

/* ══════════════════════════════════════════
   REPORTES
   ══════════════════════════════════════════ */
async function cargarReportes() {
    try {
        const res = await fetch(`${API_ADMIN}/reportes.php`);
        const json = await res.json();
        if (!json.success) return;
        const d = json.data;

        // Completitud por curso
        const compEl = document.getElementById('reportCompletitud');
        if (compEl && d.completitud && d.completitud.length) {
            compEl.innerHTML = d.completitud.map(c => {
                const pct = parseInt(c.porcentaje) || 0;
                const color = pct >= 75 ? 'var(--green)' : pct >= 40 ? 'var(--amber)' : 'var(--red)';
                const pctColor = pct >= 75 ? 'color:var(--green)' : '';
                return `<div><div style="display:flex;justify-content:space-between;font-size:.78rem;margin-bottom:.25rem"><span>${escHtml(c.titulo)}</span><span style="font-weight:600;${pctColor}">${pct}%</span></div><div style="height:5px;background:var(--warm-grey);border-radius:50px;overflow:hidden"><div style="width:${pct}%;height:100%;background:${color};border-radius:50px"></div></div></div>`;
            }).join('');
        } else if (compEl) {
            compEl.innerHTML = '<p style="font-size:.82rem;color:var(--muted)">Sin datos disponibles.</p>';
        }

        // Promedio de calificaciones
        const promEl = document.getElementById('reportPromedio');
        if (promEl) {
            const gn = d.prom_general || 0;
            promEl.innerHTML = `
                <div style="font-family:var(--font-disp);font-size:3rem;font-weight:700;color:var(--navy)">${gn}</div>
                <div style="font-size:.82rem;color:var(--muted);margin-top:.3rem">Promedio general (sobre 20)</div>
                <div style="display:flex;flex-direction:column;gap:.55rem;margin-top:.85rem;text-align:left">
                    <div><div style="display:flex;justify-content:space-between;font-size:.78rem;margin-bottom:.25rem"><span>Cuestionarios</span><span style="font-weight:600">${d.prom_quizzes || 0}/20</span></div><div style="height:5px;background:var(--warm-grey);border-radius:50px;overflow:hidden"><div style="width:${Math.round((d.prom_quizzes || 0) / 20 * 100)}%;height:100%;background:var(--navy);border-radius:50px"></div></div></div>
                    <div><div style="display:flex;justify-content:space-between;font-size:.78rem;margin-bottom:.25rem"><span>Trabajos prácticos</span><span style="font-weight:600">${d.prom_trabajos || 0}/20</span></div><div style="height:5px;background:var(--warm-grey);border-radius:50px;overflow:hidden"><div style="width:${Math.round((d.prom_trabajos || 0) / 20 * 100)}%;height:100%;background:var(--navy);border-radius:50px"></div></div></div>
                </div>`;
        }

        // Ingresos acumulados
        const ingEl = document.getElementById('reportIngresos');
        const ingTitle = document.getElementById('reportIngresosTitle');
        if (ingEl) {
            if (ingTitle) ingTitle.textContent = 'Ingresos acumulados';
            ingEl.innerHTML = `
                <div style="font-family:var(--font-disp);font-size:2.5rem;font-weight:700;color:var(--amber)">S/ ${(d.ingresos_total || 0).toLocaleString('es-PE', {minimumFractionDigits: 2})}</div>
                <div style="font-size:.82rem;color:var(--muted);margin-top:.3rem">${d.mes_inicio || ''} – ${d.mes_fin || ''}</div>
                <div style="display:flex;gap:.75rem;justify-content:center;margin-top:.5rem;flex-wrap:wrap">
                    <div style="text-align:center"><div style="font-family:var(--font-disp);font-size:1.3rem;font-weight:700;color:var(--navy)">${d.ventas_total || 0}</div><div style="font-size:.7rem;color:var(--muted)">Ventas totales</div></div>
                    <div style="text-align:center"><div style="font-family:var(--font-disp);font-size:1.3rem;font-weight:700;color:var(--navy)">S/ ${d.ingreso_prom || 0}</div><div style="font-size:.7rem;color:var(--muted)">Ingreso prom./est.</div></div>
                </div>`;
        }
    } catch (e) { console.error('Error cargando reportes:', e); }
}

/* ══════════════════════════════════════════
   LOGOUT
   ══════════════════════════════════════════ */
document.getElementById('btnLogout')?.addEventListener('click', function(e) {
    e.preventDefault();
    fetch('/PHP_DEC2/api/auth/logout.php', { method: 'POST' }).finally(function() {
        window.location.href = 'index.html';
    });
});

/* ══════════════════════════════════════════
   CONFIGURACIÓN — Load & Save
   ══════════════════════════════════════════ */
async function loadConfig() {
    try {
        const res = await fetch(`${API_ADMIN}/configuracion.php?action=listar`);
        const json = await res.json();
        if (json.success && json.data) {
            json.data.forEach(c => {
                const input = document.querySelector(`#pg-config input[data-key="${c.clave}"], #pg-config [data-key="${c.clave}"]`);
                if (input) input.value = c.valor || '';
            });
        }
    } catch (e) { console.error('Error cargando configuración:', e); }
}

async function saveConfig() {
    const inputs = document.querySelectorAll('#pg-config input[data-key]');
    const data = {};
    inputs.forEach(inp => { data[inp.dataset.key] = inp.value.trim(); });

    try {
        const res = await fetch(`${API_ADMIN}/configuracion.php?action=guardar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const json = await res.json();
        if (json.success) {
            showToast('Configuración guardada ✓', 'green');
        } else {
            showToast('Error: ' + (json.message || 'No se pudo guardar'), 'red');
        }
    } catch (e) {
        showToast('Error de conexión', 'red');
    }
}

/* ══════════════════════════════════════════
   USUARIOS — Editar con Rol
   ══════════════════════════════════════════ */
async function abrirEditarUsuario(id) {
    const u = usuariosData.find(x => x.id == id);
    if (!u) return;

    document.getElementById('eu-nombres').value = u.nombres || '';
    document.getElementById('eu-apellidos').value = u.apellidos || '';
    document.getElementById('eu-email').value = u.email || '';
    document.getElementById('eu-telefono').value = u.telefono || '';
    document.getElementById('eu-colegiado').value = u.colegiado || '';
    document.getElementById('eu-dni').value = u.dni || '';
    document.getElementById('eu-rol').value = u.rol || 'usuario';
    document.getElementById('eu-id').value = u.id;

    openModal('editUserModal');
}

async function saveUsuario() {
    const id = parseInt(document.getElementById('eu-id').value);
    const data = {
        id,
        nombres: document.getElementById('eu-nombres').value.trim(),
        apellidos: document.getElementById('eu-apellidos').value.trim(),
        email: document.getElementById('eu-email').value.trim(),
        telefono: document.getElementById('eu-telefono').value.trim(),
        colegiado: document.getElementById('eu-colegiado').value.trim(),
        dni: document.getElementById('eu-dni').value.trim(),
        rol: document.getElementById('eu-rol').value,
        password: document.getElementById('eu-password')?.value || '',
    };

    try {
        const res = await fetch(`${API_ADMIN}/usuarios.php?action=actualizar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const json = await res.json();
        if (json.success) {
            showToast('Usuario actualizado ✓', 'green');
            closeModal('editUserModal');
            await cargarUsuarios();
            renderUsers();
        } else {
            showToast('Error: ' + json.message, 'red');
        }
    } catch (e) { showToast('Error de conexión', 'red'); }
}

/* ══════════════════════════════════════════
   USUARIOS — Crear nuevo usuario
   ══════════════════════════════════════════ */
async function crearUsuario() {
    const data = {
        nombres: document.getElementById('nu-nombres').value.trim(),
        apellidos: document.getElementById('nu-apellidos').value.trim(),
        email: document.getElementById('nu-email').value.trim(),
        password: document.getElementById('nu-password').value,
        telefono: document.getElementById('nu-telefono').value.trim(),
        colegiado: document.getElementById('nu-colegiado').value.trim(),
        dni: document.getElementById('nu-dni').value.trim(),
        rol: document.getElementById('nu-rol').value,
    };

    if (!data.nombres || !data.email || !data.password) {
        showToast('Completa los campos obligatorios', 'red');
        return;
    }

    try {
        const res = await fetch(`${API_ADMIN}/usuarios.php?action=crear`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const json = await res.json();
        if (json.success) {
            showToast('Usuario creado ✓', 'green');
            closeModal('newUserModal');
            await cargarUsuarios();
            renderUsers();
        } else {
            showToast('Error: ' + json.message, 'red');
        }
    } catch (e) { showToast('Error de conexión', 'red'); }
}

/* ══════════════════════════════════════════
   QUICK CREATE (config page)
   ══════════════════════════════════════════ */
async function quickCreateCourse(status) {
    const title = document.getElementById('qcTitle')?.value.trim();
    if (!title) { showToast('El nombre del curso es obligatorio', 'red'); return; }

    const data = {
        titulo: title,
        precio: parseFloat(document.getElementById('qcPrice')?.value) || 0,
        duracion: document.getElementById('qcDur')?.value || '',
        docente_nombre: document.getElementById('qcInstructor')?.value || '',
        imagen: 'curso1.png',
        estado: status === 'published' ? 'Publicado' : 'Borrador',
    };

    try {
        const res = await fetch(`${API_CURSOS}/crear.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const json = await res.json();
        if (json.success) {
            showToast(`Curso "${title}" ${status === 'published' ? 'publicado' : 'creado como borrador'} ✓`, 'green');
            ['qcTitle', 'qcPrice', 'qcDur', 'qcInstructor', 'qcDesc'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
            await cargarCursos();
            renderCourses();
        } else {
            showToast('Error: ' + json.message, 'red');
        }
    } catch (e) { showToast('Error de conexión', 'red'); }
}

// ════════════════════════════════════════════
// QUESTION BUILDER (Quiz)
// ════════════════════════════════════════════

window.preguntasData = [];

function renderPreguntas() {
    const container = document.getElementById('preguntas-container');
    if (!container) return;
    if (window.preguntasData.length === 0) {
        container.innerHTML = '<p style="font-size:.78rem;color:var(--muted);padding:.5rem 0">No hay preguntas. Haz clic en "Añadir pregunta" para empezar.</p>';
        return;
    }
    container.innerHTML = window.preguntasData.map((p, pi) => `
        <div class="pregunta-card">
            <div class="q-header">
                <textarea placeholder="Escribe la pregunta aquí..." oninput="preguntasData[${pi}].texto=this.value">${escHtml(p.texto || '')}</textarea>
                <button class="q-del" onclick="removePregunta(${pi})" title="Eliminar pregunta">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                </button>
            </div>
            ${(p.opciones || []).map((o, oi) => `
                <div class="opcion-row">
                    <input type="radio" name="correcta-${pi}" ${o.es_correcta ? 'checked' : ''} onchange="setCorrecta(${pi},${oi})" title="Marcar como correcta"/>
                    <input type="text" placeholder="Opción ${String.fromCharCode(65 + oi)}" value="${escHtml(o.texto || '')}" oninput="preguntasData[${pi}].opciones[${oi}].texto=this.value"/>
                    <button class="o-del" onclick="removeOpcion(${pi},${oi})">✕</button>
                </div>
            `).join('')}
            <button class="add-opcion-btn" onclick="addOpcion(${pi})">+ Añadir opción</button>
        </div>
    `).join('');
}

function addPregunta() {
    window.preguntasData.push({ texto: '', opciones: [{ texto: '', es_correcta: false }, { texto: '', es_correcta: false }] });
    renderPreguntas();
    document.getElementById('preguntas-status').textContent = '';
}

function removePregunta(pi) {
    window.preguntasData.splice(pi, 1);
    renderPreguntas();
}

function addOpcion(pi) {
    if (!window.preguntasData[pi]) return;
    window.preguntasData[pi].opciones.push({ texto: '', es_correcta: false });
    renderPreguntas();
}

function removeOpcion(pi, oi) {
    const p = window.preguntasData[pi];
    if (!p || p.opciones.length <= 2) return;
    p.opciones.splice(oi, 1);
    renderPreguntas();
}

function setCorrecta(pi, oi) {
    const p = window.preguntasData[pi];
    if (!p) return;
    p.opciones.forEach((o, i) => { o.es_correcta = i === oi; });
}

async function loadPreguntas(claseId) {
    try {
        const res = await fetch(`${API_CURSOS}/preguntas_listar.php?clase_id=${claseId}`);
        const json = await res.json();
        if (json.success) {
            window.preguntasData = json.data.map(p => ({
                texto: p.texto,
                opciones: (p.opciones || []).map(o => ({
                    texto: o.texto,
                    es_correcta: o.es_correcta == 1,
                }))
            }));
            renderPreguntas();
            document.getElementById('preguntas-status').textContent = window.preguntasData.length + ' preguntas cargadas';
        }
    } catch (e) {}
}

async function savePreguntasToApi(claseId, preguntas) {
    try {
        await fetch(`${API_CURSOS}/preguntas_guardar.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clase_id: claseId, preguntas })
        });
    } catch (e) {}
}

async function guardarPreguntas() {
    const claseId = document.getElementById('cl-clase-idx').value;
    if (!claseId) {
        document.getElementById('preguntas-status').textContent = 'Guarda la clase primero';
        return;
    }
    const validas = window.preguntasData.filter(p => p.texto && p.texto.trim());
    if (validas.length === 0) {
        document.getElementById('preguntas-status').textContent = 'Agrega al menos una pregunta';
        return;
    }
    await savePreguntasToApi(parseInt(claseId), validas);
    document.getElementById('preguntas-status').textContent = validas.length + ' preguntas guardadas ✓';
    showToast('Preguntas guardadas ✓', 'green');
}

/* ══════════════════════════════════════════
   INSCRITOS — Modal con datos reales
   ══════════════════════════════════════════ */
function openStudentView(cursoId) {
    window.open('cursos.html?curso_id=' + cursoId, '_blank');
}

let enrolledData = [];

function openEnrolledModal(cursoId) {
    const sel = document.getElementById('enrolledCursoSelect');
    if (!sel) return;
    sel.innerHTML = cursosData.map(c =>
        `<option value="${c.id}" ${c.id == cursoId ? 'selected' : ''}>${escHtml(c.titulo)}</option>`
    ).join('');
    const curso = cursosData.find(c => c.id == cursoId);
    document.getElementById('enrolledCursoLabel').textContent = curso ? 'Curso: ' + curso.titulo : '';
    openModal('enrolledModal');
    loadEnrolledStudents();
}

async function loadEnrolledStudents() {
    const cursoId = document.getElementById('enrolledCursoSelect')?.value;
    if (!cursoId) return;
    const container = document.getElementById('enrolledList');
    const statsLabel = document.getElementById('enrolledStatsLabel');
    if (!container) return;

    container.innerHTML = '<div style="text-align:center;padding:1.5rem;color:var(--muted)">Cargando inscritos...</div>';

    try {
        const res = await fetch(`${API_CURSOS}/inscritos.php?action=listar&curso_id=${cursoId}`);
        const json = await res.json();
        if (!json.success) {
            container.innerHTML = '<div style="text-align:center;padding:1.5rem;color:var(--muted)">Error al cargar datos</div>';
            return;
        }
        enrolledData = json.data || [];
        const total = json.resumen?.total_inscritos || enrolledData.length;
        const promedioGeneral = enrolledData.length > 0
            ? Math.round(enrolledData.filter(e => e.progreso > 0).reduce((a, e) => a + e.progreso, 0) / enrolledData.length)
            : 0;

        if (statsLabel) {
            statsLabel.textContent = `${total} inscritos · Avance promedio: ${promedioGeneral}%`;
        }

        if (enrolledData.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--muted);font-size:.88rem">No hay estudiantes inscritos en este curso.</div>';
            return;
        }

        container.innerHTML = enrolledData.map(ins => {
            const initials = (ins.nombres?.charAt(0) || '') + (ins.apellidos?.charAt(0) || '');
            const fullName = ins.nombres + ' ' + ins.apellidos;
            const progColor = ins.progreso >= 80 ? 'green' : ins.progreso >= 40 ? 'amber' : 'red';
            const calif = ins.promedio !== null ? ins.promedio + '/100' : '—';
            const estadoBadge = ins.matricula_estado === 'Pagado'
                ? '<span style="color:var(--green)">✓ Pagado</span>'
                : '<span style="color:var(--amber)">⏳ Pendiente</span>';
            return `<div class="enrolled-row">
                <div class="enrolled-av" style="background:${progColor === 'green' ? 'var(--green)' : progColor === 'amber' ? 'var(--amber)' : 'var(--red)'}">${escHtml(initials)}</div>
                <div class="enrolled-name">
                    ${escHtml(fullName)}
                    <span style="font-size:.7rem;color:var(--muted)">${ins.colegiado || ins.email}</span>
                </div>
                <div style="display:flex;flex-direction:column;align-items:flex-end;gap:.15rem;min-width:140px">
                    <div style="display:flex;align-items:center;gap:.5rem">
                        <span style="font-size:.75rem;font-weight:600;color:var(--navy)">${ins.progreso}%</span>
                        <div class="mini-prog">
                            <div class="mini-prog-bar" style="width:70px">
                                <div class="mini-prog-fill ${progColor}" style="width:${ins.progreso}%"></div>
                            </div>
                        </div>
                    </div>
                    <div style="font-size:.7rem;color:var(--muted)">
                        ${ins.clases_completadas}/${ins.total_clases} clases · Prom: ${calif} · ${estadoBadge}
                    </div>
                </div>
            </div>`;
        }).join('');
    } catch (e) {
        container.innerHTML = '<div style="text-align:center;padding:1.5rem;color:var(--muted)">Error de conexión</div>';
        console.error('Error loading enrolled:', e);
    }
}

function exportEnrolledCSV() {
    if (!enrolledData.length) { showToast('No hay datos para exportar', 'red'); return; }
    const headers = ['Nombres', 'Apellidos', 'Email', 'Colegiado', 'Progreso %', 'Clases Completadas', 'Total Clases', 'Promedio', 'Estado Matrícula'];
    const rows = enrolledData.map(ins => [
        ins.nombres, ins.apellidos, ins.email, ins.colegiado || '',
        ins.progreso, ins.clases_completadas, ins.total_clases,
        ins.promedio ?? '', ins.matricula_estado
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'inscritos_curso.csv';
    a.click();
    URL.revokeObjectURL(url);
    showToast('CSV exportado ✓', 'green');
}

// ════════════════════════════════════════════
// MODAL PREGUNTAS — Gestión directa desde Clases & Contenido
// ════════════════════════════════════════════

let pmClaseId = null;
let pmPreguntas = [];

async function openPreguntasModal(claseId, titulo) {
    pmClaseId = claseId;
    pmPreguntas = [];
    document.getElementById('pmTitle').textContent = 'Preguntas: ' + titulo;
    document.getElementById('pmSub').textContent = 'Edita, agrega o elimina preguntas y alternativas';
    document.getElementById('pm-status').textContent = 'Cargando...';
    document.getElementById('pm-preguntas-list').innerHTML = '';

    try {
        const res = await fetch(`${API_CURSOS}/preguntas_listar.php?clase_id=${claseId}`);
        const json = await res.json();
        if (json.success && json.data) {
            pmPreguntas = json.data.map(p => ({
                id: p.id,
                texto: p.texto,
                orden: p.orden,
                opciones: (p.opciones || []).map(o => ({
                    id: o.id,
                    texto: o.texto,
                    es_correcta: o.es_correcta == 1,
                    orden: o.orden,
                }))
            }));
        }
    } catch (e) {
        console.error('Error cargando preguntas:', e);
    }

    renderPmPreguntas();
    document.getElementById('pm-status').textContent = pmPreguntas.length + ' pregunta(s)';
    openModal('preguntasModal');
}

function renderPmPreguntas() {
    const container = document.getElementById('pm-preguntas-list');
    if (!container) return;

    if (pmPreguntas.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--muted)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:36px;height:36px;margin:0 auto .65rem;opacity:.25"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg><p style="font-size:.88rem">No hay preguntas aún.<br/>Haz clic en "Añadir pregunta" para comenzar.</p></div>';
        return;
    }

    container.innerHTML = pmPreguntas.map((p, pi) => {
        const opciones = (p.opciones || []).map((o, oi) => {
            const cls = o.es_correcta ? ' correcta' : '';
            return `<div class="pm-opcion${cls}">
                <input type="radio" name="pm-correcta-${pi}" ${o.es_correcta ? 'checked' : ''} onchange="pmSetCorrecta(${pi},${oi})" title="Marcar como respuesta correcta"/>
                <input type="text" placeholder="Alternativa ${String.fromCharCode(65 + oi)}" value="${escHtml(o.texto || '')}" oninput="pmPreguntas[${pi}].opciones[${oi}].texto=this.value"/>
                ${o.es_correcta ? '<span class="pm-correcta-tag">✓ Correcta</span>' : ''}
                <button class="pm-op-del" onclick="pmRemoveOpcion(${pi},${oi})" title="Eliminar opción">✕</button>
            </div>`;
        }).join('');

        return `<div class="pm-pregunta">
            <div class="pm-pregunta-head">
                <div class="pm-q-num">${pi + 1}</div>
                <textarea class="pm-q-text" placeholder="Escribe la pregunta aquí..." oninput="pmPreguntas[${pi}].texto=this.value">${escHtml(p.texto || '')}</textarea>
                <button class="pm-q-del" onclick="pmRemovePregunta(${pi})" title="Eliminar pregunta">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                </button>
            </div>
            <div class="pm-opciones">${opciones}</div>
            <button class="pm-add-op" onclick="pmAddOpcion(${pi})">+ Añadir alternativa</button>
        </div>`;
    }).join('');
}

function pmAddPregunta() {
    pmPreguntas.push({
        texto: '',
        opciones: [
            { texto: '', es_correcta: true },
            { texto: '', es_correcta: false }
        ]
    });
    renderPmPreguntas();
    document.getElementById('pm-status').textContent = pmPreguntas.length + ' pregunta(s)';
}

function pmRemovePregunta(pi) {
    pmPreguntas.splice(pi, 1);
    renderPmPreguntas();
    document.getElementById('pm-status').textContent = pmPreguntas.length + ' pregunta(s)';
}

function pmAddOpcion(pi) {
    if (!pmPreguntas[pi]) return;
    pmPreguntas[pi].opciones.push({ texto: '', es_correcta: false });
    renderPmPreguntas();
}

function pmRemoveOpcion(pi, oi) {
    const p = pmPreguntas[pi];
    if (!p || p.opciones.length <= 2) {
        showToast('Cada pregunta debe tener al menos 2 alternativas', 'red');
        return;
    }
    const wasCorrecta = p.opciones[oi].es_correcta;
    p.opciones.splice(oi, 1);
    if (wasCorrecta && p.opciones.length > 0) {
        p.opciones[0].es_correcta = true;
    }
    renderPmPreguntas();
}

function pmSetCorrecta(pi, oi) {
    const p = pmPreguntas[pi];
    if (!p) return;
    p.opciones.forEach((o, i) => { o.es_correcta = i === oi; });
    renderPmPreguntas();
}

async function pmSavePreguntas() {
    if (!pmClaseId) { showToast('Error: no hay clase seleccionada', 'red'); return; }
    const validas = pmPreguntas.filter(p => p.texto && p.texto.trim());
    if (validas.length === 0) {
        showToast('Agrega al menos una pregunta con texto', 'red');
        return;
    }
    for (const p of validas) {
        const opsValidas = p.opciones.filter(o => o.texto && o.texto.trim());
        if (opsValidas.length < 2) {
            showToast('Cada pregunta debe tener al menos 2 alternativas con texto', 'red');
            return;
        }
        const tieneCorrecta = opsValidas.some(o => o.es_correcta);
        if (!tieneCorrecta) {
            showToast('Marca una respuesta correcta en cada pregunta', 'red');
            return;
        }
    }

    try {
        await fetch(`${API_CURSOS}/preguntas_guardar.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clase_id: pmClaseId, preguntas: validas })
        });
        showToast(validas.length + ' pregunta(s) guardada(s) ✓', 'green');
        document.getElementById('pm-status').textContent = validas.length + ' pregunta(s) guardadas ✓';
        await loadClasesData();
        renderClasesPanel();
    } catch (e) {
        showToast('Error al guardar', 'red');
    }
}



