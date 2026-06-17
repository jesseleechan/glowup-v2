/* ==========================================================
   GLOWUP ONLINE — SHOP TEMPLATES CUSTOM JAVASCRIPT
========================================================== */

document.addEventListener("DOMContentLoaded", function () {

  /* ========================================================
     UTILITIES
  ======================================================== */

  // Capitalize each word
  function titleCase(str) {
    return str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  // Get the current tag filter from the URL (e.g. ?tag=coaching)
  function getCurrentTag() {
    const params = new URLSearchParams(window.location.search);
    return params.get('tag') || '';
  }

  // Build a URL with a tag parameter, preserving the current path
  function buildTagUrl(tagValue) {
    const url = new URL(window.location.href);
    if (tagValue) {
      url.searchParams.set('tag', tagValue);
    } else {
      url.searchParams.delete('tag');
    }
    return url.toString();
  }

  // Find a native <select> by its parent filter label text
  function findSelectByLabel(container, labelText) {
    const dropdowns = container.querySelectorAll('.product-filter-dropdown');
    for (const dropdown of dropdowns) {
      const label = dropdown.querySelector('.product-filter-label');
      if (label && label.textContent.trim().toLowerCase() === labelText.toLowerCase()) {
        return dropdown.querySelector('select');
      }
    }
    return null;
  }


  /* ========================================================
     PART 1 — CUSTOM SIDEBAR
  ======================================================== */
  const sidebar = document.querySelector('.product-list-nav-and-filters');
  if (!sidebar) return;

  // --- Locate native elements ---
  const categoryLinksEls = [...sidebar.querySelectorAll('.nested-category-tree-wrapper .category-link')];
  const industrySelect = findSelectByLabel(sidebar, 'Industry');
  const allProducts = document.querySelectorAll('.product-list-item');
  const totalCount = allProducts.length;
  const currentTag = getCurrentTag();

  // Categories (reversed so Website Templates appears first)
  const categories = categoryLinksEls.map(a => ({
    name: a.textContent.trim(),
    href: a.getAttribute('href')
  })).reverse();

  // Tag options from the native Industry dropdown
  // We use this because Squarespace keeps the full list in the hidden dropdown
  // even when the page is filtered.
  const tagOptions = [];
  if (industrySelect) {
    industrySelect.querySelectorAll('option').forEach(opt => {
      if (opt.value && opt.value !== '') {
        tagOptions.push({ value: opt.value, label: opt.textContent.trim() });
      }
    });
  }

  // Read cached counts from sessionStorage
  let cachedTags = null;
  let cachedCats = null;
  try {
    const rawTags = sessionStorage.getItem('glowup_shop_tags_' + window.location.pathname);
    if (rawTags) cachedTags = JSON.parse(rawTags);
    const rawCats = sessionStorage.getItem('glowup_shop_categories');
    if (rawCats) cachedCats = JSON.parse(rawCats);
  } catch (e) {}

  // Detect current category from URL for active state
  function getCurrentCategory() {
    const path = window.location.pathname.toLowerCase();
    for (const cat of categories) {
      if (path.includes(cat.href.toLowerCase())) return cat.href;
    }
    return null;
  }

  // --- Hide native sidebar content ---
  const nativeNav = sidebar.querySelector('.product-list-nav');
  const nativeFilters = sidebar.querySelector('.product-list-filters');
  const nativeOverlay = sidebar.querySelector('.product-list-filters-drawer-overlay');

  if (nativeNav) nativeNav.style.display = 'none';
  if (nativeFilters) {
    nativeFilters.style.cssText =
      'position:absolute!important;opacity:0!important;pointer-events:none!important;' +
      'height:0!important;overflow:hidden!important;';
  }
  if (nativeOverlay) nativeOverlay.style.display = 'none';


  // --- Build custom sidebar HTML ---
  const custom = document.createElement('div');
  custom.className = 'custom-sidebar';

  // ---- CATEGORY ----
  const currentCat = getCurrentCategory();
  let catItems = '';
  categories.forEach(cat => {
    const isActive = currentCat ? cat.href.toLowerCase() === currentCat : false;
    let countDisplay = '...';
    if (cachedCats && cachedCats[cat.href] !== undefined) {
      countDisplay = cachedCats[cat.href];
    } else if (isActive && !currentTag) {
      countDisplay = totalCount;
    }
    catItems += `<li><a href="${cat.href}" class="custom-sidebar-link${isActive ? ' active' : ''}">${cat.name} <sup data-cat-id="${cat.href}">[${countDisplay}]</sup></a></li>`;
  });
  const catHTML = `
    <div class="custom-sidebar-section" data-section="category">
      <h4 class="custom-sidebar-heading">CATEGORY</h4>
      <ul class="custom-sidebar-list">${catItems}</ul>
    </div>`;

  // ---- INDUSTRY (from tags) ----
  // Use URL-based navigation for filtering — Squarespace respects ?tag= parameters
  const allTagUrl = buildTagUrl('');
  const isAllActive = !currentTag;
  const allCountDisplay = cachedTags ? cachedTags.all : (currentTag ? '...' : totalCount);
  let indItems = `<li><a href="${allTagUrl}" class="custom-sidebar-link${isAllActive ? ' active' : ''}">All <sup data-tag-id="all">[${allCountDisplay}]</sup></a></li>`;

  tagOptions.forEach(tag => {
    let countDisplay = '...';
    if (cachedTags) {
      countDisplay = cachedTags[tag.value] || 0;
    } else if (!currentTag) {
      // If we are on the unfiltered page, count from DOM directly
      const cls = 'tag-' + tag.value.replace(/\s+/g, '-');
      countDisplay = document.querySelectorAll('.product-list-item.' + cls).length;
    }
    const tagUrl = buildTagUrl(tag.value);
    const isActive = currentTag === tag.value;
    indItems += `<li><a href="${tagUrl}" class="custom-sidebar-link${isActive ? ' active' : ''}">${titleCase(tag.label)} <sup data-tag-id="${tag.value}">[${countDisplay}]</sup></a></li>`;
  });

  const indHTML = `
    <div class="custom-sidebar-section" data-section="industry">
      <h4 class="custom-sidebar-heading">INDUSTRY</h4>
      <ul class="custom-sidebar-list">${indItems}</ul>
    </div>`;

  custom.innerHTML = catHTML + indHTML;
  sidebar.appendChild(custom);

  // --- Fetch true counts if on a filtered URL and no cache exists ---
  function applyCountsToSidebar() {
    if (cachedTags) {
      const allSup = sidebar.querySelector('sup[data-tag-id="all"]');
      if (allSup && cachedTags.all !== undefined) allSup.textContent = `[${cachedTags.all}]`;
      tagOptions.forEach(tag => {
        const sup = sidebar.querySelector(`sup[data-tag-id="${tag.value}"]`);
        if (sup && cachedTags[tag.value] !== undefined) sup.textContent = `[${cachedTags[tag.value]}]`;
      });
    }
    if (cachedCats) {
      categories.forEach(cat => {
        const sup = sidebar.querySelector(`sup[data-cat-id="${cat.href}"]`);
        if (sup && cachedCats[cat.href] !== undefined) sup.textContent = `[${cachedCats[cat.href]}]`;
      });
    }
  }

  let saveTags = false;
  let saveCats = false;
  cachedTags = cachedTags || {};
  cachedCats = cachedCats || {};

  // 1. Tags & All (Contextual to the current URL path)
  if (cachedTags.all === undefined) {
    if (!currentTag) {
      cachedTags.all = totalCount;
      tagOptions.forEach(tag => {
        const cls = 'tag-' + tag.value.replace(/\s+/g, '-');
        cachedTags[tag.value] = document.querySelectorAll('.product-list-item.' + cls).length;
      });
      saveTags = true;
    } else {
      fetch(window.location.pathname)
        .then(res => res.text())
        .then(html => {
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');
          cachedTags.all = doc.querySelectorAll('.product-list-item').length;
          tagOptions.forEach(tag => {
            const cls = 'tag-' + tag.value.replace(/\s+/g, '-');
            cachedTags[tag.value] = doc.querySelectorAll('.product-list-item.' + cls).length;
          });
          sessionStorage.setItem('glowup_shop_tags_' + window.location.pathname, JSON.stringify(cachedTags));
          applyCountsToSidebar();
        });
    }
  }

  // 2. Categories (Global across the entire store)
  categories.forEach(cat => {
    if (cachedCats[cat.href] === undefined) {
      if (currentCat === cat.href.toLowerCase() && !currentTag) {
        cachedCats[cat.href] = totalCount;
        saveCats = true;
      } else {
        fetch(cat.href)
          .then(res => res.text())
          .then(html => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            cachedCats[cat.href] = doc.querySelectorAll('.product-list-item').length;
            sessionStorage.setItem('glowup_shop_categories', JSON.stringify(cachedCats));
            applyCountsToSidebar();
          });
      }
    }
  });

  if (saveTags) sessionStorage.setItem('glowup_shop_tags_' + window.location.pathname, JSON.stringify(cachedTags));
  if (saveCats) sessionStorage.setItem('glowup_shop_categories', JSON.stringify(cachedCats));
  if (saveTags || saveCats) applyCountsToSidebar();


  /* ========================================================
     PART 2 — PRODUCT CARD ENHANCEMENTS
     Injects excerpt text and tag pills into each product card.
     Uses a MutationObserver to re-inject after Squarespace
     re-renders the grid (e.g. after filtering).
  ======================================================== */

  function enhanceProductCards() {
    const productItems = document.querySelectorAll('.product-list-item');

    productItems.forEach(item => {
      // Skip if already enhanced
      if (item.querySelector('.custom-product-excerpt')) return;

      // --- Extract tags from CSS classes ---
      const tags = Array.from(item.classList)
        .filter(cls => cls.startsWith('tag-'))
        .map(cls => cls.replace('tag-', '').replace(/-/g, ' ').toUpperCase());

      const metaSection = item.querySelector('.product-list-item-meta');
      if (!metaSection) return;

      // --- Inject Excerpt / Description ---
      const descEl = document.createElement('p');
      descEl.className = 'custom-product-excerpt';
      descEl.textContent = 'Grow your brand with this modern editorial design for bold brands.';

      const statusEl = metaSection.querySelector('.product-list-item-status');
      const titlePriceRow = metaSection.querySelector('.product-list-title-price');
      const insertAfter = statusEl || titlePriceRow;

      if (insertAfter && insertAfter.nextSibling) {
        metaSection.insertBefore(descEl, insertAfter.nextSibling);
      } else if (insertAfter) {
        metaSection.appendChild(descEl);
      } else {
        metaSection.appendChild(descEl);
      }

      // --- Inject Tag Pills ---
      if (tags.length > 0) {
        const tagsContainer = document.createElement('div');
        tagsContainer.className = 'custom-product-tags';

        tags.forEach(tag => {
          // Don't show the "popular" tag as a pill — it's a sort filter, not a visible tag
          if (tag.toLowerCase() === 'popular') return;

          const pill = document.createElement('span');
          pill.className = 'custom-tag-pill';
          pill.textContent = tag;
          tagsContainer.appendChild(pill);
        });

        if (tagsContainer.children.length > 0) {
          metaSection.appendChild(tagsContainer);
        }
      }
    });
  }

  // Initial enhancement
  enhanceProductCards();

  // Re-enhance after Squarespace re-renders the grid (e.g. after filtering)
  const gridContainer = document.querySelector('.product-list-layout-container');
  if (gridContainer) {
    const observer = new MutationObserver(function () {
      // Small delay to let Squarespace finish rendering
      setTimeout(enhanceProductCards, 150);
    });
    observer.observe(gridContainer, { childList: true, subtree: true });
  }

});
