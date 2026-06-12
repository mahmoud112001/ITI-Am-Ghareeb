require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const passport = require('passport');
const configurePassport = require('./src/config/passport');

const authRouter = require('./src/routes/auth.routes');
const routesRouter = require('./src/routes/routes.routes');
const aiRouter = require('./src/routes/ai.routes');
const ratingRouter = require('./src/routes/rating.routes');
const adminRouter = require('./src/routes/admin.routes');
const errorMiddleware = require('./src/middleware/error.middleware');

const app = express();

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet());

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);

// ── Logging ───────────────────────────────────────────────────────────────────
app.use(morgan('dev'));

// ── Body Parsers ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Passport ──────────────────────────────────────────────────────────────────
app.use(passport.initialize());
configurePassport(passport);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/routes', routesRouter);
app.use('/api/ai', aiRouter);
app.use('/api/ratings', ratingRouter);
app.use('/api/admin', adminRouter);
app.use('/api/admin/routes', adminRouter);

// ── 404 Handler ───────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'المسار غير موجود' });
});

// ── Global Error Middleware ───────────────────────────────────────────────────
app.use(errorMiddleware);

module.exports = app;
