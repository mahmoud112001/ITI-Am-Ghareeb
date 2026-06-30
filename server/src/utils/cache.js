const { redisClient } = require("../config/redis");

async function getCache(key) {
  try {
    if (!redisClient?.isReady) return null;

    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.error(`Cache GET error [${key}]`, err.message);
    return null;
  }
}

async function setCache(key, value, ttl = 300) {
  try {
    if (!redisClient?.isReady) return;

    await redisClient.set(key, JSON.stringify(value), {
      EX: ttl,
    });
  } catch (err) {
    console.error(`Cache SET error [${key}]`, err.message);
  }
}

async function deleteCache(key) {
  try {
    if (!redisClient?.isReady) return;

    await redisClient.del(key);
  } catch (err) {
    console.error(`Cache DEL error [${key}]`, err.message);
  }
}

module.exports = {
  getCache,
  setCache,
  deleteCache,
};
