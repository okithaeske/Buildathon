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

const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(
  cors({
    origin: corsOrigin === '*' ? true : corsOrigin.split(',').map((o) => o.trim()),
    credentials: true,
  })
);
app.use(helmet());
app.use(morgan(isProduction ? 'combined' : 'dev'));
app.use(express.json({ limit: '2mb' }));

app.get('/health', (req, res) => {
  res.json(getHealthStatus());
});

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
