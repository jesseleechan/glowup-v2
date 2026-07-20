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
    cartEl: null,
    demoContainer: null,
    demoContent: null
  };
  var latestParentEditorState = 'unknown';
  var syncScheduled = false;
  var cartReadyObserver = null;
  var productContextSnapshot = captureProductDetailContext();

  function onReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
      callback();
    }
  }

  onReady(initProductDetail);

  function initProductDetail() {
    trackHeaderHeight();
    observeEditingState(document);
    waitForNativeCartReady();

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

    if (!activelyEditing && !isNativeCartReady()) {
      waitForNativeCartReady();
      return;
    }

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

  function waitForNativeCartReady() {
    if (isNativeCartReady()) {
      disconnectCartReadyObserver();
      scheduleDescriptionSync();
      return;
    }

    if (cartReadyObserver || !window.MutationObserver || !document.body) return;

    cartReadyObserver = new MutationObserver(function () {
      if (isNativeCartReady()) {
        disconnectCartReadyObserver();
        scheduleDescriptionSync();
      }
    });

    cartReadyObserver.observe(document.body, {
      attributes: true,
      attributeFilter: [
        'data-controllers-bound',
        'data-collection-id',
        'data-item-id',
        'data-product-type'
      ],
      childList: true,
      subtree: true
    });
  }

  function disconnectCartReadyObserver() {
    if (!cartReadyObserver) return;
    cartReadyObserver.disconnect();
    cartReadyObserver = null;
  }

  function isNativeCartReady() {
    var detail = document.querySelector('.product-detail[data-controller~="ProductDetail"]');
    if (!detail) return true;

    var button = detail.querySelector('.product-meta .sqs-add-to-cart-button');
    if (!button) return false;

    ensureNativeCartButtonAttributes(detail, button);

    var productDetailBound = (detail.getAttribute('data-controllers-bound') || '').indexOf('ProductDetail') !== -1;
    return productDetailBound && hasNativeCartButtonAttributes(button);
  }

  function hasNativeCartButtonAttributes(button) {
    return !!(
      button.getAttribute('data-collection-id') &&
      button.getAttribute('data-item-id') &&
      button.getAttribute('data-product-type')
    );
  }

  function ensureNativeCartButtonAttributes(detail, button) {
    if (hasNativeCartButtonAttributes(button)) return;

    var context = readProductDetailContext(detail);
    var product = context && context.product ? context.product : {};
    var collection = context && context.collection ? context.collection : {};
    var staticItem = getStaticProductItem();
    var pageRegions = detail.closest('[data-collection-id][data-item-id]');
    var itemId =
      product.id ||
      detail.getAttribute('data-product-id') ||
      (pageRegions ? pageRegions.getAttribute('data-item-id') : null) ||
      (staticItem ? staticItem.id : null);
    var collectionId =
      collection.id ||
      (pageRegions ? pageRegions.getAttribute('data-collection-id') : null) ||
      (staticItem ? staticItem.collectionId : null);
    var productType =
      product.productType ||
      (staticItem && staticItem.structuredContent ? staticItem.structuredContent.productType : null) ||
      (staticItem ? staticItem.productType : null) ||
      button.getAttribute('data-product-type');

    if (collectionId) button.setAttribute('data-collection-id', collectionId);
    if (itemId) button.setAttribute('data-item-id', itemId);
    if (productType !== undefined && productType !== null) {
      button.setAttribute('data-product-type', productType);
    }
    if (!button.hasAttribute('data-use-custom-label')) {
      button.setAttribute('data-use-custom-label', 'false');
    }
    if (!button.hasAttribute('data-original-label')) {
      // Derive from the live label ("Purchase" when direct-checkout is
      // on) — Squarespace restores button text from this attribute
      var labelSpan = button.querySelector('.add-to-cart-text');
      var liveLabel = labelSpan ? labelSpan.textContent.trim() : '';
      button.setAttribute('data-original-label', liveLabel || 'Add To Cart');
    }
  }

  function readProductDetailContext(detail) {
    var raw = detail.getAttribute('data-context');
    if (!raw) return productContextSnapshot;

    try {
      return JSON.parse(raw);
    } catch (e) {
      return productContextSnapshot;
    }
  }

  function captureProductDetailContext() {
    var detail = document.querySelector('.product-detail[data-controller~="ProductDetail"]');
    if (!detail) return null;

    try {
      return JSON.parse(detail.getAttribute('data-context') || 'null');
    } catch (e) {
      return null;
    }
  }

  function getStaticProductItem() {
    try {
      return window.Static && window.Static.SQUARESPACE_CONTEXT
        ? window.Static.SQUARESPACE_CONTEXT.item
        : null;
    } catch (e) {
      return null;
    }
  }

  /* Action pill: the NATIVE .product-add-to-cart element itself
     becomes the pill — it is NEVER reparented (Squarespace's commerce
     controller binds the cart handler after our DOMContentLoaded code
     runs; if the button has been moved by then, the binding silently
     never happens — learned the hard way). We only add a class and
     append the View Demo anchor (a plain link) as a child. The
     description is relocated BEFORE this element (see
     insertRelocatedDescription) so the pill sits at the bottom;
     CSS position:sticky replaces the old FE pin. */
  function syncActionPill(activelyEditing) {
    if (activelyEditing) {
      if (!pillState.built) return;

      if (pillState.demoContainer && pillState.demoContent) {
        pillState.demoContent.insertBefore(pillState.demoContainer, pillState.demoContent.firstChild);
      }

      if (pillState.cartEl) {
        restoreCartButtonLabel(pillState.cartEl);
        unstylePillButtons(pillState.cartEl);
        pillState.cartEl.classList.remove('glowup-action-pill');
      }

      pillState.built = false;
      return;
    }

    if (pillState.built) {
      // Re-append if Squarespace re-rendered around the demo anchor
      if (
        pillState.cartEl &&
        pillState.demoContainer &&
        pillState.demoContainer.parentNode !== pillState.cartEl
      ) {
        pillState.cartEl.appendChild(pillState.demoContainer);
      }
      if (pillState.cartEl) {
        stylePillButtons(pillState.cartEl);
        updateCartButtonLabel(pillState.cartEl);
      }
      return;
    }

    var relocated = document.querySelector('.relocated-description');
    var cartEl = document.querySelector('.product-meta .product-add-to-cart');
    var demoBlock = relocated ? relocated.querySelector('.sqs-block-button') : null;
    var demoContent = demoBlock ? demoBlock.querySelector('.sqs-block-content') : null;
    var demoContainer = demoContent ? demoContent.querySelector('.sqs-block-button-container') : null;

    if (!cartEl || !demoContainer) return;

    pillState.cartEl = cartEl;
    pillState.demoContainer = demoContainer;
    pillState.demoContent = demoContent;

    cartEl.classList.add('glowup-action-pill');
    cartEl.appendChild(demoContainer);
    stylePillButtons(cartEl);
    updateCartButtonLabel(cartEl);

    pillState.built = true;
  }

  /* Append the product price to the native button label:
     "Purchase" -> "Purchase for $375", or for a product on sale
     "Purchase for $225 <s>$275</s>" (the <s> is styled by global.css
     .glowup-original-price, same treatment as the shop cards).
     data-original-label is kept as the PLAIN sale text ("Purchase for
     $225") because Squarespace restores the label from that attribute
     as plain text after the added-to-cart animation — the observer
     below re-adds the strikethrough after such a restore. Reversed
     while editing. */
  function updateCartButtonLabel(cartEl) {
    var btn = cartEl.querySelector('.sqs-add-to-cart-button');
    var span = btn ? btn.querySelector('.add-to-cart-text') : null;
    if (!btn || !span) return;

    var prices = getCleanProductPrices();
    if (!prices.current) return;

    var base = btn.getAttribute('data-glowup-base-label');
    if (!base) {
      base = span.textContent.trim();
      if (!base || base.indexOf(' for ') !== -1) return;
      btn.setAttribute('data-glowup-base-label', base);
    }

    // Mid-animation states ("Added!") don't contain the base label —
    // never stomp them
    var currentText = span.textContent.trim();
    if (currentText && currentText.indexOf(base) === -1) return;

    renderCartButtonLabel(btn, span, base, prices);
    observeCartLabelRestore(btn, span);
  }

  function renderCartButtonLabel(btn, span, base, prices) {
    var plainLabel = base + ' for ' + prices.current;
    var expectedText = plainLabel + (prices.original ? ' ' + prices.original : '');

    btn.setAttribute('data-original-label', plainLabel);

    var alreadyRendered =
      span.textContent.replace(/\s+/g, ' ').trim() === expectedText &&
      (!prices.original || !!span.querySelector('s'));
    if (alreadyRendered) return;

    span.textContent = plainLabel + (prices.original ? ' ' : '');
    if (prices.original) {
      var original = document.createElement('s');
      original.className = 'glowup-original-price';
      original.textContent = prices.original;
      span.appendChild(original);
    }
  }

  /* Squarespace's added-to-cart animation ends by writing
     data-original-label back into the span as plain text, dropping the
     strikethrough — watch for exactly that state and re-render. The
     guard order makes it loop-safe: our own render adds the <s>, which
     bails the callback. */
  var cartLabelObserver = null;

  function observeCartLabelRestore(btn, span) {
    if (cartLabelObserver || !window.MutationObserver) return;

    cartLabelObserver = new MutationObserver(function () {
      if (!pillState.built) return;
      if (span.querySelector('s')) return;

      var original = btn.getAttribute('data-original-label') || '';
      if (!original || span.textContent.trim() !== original) return;

      var base = btn.getAttribute('data-glowup-base-label');
      var prices = getCleanProductPrices();
      if (!base || !prices.current || !prices.original) return;

      renderCartButtonLabel(btn, span, base, prices);
    });

    cartLabelObserver.observe(span, { childList: true, characterData: true, subtree: true });
  }

  function restoreCartButtonLabel(cartEl) {
    var btn = cartEl ? cartEl.querySelector('.sqs-add-to-cart-button') : null;
    if (!btn) return;
    var base = btn.getAttribute('data-glowup-base-label');
    if (!base) return;
    var span = btn.querySelector('.add-to-cart-text');
    if (span) span.textContent = base;
    btn.setAttribute('data-original-label', base);
    btn.removeAttribute('data-glowup-base-label');
  }

  /* Reads the native price element. Sale products expose separate
     .sale-price / .original-price spans (plus visually-hidden "Sale
     Price:" label text — never parse the container's textContent
     wholesale, that's how the button once read "Purchase for
     SalePrice:$225"); regular products render the amount directly.
     "US$375.00" (or "$375.00") -> "$375". Empty strings leave the
     label untouched. */
  function getCleanProductPrices() {
    var el = document.querySelector('.product-price');
    if (!el) return { current: '', original: '' };

    var saleEl = el.querySelector('.sale-price');
    var originalEl = el.querySelector('.original-price');
    var current = extractPriceAmount(saleEl ? saleEl.textContent : el.textContent);
    var original = saleEl && originalEl ? extractPriceAmount(originalEl.textContent) : '';

    return { current: current, original: original };
  }

  function extractPriceAmount(text) {
    var cleaned = String(text).replace(/\s|US/g, '');
    var match = cleaned.match(/\$[\d][\d.,]*/);
    if (!match) return '';
    return match[0].replace(/\.00$/, '');
  }

  /* Squarespace ships its commerce-button sizing in a CSS cascade
     LAYER using logical properties (block-size/inline-size) with
     !important — unbeatable from our unlayered stylesheet at any
     specificity. Inline style importants are the only author-level
     override that wins. Cleared on editor restore. */
  function stylePillButtons(cartEl) {
    var btn = cartEl.querySelector('.sqs-add-to-cart-button');
    var demo = cartEl.querySelector('.sqs-block-button-element');
    var isMobile = window.matchMedia && window.matchMedia('(max-width: 767px)').matches;

    cartEl.style.setProperty('display', 'flex', 'important');
    cartEl.style.setProperty('flex-direction', 'row', 'important');
    cartEl.style.setProperty('align-items', isMobile ? 'stretch' : 'center', 'important');
    // relative (not static) on mobile: the ::after capsule is absolute
    // and must anchor to the pill, not .content-wrapper
    cartEl.style.setProperty('position', isMobile ? 'relative' : 'sticky', 'important');
    cartEl.style.setProperty('bottom', isMobile ? 'auto' : '24px', 'important');
    cartEl.style.setProperty('width', '100%', 'important');
    cartEl.style.setProperty('height', 'auto', 'important');
    cartEl.style.setProperty('overflow', 'visible', 'important');
    cartEl.style.setProperty('opacity', '1', 'important');
    cartEl.style.setProperty('pointer-events', 'auto', 'important');
    cartEl.style.setProperty('margin', '24px 0 0 0', 'important');
    cartEl.style.setProperty('padding', '3px', 'important');
    cartEl.style.setProperty('box-sizing', 'border-box', 'important');
    cartEl.style.setProperty('z-index', '20', 'important');
    cartEl.style.setProperty('isolation', 'isolate', 'important');

    var buttonPadding = isMobile ? '0 clamp(12px, 3.5vw, 18px)' : '0 24px';

    if (btn) {
      btn.style.setProperty('block-size', '53px', 'important');
      btn.style.setProperty('height', '53px', 'important');
      btn.style.setProperty('min-height', '53px', 'important');
      btn.style.setProperty('max-height', '53px', 'important');
      btn.style.setProperty('padding', buttonPadding, 'important');
      btn.style.setProperty('white-space', 'nowrap', 'important');
    }
    if (demo) {
      demo.style.setProperty('block-size', '53px', 'important');
      demo.style.setProperty('height', '53px', 'important');
      demo.style.setProperty('min-height', '53px', 'important');
      demo.style.setProperty('max-height', '53px', 'important');
      demo.style.setProperty('padding', buttonPadding, 'important');
      demo.style.setProperty('white-space', 'nowrap', 'important');
    }
  }

  function unstylePillButtons(cartEl) {
    if (!cartEl) return;
    var btn = cartEl.querySelector('.sqs-add-to-cart-button');
    var demo = pillState.demoContainer
      ? pillState.demoContainer.querySelector('.sqs-block-button-element')
      : null;

    [
      'display',
      'flex-direction',
      'align-items',
      'position',
      'bottom',
      'width',
      'height',
      'overflow',
      'opacity',
      'pointer-events',
      'margin',
      'padding',
      'box-sizing',
      'z-index',
      'isolation'
    ].forEach(function (property) {
      cartEl.style.removeProperty(property);
    });

    if (btn) {
      btn.style.removeProperty('block-size');
      btn.style.removeProperty('height');
      btn.style.removeProperty('min-height');
      btn.style.removeProperty('max-height');
      btn.style.removeProperty('padding');
      btn.style.removeProperty('white-space');
    }
    if (demo) {
      demo.style.removeProperty('block-size');
      demo.style.removeProperty('height');
      demo.style.removeProperty('min-height');
      demo.style.removeProperty('max-height');
      demo.style.removeProperty('padding');
      demo.style.removeProperty('white-space');
    }
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

    var isMobile = window.matchMedia && window.matchMedia('(max-width: 767px)').matches;

    Array.prototype.forEach.call(grids, function (fe) {
      if (activelyEditing) {
        fe.style.removeProperty('grid-template-columns');
        fe.style.removeProperty('grid-template-rows');
        return;
      }

      // Clear our previous inline values so the native template is read
      fe.style.removeProperty('grid-template-columns');
      fe.style.removeProperty('grid-template-rows');
      var tracks = getComputedStyle(fe).gridTemplateColumns.trim().split(/\s+/);
      if (tracks.length < 3) return;

      var inner = tracks.length - 2;
      fe.style.setProperty(
        'grid-template-columns',
        '0px repeat(' + inner + ', minmax(0, 1fr)) 0px',
        'important'
      );

      // Desktop: trim trailing grid rows left behind by the emptied
      // View Demo fe-block (display:none via CSS once its container
      // moves into the pill). Native row values are non-uniform, so we
      // slice the native list at the last row a visible block occupies
      // rather than rebuilding. Mobile keeps the stylesheet's auto rows.
      if (isMobile) return;

      var rows = getComputedStyle(fe).gridTemplateRows.trim().split(/\s+/);
      var maxEnd = 1;
      Array.prototype.forEach.call(fe.children, function (block) {
        if (getComputedStyle(block).display === 'none') return;
        var end = parseInt(getComputedStyle(block).gridRowEnd, 10);
        if (!isNaN(end)) maxEnd = Math.max(maxEnd, end);
      });

      if (maxEnd > 1 && rows.length >= maxEnd) {
        fe.style.setProperty(
          'grid-template-rows',
          rows.slice(0, maxEnd - 1).join(' '),
          'important'
        );
      }
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
      // BEFORE the cart element: the description flows first, and the
      // native .product-add-to-cart (upgraded to the action pill by
      // syncActionPill) sits at the bottom as a sticky footer
      productMeta.insertBefore(relocated, topAnchor);
    } else {
      productMeta.appendChild(relocated);
    }
  }

  function annotateRelocatedContent(relocated) {
    // One entry per actual <ul>, not per matching ancestor: nested
    // stacks (an outer heading+list wrapper containing an inner
    // list-only stack) mean naive `:has(ul)` filtering over EVERY
    // .stack-child-container matches each list twice (the outer
    // wrapper AND the inner leaf), doubling the count and shifting
    // every index — which silently mis-targeted the page/check icons
    // to the wrong lists (and to duplicate elements) for months.
    // Walking from each <ul> up to its closest .stack-child-container
    // and deduping guarantees exactly one container per visual list,
    // in document order.
    var seen = [];
    var listChildren = [];

    Array.prototype.forEach.call(
      relocated.querySelectorAll('.sqs-stack-container ul[data-rte-list]'),
      function (ul) {
        var container = ul.closest('.stack-child-container');
        if (container && seen.indexOf(container) === -1) {
          seen.push(container);
          listChildren.push(container);
        }
      }
    );

    // List order on the product page: 1st "WHAT MAKES X DIFFERENT"
    // (checkmarks), 2nd "PAGES INCLUDED" (page icons), 3rd "FEATURES"
    // (checkmarks), 4th "HOW IT WORKS" (left plain).
    listChildren.forEach(function (child, index) {
      child.classList.add('glowup-product-list-child');

      if (index === 1) {
        child.classList.add('glowup-product-list-child--pages');
      } else if (index === 0 || index === 2) {
        child.classList.add('glowup-product-list-child--checks');
      }
    });

    // (The old action-stack annotation was removed July 2026: the
    // product-block stack was replaced by the native add-to-cart button
    // + View Demo pill built in syncActionPill.)
  }
})();
