const { createClient } = require("redis");

const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

redisClient.on("error", (err) => {
  console.error("Redis Error:", err);
});

redisClient.on("connect", () => {
  console.log("✅ Redis Connected");
});

async function connectRedis() {
  if (redisClient.isOpen) return;
  try {
    await redisClient.connect();
  } catch (err) {
    console.warn("⚠️  Redis غير متاح — التطبيق يعمل بدون cache:", err.message);
  }
}

module.exports = {
  redisClient,
  connectRedis,
};
