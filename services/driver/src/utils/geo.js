const R = 6371e3;
export const MAX_SPEED = 50; // 50 m/s is 180 km/h

export function calcDistance(lat1, lon1, lat2, lon2) {
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function checkSpeed(prev, curr, maxSpeed = MAX_SPEED) {
  if (!prev) return { valid: true, speed: 0 };

  const prevTime = new Date(prev.timestamp).getTime();
  const currTime = new Date(curr.timestamp).getTime();
  const seconds = (currTime - prevTime) / 1000;

  if (seconds <= 0) {
    return { valid: false, reason: "Invalid timestamp: current ping must be newer than previous ping" };
  }

  if (seconds > 600) {
    return { valid: true, speed: 0 };
  }

  const meters = calcDistance(prev.lat, prev.lng, curr.lat, curr.lng);
  const speed = meters / seconds;

  if (speed > maxSpeed) {
    const kmh = Math.round(speed * 3.6);
    return {
      valid: false,
      reason: `Impossible speed jump detected: ${kmh} km/h exceeds maximum threshold (${Math.round(maxSpeed * 3.6)} km/h)`,
      speed,
      kmh
    };
  }

  return { valid: true, speed };
}
