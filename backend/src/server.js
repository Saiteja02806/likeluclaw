require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const logger = require('./config/logger');
const { setupWebSocketServer } = require('./ws/handler');
// const { startTokenRefreshJob } = require('./jobs/token-refresh'); // Disabled — using Composio for Gmail/Calendar instead of direct Google OAuth

// ── Crash Prevention ──
// Without these, any unhandled error kills the process silently.
// PM2 restarts it, but context is lost. Log first, then let PM2 restart cleanly.
process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION — process will restart', { error: err.message, stack: err.stack });
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  logger.error('UNHANDLED REJECTION — process will restart', { reason: String(reason), stack: reason?.stack });
  process.exit(1);
});

// Import routes
const authRoutes = require('./routes/auth');
const employeeRoutes = require('./routes/employees');
const channelRoutes = require('./routes/channels');
const settingsRoutes = require('./routes/settings');
const billingRoutes = require('./routes/billing');
const marketplaceRoutes = require('./routes/marketplace');
const logRoutes = require('./routes/logs');
// const oauthRoutes = require('./routes/oauth'); // Disabled — using Composio for Gmail/Calendar
const previewRoutes = require('./routes/preview');
const integrationsRoutes = require('./routes/integrations');
const vapiRoutes = require('./routes/vapi');
// const chatRoutes = require('./routes/chat'); // Disabled — chat websocket proxy not deployed

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy (needed for rate-limiter behind Vite proxy / nginx in production)
app.set('trust proxy', 1);

// ── Security Middleware ──
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? [
        `https://app.${process.env.DOMAIN}`,
        `https://${process.env.DOMAIN}`,
        `https://www.${process.env.DOMAIN}`,
      ]
    : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000', 'http://localhost:4173'],
  credentials: true
}));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // Stricter for auth endpoints
  message: { error: 'Too many auth attempts, please try again later' }
});

// ── Body Parsing ──
// Stripe webhook needs raw body — must come BEFORE express.json()
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Request Logging ──
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path !== '/api/health') {
      logger.info(`${req.method} ${req.path}`, {
        status: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip
      });
    }
  });
  next();
});

// ── Routes ──
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/employees', apiLimiter, employeeRoutes);
app.use('/api/connect', apiLimiter, channelRoutes);
app.use('/api/settings', apiLimiter, settingsRoutes);
app.use('/api/billing', billingRoutes); // Webhook has its own auth
app.use('/api/marketplace', apiLimiter, marketplaceRoutes);
app.use('/api/logs', apiLimiter, logRoutes);
// app.use('/api/oauth', oauthRoutes); // Disabled — using Composio for Gmail/Calendar
app.use('/api/preview', previewRoutes); // No rate limit — serves static preview files
app.use('/api/integrations', apiLimiter, integrationsRoutes);
app.use('/api/vapi', vapiRoutes); // No rate limit — VAPI sends webhooks during live calls
// app.use('/api/chat', apiLimiter, chatRoutes); // Disabled — chat websocket proxy not deployed

// ── Health Check ──
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'likelyclaw-api',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// ── 404 Handler ──
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// ── Error Handler ──
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start Server ──
const server = http.createServer(app);

// Setup WebSocket server on the same HTTP server
setupWebSocketServer(server);

server.listen(PORT, () => {
  logger.info(`LikelyClaw API server running`, {
    port: PORT,
    env: process.env.NODE_ENV || 'development',
    supabase: process.env.SUPABASE_URL ? '✓ connected' : '✗ not configured'
  });
  logger.info(`Health check: http://localhost:${PORT}/api/health`);
  logger.info(`WebSocket: ws://localhost:${PORT}/ws`);

  // Start background jobs
  // startTokenRefreshJob(); // Disabled — using Composio for Gmail/Calendar instead of direct Google OAuth
});

// ── Graceful Shutdown ──
// Clean up WebSocket connections and timers before PM2 restarts
function gracefulShutdown(signal) {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
  // Force exit after 10s if connections don't close
  setTimeout(() => {
    logger.warn('Forced shutdown after timeout');
    process.exit(1);
  }, 10000).unref();
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = { app, server };
