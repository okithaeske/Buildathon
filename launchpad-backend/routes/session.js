const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { assertSessionOwner } = require('../middleware/auth');
const { getSession, listSessions } = require('../services/supabase');

const router = express.Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const sessions = await listSessions(req.user.id);
    res.json({ sessions });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const session = await getSession(req.params.id);
    assertSessionOwner(session, req.user.id);
    res.json(session);
  })
);

router.get(
  '/:id/export/pdf',
  asyncHandler(async (req, res) => {
    const session = await getSession(req.params.id);
    assertSessionOwner(session, req.user.id);

    const report = {
      title: 'LaunchPad AI — Pitch Report',
      disclaimer: 'AI-assisted analysis — not legal or financial advice.',
      concept: session.concept_summary,
      scan: session.scan_result,
      audit: session.audit_result,
      ideaProfile: session.idea_profile,
      viability: session.viability_score,
      pitch: session.pitch_output,
      audioUrl: session.audio_url,
      generatedAt: new Date().toISOString(),
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="session-${session.id}-report.json"`);
    res.send(JSON.stringify(report, null, 2));
  })
);

module.exports = router;
