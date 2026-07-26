/* ==========================================================
   GLOWUP ONLINE — GLOBAL JAVASCRIPT
   Runs on every page.
========================================================== */

function cleanUpPrice() {
	document.querySelectorAll(".product-price, .product-list-item-price").forEach(price => {
		if (price.closest(".product-detail")) return;
		if (price.dataset.glowupPriceClean) return;
		price.dataset.glowupPriceClean = "1";

		var text = price.textContent;
		var amounts = text.match(/\$[\d,]+(?:\.\d{2})?/g) || [];

		// Products on sale render as plain text nodes
		// "Sale Price: $X Original Price: $Y" — compact to "$X <s>$Y</s>"
		if (/sale price/i.test(text) && amounts.length >= 2) {
			price.textContent = amounts[0].replace(".00", "") + " ";
			var original = document.createElement("s");
			original.className = "glowup-original-price";
			original.textContent = amounts[1].replace(".00", "");
			price.appendChild(original);
			return;
		}

		price.textContent = text.replace(".00", "").replace("US", "").replace(/\s+/g, " ").trim();
	});
}

function loadBlogScript() {
	var body = document.body;
	if (!body || !body.classList.contains("collection-type-blog-basic-grid")) return;
	if (document.querySelector('script[data-glowup-blog-script]')) return;

	var script = document.createElement("script");
	script.src = "https://glowup-v2-eight.vercel.app/blog.js";
	script.defer = true;
	script.dataset.glowupBlogScript = "true";
	document.head.appendChild(script);
}

function initGlobal() {
	cleanUpPrice();
	loadBlogScript();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initGlobal);
} else {
  initGlobal();
}
