(() => {
  const chapters = Array.from(document.querySelectorAll('.chapter'));

  // Lazy-load each chapter's video once it's within ~1 viewport of scrolling into view.
  const loadObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const video = entry.target.querySelector('video');
      const source = video.querySelector('source');
      if (source.dataset.src && !source.getAttribute('src')) {
        source.setAttribute('src', source.dataset.src);
        video.load();
      }
    });
  }, { rootMargin: '100% 0px 100% 0px' });

  chapters.forEach((chapter) => loadObserver.observe(chapter));

  // Scroll-scrub loop: map each chapter's scroll progress to its video's currentTime.
  function tick() {
    const viewportHeight = window.innerHeight;

    chapters.forEach((chapter) => {
      const video = chapter.querySelector('video');
      const caption = chapter.querySelector('.chapter-caption');

      const rect = chapter.getBoundingClientRect();
      const scrollableHeight = chapter.offsetHeight - viewportHeight;
      if (scrollableHeight <= 0) return;

      const progress = Math.min(Math.max(-rect.top / scrollableHeight, 0), 1);

      if (video.duration && !Number.isNaN(video.duration) && rect.top < viewportHeight && rect.bottom > 0) {
        const targetTime = progress * video.duration;
        if (Math.abs(video.currentTime - targetTime) > 0.03) {
          video.currentTime = targetTime;
        }
      }

      if (caption) {
        const revealProgress = Math.min(progress / 0.25, 1);
        const fadeOutProgress = progress > 0.85 ? (progress - 0.85) / 0.15 : 0;
        const opacity = Math.max(revealProgress - fadeOutProgress, 0);
        caption.style.opacity = opacity;
        const isCenter = caption.classList.contains('chapter-caption-center');
        const baseTranslate = isCenter ? '-50%' : '0';
        caption.style.transform = isCenter
          ? `translate(-50%, calc(-50% + ${(1 - revealProgress) * 20}px))`
          : `translateY(${(1 - revealProgress) * 20}px)`;
      }
    });

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);

  // Booking modal
  const overlay = document.querySelector('[data-booking-overlay]');
  const openButtons = document.querySelectorAll('[data-open-booking]');
  const closeButtons = document.querySelectorAll('[data-close-booking]');
  const form = document.querySelector('[data-booking-form]');
  const modalBody = document.querySelector('[data-modal-body]');
  const modalSuccess = document.querySelector('[data-modal-success]');
  const successMessage = document.querySelector('[data-success-message]');

  function openModal() {
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

  openButtons.forEach((btn) => btn.addEventListener('click', openModal));
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
    successMessage.textContent = `Thanks — we'll reach out about cleaning ${cafeName || 'your cafe'} shortly.`;
    modalBody.hidden = true;
    modalSuccess.hidden = false;
  });
})();
