// NeuroRead AI — Service Worker (background.js)
// Proxies fetch requests from content scripts to bypass mixed-content restrictions.

chrome.runtime.onInstalled.addListener(() => {
  console.log("[NeuroRead] Extension installed.");
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  // Proxy HTTP requests so content scripts on HTTPS pages can reach localhost
  if (msg.type === "FETCH") {
    console.log(`[NR-BG] FETCH proxy: ${msg.method} ${msg.url}`);
    const bgStart = Date.now();
    const opts = {
      method: msg.method || "GET",
      headers: msg.headers || {}
    };
    if (msg.body) {
      opts.body = JSON.stringify(msg.body);
    }

    fetch(msg.url, opts)
      .then(res => {
        console.log(`[NR-BG] Backend responded: ${res.status} in ${((Date.now() - bgStart)/1000).toFixed(1)}s`);
        if (!res.ok) throw new Error("Backend " + res.status);
        return res.json();
      })
      .then(data => {
        console.log(`[NR-BG] Sending data back to content script`);
        sendResponse({ ok: true, data });
      })
      .catch(err => {
        console.error(`[NR-BG] FETCH error: ${err.message}`);
        sendResponse({ ok: false, error: err.message });
      });

    return true; // keep channel open for async response
  }

  // Handle toggling network-level adblocking rules
  if (msg.type === "TOGGLE_AD_RULES") {
    if (msg.enable) {
      chrome.declarativeNetRequest.updateEnabledRulesets({
        enableRulesetIds: ["ruleset_1"]
      }).catch(err => console.error("Could not enable ruleset", err));
    } else {
      chrome.declarativeNetRequest.updateEnabledRulesets({
        disableRulesetIds: ["ruleset_1"]
      }).catch(err => console.error("Could not disable ruleset", err));
    }
    sendResponse({ success: true });
    return false;
  }

  // Proxy audio uploads (binary) for voice transcription
  if (msg.type === "FETCH_AUDIO") {
    // Convert base64 back to binary
    const binaryStr = atob(msg.audioBase64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: "audio/webm" });

    const formData = new FormData();
    formData.append("audio", blob, msg.filename || "recording.webm");

    fetch(msg.url, { method: "POST", body: formData })
      .then(res => {
        if (!res.ok) throw new Error("Backend " + res.status);
        return res.json();
      })
      .then(data => sendResponse({ ok: true, data }))
      .catch(err => sendResponse({ ok: false, error: err.message }));

    return true; // keep channel open for async response
  }

  // ─── TTS via chrome.tts ───
  if (msg.type === "TTS_START") {
    const tabId = sender.tab?.id;
    const paragraphs = msg.paragraphs || [];
    globalThis.__NR_TTS_STOPPED = false;

    (async function speakAll() {
      for (let i = 0; i < paragraphs.length; i++) {
        if (globalThis.__NR_TTS_STOPPED) break;

        // Highlight current paragraph
        try {
          await chrome.tabs.sendMessage(tabId, { type: "TTS_HIGHLIGHT", index: i });
        } catch(e) {}

        // Speak and wait for completion
        await new Promise((resolve) => {
          chrome.tts.speak(paragraphs[i], {
            rate: 0.9,
            pitch: 1.0,
            lang: "en-US",
            onEvent: function(event) {
              if (event.type === 'word') {
                try {
                  chrome.tabs.sendMessage(tabId, { 
                    type: "TTS_WORD_HIGHLIGHT", 
                    index: i, 
                    charIndex: event.charIndex, 
                    length: event.length 
                  });
                } catch(e) {}
              }
              // Any terminal event resolves immediately
              if (event.type === "end" || event.type === "interrupted" ||
                  event.type === "cancelled" || event.type === "error") {
                resolve();
              }
            }
          });
        });
      }
      // Done
      try {
        await chrome.tabs.sendMessage(tabId, { type: "TTS_DONE" });
      } catch(e) {}
    })();

    sendResponse({ ok: true });
    return false;
  }

  if (msg.type === "TTS_STOP") {
    globalThis.__NR_TTS_STOPPED = true;
    chrome.tts.stop(); // Fires "interrupted" event → instantly resolves the current promise
    sendResponse({ ok: true });
    return false;
  }
});
