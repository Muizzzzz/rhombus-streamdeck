# Rhombus StreamDeck Plugin

A comprehensive StreamDeck plugin for controlling Rhombus security systems, including camera streams, door locks, and audio gateways.

## Features

### 🎥 Camera Control
- **Stream Toggle**: Start/stop live camera streams using MPV player via Streamlink
- **Real-time Status**: Visual indicators showing stream on/off state
- **HLS Support**: Optimized for Rhombus HLS streams with proper authentication

### 🚪 Door Lock Control
- **Remote Unlock**: Unlock Rhombus access-controlled doors with a single button press
- **Live Status Monitoring**: Real-time lock/unlock status with automatic updates every 5 seconds
- **Visual Feedback**: Red (locked) and green (unlocked) state indicators

### 🔊 Audio Gateway Control
- **Audio Playback**: Play audio clips through Rhombus audio gateways
- **WebSocket Monitoring**: Real-time connection status tracking
- **Toggle Control**: Start/stop audio playback with visual feedback

## Prerequisites

### Software Requirements
- **StreamDeck Software**: Version 6.5 or higher
- **Node.js**: Version 20 (specified in manifest)
- **Operating System**: 
  - macOS 12+ 
  - Windows 10+
- **Media Players**:
  - **MPV**: Required for camera streaming: https://mpv.io/installation/
  - **Streamlink**: Python module for HLS stream handling
- **Python 3**: Required for API response parsing and Streamlink

### API Access
- Valid Rhombus API key with appropriate permissions for:
  - Camera media URI access
  - Door access control
  - Audio gateway control

## Installation

### 1. Clone and Build
```bash
git clone <repository-url>
cd rhombus-streamdeck
npm install
npm run build
```

### 2. Install Dependencies
```bash
# Install Streamlink
pip3 install streamlink

# Download and install MPV
# Update the path in ui/play_cam.sh to match your MPV installation
```

### 3. Install Plugin
- Copy the `com.muizz.rhombus-camera.sdPlugin` folder to your StreamDeck plugins directory
- Restart StreamDeck software
- The plugin will appear in the "Rhombus" category

## Configuration

### Camera Action Setup
1. Drag "Open Camera" action to a StreamDeck button
2. Configure in Property Inspector:
   - **API Key**: Your Rhombus API token
   - **Camera UUID**: UUID of the target camera

### Door Lock Action Setup
1. Drag "Door Lock" action to a StreamDeck button
2. Configure in Property Inspector:
   - **API Key**: Your Rhombus API token  
   - **Door UUID**: UUID of the access-controlled door

### Audio Gateway Action Setup
1. Drag "Open Audio Gateway" action to a StreamDeck button
2. Configure in Property Inspector:
   - **API Key**: Your Rhombus API token
   - **Gateway UUID**: UUID of the audio gateway
   - **Audio Clip UUID**: (Optional) Specific audio clip to play

## Usage

### Camera Streaming
- **Press once**: Start camera stream in MPV
- **Press again**: Stop active stream
- **Status**: Button shows "Camera On" (green) or "Camera Off" (red)

### Door Control
- **Press**: Send unlock command to door
- **Status**: Automatically monitors and displays lock status
  - Red = Locked
  - Green = Unlocked
- **Monitoring**: Updates every 5 seconds while button is visible

### Audio Control
- **Press once**: Start audio playback
- **Press again**: Stop audio playback
- **Status**: Shows "Audio On" (green) or "Audio Off" (red)
- **Monitoring**: Tracks WebSocket connection status

## Development

### Project Structure
```
├── src/
│   └── plugin.ts              # Main plugin logic
├── com.muizz.rhombus-camera.sdPlugin/
│   ├── manifest.json          # Plugin configuration
│   ├── ui/                    # Settings UI and scripts
│   │   ├── play_cam.sh        # Camera streaming script
│   │   ├── unlock_door.sh     # Door unlock script
│   │   ├── play_audio.sh      # Audio playback script
│   │   └── *.html             # Property inspector UIs
│   └── imgs/                  # Action icons and images
├── package.json               # Dependencies and metadata
└── rollup.config.mjs          # Build configuration
```

### Build Process
- **TypeScript**: Source code compiled from `src/plugin.ts`
- **Rollup**: Bundles code into `bin/plugin.js`
- **Target**: ES modules with Node.js compatibility

### Key Dependencies
- `@elgato/streamdeck`: StreamDeck SDK for Node.js
- Shell scripts for external API calls and media control

## API Integration

### Rhombus API Endpoints
- **Camera Streams**: `https://api2.rhombussystems.com/api/camera/getMediaUris`
- **Door Control**: `https://api.rhombussystems.com/api/accesscontrol/unlockAccessControlledDoor`
- **Audio Playback**: `https://api.rhombussystems.com/api/audioplayback/playAudioUpload`

### Authentication
All API calls use header-based authentication:
```
x-auth-scheme: api-token
x-auth-apikey: <your-api-key>
```

## Troubleshooting

### Common Issues

**Camera stream won't start:**
- Verify MPV path in `ui/play_cam.sh`
- Check Streamlink installation: `python3 -m streamlink --version`
- Ensure API key has camera access permissions

**Door status not updating:**
- Verify door UUID is correct
- Check API key permissions for access control
- Monitor logs in StreamDeck console

**Audio playback fails:**
- Ensure audio clip UUID is valid
- Check gateway UUID configuration
- Verify API key has audio gateway permissions

### Logs
- StreamDeck logs available in StreamDeck software console
- Audio playback logs: `/tmp/rhombus_audio_playback.log`
- Camera stream logs: Check terminal output when running scripts manually

## Contributing

### Development Setup
1. Install dependencies: `npm install`
2. Start development build: `npm run dev` (if available)
3. Make changes to `src/plugin.ts`
4. Test with StreamDeck software

### Code Style
- TypeScript with strict typing
- Async/await for API calls
- Proper error handling and logging
- State management per device UUID

## License

MIT License - See package.json for details

## Author

**Muizz Khan** - Original developer

---

**Version**: 0.1.0  
**StreamDeck SDK**: Version 2  
**Node.js**: Version 20
