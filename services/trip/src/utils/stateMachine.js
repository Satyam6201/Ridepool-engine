import { BadRequestError } from "shared";

export const TRIP_STATES = [
  "requested",
  "matching",
  "matched",
  "driver_arrived",
  "started",
  "completed",
  "cancelled"
];

const ALLOWED_TRANSITIONS = {
  requested: ["matching", "cancelled"],
  matching: ["matched", "cancelled"],
  matched: ["driver_arrived", "cancelled"],
  driver_arrived: ["started", "cancelled"],
  started: ["completed", "cancelled"],
  completed: [],
  cancelled: []
};

export function canTransition(from, to) {
  const allowed = ALLOWED_TRANSITIONS[from] || [];
  return allowed.includes(to);
}

export function validateTransition(from, to) {
  if (!canTransition(from, to)) {
    throw new BadRequestError(`Invalid trip state transition from '${from}' to '${to}'`);
  }
  return true;
}
