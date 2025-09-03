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

echo "Checking door status for UUID: $DOOR_UUID"

# Get door status from Rhombus API using the findAccessControlledDoors endpoint
# This endpoint returns door information including lock status
curl -s -X POST "https://api2.rhombussystems.com/api/component/findAccessControlledDoors" \
  -H "x-auth-scheme: api-token" \
  -H "x-auth-apikey: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"accessControlledDoorUuid\":\"${DOOR_UUID}\"}" \
  -w "\nHTTP Status: %{http_code}\n"

if [ $? -eq 0 ]; then
    echo "Door status check completed"
else
    echo "Error: Failed to get door status"
    exit 1
fi 