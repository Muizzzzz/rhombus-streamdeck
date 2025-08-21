// Property inspector for Rhombus Camera plugin
let settings = {};
let apiKeyInput;
let cameraSelect;

// Global API key storage (shared across all buttons)
let globalApiKey = "";

// Load settings from localStorage (for initial form population)
function loadStoredSettings() {
  try {
    const stored = localStorage.getItem('rhombus-camera-settings');
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
      console.log("Settings sent to Stream Deck plugin");
    }
  } catch (error) {
    console.error("Error sending to plugin:", error);
  }
}

function connectElgatoSocket(inPort, inUUID, inRegisterEvent, inInfo) {
  const websocket = new WebSocket(`ws://localhost:${inPort}`);
  
  websocket.onopen = () => {
    const registrationMessage = {
      event: inRegisterEvent,
      uuid: inUUID
    };
    websocket.send(JSON.stringify(registrationMessage));
  };

  websocket.onmessage = async (evt) => {
    const msg = JSON.parse(evt.data);
    console.log("Received message:", msg.event, msg);
    
    if (msg.event === "didReceiveSettings") {
      // Load per-button settings
      settings = msg.payload.settings || {};
      console.log("Received per-button settings:", settings);
      
      // If this button has an API key, use it and update global
      if (settings.apiKey) {
        globalApiKey = settings.apiKey;
        if (apiKeyInput) {
          apiKeyInput.value = settings.apiKey;
        }
        await loadCameras(settings.apiKey, settings.cameraUuid);
      } else if (globalApiKey) {
        // Use global API key if button doesn't have one
        settings.apiKey = globalApiKey;
        if (apiKeyInput) {
          apiKeyInput.value = globalApiKey;
        }
        await loadCameras(globalApiKey, settings.cameraUuid);
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
      console.log("Sending settings:", payload);
      websocket.send(JSON.stringify(payload));
    }
  };
}

window.addEventListener("DOMContentLoaded", () => {
  apiKeyInput = document.getElementById("apiKey");
  cameraSelect = document.getElementById("cameraList");

  if (!apiKeyInput || !cameraSelect) {
    return;
  }

  // Try to load any existing settings to populate the form
  if (loadStoredSettings()) {
    if (settings.apiKey) {
      apiKeyInput.value = settings.apiKey;
      loadCameras(settings.apiKey, settings.cameraUuid);
    }
  }

  apiKeyInput.addEventListener("blur", async () => {
    const newApiKey = apiKeyInput.value.trim();
    if (newApiKey !== settings.apiKey) {
      // Update both global and per-button API key
      globalApiKey = newApiKey;
      settings.apiKey = newApiKey;
      console.log("API key updated (global and per-button):", newApiKey);
      
      // Save API key to localStorage for future use
      saveApiKeyToLocalStorage();
      
      updateApiStatus("Validating API key...");
      await loadCameras(newApiKey, settings.cameraUuid);
      sendSettingsToPlugin();
    }
  });

  cameraSelect.addEventListener("change", () => {
    settings.cameraUuid = cameraSelect.value;
    updateCameraStatus(cameraSelect.value ? `Selected: ${cameraSelect.options[cameraSelect.selectedIndex].text}` : "");
    sendSettingsToPlugin();
  });

  const testButton = document.getElementById("testButton");
  const testStatus = document.getElementById("testStatus");
  
  testButton.addEventListener("click", () => {
    sendSettingsToPlugin();
    
    const apiKeyDisplay = settings.apiKey ? `***${settings.apiKey.slice(-4)}` : "not set";
    const cameraDisplay = settings.cameraUuid ? settings.cameraUuid : "not set";
    
    testStatus.innerHTML = `
      <div>✅ Settings saved successfully!</div>
      <div style="margin-top: 5px; font-size: 12px; color: #666;">
        API Key: ${apiKeyDisplay}, Camera: ${cameraDisplay}
      </div>
      <div style="margin-top: 5px; font-size: 11px; color: #888;">
        Press the Stream Deck button to open the camera stream.
      </div>
    `;
    testStatus.className = "status success";
  });

  // Add debug button
  const debugButton = document.getElementById("debugButton");
  const debugStatus = document.getElementById("debugStatus");
  
  debugButton.addEventListener("click", () => {
    let debugInfo = "Debug Info:\n";
    debugInfo += `- $SD available: ${!!window.$SD}\n`;
    debugInfo += `- WebSocket available: ${!!(window.$SD && window.$SD.websocket)}\n`;
    
    if (window.$SD && window.$SD.websocket) {
      debugInfo += `- WebSocket readyState: ${window.$SD.websocket.readyState}\n`;
      debugInfo += `- UUID: ${window.$SD.uuid}\n`;
    }
    
    debugInfo += `- Current settings: ${JSON.stringify(settings)}\n`;
    debugInfo += `- API Key input value: ${apiKeyInput.value ? 'set' : 'empty'}\n`;
    debugInfo += `- Camera select value: ${cameraSelect.value || 'empty'}`;
    
    // Settings are now managed per-button via Stream Deck
    debugInfo += `\n- Global API Key: ${globalApiKey ? 'set' : 'not set'}`;
    debugInfo += `\n- Per-button settings: ${JSON.stringify(settings)}`;
    
    debugStatus.textContent = debugInfo;
    debugStatus.className = "status";
  });
});

function updateApiStatus(message, isError = false) {
  const statusEl = document.getElementById("apiStatus");
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.className = `status ${isError ? 'error' : 'success'}`;
  }
}

