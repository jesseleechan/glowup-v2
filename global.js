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

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", cleanUpPrice);
} else {
  cleanUpPrice();
}
