const { createClient } = require("redis");

const REDIS_URL = process.env.REDIS_URL;
const redisClient = REDIS_URL
  ? createClient({ url: REDIS_URL })
  : null;

if (redisClient) {
  redisClient.on("error", (err) => {
    console.warn("Redis unavailable; continuing without cache:", err.message);
  });

  redisClient.on("connect", () => {
    console.log("Redis connected");
  });
}

async function connectRedis() {
  if (!redisClient) {
    console.log("Redis disabled; set REDIS_URL to enable cache");
    return;
  }

  if (redisClient.isOpen) return;

  try {
    await redisClient.connect();
  } catch (err) {
    console.warn("Redis unavailable; continuing without cache:", err.message);
  }
}

module.exports = {
  redisClient,
  connectRedis,
};
