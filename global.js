/* ==========================================================
   GLOWUP ONLINE — GLOBAL JAVASCRIPT
   Runs on every page.
========================================================== */

function cleanUpPrice() {
	document.querySelectorAll(".product-price, .product-list-item-price").forEach(price => {
		price.textContent = price.textContent.replace(".00", "").replace("US", "");
	});
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", cleanUpPrice);
} else {
  cleanUpPrice();
}
