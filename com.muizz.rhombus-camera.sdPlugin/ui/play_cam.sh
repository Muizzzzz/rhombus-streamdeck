#!/bin/bash

# Check if parameters are provided
if [ $# -ne 2 ]; then
    echo "Usage: $0 <api_key> <camera_uuid>"
    exit 1
fi

API_KEY="$1"
CAM_UUID="$2"

# Validate parameters
if [ -z "$API_KEY" ] || [ -z "$CAM_UUID" ]; then
    echo "Error: API key and camera UUID are required"
    exit 1
fi

# Check if MPV is already running for this camera
if pgrep -f "mpv.*$CAM_UUID" > /dev/null; then
    echo "STREAM_STATUS: STOPPING"
    echo "Closing camera stream for UUID: $CAM_UUID"
    
    # Kill MPV and streamlink processes for this camera
    pkill -f "mpv.*$CAM_UUID"
    pkill -f "streamlink.*$CAM_UUID"
    
    echo "Camera stream stopped"
    exit 0
fi

echo "STREAM_STATUS: STARTING"
echo "Opening camera stream for UUID: $CAM_UUID"

# 1) Fetch a fresh signed HLS URL
STREAM_URL=$(
  curl -s -X POST "https://api2.rhombussystems.com/api/camera/getMediaUris" \
    -H "x-auth-scheme: api-token" \
    -H "x-auth-apikey: $API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"cameraUuid\":\"$CAM_UUID\"}" \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["wanLiveM3u8Uri"])'
)

if [ $? -ne 0 ] || [ -z "$STREAM_URL" ]; then
    echo "Error: Failed to get stream URL"
    exit 1
fi

echo "Full stream URL: $STREAM_URL"
echo "Streaming via Streamlink: $STREAM_URL"

# 2) Hand it off to Streamlink → MPV (much better for HLS streams)
python3 -m streamlink \
  --http-header "x-auth-scheme=api-token" \
  --http-header "x-auth-apikey=$API_KEY" \
  --player "/Users/muizzkhan/Downloads/mpv.app/Contents/MacOS/mpv" \
  "$STREAM_URL" best

