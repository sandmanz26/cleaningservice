(() => {
  /* ---------- Chapter scroll-scrub (canvas frame sequence) ---------- */

  const chapterState = Array.from(document.querySelectorAll('.chapter')).map((chapter) => {
    const canvas = chapter.querySelector('.chapter-canvas');
    return {
      chapter,
      canvas,
      ctx: canvas.getContext('2d'),
      frameCount: parseInt(chapter.dataset.frameCount, 10),
      frameBase: chapter.dataset.frameBase,
      images: [],
      loaded: false,
      currentFrame: -1,
    };
  });

  function frameUrl(base, index) {
    return `${base}${String(index).padStart(3, '0')}.webp`;
  }

  function sizeCanvas(state) {
    const sticky = state.chapter.querySelector('.chapter-sticky');
    const rect = sticky.getBoundingClientRect();
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

  function tickChapters() {
    const viewportHeight = window.innerHeight;

    chapterState.forEach((state) => {
      const { chapter, frameCount } = state;
      const rect = chapter.getBoundingClientRect();
      const scrollableHeight = chapter.offsetHeight - viewportHeight;
      if (scrollableHeight <= 0) return;

      const progress = Math.min(Math.max(-rect.top / scrollableHeight, 0), 1);
      const inView = rect.top < viewportHeight && rect.bottom > 0;

      if (state.loaded && inView) {
        const frameIndex = Math.min(frameCount - 1, Math.floor(progress * frameCount));
        drawFrame(state, frameIndex);
      }

      const caption = chapter.querySelector('.chapter-caption');
      if (caption) {
        const revealProgress = Math.min(progress / 0.25, 1);
        const fadeOutProgress = progress > 0.85 ? (progress - 0.85) / 0.15 : 0;
        const opacity = Math.max(revealProgress - fadeOutProgress, 0);
        caption.style.opacity = opacity;
        const isCenter = caption.classList.contains('chapter-caption-center');
        caption.style.transform = isCenter
          ? `translate(-50%, calc(-50% + ${(1 - revealProgress) * 20}px))`
          : `translateY(${(1 - revealProgress) * 20}px)`;
      }
    });

    requestAnimationFrame(tickChapters);
  }
  requestAnimationFrame(tickChapters);

  /* ---------- Before / After slider ---------- */

  const baFrame = document.querySelector('[data-ba-slider]');
  if (baFrame) {
    const beforeImg = baFrame.querySelector('[data-ba-before]');
    const handle = baFrame.querySelector('[data-ba-handle]');
    let dragging = false;

    function setSliderPosition(clientX) {
      const rect = baFrame.getBoundingClientRect();
      let pct = ((clientX - rect.left) / rect.width) * 100;
      pct = Math.min(Math.max(pct, 0), 100);
      beforeImg.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
      handle.style.left = `${pct}%`;
      handle.setAttribute('aria-valuenow', Math.round(pct));
    }

    handle.addEventListener('pointerdown', (e) => {
      dragging = true;
      handle.setPointerCapture(e.pointerId);
    });
    window.addEventListener('pointermove', (e) => {
      if (dragging) setSliderPosition(e.clientX);
    });
    window.addEventListener('pointerup', () => { dragging = false; });

    baFrame.addEventListener('pointerdown', (e) => {
      if (e.target === handle) return;
      setSliderPosition(e.clientX);
    });

    handle.addEventListener('keydown', (e) => {
      const current = parseFloat(handle.style.left) || 50;
      if (e.key === 'ArrowLeft') setSliderPosition(baFrame.getBoundingClientRect().left + (baFrame.offsetWidth * (current - 5) / 100));
      if (e.key === 'ArrowRight') setSliderPosition(baFrame.getBoundingClientRect().left + (baFrame.offsetWidth * (current + 5) / 100));
    });
  }

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
  }

  function closeModal() {
    overlay.classList.remove('is-open');
    document.body.style.overflow = '';
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

  /* ---------- FAQ: only one open at a time ---------- */

  document.querySelectorAll('.faq-item').forEach((item) => {
    item.addEventListener('toggle', () => {
      if (!item.open) return;
      document.querySelectorAll('.faq-item[open]').forEach((other) => {
        if (other !== item) other.removeAttribute('open');
      });
    });
  });
})();
