const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { assertSessionOwner } = require('../middleware/auth');
const {
  getSession,
  listSessions,
  deleteSession,
  deleteAllSessionsForUser,
  updateSession,
  uploadFile,
} = require('../services/supabase');
const { removeSessionFiles } = require('../services/deleteResources');
const { buildPitchDeckPptx, PPTX_MIME } = require('../services/pitchPptx');
const { pitchDeckFilename, appendDownloadParam } = require('../utils/filename');

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
  '/',
  asyncHandler(async (req, res) => {
    const summaries = await listSessions(req.user.id);
    const ids = (summaries || []).map((s) => s.id);

    await Promise.all(
      ids.map((id) =>
        removeSessionFiles(req.user.id, id).catch((err) =>
          console.warn('Bulk session file cleanup failed:', err.message)
        )
      )
    );

    const deletedIds = await deleteAllSessionsForUser(req.user.id);

    res.json({
      ok: true,
      deletedCount: deletedIds.length,
      deletedIds,
    });
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
      return res.status(400).json({
        error: 'NOT_READY',
        message: 'Pitch deck not generated yet. Complete the pitch job first.',
      });
    }

    const filename =
      session.pitch_output?.pptxFilename ||
      pitchDeckFilename(session.concept_summary, { ext: 'pptx' });
    const regenerate = req.query.regenerate === '1';
    const redirect = req.query.redirect === '1';
    const jsonOnly = req.query.json === '1';

    const existing = session.pitch_output?.pptxUrl;
    if (existing && !regenerate) {
      const downloadUrl = appendDownloadParam(existing, filename);
      if (jsonOnly) {
        return res.json({ pptxUrl: downloadUrl, pptxFilename: filename, cached: true });
      }
      if (redirect) return res.redirect(downloadUrl);
    }

    const meta = {
      title:
        session.concept_summary?.productType ||
        session.concept_summary?.summary ||
        'Investor Pitch Deck',
      summary: session.concept_summary?.summary,
    };
    const imageUrls = Array.isArray(session.pitch_output?.slideImageUrls)
      ? session.pitch_output.slideImageUrls
      : [];

    let buffer;
    try {
      buffer = await buildPitchDeckPptx(pitchDeck, meta, { imageUrls });
    } catch (err) {
      console.error('On-demand pitch PPTX build failed:', err);
      return res.status(500).json({
        error: 'EXPORT_FAILED',
        message: 'Pitch deck PowerPoint could not be generated.',
      });
    }

    let pptxUrl = null;
    try {
      const path = `${req.user.id}/pitch-${session.id}.pptx`;
      pptxUrl = await uploadFile('exports', path, buffer, PPTX_MIME);
      await updateSession(session.id, {
        pitch_output: {
          ...(session.pitch_output || {}),
          pptxUrl,
          pptxFilename: filename,
        },
      });
    } catch (err) {
      console.warn('Pitch PPTX storage upload failed:', err.message);
    }

    const downloadUrl = pptxUrl ? appendDownloadParam(pptxUrl, filename) : null;

    if (jsonOnly) {
      return res.json({
        pptxUrl: downloadUrl,
        pptxFilename: filename,
        cached: false,
        ...(downloadUrl ? {} : { streamed: true }),
      });
    }

    if (redirect && downloadUrl) {
      return res.redirect(downloadUrl);
    }

    res.setHeader('Content-Type', PPTX_MIME);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Filename', filename);
    if (downloadUrl) res.setHeader('X-Pptx-Url', downloadUrl);
    res.send(buffer);
  })
);

router.get(
  '/:id/export/report',
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
