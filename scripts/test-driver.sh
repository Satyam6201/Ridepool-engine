#!/bin/bash
set -e

GATEWAY_URL="http://localhost:8080"
DRIVER_EMAIL="testdriver_$(date +%s)@ridepool.com"
DRIVER_PASS="Driver#2026Secure!"

echo "=========================================================="
echo "1. Registering new driver via Auth Service"
echo "=========================================================="
REGISTER_RES=$(curl -s -X POST "$GATEWAY_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$DRIVER_EMAIL\",
    \"password\": \"$DRIVER_PASS\",
    \"role\": \"driver\"
  }")
echo "Response: $REGISTER_RES"

ACCESS_TOKEN=$(echo "$REGISTER_RES" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

if [ -z "$ACCESS_TOKEN" ]; then
  echo "Login fallback..."
  LOGIN_RES=$(curl -s -X POST "$GATEWAY_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{
      \"email\": \"$DRIVER_EMAIL\",
      \"password\": \"$DRIVER_PASS\"
    }")
  ACCESS_TOKEN=$(echo "$LOGIN_RES" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
fi

echo "Access Token acquired: ${ACCESS_TOKEN:0:15}..."

echo ""
echo "=========================================================="
echo "2. Setting up Driver Profile & Vehicle Details"
echo "=========================================================="
PROFILE_RES=$(curl -s -X PUT "$GATEWAY_URL/api/drivers/profile" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Alex Driver",
    "phone": "+14155552671",
    "licenseNumber": "DL-CA-987654",
    "vehicle": {
      "make": "Toyota",
      "model": "Prius",
      "year": 2023,
      "color": "Silver",
      "plate": "7XYZ999",
      "capacity": 4
    }
  }')
echo "Profile response: $PROFILE_RES"

echo ""
echo "=========================================================="
echo "3. Changing Driver Status to AVAILABLE"
echo "=========================================================="
STATUS_RES=$(curl -s -X PATCH "$GATEWAY_URL/api/drivers/status" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "available"}')
echo "Status response: $STATUS_RES"

echo ""
echo "=========================================================="
echo "4. Ingesting Valid GPS Location Ping (returns 202 Accepted)"
echo "=========================================================="
LOCATION_RES=$(curl -s -w "\nHTTP Status: %{http_code}\n" -X POST "$GATEWAY_URL/api/drivers/location" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"lat\": 37.7749,
    \"lng\": -122.4194,
    \"heading\": 90,
    \"speed\": 35,
    \"timestamp\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\"
  }")
echo "$LOCATION_RES"

echo ""
echo "=========================================================="
echo "5. Testing Speed Jump Rejection (should return 400 Bad Request)"
echo "=========================================================="
JUMP_RES=$(curl -s -w "\nHTTP Status: %{http_code}\n" -X POST "$GATEWAY_URL/api/drivers/location" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"lat\": 38.5816,
    \"lng\": -121.4944,
    \"heading\": 90,
    \"speed\": 35,
    \"timestamp\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\"
  }")
echo "$JUMP_RES"

echo ""
echo "=========================================================="
echo "6. Finding Nearby Available Drivers (Spatial GEO Search)"
echo "=========================================================="
NEARBY_RES=$(curl -s -X GET "$GATEWAY_URL/api/drivers/nearby?lng=-122.4194&lat=37.7749&radiusKm=10" \
  -H "Authorization: Bearer $ACCESS_TOKEN")
echo "Nearby drivers response: $NEARBY_RES"

echo ""
echo "Driver service end-to-end flow completed successfully."
