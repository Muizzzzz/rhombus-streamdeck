// src/plugin.ts
import streamDeck from "@elgato/streamdeck";
import path from "path";

// Define the settings interfaces
interface CameraSettings {
  apiKey?: string;
  cameraUuid?: string;
  isStreaming?: boolean;
}

interface DoorSettings {
  apiKey?: string;
  doorUuid?: string;
}

interface AudioGatewaySettings {
  apiKey?: string;
  gatewayUuid?: string;
  audioClipUuid?: string;
}

// Track per-instance states using Maps
const cameraStates = new Map<string, boolean>(); // cameraUuid -> streaming state
const doorStates = new Map<string, boolean>(); // doorUuid -> unlocked state
const audioStates = new Map<string, boolean>(); // gatewayUuid -> playing state

// Track per-instance monitors
const doorMonitors = new Map<string, NodeJS.Timeout>(); // doorUuid -> monitor interval
const audioMonitors = new Map<string, NodeJS.Timeout>(); // gatewayUuid -> monitor interval

// Function to check if MPV is running for a specific camera
async function checkMPVRunning(cameraUuid: string): Promise<boolean> {
  const { exec } = await import("child_process");
  
  return new Promise((resolve) => {
    exec(`pgrep -f "mpv.*${cameraUuid}"`, (error) => {
      resolve(!error);
    });
  });
}

// Function to check door lock status
async function checkDoorStatus(apiKey: string, doorUuid: string): Promise<boolean> {
  try {
    const { exec } = await import("child_process");
    return new Promise((resolve) => {
      exec(`"${path.join(process.cwd(), "ui/get_door_status.sh")}" "${apiKey}" "${doorUuid}"`, (error, stdout) => {
        if (error) {
          resolve(stdout.trim() === "Unlocked");
        } else {
          resolve(stdout.trim() === "Unlocked");
        }
      });
    });
  } catch (error) {
    return false;
  }
}

// Function to monitor door status
function startDoorMonitor(action: any, apiKey: string, doorUuid: string) {
  // Stop existing monitor for this door if running
  if (doorMonitors.has(doorUuid)) {
    clearInterval(doorMonitors.get(doorUuid)!);
  }
  
  // Initialize door state to locked
  doorStates.set(doorUuid, false);
  action.setState(0);
  action.setTitle("Locked");
  
  // Check door status after a short delay to give unlock command time to take effect
  setTimeout(() => {
    checkDoorStatus(apiKey, doorUuid).then((isUnlocked) => {
      if (isUnlocked) {
        // Door is unlocked - turn green
        doorStates.set(doorUuid, true);
        action.setState(1);
        action.setTitle("Unlocked");
      } else {
        // Door is locked - stay red
        doorStates.set(doorUuid, false);
        action.setState(0);
        action.setTitle("Locked");
      }
    });
  }, 1000); // Wait 1 second before checking
  
  // Start monitoring for status changes every 5 seconds
  const monitorInterval = setInterval(async () => {
    const currentStatus = await checkDoorStatus(apiKey, doorUuid);
    const previousStatus = doorStates.get(doorUuid) || false;
    
    // Only update if status changed
    if (currentStatus !== previousStatus) {
      doorStates.set(doorUuid, currentStatus);
      await action.setState(currentStatus ? 1 : 0);
      await action.setTitle(currentStatus ? "Unlocked" : "Locked");
    }
    // If status hasn't changed, do nothing
  }, 5000); // Check every 5 seconds
  
  // Store the monitor interval for this door
  doorMonitors.set(doorUuid, monitorInterval);
}

// Function to stop door monitor
function stopDoorMonitor(doorUuid: string) {
  if (doorMonitors.has(doorUuid)) {
    clearInterval(doorMonitors.get(doorUuid)!);
    doorMonitors.delete(doorUuid);
  }
  doorStates.delete(doorUuid);
}

// Function to check if VLC is running (for audio)
async function checkVLCRunningForAudio(): Promise<boolean> {
  const { exec } = await import("child_process");
  
  return new Promise((resolve) => {
    // Try multiple VLC detection methods
    exec("pgrep -f 'VLC'", (error1) => {
      if (!error1) {
        resolve(true);
        return;
      }
      
      // Try alternative method
      exec("ps aux | grep -i vlc | grep -v grep", (error2) => {
        const isRunning = !error2;
        resolve(isRunning);
      });
    });
  });
}

