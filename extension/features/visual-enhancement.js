// NeuroRead AI — visual-enhancement.js
// Module 5: Floating Table of Contents & Enhanced Search

(function () {
  "use strict";
  if (window.__NR_VISUAL_LOADED) return;
  window.__NR_VISUAL_LOADED = true;

  const CONTAINER_ID = "nr-toc-container";
  const TOGGLE_ID = "nr-toc-toggle";
  const PRIMARY_COLOR = "#7c3aed";
  const BG_COLOR = "#1e1e1e";
  const TEXT_COLOR = "#e2e8f0";

  let headers = [];
  let tocItems = [];
  let isDragging = false;
  let offset = { x: 0, y: 0 };

  // Inject styles for the TOC
  function injectStyles() {
    if (document.getElementById("nr-toc-styles")) return;
    const style = document.createElement("style");
    style.id = "nr-toc-styles";
    style.textContent = `
      #nr-toc-container {
        position: fixed;
        top: 20px;
        right: 20px;
        width: 320px;
        max-height: 80vh;
        background: ${BG_COLOR};
        color: ${TEXT_COLOR};
        border-radius: 12px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.5);
        z-index: 2147483647; /* Max z-index */
        display: flex;
        flex-direction: column;
        font-family: system-ui, sans-serif;
        overflow: hidden;
        border: 1px solid #333;
        transition: opacity 0.2s ease, transform 0.2s ease;
      }
      #nr-toc-header {
        padding: 12px 16px;
        background: #2a2a2a;
        font-weight: 600;
        font-size: 15px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: move;
        border-bottom: 1px solid #444;
      }
      #nr-toc-close {
        cursor: pointer;
        color: #aaa;
        font-size: 18px;
        line-height: 1;
      }
      #nr-toc-close:hover { color: #fff; }
      #nr-toc-search-container {
        padding: 12px 16px 8px;
      }
      #nr-toc-search {
        width: 100%;
        padding: 8px 12px;
        border-radius: 6px;
        border: 1px solid #444;
        background: #111;
        color: #fff;
        font-size: 13px;
        outline: none;
      }
      #nr-toc-search:focus {
        border-color: ${PRIMARY_COLOR};
      }
      #nr-toc-list {
        list-style: none;
        padding: 0;
        margin: 0;
        overflow-y: auto;
        flex-grow: 1;
        padding: 8px 0 16px 0;
      }
      #nr-toc-list::-webkit-scrollbar {
        width: 6px;
      }
      #nr-toc-list::-webkit-scrollbar-thumb {
        background: #444;
        border-radius: 3px;
      }
      .nr-toc-item {
        padding: 6px 16px;
        cursor: pointer;
        font-size: 13px;
        line-height: 1.4;
        color: #cbd5e1;
        transition: background 0.15s, color 0.15s;
        display: block;
        text-decoration: none;
      }
      .nr-toc-item:hover {
        background: #333;
        color: #fff;
      }
      .nr-toc-h1 { font-weight: 600; padding-top: 10px; }
      .nr-toc-h2 { padding-left: 24px; }
      .nr-toc-h3 { padding-left: 36px; font-size: 12px; color: #94a3b8; }
      .nr-toc-active {
        color: ${PRIMARY_COLOR} !important;
        background: rgba(124, 58, 237, 0.1) !important;
        border-left: 3px solid ${PRIMARY_COLOR};
        padding-left: 13px; /* compensate for border */
      }
      .nr-toc-h2.nr-toc-active { padding-left: 21px; }
      .nr-toc-h3.nr-toc-active { padding-left: 33px; }
      
      #nr-toc-toggle {
        position: fixed;
        bottom: 30px;
        right: 30px;
        width: 50px;
        height: 50px;
        border-radius: 25px;
        background: ${PRIMARY_COLOR};
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        cursor: pointer;
        z-index: 2147483646;
        font-size: 24px;
        border: none;
        transition: transform 0.2s, background 0.2s;
      }
      #nr-toc-toggle:hover {
        transform: scale(1.05);
        background: #6d28d9;
      }
    `;
    document.head.appendChild(style);
  }

  // Find all headers in main content area
  function extractHeaders() {
    const container = document.querySelector('article, main, .content, .mw-parser-output') || document.body;
    // Get all h1, h2, h3 that have meaningful text and are visible
    headers = Array.from(container.querySelectorAll('h1, h2, h3')).filter(h => {
      return h.innerText.trim().length > 2 && h.offsetParent !== null;
    });

    // Ensure headers have an ID for anchoring
    headers.forEach((h, i) => {
      if (!h.id) {
        h.id = 'nr-header-' + i;
      }
    });

    return headers;
  }

  // Build the TOC UI
  function buildTOC() {
    if (document.getElementById(CONTAINER_ID)) {
      document.getElementById(CONTAINER_ID).remove();
    }
    if (document.getElementById(TOGGLE_ID)) {
      document.getElementById(TOGGLE_ID).remove();
    }

    const container = document.createElement('div');
    container.id = CONTAINER_ID;

    // Header matching drag logic
    const headerEl = document.createElement('div');
    headerEl.id = 'nr-toc-header';
    headerEl.innerHTML = `
      <span>TOC & Navigation</span>
      <span id="nr-toc-close">&times;</span>
    `;

    // Search bar
    const searchContainer = document.createElement('div');
    searchContainer.id = 'nr-toc-search-container';
    searchContainer.innerHTML = `<input type="text" id="nr-toc-search" placeholder="Search sections..." autocomplete="off">`;

    // List
    const listEl = document.createElement('ul');
    listEl.id = 'nr-toc-list';

    tocItems = headers.map(h => {
      const li = document.createElement('li');
      li.className = `nr-toc-item nr-toc-${h.tagName.toLowerCase()}`;
      li.textContent = h.innerText.trim();
      li.dataset.targetId = h.id;
      
      li.addEventListener('click', () => {
        const rect = h.getBoundingClientRect();
        const absoluteTop = rect.top + window.pageYOffset;
        window.scrollTo({
          top: absoluteTop - 80, // 80px offset for floating menus
          behavior: 'smooth'
        });
      });
      
      listEl.appendChild(li);
      return { element: li, text: li.textContent.toLowerCase(), header: h };
    });

    if (tocItems.length === 0) {
      listEl.innerHTML = '<li class="nr-toc-item" style="color: #666; cursor: default;">No headers found.</li>';
    }

    container.appendChild(headerEl);
    container.appendChild(searchContainer);
    container.appendChild(listEl);
    document.body.appendChild(container);

    // Toggle button (hidden by default since TOC is open)
    const toggle = document.createElement('button');
    toggle.id = TOGGLE_ID;
    toggle.innerHTML = "📑";
    toggle.style.display = "none";
    document.body.appendChild(toggle);

    // Interactions
    document.getElementById('nr-toc-close').addEventListener('click', () => {
      container.style.opacity = '0';
      container.style.transform = 'scale(0.95)';
      setTimeout(() => {
        container.style.display = 'none';
        toggle.style.display = 'flex';
      }, 200);
    });

    toggle.addEventListener('click', () => {
      container.style.display = 'flex';
      setTimeout(() => {
        container.style.opacity = '1';
        container.style.transform = 'scale(1)';
      }, 10);
      toggle.style.display = 'none';
    });

    // Search filtering
    const searchInput = document.getElementById('nr-toc-search');
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      tocItems.forEach(item => {
        if (item.text.includes(query)) {
          item.element.style.display = 'block';
        } else {
          item.element.style.display = 'none';
        }
      });
    });

    // Native Browser Find fallback (Ctrl+F behavior) on Enter
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.value.trim().length > 0) {
        window.find(e.target.value);
      }
    });

    setupDraggable(container, headerEl);
  }

  // Make the widget draggable
  function setupDraggable(container, handle) {
    handle.addEventListener('mousedown', (e) => {
      if (e.target.id === 'nr-toc-close') return;
      isDragging = true;
      const rect = container.getBoundingClientRect();
      offset.x = e.clientX - rect.left;
      offset.y = e.clientY - rect.top;
      container.style.transition = 'none'; // disable transition while dragging
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      // Calculate new position
      let newX = e.clientX - offset.x;
      let newY = e.clientY - offset.y;

      // Bound to window
      const rect = container.getBoundingClientRect();
      newX = Math.max(0, Math.min(newX, window.innerWidth - rect.width));
      newY = Math.max(0, Math.min(newY, window.innerHeight - rect.height));

      // Because we used 'right' initially, let's switch to left for dragging
      container.style.right = 'auto';
      container.style.left = newX + 'px';
      container.style.top = newY + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        container.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
      }
    });
  }

  // Scroll Spy
  let scrollTimeout;
  function updateActiveHeader() {
    if (tocItems.length === 0) return;

    // Find the header closest to the top of the viewport
    let activeItem = null;
    let minDistance = Infinity;

    tocItems.forEach(item => {
      const rect = item.header.getBoundingClientRect();
      // We check relative to slightly below top of window (e.g. 100px)
      const distance = Math.abs(rect.top - 100); 
      
      // We want the last header that has been scrolled past, or the closest one in view
      if (rect.top < window.innerHeight / 2 && rect.top > -window.innerHeight) {
        if (distance < minDistance) {
          minDistance = distance;
          activeItem = item;
        }
      }
    });

    // Fallback: simply pick the one whose top is < 150 but highest value
    if (!activeItem) {
        let bestScore = -Infinity;
        tocItems.forEach(item => {
            const rect = item.header.getBoundingClientRect();
            if (rect.top <= 150 && rect.top > bestScore) {
                bestScore = rect.top;
                activeItem = item;
            }
        });
    }

    if (activeItem) {
      tocItems.forEach(i => i.element.classList.remove('nr-toc-active'));
      activeItem.element.classList.add('nr-toc-active');
      
      // Auto-scroll TOC list to keep active item in view 
      // (only if user isn't hovering on the TOC so we don't mess up their mouse)
      const listEl = document.getElementById('nr-toc-list');
      if (listEl && !listEl.matches(':hover')) {
          const itemTop = activeItem.element.offsetTop;
          const listHeight = listEl.offsetHeight;
          if (itemTop < listEl.scrollTop || itemTop > listEl.scrollTop + listHeight) {
             listEl.scrollTop = itemTop - listHeight / 2;
          }
      }
    }
  }

  function handleScroll() {
    if (scrollTimeout) cancelAnimationFrame(scrollTimeout);
    scrollTimeout = requestAnimationFrame(updateActiveHeader);
  }

  // Public API
  window.NR_Visual = {
    activate: function () {
      injectStyles();
      extractHeaders();
      buildTOC();
      document.addEventListener('scroll', handleScroll, { passive: true });
      updateActiveHeader();
      return { success: true };
    },
    deactivate: function () {
      document.removeEventListener('scroll', handleScroll);
      if (document.getElementById(CONTAINER_ID)) document.getElementById(CONTAINER_ID).remove();
      if (document.getElementById(TOGGLE_ID)) document.getElementById(TOGGLE_ID).remove();
      if (document.getElementById('nr-toc-styles')) document.getElementById('nr-toc-styles').remove();
      return { success: true };
    }
  };
})();
