import { Kafka, logLevel } from "kafkajs";
import { log } from "./logger.js";

export function getKafka(clientId, brokers) {
  const list = Array.isArray(brokers) ? brokers : brokers.split(",");
  const client = new Kafka({ clientId, brokers: list, logLevel: logLevel.NOTHING });
  const producer = client.producer();

  return {
    async send(topic, data) {
      await producer.send({
        topic,
        messages: [{ value: JSON.stringify(data) }]
      });
    },

    async startProducer() {
      await producer.connect();
      log.info(`Kafka producer connected (${clientId})`);
    },

    async startConsumer(groupId, topics, onMsg) {
      const consumer = client.consumer({ groupId });
      await consumer.connect();
      for (const t of topics) {
        await consumer.subscribe({ topic: t, fromBeginning: false });
      }
      await consumer.run({
        eachMessage: async ({ topic, message }) => {
          try {
            const raw = message.value?.toString();
            const data = raw ? JSON.parse(raw) : null;
            await onMsg({ topic, data });
          } catch (err) {
            log.error(`Kafka message parse error on ${topic}: ${err.message}`);
          }
        }
      });
      return consumer;
    }
  };
}
