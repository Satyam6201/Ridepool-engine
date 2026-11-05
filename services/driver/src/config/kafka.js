import { createKafkaClient, logger } from "shared";
import { env } from "./env.js";

export const TOPIC_LOCATIONS = "driver-locations";
export const GROUP_ID = "driver-location-consumer";

export const kafka = createKafkaClient({
  clientId: "driver-service",
  brokers: env.KAFKA_BROKERS
});

let consumer = null;

export async function initKafka() {
  await kafka.connectProducer();
}

export async function sendLocation(driverId, data) {
  await kafka.publish(TOPIC_LOCATIONS, data, driverId);
}

export async function startConsumer(onMessage) {
  consumer = await kafka.createConsumer(GROUP_ID, [TOPIC_LOCATIONS], onMessage);
  return consumer;
}

export async function closeKafka() {
  try {
    if (consumer) await consumer.disconnect();
    await kafka.disconnect();
  } catch (err) {
    logger.error("Error closing Kafka", { error: err.message });
  }
}
