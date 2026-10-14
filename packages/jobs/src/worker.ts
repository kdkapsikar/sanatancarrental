// Dev worker stub: connects to Redis and registers no-op processors.
import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { readEnv } from "@cab/config";
import { QUEUES } from "./queues.js";
import { processReviewRequest } from "./processors.js";

const url = new URL(readEnv().REDIS_URL);
// BullMQ workers need maxRetriesPerRequest: null on their blocking connection.
const connection = new Redis(url.href, { maxRetriesPerRequest: null });

const workers = [
  new Worker(QUEUES.documentExpiry, async (job) => {
    console.log("[stub] document-expiry", job.data);
  }, { connection }),
  new Worker(QUEUES.reviewRequest, async () => processReviewRequest(), { connection }),
  new Worker(QUEUES.dispatchTimeout, async (job) => {
    console.log("[stub] dispatch-timeout", job.data);
  }, { connection }),
];
console.log(`workers up on ${url.host}: ${Object.values(QUEUES).join(", ")}`);

process.on("SIGINT", async () => {
  await Promise.all(workers.map((w) => w.close()));
  connection.disconnect();
  process.exit(0);
});
