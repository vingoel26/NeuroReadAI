// NeuroRead AI — tone-analyzer.js
// Module: Content Tone & Emotion Analysis
// Analyzes the emotional subtext and tone of selected text.

(function () {
  "use strict";
  if (window.__NR_TONE_LOADED) return;
  window.__NR_TONE_LOADED = true;

  const CSS_ID = "nr-tone-style";
  
  if (!document.getElementById(CSS_ID)) {
    document.head.insertAdjacentHTML('beforeend', `<style id="${CSS_ID}">
      .nr-tone-card {
        position: absolute;
        z-index: 2147483647;
        width: 320px;
        background: linear-gradient(135deg, #1E1B4B, #312E81);
        color: #E0E7FF;
        border: 1px solid rgba(124, 58, 237, 0.4);
        border-radius: 12px;
        padding: 16px;
        font-family: 'Inter', system-ui, sans-serif;
        box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        animation: nr-tone-fade-up 0.2s ease-out;
      }
      
      @keyframes nr-tone-fade-up {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      
      .nr-tone-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid rgba(124, 58, 237, 0.3);
        padding-bottom: 8px;
        margin-bottom: 12px;
      }
      
      .nr-tone-title {
        font-weight: 700;
        font-size: 13px;
        color: #A78BFA;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      
      .nr-tone-close {
        background: none;
        border: none;
        color: #A78BFA;
        cursor: pointer;
        padding: 4px;
      }
      
      .nr-tone-close:hover { color: #FFF; }
      
      .nr-tone-badges {
        display: flex;
        gap: 8px;
        margin-bottom: 12px;
      }
      
      .nr-tone-badge {
        background: rgba(124, 58, 237, 0.2);
        border: 1px solid rgba(124, 58, 237, 0.4);
        padding: 4px 8px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.5px;
      }
      
      .nr-tone-meaning {
        font-size: 13px;
        line-height: 1.5;
        margin: 0;
      }
      
      .nr-tone-loading {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: #A78BFA;
      }
      
      .nr-tone-spinner {
        width: 16px;
        height: 16px;
        border: 2px solid rgba(124, 58, 237, 0.3);
        border-top-color: #A78BFA;
        border-radius: 50%;
        animation: nr-spin 1s linear infinite;
      }
    </style>`);
  }

  let activeCard = null;

  function removeCard() {
    if (activeCard) {
      activeCard.remove();
      activeCard = null;
    }
  }

  function showToneCard(rect, textContent) {
    removeCard();
    
    activeCard = document.createElement('div');
    activeCard.className = 'nr-tone-card';
    activeCard.style.top = (rect.bottom + window.scrollY + 12) + 'px';
    activeCard.style.left = Math.max(10, rect.left + window.scrollX - 160 + (rect.width/2)) + 'px'; // Center below
    
    activeCard.innerHTML = `
      <div class="nr-tone-header">
        <span class="nr-tone-title">🎭 Tone Analysis</span>
        <button class="nr-tone-close">✕</button>
      </div>
      <div class="nr-tone-loading">
        <div class="nr-tone-spinner"></div>
        <span>Analyzing subtext...</span>
      </div>
    `;
    
    document.body.appendChild(activeCard);
    
    activeCard.querySelector('.nr-tone-close').addEventListener('click', removeCard);

    // Fetch analysis
    chrome.runtime.sendMessage({
      type: "FETCH",
      url: "http://localhost:8000/analyze-tone",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: { text_content: textContent }
    }, (res) => {
      if (!activeCard) return; // closed before finishing
      
      if (res && res.ok && res.data && res.data.success) {
        const data = res.data.analysis;
        
        // Define color based on intensity
        let intensityColor = "#A78BFA"; // Medium
        if (data.emotional_intensity.toLowerCase() === 'high') intensityColor = "#EF4444";
        if (data.emotional_intensity.toLowerCase() === 'low') intensityColor = "#10B981";
        
        activeCard.innerHTML = `
          <div class="nr-tone-header">
            <span class="nr-tone-title">🎭 Tone Analysis</span>
            <button class="nr-tone-close">✕</button>
          </div>
          <div class="nr-tone-badges">
            <span class="nr-tone-badge">${data.primary_tone}</span>
            <span class="nr-tone-badge" style="border-color: ${intensityColor}; color: ${intensityColor}">${data.emotional_intensity} Intensity</span>
          </div>
          <p class="nr-tone-meaning">${data.implicit_meaning}</p>
        `;
      } else {
        activeCard.innerHTML = `
          <div class="nr-tone-header">
            <span class="nr-tone-title">🎭 Tone Analysis</span>
            <button class="nr-tone-close">✕</button>
          </div>
          <p class="nr-tone-meaning">Could not analyze tone. ${res?.error || ''}</p>
        `;
      }
      activeCard.querySelector('.nr-tone-close').addEventListener('click', removeCard);
    });
  }

  function ensureToneBtn() {
    let menu = document.getElementById('nr-selection-menu');
    if (!menu) {
      menu = document.createElement('div');
      menu.id = 'nr-selection-menu';
      document.body.appendChild(menu);
    }

    if (!document.getElementById('nr-tone-btn')) {
      const btn = document.createElement('button');
      btn.id = 'nr-tone-btn';
      btn.textContent = '🎭 Tone';
      menu.appendChild(btn);

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        menu.style.display = 'none';

        const sel = window.getSelection();
        const text = sel.toString().trim();
        if (text.length > 5) {
          const range = sel.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          showToneCard(rect, text);
          sel.removeAllRanges(); // clear selection indicating action taken
        }
      });
    }
  }

  function handleMouseUp() {
    setTimeout(() => {
      const sel = window.getSelection();
      const text = sel.toString().trim();
      
      if (text.length > 2) {
        ensureToneBtn();
        const menu = document.getElementById('nr-selection-menu');
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        menu.style.display = 'flex';
        menu.style.top = (rect.top + window.scrollY - menu.offsetHeight - 8) + 'px';
        menu.style.left = (rect.left + window.scrollX) + 'px';
      }
    }, 15);
  }

  function handleMouseDown() {
    removeCard();
  }

  window.NR_ToneAnalyzer = {
    activate: function () {
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('mousedown', handleMouseDown);
      console.log("[NeuroRead] Tone Analyzer activated.");
      return { success: true };
    },
    deactivate: function () {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousedown', handleMouseDown);
      
      const btn = document.getElementById('nr-tone-btn');
      if (btn) btn.remove();
      
      removeCard();
      console.log("[NeuroRead] Tone Analyzer deactivated.");
      return { success: true };
    }
  };
})();
