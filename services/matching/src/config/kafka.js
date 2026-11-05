import { Kafka, logLevel } from "kafkajs";
import { logger } from "shared";
import { env } from "./env.js";

export const TOPIC_REQUESTED = "trip.requested";
export const TOPIC_RETRY = "trip.requested.retry";
export const TOPIC_DLQ = "trip.requested.dlq";
export const TOPIC_MATCHED = "trip.matched";
export const TOPIC_NO_DRIVER = "trip.no_driver_found";
export const CONSUMER_GROUP = "matching-service-group";

let kafka = null;
let producer = null;
let consumer = null;

export function getKafka() {
  if (!kafka) {
    const brokers = env.KAFKA_BROKERS.split(",");
    kafka = new Kafka({
      clientId: "matching-service",
      brokers,
      logLevel: logLevel.NOTHING,
      connectionTimeout: 2000,
      retry: {
        initialRetryTime: 100,
        retries: 2
      }
    });
  }
  return kafka;
}

export async function initKafka() {
  producer = getKafka().producer();
  await producer.connect();
}

export async function publishEvent(topic, data, key = null) {
  if (!producer) return;
  const msg = { value: JSON.stringify(data) };
  if (key) msg.key = String(key);
  await producer.send({
    topic,
    messages: [msg]
  });
}

export async function startMatchingConsumer(handleMessage) {
  consumer = getKafka().consumer({
    groupId: CONSUMER_GROUP,
    enableAutoCommit: false
  });

  await consumer.connect();
  await consumer.subscribe({ topics: [TOPIC_REQUESTED, TOPIC_RETRY], fromBeginning: false });

  await consumer.run({
    autoCommit: false,
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const raw = message.value?.toString();
        const data = raw ? JSON.parse(raw) : null;
        const retryCount = Number(message.headers?.["x-retry-count"]?.toString() || 0);

        await handleMessage({ data, retryCount });

        await consumer.commitOffsets([
          {
            topic,
            partition,
            offset: (Number(message.offset) + 1).toString()
          }
        ]);
      } catch (err) {
        logger.error("Error processing message, routing to retry/dlq", {
          topic,
          offset: message.offset,
          error: err.message
        });

        const retryCount = Number(message.headers?.["x-retry-count"]?.toString() || 0);

        if (retryCount < 3) {
          await producer.send({
            topic: TOPIC_RETRY,
            messages: [
              {
                key: message.key,
                value: message.value,
                headers: { "x-retry-count": String(retryCount + 1) }
              }
            ]
          });
        } else {
          await producer.send({
            topic: TOPIC_DLQ,
            messages: [
              {
                key: message.key,
                value: message.value,
                headers: { "x-retry-count": String(retryCount), "x-error": err.message }
              }
            ]
          });
        }

        await consumer.commitOffsets([
          {
            topic,
            partition,
            offset: (Number(message.offset) + 1).toString()
          }
        ]);
      }
    }
  });

  return consumer;
}

export async function closeKafka() {
  try {
    if (consumer) await consumer.disconnect();
    if (producer) await producer.disconnect();
  } catch (err) {
    logger.error("Error closing Kafka", { error: err.message });
  }
}
