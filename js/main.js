(() => {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Page-load intro ---------- */

  const intro = document.querySelector('[data-intro]');
  if (intro) {
    if (prefersReducedMotion) {
      intro.classList.add('is-done');
    } else {
      window.addEventListener('load', () => {
        setTimeout(() => {
          intro.classList.add('is-leaving');
          setTimeout(() => intro.classList.add('is-done'), 1000);
        }, 350);
      });
      // Safety net: never block the page for more than 2.5s even if load stalls.
      setTimeout(() => intro.classList.add('is-leaving', 'is-done'), 2500);
    }
  }

  /* ---------- Nav solidify on scroll ---------- */

  const nav = document.querySelector('[data-nav]');
  if (nav) {
    const syncNav = () => nav.classList.toggle('is-scrolled', window.scrollY > 40);
    syncNav();
    window.addEventListener('scroll', syncNav, { passive: true });
  }

  /* ---------- Floating booking CTA ---------- */

  const floatCta = document.querySelector('[data-float-cta]');
  if (floatCta) {
    const syncFloatCta = () => {
      const pastHero = window.scrollY > window.innerHeight * 0.9;
      const nearBottom = window.scrollY + window.innerHeight > document.documentElement.scrollHeight - 200;
      floatCta.classList.toggle('is-visible', pastHero && !nearBottom);
    };
    syncFloatCta();
    window.addEventListener('scroll', syncFloatCta, { passive: true });
    window.addEventListener('resize', syncFloatCta);
  }

  /* ---------- Scroll reveal ---------- */

  const revealTargets = document.querySelectorAll('[data-reveal]');
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });
  revealTargets.forEach((el) => revealObserver.observe(el));

  /* ---------- Chapter scroll-scrub (canvas frame sequence) ---------- */

  const chapterState = Array.from(document.querySelectorAll('.chapter')).map((chapter) => {
    const canvas = chapter.querySelector('.chapter-canvas');
    const caption = chapter.querySelector('.chapter-caption');
    return {
      chapter,
      canvas,
      ctx: canvas.getContext('2d'),
      frameCount: parseInt(chapter.dataset.frameCount, 10),
      frameBase: chapter.dataset.frameBase,
      images: [],
      loaded: false,
      currentFrame: -1,
      card: chapter.querySelector('.chapter-card'),
      tuckDim: chapter.querySelector('[data-tuck-dim]'),
      caption,
      captionIsCenter: caption ? caption.classList.contains('chapter-caption-center') : false,
    };
  });

  function frameUrl(base, index) {
    return `${base}${String(index).padStart(3, '0')}.webp`;
  }

  function sizeCanvas(state) {
    const card = state.chapter.querySelector('.chapter-card');
    const rect = card.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    state.canvas.width = Math.round(rect.width * dpr);
    state.canvas.height = Math.round(rect.height * dpr);
    state.currentFrame = -1;
  }

  function drawFrame(state, index) {
    const img = state.images[index];
    if (!img || !img.complete || img.naturalWidth === 0) return;
    if (state.currentFrame === index) return;
    state.currentFrame = index;

    const { ctx, canvas } = state;
    const canvasRatio = canvas.width / canvas.height;
    const imgRatio = img.naturalWidth / img.naturalHeight;
    let drawWidth, drawHeight, offsetX, offsetY;

    if (imgRatio > canvasRatio) {
      drawHeight = canvas.height;
      drawWidth = drawHeight * imgRatio;
      offsetX = (canvas.width - drawWidth) / 2;
      offsetY = 0;
    } else {
      drawWidth = canvas.width;
      drawHeight = drawWidth / imgRatio;
      offsetX = 0;
      offsetY = (canvas.height - drawHeight) / 2;
    }
    ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
  }

  function loadChapter(state) {
    if (state.loaded) return;
    state.loaded = true;
    sizeCanvas(state);
    for (let i = 1; i <= state.frameCount; i += 1) {
      const img = new Image();
      img.decoding = 'async';
      img.src = frameUrl(state.frameBase, i);
      state.images[i - 1] = img;
    }
    state.images[0].addEventListener('load', () => drawFrame(state, 0));
  }

  const loadObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const state = chapterState.find((s) => s.chapter === entry.target);
      if (state) loadChapter(state);
    });
  }, { rootMargin: '100% 0px 100% 0px' });

  chapterState.forEach((state) => loadObserver.observe(state.chapter));

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      chapterState.forEach((state) => { if (state.loaded) sizeCanvas(state); });
    }, 150);
  });

  /* ---------- Chapter progress rail ---------- */

  const chapterRail = document.querySelector('[data-chapter-rail]');
  const railDots = chapterRail ? Array.from(chapterRail.querySelectorAll('[data-rail-target]')) : [];
  const chaptersSection = document.getElementById('chapters');

  railDots.forEach((dot) => {
    dot.addEventListener('click', () => {
      const n = dot.dataset.railTarget;
      const target = document.querySelector(`.chapter[data-chapter="${n}"]`);
      if (target) target.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    });
  });

  function tickChapters() {
    const viewportHeight = window.innerHeight;
    let activeIndex = -1;

    chapterState.forEach((state, i) => {
      const { chapter, frameCount } = state;
      const rect = chapter.getBoundingClientRect();
      const scrollableHeight = chapter.offsetHeight - viewportHeight;
      if (scrollableHeight <= 0) return;

      const progress = Math.min(Math.max(-rect.top / scrollableHeight, 0), 1);
      const inView = rect.top < viewportHeight && rect.bottom > 0;

      if (inView) activeIndex = i;

      if (state.loaded && inView) {
        const frameIndex = Math.min(frameCount - 1, Math.floor(progress * frameCount));
        drawFrame(state, frameIndex);
      }

      // Only touch styles for chapters actually near the viewport — with 6
      // chapters this loop runs every animation frame, so skipping off-screen
      // ones avoids paying for style writes (and repaints) nobody can see.
      if (!inView) return;

      // Reveal fast (readable almost as soon as the chapter is on screen) and
      // hold through most of the scroll, so a quick-scrolling visitor still
      // catches the text instead of only seeing mid-fade motion.
      const caption = state.caption;
      if (caption) {
        const revealProgress = Math.min(progress / 0.06, 1);
        const fadeOutProgress = progress > 0.88 ? (progress - 0.88) / 0.12 : 0;
        const opacity = Math.max(revealProgress - fadeOutProgress, 0);
        caption.style.opacity = opacity;
        const translate = (1 - revealProgress) * 10;
        caption.style.transform = state.captionIsCenter
          ? `translate(-50%, calc(-50% + ${translate}px))`
          : `translateY(${translate}px)`;
      }

      // "Stacking cards": as a chapter nears its end, the card tucks back
      // (scales down, dims slightly) just before the next card slides over
      // it. Scale is a compositor-only transform; the dim uses a plain
      // opacity overlay instead of a CSS filter, which would force a repaint
      // of the canvas underneath on every frame.
      const tuckProgress = progress > 0.85 ? (progress - 0.85) / 0.15 : 0;
      if (state.card) state.card.style.transform = tuckProgress > 0 ? `scale(${1 - tuckProgress * 0.06})` : '';
      if (state.tuckDim) state.tuckDim.style.opacity = tuckProgress * 0.35;
    });

    if (chapterRail && chaptersSection) {
      const secRect = chaptersSection.getBoundingClientRect();
      chapterRail.classList.toggle('is-active', secRect.top < viewportHeight * 0.6 && secRect.bottom > viewportHeight * 0.4);
      railDots.forEach((dot, i) => dot.classList.toggle('is-active', i === activeIndex));
    }

    requestAnimationFrame(tickChapters);
  }
  requestAnimationFrame(tickChapters);

  /* ---------- Before / After slider ---------- */

  const baFrame = document.querySelector('[data-ba-slider]');
  if (baFrame) {
    const beforeImg = baFrame.querySelector('[data-ba-before]');
    const handle = baFrame.querySelector('[data-ba-handle]');
    let dragging = false;
    let hasInteracted = false;
    handle.classList.add('is-idle');

    function setSliderPosition(clientX) {
      const rect = baFrame.getBoundingClientRect();
      let pct = ((clientX - rect.left) / rect.width) * 100;
      pct = Math.min(Math.max(pct, 0), 100);
      beforeImg.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
      handle.style.left = `${pct}%`;
      handle.setAttribute('aria-valuenow', Math.round(pct));
    }

    function markInteracted() {
      if (hasInteracted) return;
      hasInteracted = true;
      handle.classList.remove('is-idle');
    }

    handle.addEventListener('pointerdown', (e) => {
      dragging = true;
      markInteracted();
      beforeImg.classList.remove('has-transition');
      handle.classList.remove('has-transition');
      handle.setPointerCapture(e.pointerId);
    });
    window.addEventListener('pointermove', (e) => {
      if (dragging) setSliderPosition(e.clientX);
    });
    window.addEventListener('pointerup', () => { dragging = false; });

    baFrame.addEventListener('pointerdown', (e) => {
      if (e.target === handle || handle.contains(e.target)) return;
      markInteracted();
      beforeImg.classList.add('has-transition');
      handle.classList.add('has-transition');
      setSliderPosition(e.clientX);
      setTimeout(() => {
        beforeImg.classList.remove('has-transition');
        handle.classList.remove('has-transition');
      }, 550);
    });

    handle.addEventListener('keydown', (e) => {
      const current = parseFloat(handle.style.left) || 50;
      markInteracted();
      if (e.key === 'ArrowLeft') setSliderPosition(baFrame.getBoundingClientRect().left + (baFrame.offsetWidth * (current - 5) / 100));
      if (e.key === 'ArrowRight') setSliderPosition(baFrame.getBoundingClientRect().left + (baFrame.offsetWidth * (current + 5) / 100));
    });
  }

  /* ---------- FAQ accordion ---------- */

  document.querySelectorAll('[data-faq-trigger]').forEach((trigger) => {
    trigger.addEventListener('click', () => {
      const isOpen = trigger.getAttribute('aria-expanded') === 'true';
      document.querySelectorAll('[data-faq-trigger]').forEach((t) => {
        if (t !== trigger) t.setAttribute('aria-expanded', 'false');
      });
      trigger.setAttribute('aria-expanded', String(!isOpen));
    });
  });

  /* ---------- Booking modal ---------- */

  const overlay = document.querySelector('[data-booking-overlay]');
  const openButtons = document.querySelectorAll('[data-open-booking]');
  const closeButtons = document.querySelectorAll('[data-close-booking]');
  const form = document.querySelector('[data-booking-form]');
  const modalBody = document.querySelector('[data-modal-body]');
  const modalSuccess = document.querySelector('[data-modal-success]');
  const successMessage = document.querySelector('[data-success-message]');
  const packageSelect = document.querySelector('#package');

  function openModal(preselectPackage) {
    if (preselectPackage) packageSelect.value = preselectPackage;
    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add('is-open'));
    document.body.style.overflow = 'hidden';
    if (floatCta) floatCta.classList.add('is-hidden-by-modal');
  }

  function closeModal() {
    overlay.classList.remove('is-open');
    document.body.style.overflow = '';
    if (floatCta) floatCta.classList.remove('is-hidden-by-modal');
    setTimeout(() => {
      overlay.hidden = true;
      modalBody.hidden = false;
      modalSuccess.hidden = true;
      form.reset();
    }, 250);
  }

  openButtons.forEach((btn) => btn.addEventListener('click', () => openModal(btn.dataset.package)));
  closeButtons.forEach((btn) => btn.addEventListener('click', closeModal));
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('is-open')) closeModal();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const cafeName = form.querySelector('#cafeName').value.trim();
    successMessage.textContent = `Thanks — we'll reach out about restoring ${cafeName || 'your cafe'} shortly.`;
    modalBody.hidden = true;
    modalSuccess.hidden = false;
  });
})();
