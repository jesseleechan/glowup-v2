/* ==========================================================
   GLOWUP ONLINE - PRODUCT DETAIL PAGE CUSTOM JAVASCRIPT
========================================================== */

(function () {
  var relocationState = {
    contentWrapper: null,
    originalParent: null,
    originalNextSibling: null,
    relocated: null
  };
  var counterState = {
    moved: false,
    originalParent: null,
    originalNextSibling: null
  };
  var pillState = {
    built: false,
    pill: null,
    cartEl: null,
    cartParent: null,
    cartNextSibling: null,
    demoContainer: null,
    demoContent: null
  };
  var latestParentEditorState = 'unknown';
  var syncScheduled = false;

  function onReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
      callback();
    }
  }

  onReady(initProductDetail);

  function initProductDetail() {
    syncDescriptionRelocation();
    trackHeaderHeight();
    observeEditingState(document);

    // Re-derive grid overrides when the FE breakpoint flips (24 <-> 8 cols)
    window.addEventListener('resize', scheduleDescriptionSync);

    try {
      if (window.self !== window.top && window.parent && window.parent.document) {
        observeEditingState(window.parent.document);
      }
    } catch (e) {}
  }

  /* The gallery's sticky offset must match the real header height,
     which varies by viewport (52px tablet / 66px desktop). Squarespace
     exposes no header-height variable, so publish one. */
  function trackHeaderHeight() {
    var header = document.querySelector('#header');
    if (!header) return;

    var apply = function () {
      document.documentElement.style.setProperty('--glowup-header-h', header.offsetHeight + 'px');
    };

    apply();
    window.addEventListener('resize', apply);
    if (window.ResizeObserver) {
      new ResizeObserver(apply).observe(header);
    }
  }

  function isActivelyEditing() {
    var parentEditorState = getParentEditorState();
    latestParentEditorState = parentEditorState;

    if (parentEditorState === 'preview' || parentEditorState === 'live') {
      return false;
    }

    if (parentEditorState === 'editing') {
      return true;
    }

    var body = document.body;
    if (!body) return false;

    if (
      body.classList.contains('sqs-edit-mode-active') ||
      body.classList.contains('sqs-is-page-editing') ||
      body.classList.contains('sqs-hide-overlay-widgets')
    ) {
      return true;
    }

    return false;
  }

  function observeEditingState(doc) {
    if (!doc || !doc.body || !window.MutationObserver) return;

    var observer = new MutationObserver(function () {
      scheduleDescriptionSync();
    });

    if (doc === document) {
      observer.observe(doc.body, {
        attributes: true,
        attributeFilter: ['class']
      });
    } else {
      observer.observe(doc.body, {
        attributes: true,
        attributeFilter: ['class', 'aria-label', 'aria-pressed'],
        childList: true,
        subtree: true
      });
    }
  }

  function scheduleDescriptionSync() {
    if (syncScheduled) return;

    syncScheduled = true;

    var schedule = window.requestAnimationFrame || function (callback) {
      return window.setTimeout(callback, 50);
    };

    schedule(function () {
      syncScheduled = false;
      syncDescriptionRelocation();
    });
  }

  function syncDescriptionRelocation() {
    var activelyEditing = isActivelyEditing();

    updateEditorStateClasses(activelyEditing);

    if (activelyEditing) {
      // Pill teardown MUST precede description restore, or the native
      // cart button would travel into #my-description with the content
      syncActionPill(true);
      restoreDescription();
    } else {
      relocateDescription();
      syncActionPill(false);
    }

    syncGalleryCounter(activelyEditing);
    syncRelocatedGrids(activelyEditing);
  }

  /* Build the action pill: the ENTIRE native .product-add-to-cart
     element (moved, not cloned) beside the View Demo button block's
     anchor, inside a .glowup-action-pill flex wrapper styled by
     product.css. The whole subtree moves because Squarespace's cart
     handler is bound within it — moving only the inner button
     wrapper orphaned the click binding (learned the hard way).
     Fully reversed while editing. */
  function syncActionPill(activelyEditing) {
    if (activelyEditing) {
      if (!pillState.built) return;

      if (pillState.cartEl && pillState.cartParent) {
        if (
          pillState.cartNextSibling &&
          pillState.cartNextSibling.parentNode === pillState.cartParent
        ) {
          pillState.cartParent.insertBefore(pillState.cartEl, pillState.cartNextSibling);
        } else {
          pillState.cartParent.appendChild(pillState.cartEl);
        }
      }

      if (pillState.demoContainer && pillState.demoContent) {
        pillState.demoContent.insertBefore(pillState.demoContainer, pillState.demoContent.firstChild);
      }

      if (pillState.pill && pillState.pill.parentNode) {
        pillState.pill.parentNode.removeChild(pillState.pill);
      }

      pillState.built = false;
      pillState.pill = null;
      return;
    }

    if (pillState.built) {
      syncPillPinnedClass();
      return;
    }

    var relocated = document.querySelector('.relocated-description');
    var cartEl = document.querySelector('.product-meta .product-add-to-cart');
    var demoBlock = relocated ? relocated.querySelector('.sqs-block-button') : null;
    var demoContent = demoBlock ? demoBlock.querySelector('.sqs-block-content') : null;
    var demoContainer = demoContent ? demoContent.querySelector('.sqs-block-button-container') : null;

    if (!cartEl || !demoContainer) return;

    pillState.cartEl = cartEl;
    pillState.cartParent = cartEl.parentNode;
    pillState.cartNextSibling = cartEl.nextSibling;
    pillState.demoContainer = demoContainer;
    pillState.demoContent = demoContent;

    var pill = document.createElement('div');
    pill.className = 'glowup-action-pill';
    pill.appendChild(cartEl);
    pill.appendChild(demoContainer);
    demoContent.appendChild(pill);

    pillState.pill = pill;
    pillState.built = true;

    syncPillPinnedClass();
  }

  /* The scroll-cover pseudo-element only applies when the button block
     is actually pinned in the FE editor (desktop-only; computes static
     on mobile) — toggled every sync so breakpoint flips stay truthful */
  function syncPillPinnedClass() {
    if (!pillState.pill) return;
    var feBlock = pillState.pill.closest('.fe-block');
    if (!feBlock) return;
    feBlock.classList.toggle(
      'glowup-pinned',
      getComputedStyle(feBlock).position === 'sticky'
    );
  }

  /* Collapse the outer gutter columns of the relocated Fluid Engine
     grids without hardcoding Squarespace's column count. Reads the
     native track count and rebuilds as: 0 repeat(n-2, minmax(0,1fr)) 0.
     Adapts if Squarespace ever changes FE from 24/8 columns.
     Inline overrides are cleared while editing (the content moves back
     into #my-description and must render natively there). */
  function syncRelocatedGrids(activelyEditing) {
    var scope = activelyEditing
      ? relocationState.contentWrapper || document.querySelector('#my-description')
      : document.querySelector('.relocated-description');

    if (!scope) return;

    var grids = scope.querySelectorAll('.fluid-engine');

    Array.prototype.forEach.call(grids, function (fe) {
      if (activelyEditing) {
        fe.style.removeProperty('grid-template-columns');
        return;
      }

      // Clear our previous inline value so the native template is read
      fe.style.removeProperty('grid-template-columns');
      var tracks = getComputedStyle(fe).gridTemplateColumns.trim().split(/\s+/);
      if (tracks.length < 3) return;

      var inner = tracks.length - 2;
      fe.style.setProperty(
        'grid-template-columns',
        '0px repeat(' + inner + ', minmax(0, 1fr)) 0px',
        'important'
      );
    });
  }

  /* Move the native "1 / N" slide indicator between the prev/next
     buttons so flexbox centers it inside the pill pager (product.css
     styles it via .product-gallery-carousel-controls > indicator).
     Restored to its original spot while editing. */
  function syncGalleryCounter(activelyEditing) {
    var controls = document.querySelector('.product-gallery-carousel-controls');
    var indicator = document.querySelector('.product-gallery-current-slide-indicator');
    if (!controls || !indicator) return;

    if (activelyEditing) {
      if (!counterState.moved || !counterState.originalParent) return;
      if (
        counterState.originalNextSibling &&
        counterState.originalNextSibling.parentNode === counterState.originalParent
      ) {
        counterState.originalParent.insertBefore(indicator, counterState.originalNextSibling);
      } else {
        counterState.originalParent.appendChild(indicator);
      }
      counterState.moved = false;
      return;
    }

    if (indicator.parentNode === controls) return;

    if (!counterState.moved) {
      counterState.originalParent = indicator.parentNode;
      counterState.originalNextSibling = indicator.nextSibling;
    }

    var nextBtn = controls.querySelector('.product-gallery-next');
    if (nextBtn) {
      controls.insertBefore(indicator, nextBtn);
    } else {
      controls.appendChild(indicator);
    }
    counterState.moved = true;
  }

  function updateEditorStateClasses(activelyEditing) {
    var body = document.body;
    if (!body) return;

    body.classList.toggle('glowup-product-active-editing', activelyEditing);
    body.classList.toggle('glowup-product-previewing', !activelyEditing && latestParentEditorState === 'preview');
  }

  function getParentEditorState() {
    if (window.self === window.top) return 'live';

    try {
      var parentDoc = window.parent.document;
      if (!parentDoc || !parentDoc.body) return 'unknown';

      var buttons = parentDoc.querySelectorAll('button');
      var sawPreviewControl = false;

      for (var i = 0; i < buttons.length; i++) {
        var text = (buttons[i].innerText || buttons[i].textContent || '').trim().toLowerCase();
        var aria = (buttons[i].getAttribute('aria-label') || '').trim().toLowerCase();
        var label = text || aria;

        if (
          label === 'exit' ||
          label === 'save' ||
          label === 'add section' ||
          label === 'edit section' ||
          label === 'open layers panel'
        ) {
          return 'editing';
        }

        if (
          label === 'edit' ||
          label === 'preview' ||
          aria === 'preview' ||
          aria === 'toggle preview mode'
        ) {
          sawPreviewControl = true;
        }
      }

      if (sawPreviewControl) return 'preview';
    } catch (e) {}

    return 'unknown';
  }

  function relocateDescription() {
    var productMeta = document.querySelector('.product-meta');
    var myDescSection = document.querySelector('#my-description');

    if (!productMeta || !myDescSection) return;

    var contentWrapper = myDescSection.querySelector('.content-wrapper');
    var relocated = productMeta.querySelector('.relocated-description');

    if (!relocated) {
      relocated = document.createElement('div');
      relocated.className = 'relocated-description';
      relocated.setAttribute('data-glowup-relocated-description', '');
    }

    if (contentWrapper && !relocationState.originalParent) {
      relocationState.contentWrapper = contentWrapper;
      relocationState.originalParent = contentWrapper.parentNode;
      relocationState.originalNextSibling = contentWrapper.nextSibling;
    }

    if (contentWrapper && contentWrapper.parentNode !== relocated) {
      relocated.appendChild(contentWrapper);
    }

    if (!relocated.querySelector('.content-wrapper')) return;

    relocationState.relocated = relocated;
    annotateRelocatedContent(relocated);

    if (!relocated.parentNode) {
      insertRelocatedDescription(productMeta, relocated);
    }

    myDescSection.setAttribute('aria-hidden', 'true');
  }

  function restoreDescription() {
    var myDescSection = document.querySelector('#my-description');
    var relocated = relocationState.relocated || document.querySelector('.relocated-description');
    var contentWrapper =
      relocationState.contentWrapper ||
      (relocated ? relocated.querySelector('.content-wrapper') : null);

    if (myDescSection) {
      myDescSection.removeAttribute('aria-hidden');
    }

    if (!contentWrapper || !relocationState.originalParent) return;

    if (contentWrapper.parentNode !== relocationState.originalParent) {
      if (
        relocationState.originalNextSibling &&
        relocationState.originalNextSibling.parentNode === relocationState.originalParent
      ) {
        relocationState.originalParent.insertBefore(contentWrapper, relocationState.originalNextSibling);
      } else {
        relocationState.originalParent.appendChild(contentWrapper);
      }
    }

    if (relocated && relocated.parentNode && !relocated.querySelector('.content-wrapper')) {
      relocated.parentNode.removeChild(relocated);
    }
  }

  function insertRelocatedDescription(productMeta, relocated) {
    var insertionAnchor =
      productMeta.querySelector('.product-add-to-cart') ||
      productMeta.querySelector('.product-add-to-cart-layout-wrapper') ||
      productMeta.querySelector('.product-price') ||
      productMeta.lastElementChild;

    if (!insertionAnchor) {
      productMeta.appendChild(relocated);
      return;
    }

    // The anchor may be nested — walk up to the direct child of
    // productMeta so insertBefore can never throw NotFoundError
    var topAnchor = insertionAnchor;
    while (topAnchor.parentNode && topAnchor.parentNode !== productMeta) {
      topAnchor = topAnchor.parentNode;
    }

    if (topAnchor.parentNode === productMeta) {
      // nextSibling may be null — insertBefore(node, null) appends
      productMeta.insertBefore(relocated, topAnchor.nextSibling);
    } else {
      productMeta.appendChild(relocated);
    }
  }

  function annotateRelocatedContent(relocated) {
    var listChildren = Array.prototype.filter.call(
      relocated.querySelectorAll('.sqs-stack-container > .stack-child-container'),
      function (child) {
        return child.querySelector('ul[data-rte-list]');
      }
    );

    listChildren.forEach(function (child, index) {
      child.classList.add('glowup-product-list-child');

      if (index === 0) {
        child.classList.add('glowup-product-list-child--pages');
      } else if (index === 1) {
        child.classList.add('glowup-product-list-child--checks');
      }
    });

    // (The old action-stack annotation was removed July 2026: the
    // product-block stack was replaced by the native add-to-cart button
    // + View Demo pill built in syncActionPill.)
  }
})();
