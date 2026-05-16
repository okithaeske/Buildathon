const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { listSessions, listCampaigns } = require('../services/supabase');

const router = express.Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const [pitches, campaigns] = await Promise.all([
      listSessions(req.user.id),
      listCampaigns(req.user.id),
    ]);
    res.json({ pitches, campaigns });
  })
);

module.exports = router;
