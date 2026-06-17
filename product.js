/* ==========================================================
   GLOWUP ONLINE — PRODUCT DETAIL PAGE CUSTOM JAVASCRIPT
   Wrap this in <script>...</script> tags and paste into:
   Settings > Advanced > Code Injection > FOOTER
========================================================== */

document.addEventListener("DOMContentLoaded", function () {

  /* ========================================================
     EDITOR DETECTION
     Skip all DOM manipulation when inside the Squarespace
     editor so you can still see and edit #my-description.
     In SQS 7.1, the editor loads your page inside an iframe.
  ======================================================== */
  function isActivelyEditing() {
    // Check 1: Are we inside an iframe? (Squarespace editor loads pages in an iframe)
    try {
      if (window.self !== window.top) return true;
    } catch (e) {
      // Cross-origin error means we're definitely in an iframe
      return true;
    }

    // Check 2: Body class checks
    var body = document.body;
    if (!body) return false;

    return (
      body.classList.contains('sqs-edit-mode-active') ||
      body.classList.contains('sqs-is-page-editing') ||
      body.classList.contains('sqs-hide-overlay-widgets')
    );
  }

  // Don't relocate content when editing in Squarespace
  if (isActivelyEditing()) return;


  /* ========================================================
     RELOCATE #my-description INTO .product-meta
     Moves the fluid engine section content from its default
     position (below the product section) into the product
     meta area, right after the Add To Cart button.
  ======================================================== */

  const productMeta = document.querySelector('.product-meta');
  const myDescSection = document.querySelector('#my-description');

  // Only run on product detail pages that have both elements
  if (!productMeta || !myDescSection) return;

  // Find the Add To Cart button area — we'll insert after it
  const addToCart = productMeta.querySelector('.product-add-to-cart');
  if (!addToCart) return;

  // Grab the content wrapper from #my-description
  const contentWrapper = myDescSection.querySelector('.content-wrapper');
  if (!contentWrapper) return;

  // Create a container for the relocated content
  const relocated = document.createElement('div');
  relocated.className = 'relocated-description';

  // Move the content wrapper into our container
  relocated.appendChild(contentWrapper);

  // Insert after the Add To Cart button
  if (addToCart.nextSibling) {
    productMeta.insertBefore(relocated, addToCart.nextSibling);
  } else {
    productMeta.appendChild(relocated);
  }

  // The original #my-description section is now empty
  // It's already hidden via CSS (display: none), so no cleanup needed

});
