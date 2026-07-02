/* ==========================================================
   GLOWUP ONLINE — HOME PAGE JAVASCRIPT
   Hero slider (Swiper) + summary block carousel pager
   + products-overview full-card links.
   Requires: swiper-bundle.min.js loaded before this file.
========================================================== */


/* ========================================================
   PRODUCTS OVERVIEW — FULL-CARD LINKS
   Injects an invisible overlay <a> into each accordion card
   pointing at its (hidden) button's URL. Styled by home.css
   (.glowup-card-link). Skipped in the editor so cards stay
   editable.
======================================================== */

document.addEventListener('DOMContentLoaded', function () {
  function isActivelyEditing() {
    try {
      if (window.self !== window.top) return true;
    } catch (e) {
      return true;
    }
    var body = document.body;
    if (!body) return false;
    return (
      body.classList.contains('sqs-edit-mode-active') ||
      body.classList.contains('sqs-is-page-editing') ||
      body.classList.contains('sqs-hide-overlay-widgets')
    );
  }
  if (isActivelyEditing()) return;

  document.querySelectorAll('#products-overview .list-item').forEach(function (li) {
    if (li.querySelector('.glowup-card-link')) return;
    var btn = li.querySelector('.list-item-content__button-container a');
    if (!btn || !btn.getAttribute('href')) return;
    var a = document.createElement('a');
    a.className = 'glowup-card-link';
    a.href = btn.getAttribute('href');
    var title = li.querySelector('.list-item-content__title');
    a.setAttribute('aria-label', title ? title.textContent.trim() : 'View');
    li.appendChild(a);
  });
});


/* ========================================================
   HERO SLIDER — Swiper init with editor-safe destroy/rebuild
======================================================== */

(function () {
  var sliderState = {
    built: false,
    swiper: null,
    container: null,
    wrapper: null,
    slides: []
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSliderController);
  } else {
    initSliderController();
  }

  function initSliderController() {
    syncSlider();
    observeDocument(document);

    try {
      if (window.self !== window.top && window.parent && window.parent.document) {
        observeDocument(window.parent.document);
      }
    } catch (e) {}

    setInterval(syncSlider, 300);
  }

  function observeDocument(doc) {
    if (!doc || !doc.body || !window.MutationObserver) return;

    var observer = new MutationObserver(function () {
      syncSlider();
    });

    observer.observe(doc.body, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ['class', 'aria-label', 'disabled']
    });
  }

  function isActivelyEditing() {
    var parentState = getParentEditorState();
    if (parentState === 'editing') return true;
    if (parentState === 'preview') return false;

    var body = document.body;
    if (!body) return true;

    return (
      body.classList.contains('sqs-edit-mode-active') ||
      body.classList.contains('sqs-is-page-editing') ||
      body.classList.contains('sqs-hide-overlay-widgets')
    );
  }

  function getParentEditorState() {
    if (window.self === window.top) return 'live';

    try {
      var parentDoc = window.parent.document;
      if (!parentDoc || !parentDoc.body) return 'unknown';

      var buttons = parentDoc.querySelectorAll('button');
      var sawEdit = false;
      var sawPreview = false;

      for (var i = 0; i < buttons.length; i++) {
        var text = (buttons[i].innerText || buttons[i].textContent || '').trim().toLowerCase();
        var aria = (buttons[i].getAttribute('aria-label') || '').trim().toLowerCase();
        var label = text || aria;

        if (
          label === 'exit' ||
          label === 'save' ||
          label === 'add section' ||
          label === 'edit section' ||
          label === 'open layers panel' ||
          aria === 'toggle preview mode'
        ) {
          return 'editing';
        }

        if (label === 'edit') sawEdit = true;
        if (label === 'preview' || aria === 'preview') sawPreview = true;
      }

      if (sawEdit || sawPreview) return 'preview';
    } catch (e) {}

    return 'unknown';
  }

  function syncSlider() {
    if (isActivelyEditing()) {
      destroySlider();
    } else {
      buildSlider();
    }
  }

  function buildSlider() {
    if (sliderState.built) return;

    var markers = document.querySelectorAll('[id^="slide-"]');
    if (markers.length < 2) return;

    var slides = [];
    var seen = [];

    for (var i = 0; i < markers.length; i++) {
      var section = markers[i].closest('.page-section');
      if (section && seen.indexOf(section) === -1) {
        seen.push(section);
        slides.push(section);
      }
    }

    slides.sort(function (a, b) {
      return (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1;
    });

    if (slides.length < 2) return;

    var container = document.createElement('div');
    container.className = 'swiper hero-slider';

    var wrapper = document.createElement('div');
    wrapper.className = 'swiper-wrapper';
    container.appendChild(wrapper);

    var navCluster = document.createElement('div');
    navCluster.className = 'custom-nav-cluster';
    navCluster.innerHTML =
      '<button class="nav-btn nav-btn-prev" aria-label="Previous">' +
        '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M21 12H3M11.5 20.5L3 12L11.5 3.5"></path>' +
        '</svg>' +
      '</button>' +
      '<button class="nav-btn nav-btn-next" aria-label="Next">' +
        '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M3 12H21M12.5 20.5L21 12L12.5 3.5"></path>' +
        '</svg>' +
      '</button>';

    container.appendChild(navCluster);

    var parent = slides[0].parentNode;
    parent.insertBefore(container, slides[0]);

    for (var j = 0; j < slides.length; j++) {
      slides[j].classList.add('swiper-slide');
      wrapper.appendChild(slides[j]);
    }

    sliderState.swiper = new Swiper(container, {
      direction: 'horizontal',
      loop: true,
      speed: 600,
      allowTouchMove: true,
      resistance: true,
      resistanceRatio: 0,
      observer: true,
      observeParents: true,
      navigation: {
        prevEl: navCluster.querySelector('.nav-btn-prev'),
        nextEl: navCluster.querySelector('.nav-btn-next')
      }
    });

    sliderState.built = true;
    sliderState.container = container;
    sliderState.wrapper = wrapper;
    sliderState.slides = slides;
  }

  function destroySlider() {
    if (!sliderState.built || !sliderState.container) return;

    if (sliderState.swiper && sliderState.swiper.destroy) {
      sliderState.swiper.destroy(true, true);
    }

    var container = sliderState.container;
    var parent = container.parentNode;

    if (parent) {
      for (var i = 0; i < sliderState.slides.length; i++) {
        sliderState.slides[i].classList.remove('swiper-slide');
        parent.insertBefore(sliderState.slides[i], container);
      }
      parent.removeChild(container);
    }

    sliderState.built = false;
    sliderState.swiper = null;
    sliderState.container = null;
    sliderState.wrapper = null;
    sliderState.slides = [];
  }

  window.addEventListener('resize', function () {
    if (sliderState.swiper && sliderState.swiper.update) {
      sliderState.swiper.update();
    }
  });
})();


