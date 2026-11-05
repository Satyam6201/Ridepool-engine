import { redis } from "../config/redis.js";

const RELEASE_LOCK_LUA = `
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
else
    return 0
end
`;

export async function acquireDriverLock(driverId, lockValue, ttlMs = 12000, client = redis) {
  const key = `lock:driver:${driverId}`;
  const result = await client.set(key, lockValue, "PX", ttlMs, "NX");
  return result === "OK";
}

export async function releaseDriverLock(driverId, lockValue, client = redis) {
  const key = `lock:driver:${driverId}`;
  const result = await client.eval(RELEASE_LOCK_LUA, 1, key, lockValue);
  return result === 1;
}
