const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { getJob } = require('../services/supabase');
const { formatJobResponse, getStagesForType } = require('../services/jobStages');

const router = express.Router();

router.get(
  '/stages/:type',
  asyncHandler(async (req, res) => {
    const type = req.params.type;
    const stages = getStagesForType(type);
    if (!stages.length) {
      return res.status(400).json({ error: 'VALIDATION', message: 'type must be pitch or campaign' });
    }
    res.json({ type, stages: stages.map(({ key, label }) => ({ key, label })) });
  })
);

router.get(
  '/:jobId',
  asyncHandler(async (req, res) => {
    const job = await getJob(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Job not found' });
    }
    if (job.user_id !== req.user.id) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Access denied' });
    }

    res.json(formatJobResponse(job));
  })
);

module.exports = router;
