const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { assertSessionOwner } = require('../middleware/auth');
const { getSession, listSessions, deleteSession, uploadFile } = require('../services/supabase');
const { removeSessionFiles } = require('../services/deleteResources');
const { buildPitchDeckPptx } = require('../services/pptx');

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

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const session = await getSession(req.params.id);
    assertSessionOwner(session, req.user.id);

    await removeSessionFiles(req.user.id, session.id);
    await deleteSession(session.id);

    res.json({ ok: true, deletedId: session.id });
  })
);

router.get(
  '/:id/export/pptx',
  asyncHandler(async (req, res) => {
    const session = await getSession(req.params.id);
    assertSessionOwner(session, req.user.id);

    const pitchDeck = session.pitch_output?.pitchDeck;
    if (!pitchDeck?.length) {
      return res.status(409).json({
        error: 'NOT_READY',
        message: 'Pitch deck not generated yet. Complete the pitch job first.',
      });
    }

    const existing = session.pitch_output?.pptxUrl;
    if (existing && req.query.redirect === '1') {
      return res.redirect(existing);
    }
    if (existing && !req.query.regenerate) {
      return res.json({ pptxUrl: existing });
    }

    const buffer = await buildPitchDeckPptx(pitchDeck, {
      title: session.concept_summary?.summary,
      summary: session.concept_summary?.summary,
    });
    const path = `${req.user.id}/pitch-${session.id}.pptx`;
    const pptxUrl = await uploadFile(
      'exports',
      path,
      buffer,
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    );

    res.json({ pptxUrl });
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
