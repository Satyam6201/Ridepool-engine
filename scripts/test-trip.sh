#!/bin/bash
set -e

GATEWAY="http://localhost:8080"
RIDER_EMAIL="rider_$(date +%s)@ridepool.com"
DRIVER_EMAIL="driver_$(date +%s)@ridepool.com"
PASS="Test#2026Secure!"
IDEMPOTENCY_KEY="key_$(date +%s)_abc123"

echo "1. Registering Rider"
RIDER_RES=$(curl -s -X POST "$GATEWAY/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$RIDER_EMAIL\", \"password\": \"$PASS\", \"role\": \"rider\"}")
RIDER_TOKEN=$(echo "$RIDER_RES" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

echo "2. Registering Driver"
DRIVER_RES=$(curl -s -X POST "$GATEWAY/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$DRIVER_EMAIL\", \"password\": \"$PASS\", \"role\": \"driver\"}")
DRIVER_TOKEN=$(echo "$DRIVER_RES" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

echo "3. Creating Trip with Idempotency Key"
CREATE_RES=$(curl -s -X POST "$GATEWAY/api/trips" \
  -H "Authorization: Bearer $RIDER_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $IDEMPOTENCY_KEY" \
  -d '{
    "pickup": { "lat": 37.7749, "lng": -122.4194, "address": "Market St, SF" },
    "drop": { "lat": 37.7955, "lng": -122.3937, "address": "Ferry Building, SF" }
  }')
echo "Create response: $CREATE_RES"
TRIP_ID=$(echo "$CREATE_RES" | grep -o '"_id":"[^"]*' | head -1 | cut -d'"' -f4)

echo ""
echo "4. Testing Double-Tap Idempotency (same Idempotency-Key)"
DOUBLE_TAP_RES=$(curl -s -X POST "$GATEWAY/api/trips" \
  -H "Authorization: Bearer $RIDER_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $IDEMPOTENCY_KEY" \
  -d '{
    "pickup": { "lat": 37.7749, "lng": -122.4194, "address": "Market St, SF" },
    "drop": { "lat": 37.7955, "lng": -122.3937, "address": "Ferry Building, SF" }
  }')
echo "Double-tap response (isReplay should be true): $DOUBLE_TAP_RES"

echo ""
echo "5. Transition: requested -> matching"
curl -s -X PATCH "$GATEWAY/api/trips/$TRIP_ID/status" \
  -H "Authorization: Bearer $RIDER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "matching"}'

echo ""
echo "6. Transition: matching -> matched (Driver assigned)"
curl -s -X PATCH "$GATEWAY/api/trips/$TRIP_ID/status" \
  -H "Authorization: Bearer $DRIVER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "matched"}'

echo ""
echo "7. Transition: matched -> driver_arrived"
curl -s -X PATCH "$GATEWAY/api/trips/$TRIP_ID/status" \
  -H "Authorization: Bearer $DRIVER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "driver_arrived"}'

echo ""
echo "8. Transition: driver_arrived -> started"
curl -s -X PATCH "$GATEWAY/api/trips/$TRIP_ID/status" \
  -H "Authorization: Bearer $DRIVER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "started"}'

echo ""
echo "9. Transition: started -> completed"
curl -s -X PATCH "$GATEWAY/api/trips/$TRIP_ID/status" \
  -H "Authorization: Bearer $DRIVER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "completed"}'

echo ""
echo "10. Invalid Transition Test (completed -> started: should return 400 Bad Request)"
curl -s -w "\nHTTP Status: %{http_code}\n" -X PATCH "$GATEWAY/api/trips/$TRIP_ID/status" \
  -H "Authorization: Bearer $DRIVER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "started"}'

echo ""
echo "11. Fetching Paginated Trip History"
curl -s -X GET "$GATEWAY/api/trips/history?page=1&limit=5" \
  -H "Authorization: Bearer $RIDER_TOKEN"
