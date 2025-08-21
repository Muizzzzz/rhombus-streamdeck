// Door Inspector JavaScript
let settings = {};
let apiKeyInput, doorSelect;
let actionContext = null; // Track the action context

// Global API key storage (shared across all buttons)
let globalApiKey = "";

// UI state preservation - prevent dropdowns from resetting
let uiState = {
  doorUuid: null,
  isReloading: false
};

// Stream Deck handles per-button settings automatically
// No need for localStorage or global state management

// Send settings to plugin
function sendSettingsToPlugin() {
  try {
    if (window.$SD && window.$SD.sendToPlugin) {
      window.$SD.sendToPlugin();
      console.log("Door settings sent to Stream Deck plugin");
    }
  } catch (error) {
    console.error("Error sending to plugin:", error);
  }
}

function connectElgatoSocket(inPort, inUUID, inRegisterEvent, inInfo) {
  // Use the existing context or fall back to the UUID
  if (!actionContext) {
    actionContext = inUUID;
  }
  
  const websocket = new WebSocket(`ws://localhost:${inPort}`);
  
  websocket.onopen = () => {
    console.log("Door inspector WebSocket opened");
    
    const registrationMessage = {
      event: inRegisterEvent,
      uuid: inUUID
    };
    
    websocket.send(JSON.stringify(registrationMessage));
  };
  
  websocket.onclose = () => {
    console.log("Door inspector WebSocket closed");
  };
  
  websocket.onerror = (error) => {
    console.error("Door inspector WebSocket error:", error);
  };
  
  websocket.onmessage = async (evt) => {
    const msg = JSON.parse(evt.data);
    console.log("Door inspector received message:", msg.event, msg);
    
    if (msg.event === "didReceiveSettings") {
      // Load per-button settings
      settings = msg.payload.settings || {};
      console.log("Door inspector received per-button settings:", settings);
      
      // If this button has an API key, use it and update global
      if (settings.apiKey) {
        globalApiKey = settings.apiKey;
        if (apiKeyInput) {
          apiKeyInput.value = settings.apiKey;
        }
        // Load doors first, then restore selection
        await loadDoors(settings.apiKey, null); // Don't preselect yet
        // Now restore the selection after dropdown is populated
        if (settings.doorUuid && doorSelect) {
          doorSelect.value = settings.doorUuid;
          console.log("Restored door selection:", settings.doorUuid);
        }
      } else if (globalApiKey) {
        // Use global API key if button doesn't have one
        settings.apiKey = globalApiKey;
        if (apiKeyInput) {
          apiKeyInput.value = globalApiKey;
        }
        // Load doors first, then restore selection
        await loadDoors(globalApiKey, null); // Don't preselect yet
        // Now restore the selection after dropdown is populated
        if (settings.doorUuid && doorSelect) {
          doorSelect.value = settings.doorUuid;
          console.log("Restored door selection:", settings.doorUuid);
        }
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
      console.log("Door inspector sending settings:", payload);
      websocket.send(JSON.stringify(payload));
    }
  };
}

window.addEventListener("DOMContentLoaded", () => {
  apiKeyInput = document.getElementById("apiKey");
  doorSelect = document.getElementById("doorList");
  
  if (!apiKeyInput || !doorSelect) {
    return;
  }
  
  // Generate a unique context for this Property Inspector instance
  if (!actionContext) {
    actionContext = `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log("Generated unique door context:", actionContext);
  }
  
  // Settings will be loaded via didReceiveSettings event from Stream Deck
  // No need to load from localStorage
  
  apiKeyInput.addEventListener("blur", async () => {
    const newApiKey = apiKeyInput.value.trim();
    if (newApiKey !== settings.apiKey) {
      settings.apiKey = newApiKey;
      console.log("API key updated:", newApiKey);
      
      updateApiStatus("Validating API key...");
      await loadDoors(newApiKey, settings.doorUuid);
      sendSettingsToPlugin();
    }
  });
  
  doorSelect.addEventListener("change", () => {
    if (!uiState.isReloading) {
      settings.doorUuid = doorSelect.value;
      uiState.doorUuid = doorSelect.value;
      updateDoorStatus(doorSelect.value ? `Selected: ${doorSelect.options[doorSelect.selectedIndex].text}` : "");
      sendSettingsToPlugin();
    }
  });
  
  const testButton = document.getElementById("testButton");
  const testStatus = document.getElementById("testStatus");
  
  testButton.addEventListener("click", () => {
    sendSettingsToPlugin();
    
    const apiKeyDisplay = settings.apiKey ? `***${settings.apiKey.slice(-4)}` : "not set";
    const doorDisplay = settings.doorUuid ? settings.doorUuid : "not set";
    
    testStatus.innerHTML = `
      <div>✅ Door settings saved successfully!</div>
      <div style="margin-top: 5px; font-size: 12px; color: #666;">
        API Key: ${apiKeyDisplay}, Door UUID: ${doorDisplay}
      </div>
      <div style="margin-top: 5px; font-size: 11px; color: #888;">
        Press the Stream Deck button to unlock the door.
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
    debugInfo += `- Door select value: ${doorSelect.value || 'empty'}`;
    
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

function updateDoorStatus(message, isError = false) {
  const statusEl = document.getElementById("doorStatus");
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.className = `status ${isError ? 'error' : 'success'}`;
  }
}

// Settings are automatically saved via sendSettingsToPlugin() when inputs change

async function loadDoors(apiKey, preselectUuid) {
  if (!apiKey || apiKey.trim() === "") {
    doorSelect.innerHTML = "<option value=''>Enter API key first</option>";
    updateApiStatus("Enter API key to load doors");
    updateDoorStatus("");
    return;
  }
  
  // Store current selection before reloading
  const currentSelection = doorSelect.value || preselectUuid || uiState.doorUuid;
  uiState.isReloading = true;
  
  doorSelect.innerHTML = "<option>Loading doors...</option>";
  updateDoorStatus("Loading doors...");
  
  try {
    // Use the findAccessControlledDoors endpoint
    const resp = await fetch("https://api2.rhombussystems.com/api/component/findAccessControlledDoors", {
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
    
    if (!data.accessControlledDoors || !Array.isArray(data.accessControlledDoors)) {
      throw new Error("Invalid response format");
    }
    
    doorSelect.innerHTML = "";
    
    if (data.accessControlledDoors.length === 0) {
      doorSelect.innerHTML = "<option value=''>No doors found</option>";
      updateApiStatus("API key valid, but no doors found", true);
      updateDoorStatus("");
      return;
    }
    
    data.accessControlledDoors.forEach(door => {
      const opt = document.createElement("option");
      opt.value = door.uuid;
      opt.text = door.name || door.uuid;
      doorSelect.append(opt);
    });
    
    // Restore selection after reloading
    if (currentSelection) {
      doorSelect.value = currentSelection;
      uiState.doorUuid = currentSelection;
      console.log("Preserved door selection:", currentSelection);
    }
    
    updateApiStatus(`Found ${data.accessControlledDoors.length} door(s)`);
    updateDoorStatus("");
    
  } catch (e) {
    doorSelect.innerHTML = `<option value=''>Error: ${e.message}</option>`;
    updateApiStatus(`Error: ${e.message}`, true);
    updateDoorStatus("");
  } finally {
    uiState.isReloading = false;
  }
}

// Make functions available globally
window.connectElgatoSocket = connectElgatoSocket;
window.connectElgatoStreamDeckSocket = connectElgatoSocket; 