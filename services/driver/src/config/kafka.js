import { createKafkaClient, logger } from "shared";
import { env } from "./env.js";

export const TOPIC_DRIVER_LOCATIONS = "driver-locations";
export const CONSUMER_GROUP_DRIVER = "driver-location-consumer";

export const kafkaClient = createKafkaClient({
  clientId: "driver-service",
  brokers: env.KAFKA_BROKERS
});

let consumerInstance = null;

export async function initKafka() {
  await kafkaClient.connectProducer();
}

export async function publishDriverLocation(driverId, locationData) {
  // Partitioned by driverId so all location pings for the same driver stay strictly in-order
  await kafkaClient.publish(TOPIC_DRIVER_LOCATIONS, locationData, driverId);
}

export async function subscribeToDriverLocations(onMessage) {
  consumerInstance = await kafkaClient.createConsumer(
    CONSUMER_GROUP_DRIVER,
    [TOPIC_DRIVER_LOCATIONS],
    onMessage
  );
  return consumerInstance;
}

export async function disconnectKafka() {
  try {
    if (consumerInstance) {
      await consumerInstance.disconnect();
    }
    await kafkaClient.disconnect();
    logger.info("Kafka connections closed successfully");
  } catch (err) {
    logger.error("Error disconnecting Kafka", { error: err.message });
  }
}
