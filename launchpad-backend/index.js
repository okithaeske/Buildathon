require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const { validateConfig, getHealthStatus, isProduction } = require('./utils/config');
const { requireAuth } = require('./middleware/auth');
const { errorHandler } = require('./middleware/errorHandler');
const { apiLimiter, authLimiter } = require('./middleware/rateLimit');

const { publicRouter: authPublic, protectedRouter: authProtected } = require('./routes/auth');
const captureRoutes = require('./routes/capture');
const scanRoutes = require('./routes/scan');
const auditRoutes = require('./routes/audit');
const refineRoutes = require('./routes/refine');
const validateRoutes = require('./routes/validate');
const pitchRoutes = require('./routes/pitch');
const campaignRoutes = require('./routes/campaign');
const jobsRoutes = require('./routes/jobs');
const sessionRoutes = require('./routes/session');

validateConfig();

const app = express();
const PORT = process.env.PORT || 3000;

// Always allow local Vite dev; merge with CORS_ORIGIN from Railway (comma-separated).
const LOCAL_DEV_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
];

function resolveCorsOrigin() {
  const configured = process.env.CORS_ORIGIN?.trim();
  if (!configured || configured === '*') return true;
  const origins = configured.split(',').map((o) => o.trim()).filter(Boolean);
  return [...new Set([...origins, ...LOCAL_DEV_ORIGINS])];
}

app.use(
  cors({
    origin: resolveCorsOrigin(),
    credentials: true,
  })
);
app.use(helmet());
app.use(morgan(isProduction ? 'combined' : 'dev'));
app.use(express.json({ limit: '2mb' }));

function healthHandler(req, res) {
  res.json(getHealthStatus());
}

app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

app.use('/api/auth', authLimiter, authPublic);
app.use(requireAuth);
app.use('/api/auth', authProtected);
app.use('/api', apiLimiter);

app.use('/api/capture', captureRoutes);
app.use('/api/scan', scanRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/refine', refineRoutes);
app.use('/api/validate', validateRoutes);
app.use('/api/pitch', pitchRoutes);
app.use('/api/campaign', campaignRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/session', sessionRoutes);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`LaunchPad API running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`MOCK_AI=${process.env.MOCK_AI ?? 'false'}`);
});

module.exports = app;
