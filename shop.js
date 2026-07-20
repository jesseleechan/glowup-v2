/* ==========================================================
   GLOWUP ONLINE - SHOP TEMPLATES CUSTOM JAVASCRIPT
========================================================== */

(function () {
  function onReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
      callback();
    }
  }

  onReady(initShopTemplates);

  function initShopTemplates() {

    /* ========================================================
       UTILITIES
    ======================================================== */

    function normalizePath(path) {
      try {
        var pathname = new URL(path, window.location.origin).pathname;
        return pathname.replace(/\/+$/, '') || '/';
      } catch (e) {
        return String(path || '').split('?')[0].replace(/\/+$/, '') || '/';
      }
    }

    function hasOwn(obj, key) {
      return Object.prototype.hasOwnProperty.call(obj, key);
    }

    function readJsonObject(key) {
      try {
        var raw = sessionStorage.getItem(key);
        if (!raw) return null;

        var parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

        return parsed;
      } catch (e) {
        return null;
      }
    }

    function writeJsonObject(key, value) {
      try {
        sessionStorage.setItem(key, JSON.stringify(value));
      } catch (e) {}
    }

    function displayCount(value) {
      return value === undefined || value === null || value === '' ? '...' : value;
    }

    function getCachedCount(cache, key, fallback) {
      if (cache && hasOwn(cache, key)) return cache[key];
      return fallback;
    }

    function getCurrentTag() {
      var params = new URLSearchParams(window.location.search);
      return params.get('tag') || '';
    }

    function fetchDocument(url) {
      return fetch(url, { credentials: 'same-origin' })
        .then(function (response) {
          if (!response.ok) throw new Error('Request failed: ' + response.status);
          return response.text();
        })
        .then(function (html) {
          return new DOMParser().parseFromString(html, 'text/html');
        })
        .catch(function () {
          return null;
        });
    }

    function createElement(tagName, className, text) {
      var element = document.createElement(tagName);
      if (className) element.className = className;
      if (text !== undefined) element.textContent = text;
      return element;
    }

    function appendSidebarLink(list, options) {
      var item = document.createElement('li');
      var link = createElement('a', 'custom-sidebar-link' + (options.active ? ' active' : ''), options.label + ' ');
      var count = createElement('sup', '', '[' + displayCount(options.count) + ']');

      link.href = options.href;
      count.dataset[options.countType] = options.countKey;
      options.countRefs[options.countKey] = count;

      link.appendChild(count);
      item.appendChild(link);
      list.appendChild(item);
    }

    function createSidebarSection(headingText) {
      var section = createElement('div', 'custom-sidebar-section');
      var heading = createElement('h4', 'custom-sidebar-heading', headingText);
      var list = createElement('ul', 'custom-sidebar-list');

      section.dataset.section = headingText.toLowerCase();
      section.appendChild(heading);
      section.appendChild(list);

      return { section: section, list: list };
    }

    /* ========================================================
       PART 1 - CUSTOM SIDEBAR (categories only)
       The industry filter reverted to Squarespace's default filter
       UI (July 2026): the native Industry dropdown + Filter button /
       mobile drawer stay visible and untouched. Only the native
       category link tree and the native Categories dropdown are
       replaced (by this list + shop.css hiding).
    ======================================================== */

    var sidebar = document.querySelector('.product-list-nav-and-filters');
    if (!sidebar) return;

    var categoryLinksEls = Array.prototype.slice.call(sidebar.querySelectorAll('.nested-category-tree-wrapper .category-link'));
    var totalCount = document.querySelectorAll('.product-list-item').length;
    var currentTag = getCurrentTag();
    var currentPath = normalizePath(window.location.pathname);
    var catCacheKey = 'glowup_shop_categories';

    var categories = categoryLinksEls
      .map(function (link) {
        return {
          name: link.textContent.trim(),
          href: link.getAttribute('href') || ''
        };
      })
      .filter(function (category) {
        return category.name && category.href;
      })
      .reverse();

    var cachedCats = readJsonObject(catCacheKey);

    function getCurrentCategory() {
      for (var i = 0; i < categories.length; i++) {
        if (normalizePath(categories[i].href) === currentPath) return categories[i].href;
      }
      return null;
    }

    var nativeNav = sidebar.querySelector('.product-list-nav');
    if (nativeNav) nativeNav.style.display = 'none';

    var existingCustomSidebar = sidebar.querySelector('.custom-sidebar');
    if (existingCustomSidebar) existingCustomSidebar.remove();

    var custom = createElement('div', 'custom-sidebar');
    var countRefs = { cats: {} };
    var currentCat = getCurrentCategory();
    var categorySection = createSidebarSection('CATEGORY');

    categories.forEach(function (category) {
      var isActive = currentCat === category.href;
      var fallbackCount = isActive && !currentTag ? totalCount : '...';

      appendSidebarLink(categorySection.list, {
        href: category.href,
        label: category.name,
        active: isActive,
        count: getCachedCount(cachedCats, category.href, fallbackCount),
        countType: 'catId',
        countKey: category.href,
        countRefs: countRefs.cats
      });
    });

    custom.appendChild(categorySection.section);
    sidebar.appendChild(custom);

    /* ========================================================
       PART 1b - MOBILE CATEGORY DROPDOWN
       Below 768px the expanded sidebar is replaced (via CSS) by a
       pill-styled native select built from the same category data.
       Industry filtering on mobile uses Squarespace's own floating
       Filter button + drawer.
    ======================================================== */

    var optionRefs = { cats: {} };

    function optionLabel(name, count) {
      return count === undefined || count === null || count === '' || count === '...'
        ? name
        : name + ' [' + count + ']';
    }

    function buildFilterSelect(labelText, options) {
      var holder = createElement('div', 'glowup-filter');
      var label = createElement('span', 'glowup-filter-label', labelText);
      var select = document.createElement('select');
      select.setAttribute('aria-label', 'Filter by ' + labelText.toLowerCase());

      options.forEach(function (option) {
        var opt = document.createElement('option');
        opt.value = option.href;
        opt.textContent = optionLabel(option.label, option.count);
        opt.selected = !!option.active;
        select.appendChild(opt);

        if (option.refType) {
          opt.dataset.baseLabel = option.label;
          optionRefs[option.refType][option.refKey] = opt;
        }
      });

      select.addEventListener('change', function () {
        if (select.value) window.location.href = select.value;
      });

      holder.appendChild(label);
      holder.appendChild(select);
      return holder;
    }

    function getCollectionRootUrl() {
      try {
        var full = window.Static.SQUARESPACE_CONTEXT.collection.fullUrl;
        if (full) return full;
      } catch (e) {}
      return currentPath;
    }

    var existingMobileFilters = sidebar.querySelector('.glowup-mobile-filters');
    if (existingMobileFilters) existingMobileFilters.remove();

    var mobileFilters = createElement('div', 'glowup-mobile-filters');

    var categoryOptions = [{
      href: getCollectionRootUrl(),
      label: 'All Templates',
      active: !currentCat
    }];
    categories.forEach(function (category) {
      categoryOptions.push({
        href: category.href,
        label: category.name,
        active: currentCat === category.href,
        count: getCachedCount(cachedCats, category.href, undefined),
        refType: 'cats',
        refKey: category.href
      });
    });

    mobileFilters.appendChild(buildFilterSelect('Category', categoryOptions));
    sidebar.appendChild(mobileFilters);

    function applyCountsToSidebar() {
      if (!cachedCats) return;

      Object.keys(optionRefs.cats).forEach(function (key) {
        if (cachedCats[key] !== undefined) {
          var opt = optionRefs.cats[key];
          opt.textContent = optionLabel(opt.dataset.baseLabel, cachedCats[key]);
        }
      });

      categories.forEach(function (category) {
        var countEl = countRefs.cats[category.href];
        if (countEl && cachedCats[category.href] !== undefined) {
          countEl.textContent = '[' + cachedCats[category.href] + ']';
        }
      });
    }

    var saveCats = false;
    cachedCats = cachedCats || {};

    categories.forEach(function (category) {
      if (cachedCats[category.href] !== undefined) return;

      if (currentCat === category.href && !currentTag) {
        cachedCats[category.href] = totalCount;
        saveCats = true;
        return;
      }

      fetchDocument(category.href).then(function (doc) {
        if (!doc) return;

        cachedCats[category.href] = doc.querySelectorAll('.product-list-item').length;
        writeJsonObject(catCacheKey, cachedCats);
        applyCountsToSidebar();
      });
    });

    if (saveCats) {
      writeJsonObject(catCacheKey, cachedCats);
      applyCountsToSidebar();
    }

    /* ========================================================
       PART 2 - PRODUCT CARD ENHANCEMENTS
    ======================================================== */

    function getProductTags(item) {
      var seen = {};

      return Array.prototype.slice.call(item.classList)
        .filter(function (className) {
          return className.indexOf('tag-') === 0;
        })
        .map(function (className) {
          return className.replace('tag-', '').replace(/-/g, ' ');
        })
        .filter(function (tag) {
          var key = tag.toLowerCase();
          if (key === 'popular' || seen[key]) return false;
          seen[key] = true;
          return true;
        })
        .map(function (tag) {
          return tag.toUpperCase();
        });
    }

    function syncProductGridEdges() {
      var gridContainer = document.querySelector('.product-list-layout-container');
      if (!gridContainer) return;

      var items = Array.prototype.filter.call(gridContainer.querySelectorAll('.product-list-item'), function (item) {
        return item.offsetParent !== null;
      });

      if (!items.length) {
        gridContainer.classList.remove('has-js-grid-edges');
        return;
      }

      var firstRowTop = Math.round(items[0].getBoundingClientRect().top);
      var columnCount = 0;

      for (var i = 0; i < items.length; i++) {
        var itemTop = Math.round(items[i].getBoundingClientRect().top);
        if (Math.abs(itemTop - firstRowTop) > 1) break;
        columnCount++;
      }

      columnCount = Math.max(1, Math.min(columnCount, items.length));

      var lastRowStart = Math.floor((items.length - 1) / columnCount) * columnCount;
      gridContainer.classList.add('has-js-grid-edges');

      items.forEach(function (item, index) {
        item.classList.toggle('is-row-end', (index + 1) % columnCount === 0 || index === items.length - 1);
        item.classList.toggle('is-last-row', index >= lastRowStart);
      });
    }

    function enhanceProductCards() {
      var productItems = document.querySelectorAll('.product-list-item');

      productItems.forEach(function (item) {
        var metaSection = item.querySelector('.product-list-item-meta');
        if (!metaSection) return;

        if (!metaSection.querySelector('.custom-product-excerpt')) {
          var descEl = createElement('p', 'custom-product-excerpt', 'Grow your brand with this modern editorial design for bold brands.');
          var statusEl = metaSection.querySelector('.product-list-item-status');
          var titlePriceRow = metaSection.querySelector('.product-list-title-price');
          var insertAfter = statusEl || titlePriceRow;

          if (insertAfter && insertAfter.nextSibling) {
            metaSection.insertBefore(descEl, insertAfter.nextSibling);
          } else {
            metaSection.appendChild(descEl);
          }
        }

        if (!metaSection.querySelector('.custom-product-tags')) {
          var tags = getProductTags(item);
          var tagsContainer = createElement('div', 'custom-product-tags');

          tags.forEach(function (tag) {
            tagsContainer.appendChild(createElement('span', 'custom-tag-pill', tag));
          });

          if (tagsContainer.children.length > 0) {
            metaSection.appendChild(tagsContainer);
          }
        }
      });

      syncProductGridEdges();

      if (typeof window.cleanUpPrice === 'function') {
        window.cleanUpPrice();
      }
    }

    var enhanceTimer = null;

    function scheduleEnhancement() {
      window.clearTimeout(enhanceTimer);
      enhanceTimer = window.setTimeout(enhanceProductCards, 150);
    }

    enhanceProductCards();

    var gridContainer = document.querySelector('.product-list-layout-container');
    if (gridContainer) {
      var observer = new MutationObserver(scheduleEnhancement);
      observer.observe(gridContainer, { childList: true, subtree: true });
      window.addEventListener('resize', scheduleEnhancement);
    }
  }
})();
