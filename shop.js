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

    function titleCase(str) {
      return String(str)
        .trim()
        .split(/\s+/)
        .map(function (word) {
          return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .join(' ');
    }

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

    function buildTagUrl(tagValue) {
      var url = new URL(window.location.href);
      if (tagValue) {
        url.searchParams.set('tag', tagValue);
      } else {
        url.searchParams.delete('tag');
      }
      return url.pathname + url.search + url.hash;
    }

    function getTagClass(tagValue) {
      return 'tag-' + String(tagValue).trim().toLowerCase().replace(/\s+/g, '-');
    }

    function countProductsWithTag(root, tagValue) {
      var tagClass = getTagClass(tagValue);
      return Array.prototype.filter.call(root.querySelectorAll('.product-list-item'), function (item) {
        return item.classList.contains(tagClass);
      }).length;
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

    function findSelectByLabel(container, labelText) {
      var dropdowns = container.querySelectorAll('.product-filter-dropdown');
      for (var i = 0; i < dropdowns.length; i++) {
        var label = dropdowns[i].querySelector('.product-filter-label');
        if (label && label.textContent.trim().toLowerCase() === labelText.toLowerCase()) {
          return dropdowns[i].querySelector('select');
        }
      }
      return null;
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
       PART 1 - CUSTOM SIDEBAR
    ======================================================== */

    var sidebar = document.querySelector('.product-list-nav-and-filters');
    if (!sidebar) return;

    var categoryLinksEls = Array.prototype.slice.call(sidebar.querySelectorAll('.nested-category-tree-wrapper .category-link'));
    var industrySelect = findSelectByLabel(sidebar, 'Industry');
    var totalCount = document.querySelectorAll('.product-list-item').length;
    var currentTag = getCurrentTag();
    var currentPath = normalizePath(window.location.pathname);
    var tagCacheKey = 'glowup_shop_tags_' + currentPath;
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

    var tagOptions = [];
    if (industrySelect) {
      industrySelect.querySelectorAll('option').forEach(function (option) {
        if (option.value) {
          tagOptions.push({
            value: option.value,
            label: option.textContent.trim()
          });
        }
      });
    }

    var cachedTags = readJsonObject(tagCacheKey);
    var cachedCats = readJsonObject(catCacheKey);

    function getCurrentCategory() {
      for (var i = 0; i < categories.length; i++) {
        if (normalizePath(categories[i].href) === currentPath) return categories[i].href;
      }
      return null;
    }

    var nativeNav = sidebar.querySelector('.product-list-nav');
    var nativeFilters = sidebar.querySelector('.product-list-filters');
    var nativeOverlay = sidebar.querySelector('.product-list-filters-drawer-overlay');

    if (nativeNav) nativeNav.style.display = 'none';
    if (nativeFilters) {
      nativeFilters.style.cssText =
        'position:absolute!important;opacity:0!important;pointer-events:none!important;' +
        'height:0!important;overflow:hidden!important;';
    }
    if (nativeOverlay) nativeOverlay.style.display = 'none';

    var existingCustomSidebar = sidebar.querySelector('.custom-sidebar');
    if (existingCustomSidebar) existingCustomSidebar.remove();

    var custom = createElement('div', 'custom-sidebar');
    var countRefs = { tags: {}, cats: {} };
    var currentCat = getCurrentCategory();
    var categorySection = createSidebarSection('CATEGORY');
    var industrySection = createSidebarSection('INDUSTRY');

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

    appendSidebarLink(industrySection.list, {
      href: buildTagUrl(''),
      label: 'All',
      active: !currentTag,
      count: getCachedCount(cachedTags, 'all', currentTag ? '...' : totalCount),
      countType: 'tagId',
      countKey: 'all',
      countRefs: countRefs.tags
    });

    tagOptions.forEach(function (tag) {
      var fallbackCount = currentTag ? '...' : countProductsWithTag(document, tag.value);

      appendSidebarLink(industrySection.list, {
        href: buildTagUrl(tag.value),
        label: titleCase(tag.label),
        active: currentTag === tag.value,
        count: getCachedCount(cachedTags, tag.value, fallbackCount),
        countType: 'tagId',
        countKey: tag.value,
        countRefs: countRefs.tags
      });
    });

    custom.appendChild(categorySection.section);
    custom.appendChild(industrySection.section);
    sidebar.appendChild(custom);

    /* ========================================================
       PART 1b - MOBILE FILTER DROPDOWNS
       Below 768px the expanded sidebar is replaced (via CSS) by
       two pill-styled native selects built from the same data.
       Native selects give the OS picker UX on phones and need no
       open/close or outside-click handling.
    ======================================================== */

    var optionRefs = { tags: {}, cats: {} };

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

    var industryOptions = [{
      href: buildTagUrl(''),
      label: 'All',
      active: !currentTag,
      count: getCachedCount(cachedTags, 'all', currentTag ? undefined : totalCount),
      refType: 'tags',
      refKey: 'all'
    }];
    tagOptions.forEach(function (tag) {
      industryOptions.push({
        href: buildTagUrl(tag.value),
        label: titleCase(tag.label),
        active: currentTag === tag.value,
        count: getCachedCount(cachedTags, tag.value, undefined),
        refType: 'tags',
        refKey: tag.value
      });
    });

    mobileFilters.appendChild(buildFilterSelect('Category', categoryOptions));
    mobileFilters.appendChild(buildFilterSelect('Industry', industryOptions));
    sidebar.appendChild(mobileFilters);

    function applyCountsToMobileFilters() {
      Object.keys(optionRefs.tags).forEach(function (key) {
        if (cachedTags && cachedTags[key] !== undefined) {
          var opt = optionRefs.tags[key];
          opt.textContent = optionLabel(opt.dataset.baseLabel, cachedTags[key]);
        }
      });
      Object.keys(optionRefs.cats).forEach(function (key) {
        if (cachedCats && cachedCats[key] !== undefined) {
          var opt = optionRefs.cats[key];
          opt.textContent = optionLabel(opt.dataset.baseLabel, cachedCats[key]);
        }
      });
    }

    function applyCountsToSidebar() {
      applyCountsToMobileFilters();

      if (cachedTags) {
        if (countRefs.tags.all && cachedTags.all !== undefined) {
          countRefs.tags.all.textContent = '[' + cachedTags.all + ']';
        }

        tagOptions.forEach(function (tag) {
          var countEl = countRefs.tags[tag.value];
          if (countEl && cachedTags[tag.value] !== undefined) {
            countEl.textContent = '[' + cachedTags[tag.value] + ']';
          }
        });
      }

      if (cachedCats) {
        categories.forEach(function (category) {
          var countEl = countRefs.cats[category.href];
          if (countEl && cachedCats[category.href] !== undefined) {
            countEl.textContent = '[' + cachedCats[category.href] + ']';
          }
        });
      }
    }

    var saveTags = false;
    var saveCats = false;
    cachedTags = cachedTags || {};
    cachedCats = cachedCats || {};

    if (cachedTags.all === undefined) {
      if (!currentTag) {
        cachedTags.all = totalCount;
        tagOptions.forEach(function (tag) {
          cachedTags[tag.value] = countProductsWithTag(document, tag.value);
        });
        saveTags = true;
      } else {
        fetchDocument(currentPath).then(function (doc) {
          if (!doc) return;

          cachedTags.all = doc.querySelectorAll('.product-list-item').length;
          tagOptions.forEach(function (tag) {
            cachedTags[tag.value] = countProductsWithTag(doc, tag.value);
          });

          writeJsonObject(tagCacheKey, cachedTags);
          applyCountsToSidebar();
        });
      }
    }

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

    if (saveTags) writeJsonObject(tagCacheKey, cachedTags);
    if (saveCats) writeJsonObject(catCacheKey, cachedCats);
    if (saveTags || saveCats) applyCountsToSidebar();

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
