import { createKafkaClient, logger } from "shared";
import { env } from "./env.js";

let kafkaClient = null;
let isConnected = false;

export async function initKafka() {
  if (env.NODE_ENV === "test") return;

  try {
    kafkaClient = createKafkaClient({
      clientId: "auth-service",
      brokers: env.KAFKA_BROKERS
    });
    await kafkaClient.connectProducer();
    isConnected = true;
  } catch (err) {
    logger.error("Failed to connect Kafka producer", { error: err.message });
  }
}

export async function publishEvent(topic, message) {
  if (!isConnected || !kafkaClient) {
    logger.warn("Kafka producer unavailable, skipping publish", { topic });
    return;
  }

  try {
    await kafkaClient.publish(topic, message);
  } catch (err) {
    logger.error("Failed to publish Kafka message", { topic, error: err.message });
  }
}

export async function disconnectKafka() {
  if (kafkaClient && isConnected) {
    await kafkaClient.disconnect();
    isConnected = false;
  }
}
