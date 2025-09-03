#!/usr/bin/env bash

# Audio Gateway Control Script for Rhombus Systems - Direct API Version
# Usage: ./play_audio.sh <API_KEY> <GATEWAY_UUID> [AUDIO_CLIP_UUID]

# Check if parameters are provided
if [ $# -lt 2 ] || [ $# -gt 3 ]; then
    echo "Usage: $0 <api_key> <gateway_uuid> [audio_clip_uuid]"
    echo "  api_key: Your Rhombus API key"
    echo "  gateway_uuid: UUID of the audio gateway device"
    echo "  audio_clip_uuid: (Optional) UUID of the audio clip to play"
    exit 1
fi

API_KEY="$1"
GATEWAY_UUID="$2"
AUDIO_CLIP_UUID="$3"

# Validate parameters
if [ -z "$API_KEY" ] || [ -z "$GATEWAY_UUID" ]; then
    echo "Error: API key and gateway UUID are required"
    exit 1
fi

echo "Audio Gateway Control for UUID: $GATEWAY_UUID"

# Check if we have an audio clip UUID
if [ -n "$AUDIO_CLIP_UUID" ]; then
    echo "Playing audio clip: $AUDIO_CLIP_UUID"
    
    # Use the direct playAudioUpload endpoint
    echo "Calling /api/audioplayback/playAudioUpload for audio clip..."
    echo "Request payload: {\"audioGatewayUuids\":[\"$GATEWAY_UUID\"],\"audioUploadUuid\":\"$AUDIO_CLIP_UUID\",\"playCount\":1}"
    
    # Try the direct playAudioUpload endpoint
    echo "Trying api.rhombussystems.com (like doors use)..."
    API_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "https://api.rhombussystems.com/api/audioplayback/playAudioUpload" \
        -H "x-auth-scheme: api-token" \
        -H "x-auth-apikey: $API_KEY" \
        -H "Content-Type: application/json" \
        -d "{\"audioGatewayUuids\":[\"$GATEWAY_UUID\"],\"audioUploadUuid\":\"$AUDIO_CLIP_UUID\",\"playCount\":1}")
    
    # Extract HTTP status and response body
    HTTP_STATUS=$(echo "$API_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
    RESPONSE_BODY=$(echo "$API_RESPONSE" | grep -v "HTTP_STATUS:")
    
    echo "playAudioUpload HTTP Status: $HTTP_STATUS"
    echo "playAudioUpload Response: $RESPONSE_BODY"
    
    # If first fails, try api2.rhombussystems.com
    if [ "$HTTP_STATUS" != "200" ]; then
        echo "api.rhombussystems.com failed, trying api2.rhombussystems.com..."
        API_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "https://api2.rhombussystems.com/api/audioplayback/playAudioUpload" \
            -H "x-auth-scheme: api-token" \
            -H "x-auth-apikey: $API_KEY" \
            -H "Content-Type: application/json" \
            -d "{\"audioGatewayUuids\":[\"$GATEWAY_UUID\"],\"audioUploadUuid\":\"$AUDIO_CLIP_UUID\",\"playCount\":1}")
        
        HTTP_STATUS=$(echo "$API_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
        RESPONSE_BODY=$(echo "$API_RESPONSE" | grep -v "HTTP_STATUS:")
        
        echo "api2.rhombussystems.com playAudioUpload HTTP Status: $HTTP_STATUS"
        echo "api2.rhombussystems.com playAudioUpload Response: $RESPONSE_BODY"
    fi
    
    # Check what fields are available in the response
    echo "Available fields in response:"
    echo "$RESPONSE_BODY" | python3 -c '
import sys, json
try:
    data = json.load(sys.stdin)
    if isinstance(data, dict):
        for key, value in data.items():
            print(f"  {key}: {type(value).__name__}")
            if isinstance(value, list) and len(value) > 0:
                if isinstance(value[0], dict):
                    print(f"    First item keys: {list(value[0].keys())}")
                else:
                    print(f"    First item type: {type(value[0]).__name__}")
    else:
        print(f"Response is not a dict: {type(data).__name__}")
except Exception as e:
    print(f"Error parsing response: {e}")
'
    
    if [ "$HTTP_STATUS" = "200" ]; then
        echo "Successfully started audio clip playback!"
        echo "$(date): Audio Clip Started - Gateway: $GATEWAY_UUID, Clip: $AUDIO_CLIP_UUID" >> /tmp/rhombus_audio_playback.log
    else
        echo "Error: Failed to start audio clip playback"
        exit 1
    fi
    
else
    echo "No audio clip specified - this script requires an audio clip UUID for playback"
    echo "Use: $0 <api_key> <gateway_uuid> <audio_clip_uuid>"
    exit 1
fi

echo "Audio gateway operation completed"
