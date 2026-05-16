const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { assertSessionOwner } = require('../middleware/auth');
const { getSession, createJob } = require('../services/supabase');
const { enqueueJob } = require('../services/jobs');
const { getStagesForType } = require('../services/jobStages');

const router = express.Router();

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: 'VALIDATION', message: 'sessionId is required' });
    }

    const session = await getSession(sessionId);
    assertSessionOwner(session, req.user.id);

    if (!session.viability_score) {
      return res.status(400).json({ error: 'INVALID_STATE', message: 'Complete validate before pitch' });
    }

    const job = await createJob({
      user_id: req.user.id,
      type: 'pitch',
      session_id: sessionId,
      status: 'queued',
      progress: 'queued',
    });

    enqueueJob(job.id, 'pitch');

    res.status(202).json({
      jobId: job.id,
      status: 'processing',
      progress: 'queued',
      stages: getStagesForType('pitch').map(({ key, label }) => ({ key, label })),
    });
  })
);

module.exports = router;
