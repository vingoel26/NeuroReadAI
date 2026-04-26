// NeuroRead AI — image-explainer.js
// Module: Multimodal Image/Diagram Explainer
// Adds a 🔍 overlay to images. On click, sends to Llama 3.2 Vision for explanation.

(function () {
  "use strict";
  if (window.__NR_IMAGE_EXPLAINER_LOADED) return;
  window.__NR_IMAGE_EXPLAINER_LOADED = true;

  const STYLE_ID = "nr-img-explainer-style";
  const API_URL = "http://localhost:8000/explain-image";

  if (!document.getElementById(STYLE_ID)) {
    const styleEl = document.createElement("style");
    styleEl.id = STYLE_ID;
    styleEl.textContent = `
      .nr-img-wrap {
        position: relative;
        display: inline-block;
      }
      .nr-img-explain-btn {
        position: absolute;
        top: 8px;
        right: 8px;
        z-index: 9999;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: linear-gradient(135deg, #7C3AED, #6D28D9);
        color: #fff;
        border: 2px solid rgba(255,255,255,0.8);
        font-size: 16px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 10px rgba(124, 58, 237, 0.5);
        transition: transform 0.15s ease, box-shadow 0.15s ease;
        opacity: 0;
        pointer-events: none;
      }
      .nr-img-wrap:hover .nr-img-explain-btn,
      .nr-img-explain-btn.nr-visible {
        opacity: 1;
        pointer-events: auto;
      }
      .nr-img-explain-btn:hover {
        transform: scale(1.15);
        box-shadow: 0 4px 16px rgba(124, 58, 237, 0.7);
      }
      .nr-img-explain-btn.nr-loading {
        opacity: 1;
        pointer-events: none;
        animation: nr-spin 1s linear infinite;
      }
      @keyframes nr-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }

      .nr-explain-card {
        position: absolute !important;
        top: calc(100% + 8px) !important;
        left: 0 !important;
        width: 400px !important;
        max-width: 90vw !important;
        margin-top: 0 !important;
        background: linear-gradient(135deg, #1E1B4B, #312E81) !important;
        color: #E0E7FF !important;
        border: 1px solid rgba(124, 58, 237, 0.4) !important;
        border-radius: 12px !important;
        padding: 16px !important;
        font-family: var(--nr-font-family, 'Inter', system-ui, sans-serif) !important;
        font-size: var(--nr-font-size, 14px) !important;
        line-height: var(--nr-line-height, 1.6) !important;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5) !important;
        z-index: 999999 !important;
        animation: nr-fade-in 0.3s ease !important;
      }
      @keyframes nr-fade-in {
        from { opacity: 0; transform: translateY(-8px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .nr-explain-card-header {
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        margin-bottom: 10px !important;
        padding-bottom: 8px !important;
        border-bottom: 1px solid rgba(124, 58, 237, 0.3) !important;
      }
      .nr-explain-card-title {
        font-weight: 700 !important;
        font-size: 13px !important;
        color: #A78BFA !important;
        text-transform: uppercase !important;
        letter-spacing: 0.5px !important;
      }
      .nr-explain-card-actions {
        display: flex !important;
        gap: 8px !important;
      }
      .nr-explain-card-actions button {
        background: rgba(124, 58, 237, 0.2) !important;
        color: #C4B5FD !important;
        border: 1px solid rgba(124, 58, 237, 0.3) !important;
        border-radius: 16px !important;
        padding: 4px 12px !important;
        font-size: 11px !important;
        font-weight: 600 !important;
        cursor: pointer !important;
        transition: background 0.15s ease !important;
      }
      .nr-explain-card-actions button:hover {
        background: rgba(124, 58, 237, 0.4) !important;
      }
      .nr-explain-card p {
        margin: 0 !important;
        color: #E0E7FF !important;
        font-size: var(--nr-font-size, 14px) !important;
        line-height: var(--nr-line-height, 1.6) !important;
        font-weight: normal !important;
        font-family: var(--nr-font-family, 'Inter', system-ui, sans-serif) !important;
      }
    `;
    document.head.appendChild(styleEl);
  }

  let wrappedImages = [];

  /**
   * Convert an <img> to a base64 data URL via canvas.
   * Resizes to max 1024px to stay within API limits.
   */
  function imageToBase64(img) {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement("canvas");
      const maxDim = 1024;

      let w = img.naturalWidth;
      let h = img.naturalHeight;

      if (w > maxDim || h > maxDim) {
        const scale = maxDim / Math.max(w, h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }

      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext("2d");

      // Handle CORS: try drawing directly, fallback to fetch
      try {
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      } catch (e) {
        // CORS blocked — try fetching via background proxy
        reject(e);
      }
    });
  }

  /**
   * Fetch image via background proxy for CORS-blocked images.
   */
  async function fetchImageBase64(src) {
    return new Promise((resolve) => {
      // Create a temporary image with crossOrigin
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxDim = 1024;
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        if (w > maxDim || h > maxDim) {
          const scale = maxDim / Math.max(w, h);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  /**
   * Get surrounding text context for the image.
   */
  function getImageContext(img) {
    const parent = img.closest("figure, .thumb, .image, div, td") || img.parentElement;
    if (!parent) return "";

    // Check for figcaption
    const caption = parent.querySelector("figcaption, .thumbcaption, .caption");
    let text = caption ? caption.innerText.trim() : "";

    // Also grab alt text
    if (img.alt) text = (text ? text + ". " : "") + img.alt;

    return text.substring(0, 300);
  }

  /**
   * Send image to the backend for AI explanation.
   */
  async function explainImage(base64Data, context) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: "FETCH",
        url: API_URL,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: {
          image_base64: base64Data,
          context: context
        }
      }, (res) => {
        if (res && res.ok && res.data) {
          resolve(res.data.explanation || "No explanation available.");
        } else {
          resolve("Could not analyze this image. " + (res?.error || ""));
        }
      });
    });
  }

  /**
   * Show explanation card below the image.
   */
  function showExplanation(img, explanation) {
    // Remove any existing card for this image
    const existingCard = img.parentElement.querySelector(".nr-explain-card");
    if (existingCard) existingCard.remove();

    const card = document.createElement("div");
    card.className = "nr-explain-card";
    card.innerHTML = `
      <div class="nr-explain-card-header">
        <span class="nr-explain-card-title">🧠 AI Explanation</span>
        <div class="nr-explain-card-actions">
          <button class="nr-speak-btn">🔊 Read</button>
          <button class="nr-close-btn">✕</button>
        </div>
      </div>
      <p>${explanation}</p>
    `;

    // Append inside the wrapper so position absolute attaches properly
    const wrapper = img.closest(".nr-img-wrap");
    if (wrapper) {
      wrapper.appendChild(card);
    } else {
      img.parentElement.appendChild(card);
    }

    // Prevent clicks inside the card from bubbling up to parent <a> tags
    card.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
    });

    // Read aloud button
    card.querySelector(".nr-speak-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(explanation);
      u.rate = 1.0;
      u.lang = "en-US";
      speechSynthesis.speak(u);
    });

    // Close button
    card.querySelector(".nr-close-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      speechSynthesis.cancel();
      card.remove();
    });
  }

  /**
   * Add explain buttons to all qualifying images.
   */
  function addExplainButtons() {
    const container = document.querySelector("article, main, .content, .mw-parser-output") || document.body;
    const images = Array.from(container.querySelectorAll("img")).filter(img => {
      // Only images of meaningful size (not icons/bullets)
      return img.naturalWidth > 80 && img.naturalHeight > 80 &&
             img.offsetParent !== null &&
             !img.closest("nav, footer, .nav, .menu, #nr-toc-container");
    });

    images.forEach(img => {
      // Skip if already wrapped
      if (img.parentElement.classList.contains("nr-img-wrap")) return;

      // Wrap the image
      const wrapper = document.createElement("span");
      wrapper.className = "nr-img-wrap";
      img.parentNode.insertBefore(wrapper, img);
      wrapper.appendChild(img);

      // Add the explain button
      const btn = document.createElement("button");
      btn.className = "nr-img-explain-btn";
      btn.textContent = "🔍";
      btn.title = "AI: Explain this image";
      wrapper.appendChild(btn);

      wrappedImages.push({ img, wrapper, btn });

      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();

        btn.textContent = "⏳";
        btn.classList.add("nr-loading");

        // Convert image to base64
        let base64;
        try {
          base64 = await imageToBase64(img);
        } catch (corsErr) {
          base64 = await fetchImageBase64(img.src);
        }

        if (!base64) {
          showExplanation(img, "Could not load this image for analysis (blocked by the website).");
          btn.textContent = "🔍";
          btn.classList.remove("nr-loading");
          return;
        }

        const context = getImageContext(img);
        const explanation = await explainImage(base64, context);

        showExplanation(img, explanation);

        btn.textContent = "🔍";
        btn.classList.remove("nr-loading");
      });
    });
  }

  /**
   * Remove all explain buttons and cards.
   */
  function removeExplainButtons() {
    // Remove cards
    document.querySelectorAll(".nr-explain-card").forEach(c => c.remove());

    // Unwrap images
    wrappedImages.forEach(({ img, wrapper }) => {
      if (wrapper.parentNode) {
        wrapper.parentNode.insertBefore(img, wrapper);
        wrapper.remove();
      }
    });
    wrappedImages = [];
  }

  // Public API
  window.NR_ImageExplainer = {
    activate: function () {
      addExplainButtons();
      console.log("[NeuroRead] Image Explainer activated.");
      return { success: true };
    },

    deactivate: function () {
      speechSynthesis.cancel();
      removeExplainButtons();
      console.log("[NeuroRead] Image Explainer deactivated.");
      return { success: true };
    }
  };
})();
