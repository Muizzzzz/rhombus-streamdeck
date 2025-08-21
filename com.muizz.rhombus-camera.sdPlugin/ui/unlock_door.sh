#!/usr/bin/env bash

# Check if parameters are provided
if [ $# -ne 2 ]; then
    echo "Usage: $0 <api_key> <door_uuid>"
    exit 1
fi

API_KEY="$1"
DOOR_UUID="$2"

# Validate parameters
if [ -z "$API_KEY" ] || [ -z "$DOOR_UUID" ]; then
    echo "Error: API key and door UUID are required"
    exit 1
fi

echo "Unlocking door for UUID: $DOOR_UUID"

# Call Rhombus's unlock API—note the JSON field is accessControlledDoorUuid
curl -s -X POST "https://api.rhombussystems.com/api/accesscontrol/unlockAccessControlledDoor" \
  -H "x-auth-scheme: api-token" \
  -H "x-auth-apikey: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"accessControlledDoorUuid\":\"${DOOR_UUID}\"}" \
  -w "\nHTTP Status: %{http_code}\n"

if [ $? -eq 0 ]; then
    echo "Door unlock command executed successfully"
else
    echo "Error: Failed to unlock door"
    exit 1
fi