/* ========================================================
   SUMMARY BLOCK CAROUSEL PAGER
   Injects chevron SVGs and a "1 / N" counter into the
   pager row of the product summary carousel block.
======================================================== */

window.addEventListener('DOMContentLoaded', function () {
  var prevSVG = '<svg width="8" height="14" viewBox="0 0 8 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 13L1 7L7 1" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var nextSVG = '<svg width="8" height="14" viewBox="0 0 8 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L7 7L1 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  var prev = document.querySelector('.summary-carousel-pager-prev');
  var next = document.querySelector('.summary-carousel-pager-next');
  var pager = document.querySelector('.summary-carousel-pager');
  var gallery = document.querySelector('.sqs-gallery-design-carousel');

  if (!prev || !next || !pager || !gallery) return;

  prev.innerHTML = prevSVG;
  next.innerHTML = nextSVG;

  var slides = gallery.querySelectorAll('.sqs-gallery-design-carousel-slide');
  var slidesPerView = parseInt(gallery.getAttribute('data-sqs-slides-in-view') || 4);
  var totalPages = Math.ceil(slides.length / slidesPerView);

  var counter = document.createElement('span');
  counter.className = 'glowup-pager-counter';
  counter.textContent = '1 / ' + totalPages;
  pager.insertBefore(counter, next);

  var currentPage = 1;

  var updateCounter = function () {
    counter.textContent = currentPage + ' / ' + totalPages;
  };

  new MutationObserver(function () {
    var prevDisabled = prev.classList.contains('sqs-disabled');
    var nextDisabled = next.classList.contains('sqs-disabled');
    if (prevDisabled) {
      currentPage = 1;
    } else if (nextDisabled) {
      currentPage = totalPages;
    }
    updateCounter();
  }).observe(prev, { attributes: true, attributeFilter: ['class'] });

  new MutationObserver(function () {
    var prevDisabled = prev.classList.contains('sqs-disabled');
    var nextDisabled = next.classList.contains('sqs-disabled');
    if (nextDisabled) {
      currentPage = totalPages;
    } else if (prevDisabled) {
      currentPage = 1;
    }
    updateCounter();
  }).observe(next, { attributes: true, attributeFilter: ['class'] });

  next.addEventListener('click', function () {
    if (!next.classList.contains('sqs-disabled') && currentPage < totalPages) {
      currentPage = Math.min(currentPage + 1, totalPages);
      updateCounter();
    }
  });

  prev.addEventListener('click', function () {
    if (!prev.classList.contains('sqs-disabled') && currentPage > 1) {
      currentPage = Math.max(currentPage - 1, 1);
      updateCounter();
    }
  });
});