function updateCameraStatus(message, isError = false) {
  const statusEl = document.getElementById("cameraStatus");
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.className = `status ${isError ? 'error' : 'success'}`;
  }
}

// Save only API key to localStorage (device selections are per-button)
function saveApiKeyToLocalStorage() {
  try {
    const apiKeyOnly = { apiKey: globalApiKey };
    localStorage.setItem('rhombus-camera-settings', JSON.stringify(apiKeyOnly));
    console.log("Saved API key to localStorage:", globalApiKey);
  } catch (error) {
    console.error("Error saving API key to localStorage:", error);
  }
}

async function loadCameras(apiKey, preselectUuid) {
  if (!apiKey || apiKey.trim() === "") {
    cameraSelect.innerHTML = "<option value=''>Enter API key first</option>";
    updateApiStatus("Enter API key to load cameras");
    updateCameraStatus("");
    return;
  }

  cameraSelect.innerHTML = "<option>Loading cameras...</option>";
  updateCameraStatus("Loading cameras...");
  updateApiStatus("Connecting to Rhombus API...");
  
  try {
    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    const resp = await fetch("https://api2.rhombussystems.com/api/camera/getMinimalCameraStateList", {
      method: "POST",
      headers: {
        "x-auth-scheme": "api-token",
        "x-auth-apikey": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({}),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!resp.ok) {
      let errorMessage = `HTTP ${resp.status}: ${resp.statusText}`;
      if (resp.status === 401) {
        errorMessage = "Invalid API key";
      } else if (resp.status === 403) {
        errorMessage = "API key lacks required permissions";
      } else if (resp.status >= 500) {
        errorMessage = "Rhombus API server error";
      }
      throw new Error(errorMessage);
    }
    
    const data = await resp.json();
    
    if (!data.cameraStates || !Array.isArray(data.cameraStates)) {
      throw new Error("Invalid response format from API");
    }
    
    cameraSelect.innerHTML = "";
    
    if (data.cameraStates.length === 0) {
      cameraSelect.innerHTML = "<option value=''>No cameras found</option>";
      updateApiStatus("API key valid, but no cameras found", true);
      updateCameraStatus("");
      return;
    }
    
    data.cameraStates.forEach(cam => {
      const opt = document.createElement("option");
      opt.value = cam.uuid;
      opt.text = cam.name || cam.uuid;
      cameraSelect.append(opt);
    });
    
    if (preselectUuid) {
      cameraSelect.value = preselectUuid;
    }
    
    updateApiStatus(`Found ${data.cameraStates.length} camera(s)`);
    updateCameraStatus("");
    
  } catch (e) {
    let errorMessage = e.message;
    if (e.name === 'AbortError') {
      errorMessage = "Request timed out after 30 seconds";
    }
    
    cameraSelect.innerHTML = `<option value=''>Error: ${errorMessage}</option>`;
    updateApiStatus(`Error: ${errorMessage}`, true);
    updateCameraStatus("");
  }
}

// Make functions available globally
window.connectElgatoSocket = connectElgatoSocket;
window.connectElgatoStreamDeckSocket = connectElgatoSocket;