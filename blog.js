/* ==========================================================
   GLOWUP ONLINE - BLOG JAVASCRIPT

   Builds the blog-post hero from Squarespace's native article
   markup and page metadata. Collection pages are untouched.
========================================================== */

(function () {
  var observer = null;
  var frame = 0;
  var tocFrame = 0;
  var tocState = null;
  var promotions = [
    {
      theme: 'dark',
      title: 'Launch with a website that already knows how to sell.',
      copy: 'Browse premium Squarespace templates built for service brands that need polish, clarity, and a faster path to booked.',
      cta: 'Shop Templates',
      href: '/squarespace-templates'
    },
    {
      theme: 'light',
      eyebrow: 'Setup Packages',
      title: 'Want the strategy, design, and setup handled for you?',
      copy: 'Work with us on a conversion-focused website experience designed to make your brand feel premium before the first inquiry.',
      cta: 'Explore Services',
      href: '/services'
    }
  ];

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBlog);
  } else {
    initBlog();
  }

  function initBlog() {
    syncBlogHero();
    window.addEventListener('resize', scheduleSync);

    if (!window.MutationObserver || !document.body) return;

    observer = new MutationObserver(scheduleSync);
    observer.observe(document.body, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ['class']
    });
  }

  function scheduleSync() {
    if (frame) return;

    frame = window.requestAnimationFrame(function () {
      frame = 0;
      syncBlogHero();
    });
  }

  function syncBlogHero() {
    if (!isBlogPost() || isActivelyEditing()) {
      restoreBlogLayout();
      restoreNativeHeader();
      return;
    }

    mountBlogHero();
    mountBlogLayout();
  }

  function isBlogPost() {
    var body = document.body;
    return !!(
      body &&
      body.classList.contains('collection-type-blog-basic-grid') &&
      body.classList.contains('view-item')
    );
  }

  function isActivelyEditing() {
    var body = document.body;
    if (!body) return true;

    return (
      body.classList.contains('sqs-edit-mode-active') ||
      body.classList.contains('sqs-is-page-editing')
    );
  }

  function mountBlogHero() {
    var article = document.querySelector('article.h-entry');
    if (!article) return;

    var inner = article.querySelector('.blog-item-inner-wrapper');
    var top = inner && inner.querySelector('.blog-item-top-wrapper');
    var content = inner && inner.querySelector('.blog-item-content-wrapper');
    var imageUrl = getMetaContent([
      'meta[itemprop="thumbnailUrl"]',
      'meta[property="og:image"]',
      'meta[itemprop="image"]'
    ]);

    if (!inner || !top || !content || !imageUrl) return;
    if (inner.querySelector('.glowup-blog-hero')) return;

    var title = top.querySelector('.entry-title');
    var description = getMetaContent([
      'meta[itemprop="description"]',
      'meta[property="og:description"]',
      'meta[name="description"]'
    ]);

    var hero = document.createElement('section');
    hero.className = 'glowup-blog-hero';
    hero.setAttribute('aria-label', 'Article introduction');

    var media = document.createElement('div');
    media.className = 'glowup-blog-hero__media';

    var image = document.createElement('img');
    image.className = 'glowup-blog-hero__image';
    image.src = imageUrl.replace(/^http:/, 'https:');
    image.alt = title ? title.textContent.trim() : '';
    image.loading = 'eager';
    image.decoding = 'async';
    image.setAttribute('fetchpriority', 'high');
    media.appendChild(image);

    if (description) {
      var excerpt = document.createElement('p');
      excerpt.className = 'glowup-blog-hero__excerpt';
      excerpt.textContent = description;
      top.appendChild(excerpt);
    }

    formatPublishedDate(top);

    inner.insertBefore(hero, top);
    hero.appendChild(media);
    hero.appendChild(top);
    document.body.classList.add('glowup-blog-hero-mounted');
  }

  function mountBlogLayout() {
    var article = document.querySelector('article.h-entry');
    var inner = article && article.querySelector('.blog-item-inner-wrapper');
    var contentWrapper = inner && inner.querySelector('.blog-item-content-wrapper');
    var content = contentWrapper && contentWrapper.querySelector('.blog-item-content');
    var existing = contentWrapper && contentWrapper.querySelector('.glowup-blog-layout');

    if (!article || !inner || !contentWrapper || !content) return;

    if (existing) {
      syncTocMode(existing);
      return;
    }

    var headings = getArticleHeadings(content);
    var author = contentWrapper.querySelector('.blog-item-author-profile-wrapper');
    var layout = document.createElement('div');
    var articleColumn = document.createElement('div');
    var toc = createTableOfContents(headings);
    var promos = createPromotionRail();

    layout.className = 'glowup-blog-layout';
    articleColumn.className = 'glowup-blog-article';

    if (!headings.length) {
      layout.classList.add('glowup-blog-layout--no-toc');
      toc.hidden = true;
    }

    contentWrapper.insertBefore(layout, content);
    layout.appendChild(toc);
    layout.appendChild(articleColumn);
    layout.appendChild(promos);
    articleColumn.appendChild(content);

    if (author) {
      articleColumn.appendChild(author);
    }

    document.body.classList.add('glowup-blog-layout-mounted');
    syncTocMode(layout);
    startTocTracking(layout, headings);
  }

  function createTableOfContents(headings) {
    var aside = document.createElement('aside');
    var sticky = document.createElement('div');
    var toggle = document.createElement('button');
    var label = document.createElement('span');
    var rule = document.createElement('span');
    var chevron = document.createElement('span');
    var nav = document.createElement('nav');

    aside.className = 'glowup-blog-toc';
    aside.setAttribute('aria-label', 'Table of contents');
    sticky.className = 'glowup-blog-toc__sticky';

    toggle.className = 'glowup-blog-toc__toggle';
    toggle.type = 'button';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', 'glowup-blog-toc-links');

    label.className = 'glowup-blog-toc__label';
    label.textContent = 'Table of Contents';
    rule.className = 'glowup-blog-toc__rule';
    rule.setAttribute('aria-hidden', 'true');
    chevron.className = 'glowup-blog-toc__chevron';
    chevron.setAttribute('aria-hidden', 'true');

    nav.id = 'glowup-blog-toc-links';
    nav.className = 'glowup-blog-toc__nav';
    nav.setAttribute('aria-label', 'Article sections');

    headings.forEach(function (heading) {
      var link = document.createElement('a');
      link.className = 'glowup-blog-toc__link glowup-blog-toc__link--' + heading.tagName.toLowerCase();
      link.href = '#' + heading.id;
      link.textContent = heading.textContent.trim();
      nav.appendChild(link);
    });

    toggle.appendChild(label);
    toggle.appendChild(rule);
    toggle.appendChild(chevron);
    sticky.appendChild(toggle);
    sticky.appendChild(nav);
    aside.appendChild(sticky);

    toggle.addEventListener('click', function () {
      if (window.matchMedia('(min-width: 1200px)').matches) return;
      setTocExpanded(aside, !aside.classList.contains('is-open'));
    });

    nav.addEventListener('click', function (event) {
      if (
        event.target.closest('a') &&
        !window.matchMedia('(min-width: 1200px)').matches
      ) {
        setTocExpanded(aside, false);
      }
    });

    return aside;
  }

  function createPromotionRail() {
    var aside = document.createElement('aside');
    aside.className = 'glowup-blog-promos';
    aside.setAttribute('aria-label', 'More from Glowup');

    promotions.forEach(function (promotion) {
      aside.appendChild(createPromotionCard(promotion));
    });

    return aside;
  }

  function createPromotionCard(promotion) {
    var card = document.createElement('section');
    var title = document.createElement('h2');
    var copy = document.createElement('p');
    var link = document.createElement('a');
    var linkText = document.createElement('span');
    var arrow = document.createElement('span');

    card.className = 'glowup-blog-promo glowup-blog-promo--' + promotion.theme;

    if (promotion.eyebrow) {
      var eyebrow = document.createElement('p');
      eyebrow.className = 'glowup-blog-promo__eyebrow';
      eyebrow.textContent = promotion.eyebrow;
      card.appendChild(eyebrow);
    }

    title.className = 'glowup-blog-promo__title';
    title.textContent = promotion.title;
    copy.className = 'glowup-blog-promo__copy';
    copy.textContent = promotion.copy;

    link.className = 'glowup-blog-promo__link';
    link.href = promotion.href;
    linkText.textContent = promotion.cta;
    arrow.textContent = '\u2197';
    arrow.setAttribute('aria-hidden', 'true');
    link.appendChild(linkText);
    link.appendChild(arrow);

    card.appendChild(title);
    card.appendChild(copy);
    card.appendChild(link);
    return card;
  }

  function getArticleHeadings(content) {
    var headings = Array.prototype.slice.call(content.querySelectorAll('h2, h3'));

    headings.forEach(function (heading) {
      if (heading.id) return;

      heading.id = getUniqueHeadingId(heading.textContent);
      heading.dataset.glowupTocGeneratedId = 'true';
    });

    return headings.filter(function (heading) {
      return heading.textContent.trim();
    });
  }

  function getUniqueHeadingId(text) {
    var base = text
      .toLowerCase()
      .trim()
      .replace(/['\u2019]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'section';
    var candidate = base;
    var suffix = 2;

    while (document.getElementById(candidate)) {
      candidate = base + '-' + suffix;
      suffix += 1;
    }

    return candidate;
  }

  function syncTocMode(layout) {
    var toc = layout.querySelector('.glowup-blog-toc');
    if (!toc || toc.hidden) return;

    var mode = window.matchMedia('(min-width: 1200px)').matches ? 'desktop' : 'compact';
    if (layout.dataset.glowupTocMode === mode) return;

    layout.dataset.glowupTocMode = mode;
    setTocExpanded(toc, mode === 'desktop');
  }

  function setTocExpanded(toc, expanded) {
    var toggle = toc.querySelector('.glowup-blog-toc__toggle');
    toc.classList.toggle('is-open', expanded);

    if (toggle) {
      toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    }
  }

  function startTocTracking(layout, headings) {
    stopTocTracking();
    if (!headings.length) return;

    tocState = {
      headings: headings,
      links: Array.prototype.slice.call(layout.querySelectorAll('.glowup-blog-toc__link'))
    };

    window.addEventListener('scroll', scheduleTocUpdate, { passive: true });
    updateActiveToc();
  }

  function stopTocTracking() {
    window.removeEventListener('scroll', scheduleTocUpdate);

    if (tocFrame) {
      window.cancelAnimationFrame(tocFrame);
      tocFrame = 0;
    }

    tocState = null;
  }

  function scheduleTocUpdate() {
    if (tocFrame || !tocState) return;

    tocFrame = window.requestAnimationFrame(function () {
      tocFrame = 0;
      updateActiveToc();
    });
  }

  function updateActiveToc() {
    if (!tocState || !tocState.headings.length) return;

    var active = tocState.headings[0];
    var header = document.querySelector('header');
    var headerBottom = header ? Math.max(0, header.getBoundingClientRect().bottom) : 0;
    var threshold = headerBottom + 130;

    tocState.headings.forEach(function (heading) {
      if (heading.getBoundingClientRect().top <= threshold) {
        active = heading;
      }
    });

    tocState.links.forEach(function (link) {
      var isActive = link.getAttribute('href') === '#' + active.id;
      link.classList.toggle('is-active', isActive);

      if (isActive) {
        link.setAttribute('aria-current', 'location');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  }

  function restoreBlogLayout() {
    var layout = document.querySelector('.glowup-blog-layout');
    stopTocTracking();

    if (!layout) {
      if (document.body) {
        document.body.classList.remove('glowup-blog-layout-mounted');
      }
      return;
    }

    var contentWrapper = layout.parentElement;
    var articleColumn = layout.querySelector('.glowup-blog-article');
    var content = articleColumn && articleColumn.querySelector('.blog-item-content');
    var author = articleColumn && articleColumn.querySelector('.blog-item-author-profile-wrapper');

    if (contentWrapper && content) {
      contentWrapper.insertBefore(content, layout);
    }

    if (contentWrapper && author) {
      contentWrapper.insertBefore(author, layout);
    }

    layout.remove();

    document.querySelectorAll('[data-glowup-toc-generated-id="true"]').forEach(function (heading) {
      heading.removeAttribute('id');
      delete heading.dataset.glowupTocGeneratedId;
    });

    if (document.body) {
      document.body.classList.remove('glowup-blog-layout-mounted');
    }
  }

  function restoreNativeHeader() {
    var hero = document.querySelector('.glowup-blog-hero');
    if (!hero) {
      if (document.body) {
        document.body.classList.remove('glowup-blog-hero-mounted');
      }
      return;
    }

    var inner = hero.parentElement;
    var top = hero.querySelector('.blog-item-top-wrapper');
    var content = inner && inner.querySelector('.blog-item-content-wrapper');
    var excerpt = top && top.querySelector('.glowup-blog-hero__excerpt');
    var date = top && top.querySelector('.blog-meta-item--date');

    if (excerpt) excerpt.remove();

    if (date && date.dataset.glowupOriginalDateHtml) {
      date.innerHTML = date.dataset.glowupOriginalDateHtml;

      if (date.dataset.glowupOriginalDateTime) {
        date.setAttribute('datetime', date.dataset.glowupOriginalDateTime);
      } else {
        date.removeAttribute('datetime');
      }

      delete date.dataset.glowupOriginalDateHtml;
      delete date.dataset.glowupOriginalDateTime;
    }

    if (inner && top) {
      inner.insertBefore(top, content || hero);
    }

    hero.remove();

    if (document.body) {
      document.body.classList.remove('glowup-blog-hero-mounted');
    }
  }

  function formatPublishedDate(scope) {
    var date = scope.querySelector('.blog-meta-item--date');
    var published = getMetaContent(['meta[itemprop="datePublished"]']);
    if (!date || !published || date.dataset.glowupOriginalDateHtml) return;

    var value = new Date(published);
    if (isNaN(value.getTime())) return;

    date.dataset.glowupOriginalDateHtml = date.innerHTML;
    date.dataset.glowupOriginalDateTime = date.getAttribute('datetime') || '';
    date.dateTime = published;
    date.textContent = new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    }).format(value);
  }

  function getMetaContent(selectors) {
    for (var index = 0; index < selectors.length; index += 1) {
      var meta = document.querySelector(selectors[index]);
      var content = meta && meta.getAttribute('content');
      if (content && content.trim()) return content.trim();
    }

    return '';
  }
})();
