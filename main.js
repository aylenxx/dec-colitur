/* ========================================
   DEC COLITUR — main.js
   Versión con Backend API completo
   CORREGIDO: URL dinámica + CORS + Redirección por rol
   ======================================== */

(function () {
  'use strict';

  // ========================================
  // CONFIGURACIÓN API - URL DINÁMICA
  // ========================================
  const getApiBase = () => {
    return '/PHP_DEC2/api/auth';
  };

  const getContactUrl = () => {
    return '/PHP_DEC2/api/send-email.php';
  };

  const API_BASE = getApiBase();
  const API_CONTACT = getContactUrl();

  console.log('🔗 API_BASE:', API_BASE);
  console.log('📧 API_CONTACT:', API_CONTACT);

  /* ══════════════════════════════════════════════════════
     DATOS DE CURSOS — CARGADOS DESDE LA BASE DE DATOS
  ══════════════════════════════════════════════════════ */
  const API_CURSOS = '/PHP_DEC2/api/cursos';
  let COURSES_DB = [];

  async function loadCoursesFromDB() {
    try {
      const res = await fetch(`${API_CURSOS}/listar.php?tipo=publico`);
      const json = await res.json();
      if (json.success && json.data) {
        COURSES_DB = json.data;

        // Cargar módulos para cada curso
        for (const c of COURSES_DB) {
          try {
            const modRes = await fetch(`${API_CURSOS}/listar.php?tipo=modulos&curso_id=${c.id}`);
            const modJson = await modRes.json();
            c._modulos = modJson.success ? modJson.data : [];
          } catch { c._modulos = []; }
        }

        renderCoursesGrid();
        renderCourseModalData();
      }
    } catch (e) {
      console.error('Error cargando cursos:', e);
    }
  }

  function renderCoursesGrid() {
    const grid = document.getElementById('coursesGrid');
    if (!grid) return;
    grid.innerHTML = '';

    COURSES_DB.forEach((c, idx) => {
      const article = document.createElement('article');
      article.className = 'course-card';
      article.dataset.course = idx;

      const img = c.imagen && c.imagen.startsWith('http') ? c.imagen : (c.imagen || 'curso1.png');
      const badge = c.badge || 'Curso';
      const cat = c.categoria_nombre || 'Sin categoría';
      const title = c.titulo || 'Sin título';
      const desc = c.descripcion_breve || '';

      article.innerHTML = `
        <div class="course-card-img" style="background-image:url('${img}')">
          <div class="course-badge">${badge}</div>
        </div>
        <div class="course-card-body">
          <span class="course-cat">${cat}</span>
          <h3 class="course-title">${title}</h3>
          <p class="course-desc">${desc.substring(0, 120)}${desc.length > 120 ? '...' : ''}</p>
          <button class="btn-card">Ver Curso →</button>
        </div>
      `;
      grid.appendChild(article);
    });

    // Re-attach event listeners
    grid.querySelectorAll('.course-card').forEach(card => {
      card.addEventListener('click', () => {
        const idx = parseInt(card.dataset.course, 10);
        renderCourseModal(idx);
        openModal(courseModal);
      });
    });

    // Re-apply scroll reveal
    grid.querySelectorAll('.course-card').forEach((el, i) => {
      el.classList.add('reveal', `reveal-delay-${(i % 3) + 1}`);
      revealObserver.observe(el);
    });
  }

  function renderCourseModalData() {
    // Pre-render modal if already visible
    if (courseModal && courseModal.classList.contains('open')) {
      const idx = parseInt(courseModal.dataset.currentIdx || '0', 10);
      renderCourseModal(idx);
    }
  }

  function renderCourseModal(idx) {
    const c = COURSES_DB[idx];
    if (!c) return;

    courseModal.dataset.currentIdx = idx;

    const img = c.imagen && c.imagen.startsWith('http') ? c.imagen : (c.imagen || 'curso1.png');
    document.getElementById('cmHero').style.backgroundImage = `url('${img}')`;
    document.getElementById('cmCat').textContent = c.categoria_nombre || 'Sin categoría';
    document.getElementById('cmTitle').textContent = c.titulo || 'Sin título';
    document.getElementById('cmDescText').textContent = c.descripcion_breve || '';
    document.getElementById('cmDescExtra').textContent = c.descripcion_ampliada || '';
    document.getElementById('cmCurrDesc').textContent = c.descripcion_curriculum || '';
    document.getElementById('cmPrice').textContent = `S/ ${parseFloat(c.precio || 0).toFixed(0)}`;

    const learnList = document.getElementById('cmLearnList');
    learnList.innerHTML = '';
    const learnItems = (c.aprenderas || '').split('<br>').filter(Boolean);
    learnItems.forEach(item => {
      const li = document.createElement('li');
      li.textContent = item;
      learnList.appendChild(li);
    });

    const modWrap = document.getElementById('cmModules');
    modWrap.innerHTML = '';
    const modulos = c._modulos || [];
    modulos.forEach(m => {
      const div = document.createElement('div');
      div.className = 'cm-module';
      div.innerHTML = `<span>${m.titulo || m.title || ''}</span><span>${m.sesiones || 0} sesiones</span>`;
      modWrap.appendChild(div);
    });

    document.getElementById('cmDetails').innerHTML = `
      <li>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/></svg>
        <div><strong>Instructor:</strong> <span>${c.docente_nombre || 'Sin asignar'}</span></div>
      </li>
      <li>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <div><strong>Duración:</strong> <span>${c.duracion || 'N/A'}</span></div>
      </li>
      <li>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <div><strong>Lecciones:</strong> <span>${c.cantidad_sesiones || 0}</span></div>
      </li>
      <li>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>
        <div><strong>Certificación:</strong> <span>${c.certificacion || 'No'}</span></div>
      </li>`;

    document.querySelectorAll('.cm-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.cm-panel').forEach(p => p.classList.remove('active'));
    document.querySelector('.cm-tab[data-ctab="desc"]').classList.add('active');
    document.getElementById('cmDesc').classList.add('active');
  }

  /* ══════════════════════════════════════════════════════
     DETECCIÓN DE TOKEN EN URL
  ══════════════════════════════════════════════════════ */
  const _urlParams = new URLSearchParams(window.location.search);
  const _urlToken  = _urlParams.get('token');
  const _urlMode   = _urlParams.get('mode');

  window._resetToken = null;

  async function checkURLToken() {
    if (_urlMode !== 'reset' || !_urlToken) {
      return;
    }

    const authModal = document.getElementById('authModal');
    if (!authModal) {
      console.error('Modal de autenticación no encontrado');
      return;
    }

    console.log('🔍 Detectado token en URL:', _urlToken);

    switchAuthPanel('recover');
    openModal(authModal);

    const backLink = document.getElementById('recoverBackLink');
    if (backLink) backLink.style.display = 'none';

    try {
      const response = await fetch(`${API_BASE}/validate-token.php?token=${encodeURIComponent(_urlToken)}`);
      const data = await response.json();

      if (data.valid) {
        console.log('✅ Token válido para:', data.email);
        window._resetToken = _urlToken;
        showRecoverStep(3);
      } else {
        console.log('❌ Token inválido:', data.message);
        showRecoverStep('invalid');
      }
    } catch (error) {
      console.error('Error validando token:', error);
      showRecoverStep('invalid');
    }

    if (window.history && window.history.replaceState) {
      window.history.replaceState(
        { path: window.location.pathname },
        document.title,
        window.location.pathname
      );
    }
  }

  /* ══════════════════════════════════════════════════════
     HEADER — scroll + hamburger + smooth scroll + active nav
  ══════════════════════════════════════════════════════ */
  const header    = document.getElementById('siteHeader');
  const hamburger = document.getElementById('hamburger');
  const mainNav   = document.getElementById('mainNav');

  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 60);
  }, { passive: true });
  header.classList.toggle('scrolled', window.scrollY > 60);

  hamburger.addEventListener('click', () => {
    const open = mainNav.classList.toggle('open');
    hamburger.classList.toggle('active', open);
    document.body.style.overflow = open ? 'hidden' : '';
  });

  mainNav.querySelectorAll('a, button').forEach(el => {
    el.addEventListener('click', () => {
      mainNav.classList.remove('open');
      hamburger.classList.remove('active');
      document.body.style.overflow = '';
    });
  });

  document.addEventListener('click', (e) => {
    if (mainNav.classList.contains('open') &&
        !mainNav.contains(e.target) &&
        !hamburger.contains(e.target)) {
      mainNav.classList.remove('open');
      hamburger.classList.remove('active');
      document.body.style.overflow = '';
    }
  });

  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', (e) => {
      const target = document.querySelector(a.getAttribute('href'));
      if (target) {
        e.preventDefault();
        const top = target.getBoundingClientRect().top + window.scrollY - 80;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });

  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-link');
  window.addEventListener('scroll', () => {
    let current = '';
    sections.forEach(s => { if (s.getBoundingClientRect().top <= 120) current = s.id; });
    navLinks.forEach(l => {
      l.classList.toggle('active-nav', l.getAttribute('href') === `#${current}`);
    });
  }, { passive: true });

  /* ══════════════════════════════════════════════════════
     FAQ ACCORDION
  ══════════════════════════════════════════════════════ */
  document.querySelectorAll('.faq-item').forEach(item => {
    const trigger = item.querySelector('.faq-trigger');
    const body    = item.querySelector('.faq-body');
    trigger.addEventListener('click', () => {
      const isOpen = trigger.getAttribute('aria-expanded') === 'true';
      document.querySelectorAll('.faq-item').forEach(o => {
        o.querySelector('.faq-trigger').setAttribute('aria-expanded', 'false');
        o.querySelector('.faq-body').classList.remove('open');
      });
      if (!isOpen) {
        trigger.setAttribute('aria-expanded', 'true');
        body.classList.add('open');
      }
    });
  });

  /* ══════════════════════════════════════════════════════
     SCROLL REVEAL
  ══════════════════════════════════════════════════════ */
  document.querySelectorAll(
    '.course-card, .why-list li, .faq-item, .contact-info-item, .contact-form, .about-text-col'
  ).forEach((el, i) => {
    el.classList.add('reveal', `reveal-delay-${(i % 3) + 1}`);
  });

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('visible'); revealObserver.unobserve(e.target); }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

  /* ══════════════════════════════════════════════════════
     PARALLAX HERO
  ══════════════════════════════════════════════════════ */
  const hero = document.querySelector('.hero');
  if (hero) {
    window.addEventListener('scroll', () => {
      hero.style.backgroundPositionY = `calc(50% + ${window.scrollY * 0.25}px)`;
    }, { passive: true });
  }

  /* ══════════════════════════════════════════════════════
     MODAL HELPERS
  ══════════════════════════════════════════════════════ */
  function openModal(modal) {
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal(modal) {
    modal.classList.remove('open');
    document.body.style.overflow = '';
    const at = document.querySelector('.auth-tabs');
    if (at) at.classList.remove('recover-mode');
    resetRecoverPanel();
  }

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal(overlay);
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.open').forEach(m => closeModal(m));
    }
  });

  /* ══════════════════════════════════════════════════════
     AUTH MODAL — abrir / cerrar
  ══════════════════════════════════════════════════════ */
  const authModal    = document.getElementById('authModal');
  const openLoginBtn = document.getElementById('openLoginBtn');
  const closeAuth    = document.getElementById('closeAuthModal');

  if (openLoginBtn) {
    openLoginBtn.addEventListener('click', () => {
      switchAuthPanel('login');
      openModal(authModal);
    });
  }

  if (closeAuth) {
    closeAuth.addEventListener('click', () => closeModal(authModal));
  }

  /* ══════════════════════════════════════════════════════
     switchAuthPanel
  ══════════════════════════════════════════════════════ */
  function switchAuthPanel(target) {
    const authTabs = document.getElementById('authTabs');
    const panels   = { login: 'loginPanel', register: 'registerPanel', recover: 'recoverPanel' };

    document.querySelectorAll('.auth-panel').forEach(p => p.classList.remove('active'));

    if (target === 'recover') {
      authTabs.classList.add('recover-mode');
      updateStepDots(1);
    } else {
      authTabs.classList.remove('recover-mode');
      document.querySelectorAll('.auth-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === target);
      });
    }

    const panelId = panels[target];
    if (panelId) document.getElementById(panelId).classList.add('active');
  }

  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => switchAuthPanel(tab.dataset.tab));
  });

  document.querySelectorAll('.link-btn[data-switch]').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.switch;
      if (target === 'recover') resetRecoverPanel();
      switchAuthPanel(target);
    });
  });

  /* ══════════════════════════════════════════════════════
     INDICADOR DE PASOS
  ══════════════════════════════════════════════════════ */
  function updateStepDots(active) {
    ['sd1','sd2','sd3'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('active', 'done');
    });
    ['sl1','sl2'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('done');
    });

    if (active >= 1) {
      const sd1 = document.getElementById('sd1');
      if (sd1) sd1.classList.add(active === 1 ? 'active' : 'done');
    }
    if (active >= 2) {
      const sl1 = document.getElementById('sl1');
      const sd2 = document.getElementById('sd2');
      if (sl1) sl1.classList.add('done');
      if (sd2) sd2.classList.add(active === 2 ? 'active' : 'done');
    }
    if (active >= 3) {
      const sl2 = document.getElementById('sl2');
      const sd3 = document.getElementById('sd3');
      if (sl2) sl2.classList.add('done');
      if (sd3) sd3.classList.add('active');
    }
  }

  /* ══════════════════════════════════════════════════════
     showRecoverStep
  ══════════════════════════════════════════════════════ */
  const ALL_STEPS = ['recoverStep1','recoverStep2','recoverStep3','recoverStep4','recoverInvalid'];

  function showRecoverStep(step) {
    ALL_STEPS.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });

    if (step === 'invalid') {
      const inv = document.getElementById('recoverInvalid');
      if (inv) {
        inv.style.display = 'block';
      }
      const stepIndicator = document.getElementById('stepIndicator');
      if (stepIndicator) stepIndicator.style.display = 'none';
      return;
    }

    const stepIndicator = document.getElementById('stepIndicator');
    if (stepIndicator) stepIndicator.style.display = 'flex';

    const el = document.getElementById('recoverStep' + step);
    if (el) el.style.display = 'block';

    if (step === 1) updateStepDots(1);
    if (step === 2) updateStepDots(2);
    if (step === 3) updateStepDots(2);
    if (step === 4) updateStepDots(3);
  }

  function resetRecoverPanel() {
    ALL_STEPS.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });

    const step1 = document.getElementById('recoverStep1');
    if (step1) step1.style.display = 'block';

    const rf = document.getElementById('recoverForm');
    if (rf) rf.reset();

    const sf = document.getElementById('strengthFill');
    const sl = document.getElementById('strengthLabel');
    const mm = document.getElementById('matchMsg');
    const np = document.getElementById('newPassword');
    const cp = document.getElementById('confirmPassword');
    if (sf) { sf.style.width = '0%'; sf.className = 'strength-fill'; }
    if (sl) { sl.textContent = ''; sl.className = 'strength-label'; }
    if (mm) { mm.textContent = ''; mm.className = 'match-msg'; }
    if (np) np.value = '';
    if (cp) cp.value = '';

    window._resetToken = null;

    const stepIndicator = document.getElementById('stepIndicator');
    if (stepIndicator) stepIndicator.style.display = 'flex';

    updateStepDots(1);
  }

  /* ══════════════════════════════════════════════════════
     RECOVER — Paso 1: enviar correo
  ══════════════════════════════════════════════════════ */
  const recoverForm      = document.getElementById('recoverForm');
  const recoverEmailSent = document.getElementById('recoverEmailSent');
  const recoverResendBtn = document.getElementById('recoverResendBtn');

  if (recoverForm) {
    recoverForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const emailVal = document.getElementById('recoverEmail').value.trim();
      const btn      = document.getElementById('recoverSubmitBtn');

      btn.textContent = 'Enviando...';
      btn.disabled    = true;

      try {
        const response = await fetch(`${API_BASE}/forgot-password.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailVal })
        });

        const data = await response.json();

        btn.textContent = 'Enviar enlace de recuperación';
        btn.disabled    = false;

        if (data.success) {
          if (recoverEmailSent) recoverEmailSent.textContent = emailVal;
          showRecoverStep(2);
        } else {
          alert(data.message || 'Error al enviar el correo. Intenta de nuevo.');
        }
      } catch (error) {
        console.error('Error:', error);
        btn.textContent = 'Enviar enlace de recuperación';
        btn.disabled    = false;
        alert('Error de conexión. Verifica que el servidor esté corriendo.');
      }
    });
  }

  if (recoverResendBtn) {
    recoverResendBtn.addEventListener('click', async () => {
      const emailVal = recoverEmailSent ? recoverEmailSent.textContent : '';
      if (!emailVal) return;

      recoverResendBtn.textContent = 'Reenviando...';
      recoverResendBtn.disabled    = true;

      try {
        const response = await fetch(`${API_BASE}/forgot-password.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailVal })
        });

        const data = await response.json();

        if (data.success) {
          recoverResendBtn.textContent = 'Reenviado ✓';
          setTimeout(() => {
            recoverResendBtn.textContent = 'Reenviar correo';
            recoverResendBtn.disabled    = false;
          }, 5000);
        } else {
          recoverResendBtn.textContent = 'Reenviar correo';
          recoverResendBtn.disabled    = false;
          alert(data.message || 'Error al reenviar');
        }
      } catch (error) {
        recoverResendBtn.textContent = 'Reenviar correo';
        recoverResendBtn.disabled    = false;
        alert('Error de conexión');
      }
    });
  }

  /* ══════════════════════════════════════════════════════
     RECOVER — Paso 3: barra de fortaleza y coincidencia
  ══════════════════════════════════════════════════════ */
  function getStrength(pwd) {
    let score = 0;
    if (pwd.length >= 8)          score++;
    if (pwd.length >= 12)         score++;
    if (/[A-Z]/.test(pwd))        score++;
    if (/[0-9]/.test(pwd))        score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    const levels = [
      { level: 'weak',   label: 'Débil',   pct: '25%'  },
      { level: 'weak',   label: 'Débil',   pct: '25%'  },
      { level: 'fair',   label: 'Regular', pct: '50%'  },
      { level: 'good',   label: 'Buena',   pct: '75%'  },
      { level: 'strong', label: 'Segura',  pct: '100%' },
      { level: 'strong', label: 'Segura',  pct: '100%' },
    ];
    return levels[Math.min(score, 5)];
  }

  const newPassInput  = document.getElementById('newPassword');
  const confirmInput  = document.getElementById('confirmPassword');
  const strengthFill  = document.getElementById('strengthFill');
  const strengthLabel = document.getElementById('strengthLabel');
  const matchMsg      = document.getElementById('matchMsg');

  function checkMatch() {
    if (!confirmInput || !confirmInput.value) {
      if (matchMsg) matchMsg.textContent = '';
      return false;
    }
    const match = newPassInput.value === confirmInput.value;
    matchMsg.textContent = match ? '✓ Las contraseñas coinciden' : '✗ Las contraseñas no coinciden';
    matchMsg.className   = `match-msg ${match ? 'ok' : 'fail'}`;
    return match;
  }

  if (newPassInput) {
    newPassInput.addEventListener('input', () => {
      const pwd = newPassInput.value;
      if (!pwd) {
        if (strengthFill)  { strengthFill.style.width = '0%'; strengthFill.className = 'strength-fill'; }
        if (strengthLabel) { strengthLabel.textContent = ''; strengthLabel.className = 'strength-label'; }
        checkMatch();
        return;
      }
      const s = getStrength(pwd);
      if (strengthFill)  { strengthFill.style.width = s.pct; strengthFill.className = `strength-fill ${s.level}`; }
      if (strengthLabel) { strengthLabel.textContent = s.label; strengthLabel.className = `strength-label ${s.level}`; }
      checkMatch();
    });
  }

  if (confirmInput) {
    confirmInput.addEventListener('input', checkMatch);
  }

  /* ══════════════════════════════════════════════════════
     RECOVER — Paso 3: formulario nueva contraseña
  ══════════════════════════════════════════════════════ */
  const resetPasswordForm = document.getElementById('resetPasswordForm');

  if (resetPasswordForm) {
    resetPasswordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const pwd     = newPassInput ? newPassInput.value : '';
      const confirm = confirmInput ? confirmInput.value : '';
      const btn     = document.getElementById('resetSubmitBtn');

      if (pwd.length < 8)  { if (newPassInput) newPassInput.focus(); return; }
      if (pwd !== confirm) { checkMatch(); if (confirmInput) confirmInput.focus(); return; }

      const token = window._resetToken;
      if (!token) {
        alert('Error: Token no encontrado. Solicita un nuevo enlace.');
        return;
      }

      btn.textContent = 'Actualizando...';
      btn.disabled    = true;

      try {
        const response = await fetch(`${API_BASE}/reset-password.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: token, password: pwd })
        });

        const data = await response.json();

        btn.textContent = 'Actualizar contraseña';
        btn.disabled    = false;

        if (data.success) {
          showRecoverStep(4);
          setChangeDate();
        } else {
          alert(data.message || 'Error al actualizar. Intenta de nuevo.');
        }
      } catch (error) {
        console.error('Error:', error);
        btn.textContent = 'Actualizar contraseña';
        btn.disabled    = false;
        alert('Error de conexión. Intenta de nuevo.');
      }
    });
  }

  function setChangeDate() {
    const el = document.getElementById('changeDate');
    if (!el) return;
    const now = new Date();
    el.textContent = now.toLocaleDateString('es-PE', {
      day: '2-digit', month: 'long', year: 'numeric'
    }) + ' a las ' + now.toLocaleTimeString('es-PE', {
      hour: '2-digit', minute: '2-digit'
    });
  }

  /* ══════════════════════════════════════════════════════
     RECOVER — Paso 4: ir a login
  ══════════════════════════════════════════════════════ */
  const goToLoginBtn = document.getElementById('goToLoginBtn');
  if (goToLoginBtn) {
    goToLoginBtn.addEventListener('click', () => {
      resetRecoverPanel();
      const bl = document.getElementById('recoverBackLink');
      if (bl) bl.style.display = 'block';
      switchAuthPanel('login');
    });
  }

  /* ══════════════════════════════════════════════════════
     BOTÓN "Solicitar nuevo enlace"
  ══════════════════════════════════════════════════════ */
  const reqNewLinkBtn = document.getElementById('reqNewLinkBtn');
  if (reqNewLinkBtn) {
    reqNewLinkBtn.addEventListener('click', () => {
      resetRecoverPanel();
      switchAuthPanel('recover');
      const bl = document.getElementById('recoverBackLink');
      if (bl) bl.style.display = 'block';
    });
  }

  /* ══════════════════════════════════════════════════════
     TOGGLE VISIBILIDAD CONTRASEÑA
  ══════════════════════════════════════════════════════ */
  document.querySelectorAll('.toggle-pass').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = btn.previousElementSibling;
      if (input) input.type = input.type === 'password' ? 'text' : 'password';
    });
  });

  /* ══════════════════════════════════════════════════════
     FORMULARIO LOGIN (BACKEND REAL) ✅ CON REDIRECCIÓN POR ROL
  ══════════════════════════════════════════════════════ */
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn  = loginForm.querySelector('button[type="submit"]');
      const orig = btn.textContent;

      const email = document.getElementById('loginEmail').value;
      const password = document.getElementById('loginPass').value;

      btn.textContent = 'Ingresando...';
      btn.disabled    = true;

      try {
        const response = await fetch(`${API_BASE}/login.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        btn.textContent = orig;
        btn.disabled    = false;

        if (data.success) {
          localStorage.setItem('dec_user', JSON.stringify(data.usuario));

          alert(`✅ Bienvenido ${data.usuario.nombres}!`);
          closeModal(authModal);

          // ✅ REDIRECCIÓN SEGÚN ROL
          setTimeout(() => {
            if (data.usuario.rol === 'admin') {
              window.location.href = 'admin.html';
            } else {
              window.location.href = 'dashboard.html';
            }
          }, 500);
        } else {
          alert(data.message || 'Error al iniciar sesión');
        }
      } catch (error) {
        console.error('Error login:', error);
        btn.textContent = orig;
        btn.disabled    = false;
        alert('Error de conexión. Verifica que el servidor esté corriendo.');
      }
    });
  }

  /* ══════════════════════════════════════════════════════
     FORMULARIO REGISTRO (BACKEND REAL)
  ══════════════════════════════════════════════════════ */
  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn  = registerForm.querySelector('button[type="submit"]');
      const orig = btn.textContent;

      const nombres = document.getElementById('regNombre').value;
      const apellidos = document.getElementById('regApellido').value;
      const email = document.getElementById('regEmail').value;
      const password = document.getElementById('regPass').value;
      const colegiado = document.getElementById('regColegiado').value;

      btn.textContent = 'Creando cuenta...';
      btn.disabled    = true;

      try {
        const response = await fetch(`${API_BASE}/register.php`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombres, apellidos, email, password, colegiado })
        });

        const data = await response.json();

        btn.textContent = orig;
        btn.disabled    = false;

        if (data.success) {
          alert('✅ Cuenta creada exitosamente. Ahora puedes iniciar sesión.');
          registerForm.reset();
          switchAuthPanel('login');
        } else {
          alert(data.message || 'Error al registrar. Intenta de nuevo.');
        }
      } catch (error) {
        console.error('Error registro:', error);
        btn.textContent = orig;
        btn.disabled    = false;
        alert('Error de conexión. Verifica que el servidor esté corriendo.');
      }
    });
  }

  // Función para actualizar UI después de login
  function updateUIAfterLogin(usuario) {
    const loginBtn = document.getElementById('openLoginBtn');
    if (loginBtn) {
      loginBtn.textContent = `${usuario.nombres} ${usuario.apellidos}`;
      loginBtn.onclick = () => {
        if (confirm('¿Cerrar sesión?')) {
          fetch(`${API_BASE}/logout.php`, { method: 'POST' })
            .catch(() => {})
            .finally(() => {
              localStorage.removeItem('dec_user');
              window.location.reload();
            });
        }
      };
    }
  }

  // Verificar si hay sesión activa al cargar
  function checkSession() {
    const userStr = localStorage.getItem('dec_user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        updateUIAfterLogin(user);
      } catch(e) {
        localStorage.removeItem('dec_user');
      }
    }
  }

  /* ══════════════════════════════════════════════════════
     MODAL DE CURSO
  ══════════════════════════════════════════════════════ */
  const courseModal = document.getElementById('courseModal');
  const closeCourse = document.getElementById('closeCourseModal');

  if (closeCourse) {
    closeCourse.addEventListener('click', () => closeModal(courseModal));
  }

  // ── ACCIÓN BOTÓN COMPRAR AHORA DENTRO DEL MODAL ──
  const buyBtn = courseModal.querySelector('.cm-buy-btn');
  if (buyBtn) {
    buyBtn.addEventListener('click', () => {
      const courseTitle = document.getElementById('cmTitle').textContent;
      closeModal(courseModal);

      const asuntoInput = document.getElementById('asunto');
      if (asuntoInput) {
        asuntoInput.value = `Interés en comprar el curso: ${courseTitle}`;
      }

      const targetSection = document.getElementById('contacto');
      if (targetSection) {
        const top = targetSection.getBoundingClientRect().top + window.scrollY - 80;
        window.scrollTo({ top, behavior: 'smooth' });
      }

      const nombreInput = document.getElementById('nombre');
      if (nombreInput) {
        setTimeout(() => nombreInput.focus(), 600);
      }
    });
  }

  // Los listeners de course-card ahora se crean dinámicamente en renderCoursesGrid()

  /* ══════════════════════════════════════════════════════
     FORMULARIO DE CONTACTO (BACKEND REAL) 
  ══════════════════════════════════════════════════════ */
  const contactForm = document.getElementById('contactForm');
  const formSuccess = document.getElementById('formSuccess');

  if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = contactForm.querySelector('button[type="submit"]');
      const origText = btn.textContent;

      const formData = {
        nombre:  document.getElementById('nombre').value.trim(),
        email:   document.getElementById('email').value.trim(),
        asunto:  document.getElementById('asunto').value.trim(),
        mensaje: document.getElementById('mensaje').value.trim()
      };

      if (!formData.nombre || !formData.email || !formData.mensaje) {
        alert('Por favor completa todos los campos obligatorios.');
        return;
      }

      btn.textContent = 'Enviando...';
      btn.disabled    = true;

      try {
        const response = await fetch(API_CONTACT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });

        const result = await response.json();

        if (result.success) {
          contactForm.reset();
          formSuccess.textContent = '✅ ¡Mensaje enviado correctamente! Nos pondremos en contacto pronto.';
          formSuccess.classList.add('show');
          setTimeout(() => formSuccess.classList.remove('show'), 6000);
        } else {
          throw new Error(result.message || 'Error del servidor');
        }
      } catch (error) {
        console.error('Error enviando contacto:', error);
        alert('Hubo un error al enviar el mensaje. Por favor, inténtalo más tarde.');
      } finally {
        btn.textContent = origText;
        btn.disabled    = false;
      }
    });
  }

  /* ══════════════════════════════════════════════════════
     INICIALIZACIÓN
  ══════════════════════════════════════════════════════ */
  document.querySelectorAll('.cm-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.cm-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.cm-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.ctab === 'desc' ? 'cmDesc' : 'cmCurr').classList.add('active');
    });
  });

  checkURLToken();
  checkSession();
  loadCoursesFromDB();

})();
