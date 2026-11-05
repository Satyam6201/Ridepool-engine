import { Kafka, logLevel } from "kafkajs";
import { logger } from "./logger.js";

export function createKafkaClient({ clientId, brokers }) {
  const brokerList = Array.isArray(brokers) ? brokers : brokers.split(",");

  const kafka = new Kafka({
    clientId,
    brokers: brokerList,
    logLevel: logLevel.NOTHING,
    connectionTimeout: 2000,
    retry: {
      initialRetryTime: 100,
      retries: 2
    }
  });

  const producer = kafka.producer();

  async function connectProducer() {
    await producer.connect();
    logger.info("Kafka producer connected successfully", { clientId });
  }

  async function publish(topic, message, key = null) {
    const payload = typeof message === "string" ? message : JSON.stringify(message);
    const msg = { value: payload };
    if (key !== null && key !== undefined) {
      msg.key = String(key);
    }
    await producer.send({
      topic,
      messages: [msg]
    });
  }

  async function createConsumer(groupId, topics, onMessage) {
    const consumer = kafka.consumer({ groupId });
    await consumer.connect();
    logger.info("Kafka consumer connected successfully", { clientId, groupId });

    for (const topic of topics) {
      await consumer.subscribe({ topic, fromBeginning: false });
    }

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const rawValue = message.value ? message.value.toString() : null;
          const parsed = rawValue ? JSON.parse(rawValue) : null;
          await onMessage({ topic, partition, data: parsed, offset: message.offset });
        } catch (error) {
          logger.error("Failed to process Kafka message", {
            topic,
            partition,
            offset: message.offset,
            error: error.message
          });
        }
      }
    });

    return consumer;
  }

  async function disconnect() {
    await producer.disconnect();
  }

  return {
    kafka,
    producer,
    connectProducer,
    publish,
    createConsumer,
    disconnect
  };
}
