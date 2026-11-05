# Matching Service

## Architecture & Dispatch Flow

1. **Kafka Event Ingestion**:
   - Subscribes to `trip.requested` in consumer group `matching-service-group` (scalable across replicas).
   - Offsets are committed manually only after a trip request is successfully matched or resolved.

2. **Idempotency Gate**:
   - On message arrival, acquires an atomic Redis key (`SET match:idempotent:<tripId> 1 NX EX 86400`).
   - If the key already exists, the event is recognized as a duplicate replay and ignored.

3. **Geospatial Candidate Search**:
   - Queries Redis GEO (`GEORADIUS drivers:available`) within a 2 km radius.
   - If no available drivers are found within 2 km, the search radius automatically expands to 5 km.

4. **Candidate Ranking**:
   - Candidates are sorted primarily by proximity (distance in km).
   - If distances are comparable, candidates are ranked secondarily by driver rating (`driver:rating:<id>`).

5. **Distributed Driver Locking**:
   - Before offering a trip, takes an exclusive lock on the driver (`SET lock:driver:<id> <tripId:token> NX PX 12000`).
   - Prevents race conditions where two simultaneous trips are dispatched to the same driver.
   - Lock is safely released using a Lua script that checks ownership (`if get(key) == token then del(key)`).

6. **Sequential Offer Cycle**:
   - Offers trip to one candidate at a time with a 10-second timeout.
   - If the driver accepts, status updates to `matched` and publishes `trip.matched`.
   - If the driver rejects or times out, the lock is released and the engine moves to the next candidate.
   - If all candidates are exhausted without acceptance, publishes `trip.no_driver_found`.

7. **Resilience & Dead-Letter Queue (DLQ)**:
   - Transient failures are forwarded to `trip.requested.retry` with an incremented `x-retry-count`.
   - After 3 failed attempts, messages are sent to `trip.requested.dlq`.
