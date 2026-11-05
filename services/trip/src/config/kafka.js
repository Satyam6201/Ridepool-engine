import { createKafkaClient, logger } from "shared";
import { env } from "./env.js";

let client = null;

export function getKafka() {
  if (!client) {
    client = createKafkaClient({
      clientId: "trip-service",
      brokers: env.KAFKA_BROKERS
    });
  }
  return client;
}

export async function initKafka() {
  await getKafka().connectProducer();
}

export async function publishTripEvent(event, data, tripId) {
  try {
    await getKafka().publish(event, data, tripId);
  } catch (err) {
    logger.error("Failed to publish trip event", { event, tripId, error: err.message });
  }
}

export async function closeKafka() {
  try {
    if (client) await client.disconnect();
  } catch (err) {
    logger.error("Error closing Kafka", { error: err.message });
  }
}
