let baseCamData = null;

document.addEventListener("DOMContentLoaded", async () => {
  const status = document.getElementById("status");
  const btnVoice = document.getElementById("btn-voice");
  
  const toggles = {
    formatting: document.getElementById("toggle-formatting"),
    focus: document.getElementById("toggle-focus"),
    simplify: document.getElementById("toggle-simplify"),
    read: document.getElementById("toggle-read"),
    toc: document.getElementById("toggle-toc"),
    ruler: document.getElementById("toggle-ruler"),
    focusMode: document.getElementById("toggle-focus-mode"),
    reader: document.getElementById("toggle-reader"),
    imageExplainer: document.getElementById("toggle-explain"),
    tone: document.getElementById("toggle-tone")
  };

  const sliders = {
    fontSize: { el: document.getElementById("font-size-slider"), val: document.getElementById("font-size-val"), suffix: "px" },
    lineSpacing: { el: document.getElementById("line-spacing-slider"), val: document.getElementById("line-spacing-val"), suffix: "" },
    readSpeed: { el: document.getElementById("read-speed-slider"), val: document.getElementById("read-speed-val"), suffix: "x" }
  };

  const profileCards = document.querySelectorAll(".profile-card");

  async function getTabId() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || tab.url.startsWith("chrome://")) {
      status.textContent = "Open a real webpage first.";
      return null;
    }
    return tab.id;
  }

  // Inject a file if not already present, then execute a function natively (Across ALL frames payload)
  async function executeFeature(tabId, file, closureFunc) {
    try {
      await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: [file] });
      const results = await chrome.scripting.executeScript({
        target: { tabId, allFrames: true },
        func: closureFunc
      });
      return results && results.length > 0 ? results[0].result : { success: false };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // Storage wrappers
  async function saveState() {
    const state = {
      formatting: toggles.formatting.checked,
      focus: toggles.focus.checked,
      simplify: toggles.simplify.checked,
      read: toggles.read.checked,
      toc: toggles.toc.checked,
      ruler: toggles.ruler.checked,
      focusMode: toggles.focusMode.checked,
      reader: toggles.reader.checked,
      activeProfile: document.querySelector('.profile-card.active')?.dataset.preset || 'custom',
      typographyOverrides: {
        fontSize: sliders.fontSize.el.value,
        lineSpacing: sliders.lineSpacing.el.value,
        readSpeed: sliders.readSpeed.el.value
      }
    };
    await chrome.storage.local.set({ nrState: state });
  }

  async function loadState() {
    const res = await chrome.storage.local.get("nrState");
    if (res.nrState) {
      Object.keys(toggles).forEach(k => {
        if (res.nrState[k] !== undefined) toggles[k].checked = res.nrState[k];
      });
      if (res.nrState.typographyOverrides) {
        if (res.nrState.typographyOverrides.fontSize) {
          sliders.fontSize.el.value = res.nrState.typographyOverrides.fontSize;
          sliders.fontSize.val.textContent = sliders.fontSize.el.value + sliders.fontSize.suffix;
        }
        if (res.nrState.typographyOverrides.lineSpacing) {
          sliders.lineSpacing.el.value = res.nrState.typographyOverrides.lineSpacing;
          sliders.lineSpacing.val.textContent = sliders.lineSpacing.el.value + sliders.lineSpacing.suffix;
        }
        if (res.nrState.typographyOverrides.readSpeed) {
          sliders.readSpeed.el.value = res.nrState.typographyOverrides.readSpeed;
          sliders.readSpeed.val.textContent = sliders.readSpeed.el.value + sliders.readSpeed.suffix;
        }
      }
      setProfileActive(res.nrState.activeProfile || 'custom');
    }
  }

  function setProfileActive(preset) {
    profileCards.forEach(c => c.classList.remove('active'));
    const target = document.querySelector(`.profile-card[data-preset="${preset}"]`);
    if (target) target.classList.add('active');
  }

  /* ---------------------------------
   * FEATURE EXECUTION MAP
   * --------------------------------- */
  const features = {
    formatting: {
      file: "features/formatting.js",
      on: function() { return window.NR_Formatting.activate(); },
      off: function() { return window.NR_Formatting.deactivate(); }
    },
    focus: {
      file: "features/focus-blocker.js",
      on: function() { return window.NR_FocusBlock.activate(); },
      off: function() { return window.NR_FocusBlock.deactivate(); }
    },
    simplify: {
      file: "features/ai-text.js",
      on: function() { return window.NR_AiText.activate(); },
      off: function() { return window.NR_AiText.deactivate(); }
    },
    read: {
      file: "features/speech-out.js",
      on: function() { return window.NR_SpeechOut.activate(); },
      off: function() { return window.NR_SpeechOut.deactivate(); }
    },
    toc: {
      file: "features/visual-enhancement.js",
      on: function() { return window.NR_Visual.activate(); },
      off: function() { return window.NR_Visual.deactivate(); }
    },
    ruler: {
      file: "features/read-ruler.js",
      on: function() { return window.NR_ReadRuler.activate(); },
      off: function() { return window.NR_ReadRuler.deactivate(); }
    },
    focusMode: {
      file: "features/focus-mode.js",
      on: function() { return window.NR_FocusMode.activate(); },
      off: function() { return window.NR_FocusMode.deactivate(); }
    },
    reader: {
      file: "features/reader-mode.js",
      on: function() { return window.NR_ReaderMode.activate(); },
      off: function() { return window.NR_ReaderMode.deactivate(); }
    },
    imageExplainer: {
      file: "features/image-explainer.js",
      on: function() { return window.NR_ImageExplainer.activate(); },
      off: function() { return window.NR_ImageExplainer.deactivate(); }
    },
    tone: {
      file: "features/tone-analyzer.js",
      on: function() { return window.NR_ToneAnalyzer.activate(); },
      off: function() { return window.NR_ToneAnalyzer.deactivate(); }
    }
  };

  async function toggleFeature(key, turnOn) {
    const tabId = await getTabId();
    if (!tabId) return;
    status.textContent = turnOn ? `Activating ${key}…` : `Deactivating ${key}…`;
    
    const feat = features[key];
    const func = turnOn ? feat.on : feat.off;
    const res = await executeFeature(tabId, feat.file, func);
    
    if (res && res.error) {
       status.textContent = `❌ ${res.error}`;
    } else {
       status.textContent = "Ready.";
    }
  }

  // Attach Toggle Listeners
  Object.keys(toggles).forEach(key => {
    toggles[key].addEventListener('change', async (e) => {
      setProfileActive('custom'); // Manual toggle switches to custom mode
      await toggleFeature(key, e.target.checked);
      applyCamModifiers(); // Instantly update score display
      await saveState();
    });
  });

  // Attach Slider Listeners
  Object.keys(sliders).forEach(key => {
    const s = sliders[key];
    s.el.addEventListener('input', async (e) => {
      s.val.textContent = e.target.value + s.suffix;
      setProfileActive('custom');
      await saveState();
    });
  });

  /* ---------------------------------
   * USER PROFILES (PRESETS)
   * --------------------------------- */
  const presets = {
    adhd: { formatting: true, focus: true, focusMode: true, simplify: false, read: false, toc: true, ruler: true },
    dyslexia: { formatting: true, focus: false, focusMode: false, simplify: true, read: true, toc: false, ruler: true },
    autism: { formatting: true, focus: true, focusMode: true, simplify: true, read: false, toc: false, ruler: false }
  };

  profileCards.forEach(card => {
    card.addEventListener('click', async () => {
      const presetName = card.dataset.preset;
      setProfileActive(presetName);
      
      if (presetName !== 'custom' && presets[presetName]) {
        // Apply preset
        const config = presets[presetName];
        status.textContent = `Applying ${presetName.toUpperCase()} Profile…`;
        
        for (const key of Object.keys(toggles)) {
          const shouldBeOn = config[key];
          if (toggles[key].checked !== shouldBeOn) {
            toggles[key].checked = shouldBeOn;
            await toggleFeature(key, shouldBeOn);
          }
        }
        applyCamModifiers(); // Update score after profile applied
        status.textContent = `${presetName.toUpperCase()} Profile Active`;
      }
      await saveState();
    });
  });

  /* ---------------------------------
   * VOICE COMMAND (Always manual)
   * --------------------------------- */
  btnVoice.addEventListener("click", async () => {
    const tabId = await getTabId();
    if (!tabId) return;
    
    btnVoice.classList.add("listening");
    btnVoice.textContent = "🎤 Listening...";
    
    // Inject dependencies
    await chrome.scripting.executeScript({ target: { tabId }, files: ["features/formatting.js"] });
    await chrome.scripting.executeScript({ target: { tabId }, files: ["features/ai-text.js"] });
    await chrome.scripting.executeScript({ target: { tabId }, files: ["features/speech-out.js"] });
    await chrome.scripting.executeScript({ target: { tabId }, files: ["features/visual-enhancement.js"] });
    await chrome.scripting.executeScript({ target: { tabId }, files: ["features/read-ruler.js"] });
    await chrome.scripting.executeScript({ target: { tabId }, files: ["features/focus-mode.js"] });
    
    const res = await executeFeature(tabId, "features/speech-in.js", function() { return window.NR_SpeechIn.activate(); });
    
    setTimeout(() => {
      btnVoice.classList.remove("listening");
      btnVoice.textContent = "🎤 Listen";
    }, 5000);
    
    if (res && res.error) status.textContent = `❌ ${res.error}`;
  });

  // --- CAM Score Logic ---
  async function initCamScore(tabId) {
    const camSection = document.getElementById("cam-section");
    camSection.style.display = "block";

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabUrl = tab.url;

    // Check cache
    const cacheKey = "camCache_" + tabUrl;
    const cacheRes = await chrome.storage.local.get(cacheKey);
    if (cacheRes[cacheKey]) {
      baseCamData = cacheRes[cacheKey];
      applyCamModifiers();
      return;
    }

    // Extract text from page
    const textRes = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const container = document.querySelector('article, main, .content, .mw-parser-output') || document.body;
        return container.innerText.substring(0, 5000);
      }
    });

    if (!textRes || !textRes[0].result) {
      renderCamScore({ score: -1, rating: "Error", insights: ["Could not extract page text."] });
      return;
    }

    // Call backend
    chrome.runtime.sendMessage({
      type: "FETCH",
      url: "http://localhost:8000/cam-score",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: { text_content: textRes[0].result }
    }, (res) => {
      if (res && res.ok && res.data && res.data.success) {
        baseCamData = res.data.cam;
        applyCamModifiers();
        // Cache result
        chrome.storage.local.set({ [cacheKey]: baseCamData });
      } else {
        renderCamScore({ score: -1, rating: "API Error", insights: ["Backend unreachable."] });
      }
    });
  }

  function applyCamModifiers() {
    if (!baseCamData || baseCamData.score === -1) return;
    
    // Deep copy to avoid mutating cache
    let currentData = JSON.parse(JSON.stringify(baseCamData));
    let bonus = 0;
    
    if (toggles.formatting.checked) {
      bonus += 15;
      currentData.insights.unshift("Typography formats applied (+15)");
    }
    if (toggles.simplify.checked) {
      bonus += 25;
      currentData.insights.unshift("Text simplified (+25)");
    }
    if (toggles.focus.checked || toggles.focusMode.checked) {
      bonus += 10;
      currentData.insights.unshift("Distractions blocked (+10)");
    }
    
    currentData.score = Math.min(100, currentData.score + bonus);
    
    // Re-evaluate rating
    if (currentData.score >= 80) currentData.rating = "Excellent";
    else if (currentData.score >= 50) currentData.rating = "Good";
    else currentData.rating = "Needs Adjustments";
    
    // Keep only top 2 insights
    currentData.insights = currentData.insights.slice(0, 2);
    
    renderCamScore(currentData);
  }

  function renderCamScore(data) {
    document.getElementById("cam-score-val").textContent = data.score >= 0 ? data.score : "--";
    document.getElementById("cam-rating-badge").textContent = data.rating;
    
    const insightsList = document.getElementById("cam-insights-list");
    insightsList.innerHTML = "";
    (data.insights || []).forEach(insight => {
      const li = document.createElement("li");
      li.textContent = insight;
      insightsList.appendChild(li);
    });

    const gauge = document.getElementById("cam-gauge-circle");
    if (data.score >= 0) {
      let color = "#EF4444"; // Red for < 50
      if (data.score >= 80) color = "#10B981";      // Green
      else if (data.score >= 50) color = "#F59E0B"; // Yellow

      document.getElementById("cam-rating-badge").style.color = color;
      
      // Animate the conic gradient
      setTimeout(() => {
        gauge.style.background = `conic-gradient(${color} ${data.score}%, transparent ${data.score}%)`;
      }, 50);
    } else {
      gauge.style.background = `conic-gradient(var(--text-muted) 0%, transparent 0%)`;
      document.getElementById("cam-rating-badge").style.color = "var(--text-main)";
    }
  }

  // Init
  const activeTabId = await getTabId();
  if (activeTabId) {
    initCamScore(activeTabId);
  }
  await loadState();
});
