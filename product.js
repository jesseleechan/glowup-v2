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
    observeEditingState(document);

    try {
      if (window.self !== window.top && window.parent && window.parent.document) {
        observeEditingState(window.parent.document);
      }
    } catch (e) {}
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
      restoreDescription();
    } else {
      relocateDescription();
    }

    syncGalleryCounter(activelyEditing);
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

    if (insertionAnchor && insertionAnchor.nextSibling) {
      productMeta.insertBefore(relocated, insertionAnchor.nextSibling);
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

    var actionStacks = Array.prototype.filter.call(
      relocated.querySelectorAll('.sqs-stack-container'),
      function (stack) {
        return stack.querySelector('.product-block');
      }
    );

    actionStacks.forEach(function (stack) {
      stack.classList.add('glowup-product-action-stack');

      var children = Array.prototype.filter.call(stack.children, function (child) {
        return child.classList.contains('stack-child-container');
      });

      if (children[0]) children[0].classList.add('glowup-product-action-child--cart');
      if (children[1]) children[1].classList.add('glowup-product-action-child--demo');
    });

    relocated.querySelectorAll('[data-definition-name="website.components.product"] .product-block').forEach(function (block) {
      block.classList.add('is-first-product-block');
    });
  }
})();