// Audio gateway monitoring
async function checkAudioWebSocketRunning(apiKey: string, gatewayUuid: string): Promise<boolean> {
  try {
    // Since we're now using direct API calls instead of WebSockets,
    // we'll check if there's an active audio playback session
    // For now, we'll assume audio is playing if the script is running
    const { exec } = await import("child_process");
    return new Promise((resolve) => {
      exec(`pgrep -f "play_audio.sh.*${gatewayUuid}"`, (error) => {
        // pgrep returns error code 1 when no processes are found
        resolve(!error);
      });
    });
  } catch (error) {
    return false;
  }
}

// Function to start audio monitor
function startAudioMonitor(action: any, apiKey: string, gatewayUuid: string) {
  // Stop existing monitor for this gateway if running
  if (audioMonitors.has(gatewayUuid)) {
    clearInterval(audioMonitors.get(gatewayUuid)!);
  }
  
  // Initialize audio state to OFF
  audioStates.set(gatewayUuid, false);
  action.setState(0);
  action.setTitle("Audio Off");
  
  // Wait 3 seconds for WebSocket to connect, then check
  setTimeout(async () => {
    const isWebSocketRunning = await checkAudioWebSocketRunning(apiKey, gatewayUuid);
    
    if (isWebSocketRunning) {
      // WebSocket connected successfully - turn green
      audioStates.set(gatewayUuid, true);
      await action.setState(1);
      await action.setTitle("Audio On");
      
      // Start monitoring for WebSocket closure - only turn red when WebSocket actually closes
      const monitorInterval = setInterval(async () => {
        const isStillRunning = await checkAudioWebSocketRunning(apiKey, gatewayUuid);
        
        // Only turn red if WebSocket is definitely not running
        if (!isStillRunning && audioStates.get(gatewayUuid)) {
          audioStates.set(gatewayUuid, false);
          await action.setState(0);
          await action.setTitle("Audio Off");
        }
        // If WebSocket is running, do nothing - keep it green
      }, 3000); // Check every 3 seconds
      
      // Store the monitor interval for this gateway
      audioMonitors.set(gatewayUuid, monitorInterval);
    } else {
      // WebSocket didn't connect - stay red
      audioStates.set(gatewayUuid, false);
      await action.setState(0);
      await action.setTitle("Audio Off");
    }
  }, 3000); // Wait 3 seconds before checking
}

// Function to stop audio monitor
function stopAudioMonitor(gatewayUuid: string) {
  if (audioMonitors.has(gatewayUuid)) {
    clearInterval(audioMonitors.get(gatewayUuid)!);
    audioMonitors.delete(gatewayUuid);
  }
  audioStates.delete(gatewayUuid);
}



// Connect to Stream Deck
streamDeck.connect();



// Handle action appearance (when action becomes visible)
streamDeck.actions.onWillAppear(async (event: any) => {
  if (event.action.manifestId === "com.muizz.rhombus-camera.action") {
    // Get settings to determine initial state
    let streamDeckSettings = await event.action.getSettings() as any;
    let settings: CameraSettings = {};
    if (streamDeckSettings && streamDeckSettings.settings) {
      settings = streamDeckSettings.settings;
    }
    
    if (settings.cameraUuid) {
      // Set initial state based on stored state for this camera
      const isStreaming = cameraStates.get(settings.cameraUuid) || false;
      await event.action.setState(isStreaming ? 1 : 0);
      await event.action.setTitle(isStreaming ? "Camera On" : "Camera Off");
    } else {
      // Default to OFF if no settings
      await event.action.setState(0);
      await event.action.setTitle("Camera Off");
    }
  }
  
  else if (event.action.manifestId === "com.muizz.rhombus-door.action") {
    // Get settings for door monitoring
    let streamDeckSettings = await event.action.getSettings() as any;
    let settings: DoorSettings = {};
    if (streamDeckSettings && streamDeckSettings.settings) {
      settings = streamDeckSettings.settings;
    }
    
    if (settings.apiKey && settings.doorUuid) {
      // Start monitoring door status
      startDoorMonitor(event.action, settings.apiKey, settings.doorUuid);
    } else {
      // Set default locked state
      await event.action.setState(0);
      await event.action.setTitle("Locked");
    }
  }
  
  else if (event.action.manifestId === "com.muizz.rhombus-camera.audio") {
    // Get settings for audio gateway
    let streamDeckSettings = await event.action.getSettings() as any;
    let settings: AudioGatewaySettings = {};
    if (streamDeckSettings && streamDeckSettings.settings) {
      settings = streamDeckSettings.settings;
    }
    
    if (settings.apiKey && settings.gatewayUuid) {
      // Set initial state based on stored state for this gateway
      const isPlaying = audioStates.get(settings.gatewayUuid) || false;
      await event.action.setState(isPlaying ? 1 : 0);
      await event.action.setTitle(isPlaying ? "Audio On" : "Audio Off");
    } else {
      // Set default audio off state
      await event.action.setState(0);
      await event.action.setTitle("Audio Off");
    }
  }
});

