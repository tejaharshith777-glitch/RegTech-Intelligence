'use strict';

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const connectDB = require('./config/db');
const authRoutes = require('./routes/auth.routes');
const researchRoutes = require('./routes/research.routes');
const { errorHandler, notFound } = require('./middleware/error.middleware');

// ─── Bootstrap ─────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  connectDB();
}

const app = express();

// Render/Vercel sit behind a proxy — express-rate-limit requires this
app.set('trust proxy', 1);

// ─── Security Middleware ────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);
const DEFAULT_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5000',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'https://reg-tech-intelligence.vercel.app',
];

const allowedOrigins = [
  ...(process.env.CLIENT_ORIGIN || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  ...DEFAULT_ORIGINS,
];

app.use(
  cors({
    origin: (origin, callback) => {
      // No Origin header = same-origin, curl, or a server-side proxy (Vercel rewrite).
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      // Reject by omitting the ACAO header instead of throwing: a thrown error
      // would become a 500 and could break unrelated server-to-server calls.
      return callback(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
  })
);

// ─── Global Rate Limiter ────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 min
  max: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
  },
});
app.use(globalLimiter);

const path = require('path');
const fs = require('fs');

// ─── Request Parsing & Static Assets ────────────────────────────────────────
const frontendDist = path.join(__dirname, 'frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
} else {
  app.use(express.static('public'));
}

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Logging ────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ─── Health Check ───────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  const readyState = mongoose.connection.readyState; // 1 = connected
  const dbUp = readyState === 1;
  res.status(dbUp ? 200 : 503).json({
    success: dbUp,
    message: dbUp
      ? 'Regulatory Compliance API is running.'
      : 'API is up but MongoDB is not connected.',
    db: dbUp ? 'connected' : 'disconnected',
    readyState,
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// ─── API Routes ─────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/research', researchRoutes);

// ─── SPA Client Routing ─────────────────────────────────────────────────────
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  const indexPath = fs.existsSync(frontendDist)
    ? path.join(frontendDist, 'index.html')
    : path.join(__dirname, 'public/index.html');
  res.sendFile(indexPath);
});

// ─── Error Handling ─────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─── Start Server ───────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(
      `[server] 🚀 Running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`
    );
  });
}

module.exports = app; // for testing
