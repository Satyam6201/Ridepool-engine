// Earth radius in meters
const EARTH_RADIUS_METERS = 6371e3;

// Maximum realistic vehicle speed: 50 meters/sec (~180 km/h)
export const MAX_SPEED_MPS = 50;

/**
 * Calculates distance between two coordinates in meters using the Haversine formula.
 */
export function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) *
    Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Validates speed between two pings.
 * Throws an error if speed exceeds maximum realistic threshold.
 */
export function checkSpeedJump(prevPing, currentPing, maxSpeedMps = MAX_SPEED_MPS) {
  if (!prevPing) {
    return { valid: true, speedMps: 0 };
  }

  const prevTime = new Date(prevPing.timestamp).getTime();
  const currTime = new Date(currentPing.timestamp).getTime();
  const timeDiffSeconds = (currTime - prevTime) / 1000;

  if (timeDiffSeconds <= 0) {
    return {
      valid: false,
      reason: "Invalid timestamp: current ping must be newer than previous ping"
    };
  }

  // If previous ping was more than 10 minutes ago, vehicle could be anywhere
  if (timeDiffSeconds > 600) {
    return { valid: true, speedMps: 0 };
  }

  const distanceMeters = calculateDistanceMeters(
    prevPing.lat,
    prevPing.lng,
    currentPing.lat,
    currentPing.lng
  );

  const speedMps = distanceMeters / timeDiffSeconds;

  if (speedMps > maxSpeedMps) {
    const speedKmh = Math.round(speedMps * 3.6);
    return {
      valid: false,
      reason: `Impossible speed jump detected: ${speedKmh} km/h exceeds maximum threshold (${Math.round(maxSpeedMps * 3.6)} km/h)`,
      speedMps,
      speedKmh
    };
  }

  return { valid: true, speedMps };
}
