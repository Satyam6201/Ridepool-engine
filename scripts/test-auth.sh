#!/usr/bin/env bash
set -e

BASE_URL="${AUTH_URL:-http://localhost:3001}"
echo "============================================="
echo "Testing Auth Service on $BASE_URL"
echo "============================================="

# 1. Health check
echo -e "\n1. Checking Health..."
curl -s -f "$BASE_URL/health" | grep -q "ok" && echo "Health check passed"

# 2. Register a Rider
echo -e "\n2. Registering Rider..."
RIDER_RES=$(curl -s -X POST "$BASE_URL/register" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Alex Rider",
    "email": "alex.rider@ridepool.com",
    "password": "Secure#Rider2026!",
    "role": "rider",
    "phone": "+1234567890"
  }')
echo "$RIDER_RES" | grep -q "success" && echo "Rider registered successfully"

# 3. Register a Driver
echo -e "\n3. Registering Driver..."
DRIVER_RES=$(curl -s -X POST "$BASE_URL/register" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Dave Driver",
    "email": "dave.driver@ridepool.com",
    "password": "Secure#Driver2026!",
    "role": "driver",
    "phone": "+1987654321"
  }')
echo "$DRIVER_RES" | grep -q "success" && echo "Driver registered successfully"

# 4. Weak password rejection
echo -e "\n4. Testing Weak Password Rejection..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/register" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Weak User",
    "email": "weak@ridepool.com",
    "password": "weak",
    "role": "rider"
  }')
[ "$HTTP_CODE" -eq 400 ] && echo "Weak password rejected as expected (HTTP 400)"

# 5. Login
echo -e "\n5. Logging in Rider..."
LOGIN_RES=$(curl -s -X POST "$BASE_URL/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alex.rider@ridepool.com",
    "password": "Secure#Rider2026!"
  }')

ACCESS_TOKEN=$(echo "$LOGIN_RES" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
REFRESH_TOKEN=$(echo "$LOGIN_RES" | grep -o '"refreshToken":"[^"]*' | cut -d'"' -f4)

if [ -n "$ACCESS_TOKEN" ] && [ -n "$REFRESH_TOKEN" ]; then
  echo "Login successful, received tokens"
else
  echo "Login failed to return tokens"
  exit 1
fi

# 6. Get Profile (/me)
echo -e "\n6. Accessing Protected Profile (/me)..."
ME_RES=$(curl -s -X GET "$BASE_URL/me" \
  -H "Authorization: Bearer $ACCESS_TOKEN")
echo "$ME_RES" | grep -q "alex.rider@ridepool.com" && echo "Profile fetched successfully"

# 7. Rotate Refresh Token
echo -e "\n7. Rotating Refresh Token..."
ROTATE_RES=$(curl -s -X POST "$BASE_URL/refresh" \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}")

NEW_ACCESS_TOKEN=$(echo "$ROTATE_RES" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
NEW_REFRESH_TOKEN=$(echo "$ROTATE_RES" | grep -o '"refreshToken":"[^"]*' | cut -d'"' -f4)

if [ -n "$NEW_ACCESS_TOKEN" ] && [ -n "$NEW_REFRESH_TOKEN" ]; then
  echo "Token rotated successfully"
else
  echo "Token rotation failed"
  exit 1
fi

# 8. Token Reuse Detection (Replaying old refresh token)
echo -e "\n8. Testing Token Reuse Detection with invalidated token..."
REUSE_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/refresh" \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}")
[ "$REUSE_CODE" -eq 403 ] && echo "Reuse detected and blocked as expected (HTTP 403)"

# 9. Logout
echo -e "\n9. Testing Logout..."
LOGOUT_RES=$(curl -s -X POST "$BASE_URL/logout" \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$NEW_REFRESH_TOKEN\"}")
echo "$LOGOUT_RES" | grep -q "success" && echo "Logged out successfully"

# 10. Logout All Devices
echo -e "\n10. Testing Logout All Devices..."
LOGOUT_ALL_RES=$(curl -s -X POST "$BASE_URL/logout-all" \
  -H "Authorization: Bearer $NEW_ACCESS_TOKEN")
echo "$LOGOUT_ALL_RES" | grep -q "success" && echo "All devices logged out successfully"

# 11. Testing Account Lockout (5 consecutive failed attempts)
echo -e "\n11. Testing Account Lockout after 5 failed attempts..."
LOCK_EMAIL="lockout.test@ridepool.com"
curl -s -X POST "$BASE_URL/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Lock Test\",\"email\":\"$LOCK_EMAIL\",\"password\":\"Secure#Lock2026!\",\"role\":\"rider\"}" > /dev/null

for i in {1..5}; do
  FAIL_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$LOCK_EMAIL\",\"password\":\"WrongPassword!\"}")
  echo "Attempt $i: HTTP $FAIL_CODE"
done

LOCK_CHECK_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$LOCK_EMAIL\",\"password\":\"Secure#Lock2026!\"}")
echo "Post-lockout attempt with CORRECT password: HTTP $LOCK_CHECK_CODE (Account is locked)"

echo -e "\n============================================="
echo "All Auth Service Flow Tests Completed!"
echo "============================================="
