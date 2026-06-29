require('dotenv').config();

const mongoose = require('mongoose');
const app = require('./app');

const PORT = process.env.PORT || 5000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 3000;

const { connectRedis } = require("./src/config/redis");

// ── DB Connection with Retry ──────────────────────────────────────────────────
async function connectDB(attempt = 1) {
  console.log(`جاري الاتصال بقاعدة البيانات... (محاولة ${attempt} من ${MAX_RETRIES})`);
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log('تم الاتصال بقاعدة البيانات بنجاح ✓');
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      console.error(`فشل الاتصال — سيتم إعادة المحاولة بعد ${RETRY_DELAY_MS / 1000} ثوانٍ...`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      return connectDB(attempt + 1);
    }
    console.error('فشل الاتصال بقاعدة البيانات بعد جميع المحاولات. جاري الإيقاف...');
    console.error(err.message);
    process.exit(1);
  }
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
async function bootstrap() {
  await connectDB();
  await connectRedis();
  app.listen(PORT, () => {
    console.log(`السيرفر شغال على البورت ${PORT} ✓`);
    console.log(`الرابط: http://localhost:${PORT}/api`);
  });
}

bootstrap();

// ── Process-level Safety Nets ─────────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('خطأ غير متوقع — جاري الإيقاف الاضطراري:', err.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('وعد مرفوض غير معالَج — جاري الإيقاف الاضطراري:', reason);
  process.exit(1);
});
