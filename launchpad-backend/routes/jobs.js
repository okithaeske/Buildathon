const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { getJob } = require('../services/supabase');

const router = express.Router();

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

    res.json({
      jobId: job.id,
      type: job.type,
      status: job.status,
      progress: job.progress,
      result: job.result,
      error: job.error,
    });
  })
);

module.exports = router;
