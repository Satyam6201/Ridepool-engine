import { calcDistanceKm } from "../utils/geo.js";

export function estimateFare(pickup, drop) {
  const distanceKm = calcDistanceKm(pickup.lat, pickup.lng, drop.lat, drop.lng);
  const durationMin = Math.max(5, distanceKm * 2.5); // ~2.5 min per km in city traffic

  const baseFare = 50;
  const distanceFare = distanceKm * 15;
  const timeFare = durationMin * 2;
  const total = Math.max(60, Math.round(baseFare + distanceFare + timeFare));

  return {
    amount: total,
    currency: "INR",
    distanceKm: parseFloat(distanceKm.toFixed(2)),
    durationMin: Math.round(durationMin)
  };
}
