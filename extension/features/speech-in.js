// NeuroRead AI — speech-in.js
// Module 4: Voice Command Input
// Records audio from the mic, sends to Groq via backend, and executes AI-mapped intents.

(function () {
  "use strict";
  if (window.__NR_SPEECH_IN_LOADED) return;
  window.__NR_SPEECH_IN_LOADED = true;

  const API = "http://localhost:8000/voice";
  let mediaRecorder = null;
  let audioChunks = [];
  let isRecording = false;

  const NATIVE_FEATURES = {
    "formatting": () => { window.NR_Formatting && window.NR_Formatting.activate(); },
    "simplify": () => { window.NR_AiText && window.NR_AiText.activate(); },
    "read": () => { window.NR_SpeechOut && window.NR_SpeechOut.activate(); },
    "stop": () => { window.NR_SpeechOut && window.NR_SpeechOut.deactivate(); },
    "focus": () => { window.NR_FocusMode && window.NR_FocusMode.activate(); },
    "ruler": () => { window.NR_ReadRuler && window.NR_ReadRuler.activate(); },
    "toc": () => { window.NR_Visual && window.NR_Visual.activate(); },
    "undo": () => { 
      window.NR_Formatting && window.NR_Formatting.deactivate();
      window.NR_AiText && window.NR_AiText.deactivate();
      window.NR_FocusMode && window.NR_FocusMode.deactivate();
      window.NR_ReadRuler && window.NR_ReadRuler.deactivate();
      window.NR_Visual && window.NR_Visual.deactivate();
    }
  };

  /**
   * Start recording from the microphone.
   */
  async function startRecording() {
    if (isRecording) return { success: false, error: "Already recording" };

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunks = [];
      mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        // Stop all tracks to release mic
        stream.getTracks().forEach(t => t.stop());
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        isRecording = false;
        const micBtn = document.getElementById("tb-mic");
        if (micBtn) {
           micBtn.classList.remove("nr-recording", "nr-active");
           chrome.storage.local.get("nrState", (res) => {
             let state = res.nrState || {};
             state['mic'] = false;
             chrome.storage.local.set({ nrState: state });
           });
        }

        // Send to backend for transcription and intent parsing
        const responseData = await sendToBackend(audioBlob);
        
        if (responseData && responseData.intent) {
          const trans = responseData.transcription;
          const intent = responseData.intent;
          
          console.log(`%c🎤 Heard: "${trans}"`, "background: #DC2626; color: white; padding: 6px 12px; border-radius: 4px;");
          console.log(`%c🤖 AI Intent: ${intent.action_type}`, "background: #059669; color: white; padding: 4px 8px; border-radius: 4px;", intent);

          if (intent.action_type === 'feature' && intent.feature_name) {
            if (NATIVE_FEATURES[intent.feature_name]) {
               NATIVE_FEATURES[intent.feature_name]();
            } else {
               speak("I'm sorry, I don't recognize that specific extension feature.");
            }
          } 
          else if (intent.action_type === 'dom_manipulation' && intent.dom_action) {
             try {
               // Execute the AI-generated DOM action securely via structured JSON API
               const action = intent.dom_action;
               let targetNode = window; // Default to window
               
               if (action.selector) {
                   targetNode = document.querySelector(action.selector);
               }

               if (targetNode && typeof targetNode[action.method] === 'function') {
                   if (action.args !== null && typeof action.args === 'object' && Object.keys(action.args).length > 0) {
                       targetNode[action.method](action.args);
                   } else {
                       targetNode[action.method]();
                   }
               } else {
                   throw new Error(`Method ${action.method} not found on target`);
               }
             } catch (e) {
               console.error("[NeuroRead/Voice] Error executing DOM manipulation:", e);
               speak("I had trouble executing that command on this web page.");
             }
          } 

          else if (intent.action_type === 'speak' && intent.speak_message) {
             speak(intent.speak_message);
          } else {
             speak("I didn't quite catch what to do.");
          }
        } else {
          console.log("%c🎤 NeuroRead: Could not transcribe or map audio.", "background: #333; color: #aaa; padding: 4px 8px;");
          speak("I didn't hear anything.");
        }
      };

      mediaRecorder.start();
      isRecording = true;

      // Auto-stop after 5 seconds to prevent runaway recording
      setTimeout(() => {
        if (mediaRecorder && mediaRecorder.state === "recording") {
          mediaRecorder.stop();
        }
      }, 5000);

      const micBtn = document.getElementById("tb-mic");
      if (micBtn) micBtn.classList.add("nr-recording", "nr-active");

      return { success: true, message: "Recording active." };
    } catch (err) {
      console.error("[NeuroRead/Voice] Mic error:", err);
      return { success: false, error: "Microphone access denied" };
    }
  }

  function speak(text) {
    if ('speechSynthesis' in window) {
      const msg = new SpeechSynthesisUtterance(text);
      msg.lang = 'en-US';
      msg.pitch = 1.1;
      msg.rate = 1.0;
      window.speechSynthesis.speak(msg);
    }
  }

  /**
   * Send the recorded audio blob to the backend via background.js proxy.
   */
  function sendToBackend(audioBlob) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result.split(',')[1];
        chrome.runtime.sendMessage(
          {
            type: "FETCH_AUDIO",
            url: API,
            audioBase64: base64,
            filename: "recording.webm"
          },
          (res) => {
            if (chrome.runtime.lastError || !res || !res.ok) {
              console.error("[NeuroRead/Voice] Fetch failed:", chrome.runtime.lastError || res?.error);
              resolve(null);
            } else {
              resolve(res.data);
            }
          }
        );
      };
      reader.readAsDataURL(audioBlob);
    });
  }

  window.NR_SpeechIn = {
    activate: startRecording,
    deactivate: function () {
      if (mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.stop();
      }
      isRecording = false;
      const micBtn = document.getElementById("tb-mic");
      if (micBtn) {
         micBtn.classList.remove("nr-recording", "nr-active");
         chrome.storage.local.get("nrState", (res) => {
             let state = res.nrState || {};
             state['mic'] = false;
             chrome.storage.local.set({ nrState: state });
         });
      }
    }
  };
})();
