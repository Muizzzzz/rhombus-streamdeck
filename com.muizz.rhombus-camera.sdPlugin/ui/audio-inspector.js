// Audio Inspector JavaScript - Using exact pattern from working camera inspector
let settings = {};
let apiKeyInput, gatewaySelect, audioClipSelect;

// Global API key storage (shared across all buttons)
let globalApiKey = "";

// Load settings from localStorage (for initial form population)
function loadStoredSettings() {
  try {
    const stored = localStorage.getItem('rhombus-audio-settings');
    if (stored) {
      const storedSettings = JSON.parse(stored);
      // Only use API key from localStorage, not device selections
      if (storedSettings.apiKey) {
        globalApiKey = storedSettings.apiKey;
        settings.apiKey = storedSettings.apiKey;
        console.log("Loaded API key from localStorage:", storedSettings.apiKey);
        return true;
      }
    }
  } catch (error) {
    console.error("Error loading from localStorage:", error);
  }
  return false;
}

// Send settings to plugin
function sendSettingsToPlugin() {
  try {
    if (window.$SD && window.$SD.sendToPlugin) {
      window.$SD.sendToPlugin();
      console.log("Audio settings sent to Stream Deck plugin");
    }
  } catch (error) {
    console.error("Error sending audio settings to plugin:", error);
  }
}

function connectElgatoSocket(inPort, inUUID, inRegisterEvent, inInfo) {
  const websocket = new WebSocket(`ws://localhost:${inPort}`);
  
  websocket.onopen = () => {
    console.log("Audio inspector WebSocket opened");
    const registrationMessage = {
      event: inRegisterEvent,
      uuid: inUUID
    };
    websocket.send(JSON.stringify(registrationMessage));
  };

  websocket.onclose = () => {
    console.log("Audio inspector WebSocket closed");
  };

  websocket.onerror = (error) => {
    console.error("Audio inspector WebSocket error:", error);
  };

  websocket.onmessage = async (evt) => {
    const msg = JSON.parse(evt.data);
    console.log("Audio inspector received message:", msg.event, msg);
    
    if (msg.event === "didReceiveSettings") {
      // Load per-button settings
      settings = msg.payload.settings || {};
      console.log("Audio inspector received per-button settings:", settings);
      
      // If this button has an API key, use it and update global
      if (settings.apiKey) {
        globalApiKey = settings.apiKey;
        if (apiKeyInput) {
          apiKeyInput.value = settings.apiKey;
        }
        if (gatewaySelect) {
          gatewaySelect.value = settings.gatewayUuid || "";
        }
        if (audioClipSelect) {
          audioClipSelect.value = settings.audioClipUuid || "";
        }
        await loadGateways(settings.apiKey, settings.gatewayUuid);
        await loadAudioClips(settings.apiKey, settings.audioClipUuid);
      } else if (globalApiKey) {
        // Use global API key if button doesn't have one
        settings.apiKey = globalApiKey;
        if (apiKeyInput) {
          apiKeyInput.value = globalApiKey;
        }
        if (gatewaySelect) {
          gatewaySelect.value = settings.gatewayUuid || "";
        }
        if (audioClipSelect) {
          audioClipSelect.value = settings.audioClipUuid || "";
        }
        await loadGateways(globalApiKey, settings.gatewayUuid);
        await loadAudioClips(globalApiKey, settings.audioClipUuid);
      }
    }
  };

  window.$SD = {
    websocket: websocket,
    uuid: inUUID,
    sendToPlugin: () => {
      const payload = {
        event: "setSettings",
        context: inUUID,
        payload: { settings }
      };
      console.log("Audio inspector sending settings:", payload);
      websocket.send(JSON.stringify(payload));
    }
  };
}