// Handle action disappearance
streamDeck.actions.onWillDisappear(async (event: any) => {
  if (event.action.manifestId === "com.muizz.rhombus-camera.action") {
    // Camera action disappeared - no monitoring needed
  }
  
  else if (event.action.manifestId === "com.muizz.rhombus-door.action") {
    // Get door UUID from settings to stop the correct monitor
    let streamDeckSettings = await event.action.getSettings() as any;
    let settings: DoorSettings = {};
    if (streamDeckSettings && streamDeckSettings.settings) {
      settings = streamDeckSettings.settings;
    }
    
    if (settings.doorUuid) {
      stopDoorMonitor(settings.doorUuid);
    }
  }
  
  else if (event.action.manifestId === "com.muizz.rhombus-camera.audio") {
    // Get gateway UUID from settings to stop the correct monitor
    let streamDeckSettings = await event.action.getSettings() as any;
    let settings: AudioGatewaySettings = {};
    if (streamDeckSettings && streamDeckSettings.settings) {
      settings = streamDeckSettings.settings;
    }
    
    if (settings.gatewayUuid) {
      stopAudioMonitor(settings.gatewayUuid);
    }
  }
});

// Listen for key down events on the specific action
streamDeck.actions.onKeyDown(async (event: any) => {
  // Check if this is our camera action
  if (event.action.manifestId === "com.muizz.rhombus-camera.action") {
    // Get settings from Stream Deck
    let streamDeckSettings = await event.action.getSettings() as any;
    
    // Extract settings from the nested format
    let settings: CameraSettings = {};
    if (streamDeckSettings && streamDeckSettings.settings) {
      settings = streamDeckSettings.settings;
    }
    
    // Check if we have the required settings
    if (!settings.apiKey || !settings.cameraUuid) {
      streamDeck.logger.error("Missing API key or camera UUID in settings");
      return;
    }
    
    // Always execute the script - it handles toggling internally
    try {
      // Execute the script with API key and camera UUID as parameters
      const scriptPath = path.join(process.cwd(), "ui/play_cam.sh");
      const { exec } = await import("child_process");
      
      // Pass both API key and camera UUID to the script
      const command = `${scriptPath} "${settings.apiKey}" "${settings.cameraUuid}"`;
      
      // Execute the script and handle the response
      exec(command, (error, stdout, stderr) => {
        if (error) {
          streamDeck.logger.error(`Script error: ${error.message}`);
          return;
        }
        
        if (stdout) {
          // Check the stream status from the script output
          if (stdout.includes("STREAM_STATUS: STARTING")) {
            // Stream is starting - update state to ON
            if (settings.cameraUuid) {
              cameraStates.set(settings.cameraUuid, true);
            }
            event.action.setState(1);
            event.action.setTitle("Camera On");
            streamDeck.logger.info("Camera stream started - setting state to ON");
          } else if (stdout.includes("STREAM_STATUS: STOPPING")) {
            // Stream is stopping - update state to OFF
            if (settings.cameraUuid) {
              cameraStates.set(settings.cameraUuid, false);
            }
            event.action.setState(0);
            event.action.setTitle("Camera Off");
            streamDeck.logger.info("Camera stream stopped - setting state to OFF");
          } else if (stdout.includes("Full stream URL:")) {
            // Log the stream URL
            streamDeck.logger.info(`Camera Stream URL: ${stdout}`);
          }
        }
        
        if (stderr) {
          streamDeck.logger.warn(`Script stderr: ${stderr}`);
        }
      });
      
    } catch (error) {
      streamDeck.logger.error(`Error executing script: ${error}`);
    }
  }
  
  // Check if this is our door action
  else if (event.action.manifestId === "com.muizz.rhombus-door.action") {
    // Get settings from Stream Deck
    let streamDeckSettings = await event.action.getSettings() as any;
    
    // Extract settings from the nested format
    let settings: DoorSettings = {};
    if (streamDeckSettings && streamDeckSettings.settings) {
      settings = streamDeckSettings.settings;
    }
    
    // Check if we have the required settings
    if (!settings.apiKey || !settings.doorUuid) {
      streamDeck.logger.error("Missing API key or door UUID in settings");
      return;
    }
    
    try {
      // Execute the door unlock script
      const { exec } = await import("child_process");
      const scriptPath = path.join(process.cwd(), "ui/unlock_door.sh");
      
      // Pass both API key and door UUID to the script
      const command = `${scriptPath} "${settings.apiKey}" "${settings.doorUuid}"`;
      
      exec(command, (error, stdout, stderr) => {
        if (error) {
          streamDeck.logger.error(`Door script error: ${error.message}`);
        }
        if (stderr) {
          streamDeck.logger.warn(`Door script stderr: ${stderr}`);
        }
      });
      
      // Start monitoring door status for reactive updates
      if (settings.apiKey && settings.doorUuid) {
        startDoorMonitor(event.action, settings.apiKey, settings.doorUuid);
      }
      
    } catch (error) {
      streamDeck.logger.error(`Error executing door script: ${error}`);
    }
  }
  
  // Check if this is our audio gateway action
  else if (event.action.manifestId === "com.muizz.rhombus-camera.audio") {
    // Get settings from Stream Deck
    let streamDeckSettings = await event.action.getSettings() as any;
    
    // Extract settings from the nested format
    let settings: AudioGatewaySettings = {};
    if (streamDeckSettings && streamDeckSettings.settings) {
      settings = streamDeckSettings.settings;
    }
    
    // Check if we have the required settings
    if (!settings.apiKey || !settings.gatewayUuid) {
      streamDeck.logger.error("Missing API key or gateway UUID in settings");
      return;
    }
    
    // Check if audio is already playing for this gateway
    const isPlaying = audioStates.get(settings.gatewayUuid) || false;
    if (isPlaying) {
      // Audio is playing, stop it
      
      // Kill any existing audio WebSocket processes
      const { exec } = await import("child_process");
      
      exec(`pkill -f "play_audio.sh.*${settings.gatewayUuid}"`, (error) => {
        // pkill returns error code 1 when no processes are found, which is normal
        if (error && error.code !== 1) {
          streamDeck.logger.warn(`Error killing audio script: ${error.message}`);
        }
      });
      
      // Also kill Python websocket processes to ensure they close
      exec(`pkill -f "websocket.*audio"`, (error) => {
        if (error && error.code !== 1) {
          streamDeck.logger.warn(`Error killing Python websocket: ${error.message}`);
        }
      });
      
      // Update state to off
      audioStates.set(settings.gatewayUuid, false);
      await event.action.setState(0); // State 0 = Audio Off
      await event.action.setTitle("Audio Off");
    } else {
      // Audio is not playing, start it
      
      try {
        // Execute the audio script with API key, gateway UUID, and optional audio clip UUID
        const scriptPath = path.join(process.cwd(), "ui/play_audio.sh");
        const { exec } = await import("child_process");
        
        // Build command with parameters
        let command = `${scriptPath} "${settings.apiKey}" "${settings.gatewayUuid}"`;
        if (settings.audioClipUuid) {
          command += ` "${settings.audioClipUuid}"`;
        }
        
        streamDeck.logger.info(`Command: ${command}`);
        
        // Start monitoring WebSocket - this will check if WebSocket connects and update state accordingly
        startAudioMonitor(event.action, settings.apiKey, settings.gatewayUuid);
        
        streamDeck.logger.info("Audio playback starting... waiting for WebSocket to connect");
        
        // Start the script in the background - don't wait for completion
        exec(command, (error, stdout, stderr) => {
          // Only log errors, don't reset state since script runs continuously
          if (error) {
            streamDeck.logger.error(`Audio script error: ${error.message}`);
          }
          if (stderr) {
            streamDeck.logger.warn(`Audio script stderr: ${stderr}`);
          }
          if (stdout) {
            streamDeck.logger.info(`Audio script output: ${stdout}`);
          }
        });
        
      } catch (error) {
        streamDeck.logger.error(`Error executing audio script: ${error}`);
        // Reset state on error
        audioStates.set(settings.gatewayUuid, false);
        await event.action.setState(0);
        await event.action.setTitle("Audio Off");
      }
    }
  }
  
  else {
    streamDeck.logger.info(`Not our action, manifestId: ${event.action.manifestId}`);
  }
});


