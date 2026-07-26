/* ==========================================================
   GLOWUP ONLINE - BLOG JAVASCRIPT

   Builds the blog-post hero from Squarespace's native article
   markup and page metadata. Collection pages are untouched.
========================================================== */

(function () {
  var observer = null;
  var frame = 0;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBlog);
  } else {
    initBlog();
  }

  function initBlog() {
    syncBlogHero();

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
      restoreNativeHeader();
      return;
    }

    mountBlogHero();
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