// Load audio gateways from Rhombus API
async function loadGateways(apiKey, preselectUuid = null) {
    if (!apiKey) {
        showStatus('Please enter an API key first', 'error');
        return;
    }

    try {
        showStatus('Loading audio gateways...', 'info');
        
        const resp = await fetch("https://api2.rhombussystems.com/api/audiogateway/getMinimalAudioGatewayStateList", {
            method: "POST",
            headers: {
                "x-auth-scheme": "api-token",
                "x-auth-apikey": apiKey,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({})
        });
        
        if (!resp.ok) {
            throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
        }
        
        const data = await resp.json();
        console.log('Audio gateways response:', data);
        
        if (data && data.audioGatewayStates) {
            populateGatewaySelect(data.audioGatewayStates, preselectUuid);
            showStatus(`Loaded ${data.audioGatewayStates.length} audio gateways`, 'success');
        } else {
            showStatus('No audio gateways found', 'info');
        }
    } catch (error) {
        console.error('Error loading gateways:', error);
        showStatus(`Error loading gateways: ${error.message}`, 'error');
    }
}

// Load audio clips from Rhombus API
async function loadAudioClips(apiKey, preselectUuid = null) {
    if (!apiKey) {
        showStatus('Please enter an API key first', 'error');
        return;
    }

    try {
        showStatus('Loading audio clips...', 'info');
        
        const resp = await fetch("https://api2.rhombussystems.com/api/audioplayback/getAudioUploadMetadataForOrg", {
            method: "POST",
            headers: {
                "x-auth-scheme": "api-token",
                "x-auth-apikey": apiKey,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({})
        });
        
        if (!resp.ok) {
            throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
        }
        
        const data = await resp.json();
        console.log('Audio clips response:', data);
        
        if (data && data.audioUploadMetadata) {
            populateAudioClipSelect(data.audioUploadMetadata, preselectUuid);
            showStatus(`Loaded ${data.audioUploadMetadata.length} audio clips`, 'success');
        } else {
            showStatus('No audio clips found', 'info');
        }
    } catch (error) {
        console.error('Error loading audio clips:', error);
        showStatus(`Error loading audio clips: ${error.message}`, 'error');
    }
}

// Populate the gateway select dropdown
function populateGatewaySelect(gateways, preselectUuid = null) {
    const select = document.getElementById('gatewaySelect');
    if (!select) return;
    
    select.innerHTML = '<option value="">Select an audio gateway...</option>';
    
    gateways.forEach(gateway => {
        const option = document.createElement('option');
        option.value = gateway.uuid;
        option.textContent = gateway.name || `Gateway ${gateway.uuid.slice(0, 8)}...`;
        if (preselectUuid && gateway.uuid === preselectUuid) {
            option.selected = true;
        }
        select.appendChild(option);
    });
}

// Populate the audio clip select dropdown
function populateAudioClipSelect(clips, preselectUuid = null) {
    const select = document.getElementById('clipSelect');
    if (!select) return;
    
    select.innerHTML = '<option value="">No audio clip</option>';
    
    clips.forEach(clip => {
        const option = document.createElement('option');
        option.value = clip.uuid;
        option.textContent = clip.displayName || `Clip ${clip.uuid.slice(0, 8)}...`;
        if (preselectUuid && clip.uuid === preselectUuid) {
            option.selected = true;
        }
        select.appendChild(option);
    });
}

// Show status message
function showStatus(message, type = 'info') {
    const statusDiv = document.getElementById('status');
    if (!statusDiv) return;
    
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        statusDiv.style.display = 'none';
    }, 5000);
}

// Save only API key to localStorage (device selections are per-button)
function saveApiKeyToLocalStorage() {
  try {
    const apiKeyOnly = { apiKey: globalApiKey };
    localStorage.setItem('rhombus-audio-settings', JSON.stringify(apiKeyOnly));
    console.log("Saved API key to localStorage:", globalApiKey);
  } catch (error) {
    console.error("Error saving API key to localStorage:", error);
  }
}

// Initialize the page
window.addEventListener("DOMContentLoaded", () => {
    apiKeyInput = document.getElementById("apiKey");
    gatewaySelect = document.getElementById("gatewaySelect");
    audioClipSelect = document.getElementById("clipSelect");
    const refreshGatewaysBtn = document.getElementById("refreshGatewaysButton");
    const refreshClipsBtn = document.getElementById("refreshClipsButton");
    
    if (!apiKeyInput || !gatewaySelect || !audioClipSelect) {
        console.error('Required elements not found');
        return;
    }
    
    // Try to load any existing settings to populate the form
    if (loadStoredSettings()) {
        if (settings.apiKey) {
            apiKeyInput.value = settings.apiKey;
            loadGateways(settings.apiKey, settings.gatewayUuid);
            loadAudioClips(settings.apiKey, settings.audioClipUuid);
        }
        if (settings.gatewayUuid) {
            gatewaySelect.value = settings.gatewayUuid;
        }
        if (settings.audioClipUuid) {
            audioClipSelect.value = settings.audioClipUuid;
        }
    }
    
    // Add event listeners - matching camera inspector pattern exactly
    apiKeyInput.addEventListener("blur", async () => {
        const newApiKey = apiKeyInput.value.trim();
        if (newApiKey !== settings.apiKey) {
            // Update both global and per-button API key
            globalApiKey = newApiKey;
            settings.apiKey = newApiKey;
            console.log("API key updated (global and per-button):", newApiKey);
            
            // Save API key to localStorage for future use
            saveApiKeyToLocalStorage();
            
            if (newApiKey) {
                await loadGateways(newApiKey, settings.gatewayUuid);
                await loadAudioClips(newApiKey, settings.audioClipUuid);
            }
            sendSettingsToPlugin();
        }
    });
    
    gatewaySelect.addEventListener("change", () => {
        settings.gatewayUuid = gatewaySelect.value;
        sendSettingsToPlugin();
    });
    
    audioClipSelect.addEventListener("change", () => {
        settings.audioClipUuid = audioClipSelect.value;
        sendSettingsToPlugin();
    });
    
    refreshGatewaysBtn.addEventListener('click', () => {
        const apiKey = apiKeyInput.value.trim();
        if (apiKey) {
            loadGateways(apiKey, settings.gatewayUuid);
        } else {
            showStatus('Please enter an API key first', 'error');
        }
    });
    
    refreshClipsBtn.addEventListener('click', () => {
        const apiKey = apiKeyInput.value.trim();
        if (apiKey) {
            loadAudioClips(apiKey, settings.audioClipUuid);
        } else {
            showStatus('Please enter an API key first', 'error');
        }
    });
});

// Export functions to global scope for Stream Deck to find
window.connectElgatoSocket = connectElgatoSocket;
window.connectElgatoStreamDeckSocket = connectElgatoSocket;

  