require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const { requireAuth } = require('./middleware/auth');
const { errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth');
const captureRoutes = require('./routes/capture');
const scanRoutes = require('./routes/scan');
const auditRoutes = require('./routes/audit');
const refineRoutes = require('./routes/refine');
const validateRoutes = require('./routes/validate');
const pitchRoutes = require('./routes/pitch');
const campaignRoutes = require('./routes/campaign');
const jobsRoutes = require('./routes/jobs');
const sessionRoutes = require('./routes/session');

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
app.use(morgan('dev'));
app.use(express.json({ limit: '2mb' }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(requireAuth);

app.use('/api/auth', authRoutes);
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
  console.log(`MOCK_AI=${process.env.MOCK_AI ?? 'false'} DEV_BYPASS_AUTH=${process.env.DEV_BYPASS_AUTH ?? 'false'}`);
});

module.exports = app;
