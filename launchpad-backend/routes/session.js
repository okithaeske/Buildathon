const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { assertSessionOwner } = require('../middleware/auth');
const {
  getSession,
  listSessions,
  updateSession,
  deleteSession,
  deleteAllSessionsForUser,
  uploadFile,
} = require('../services/supabase');
const { removeSessionFiles } = require('../services/deleteResources');
const { buildPitchDeckPdf } = require('../services/pitchPdf');
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
  '/:id/export/pdf',
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

    const pdfFilename =
      session.pitch_output?.pdfFilename ||
      pitchDeckFilename(session.concept_summary, { ext: 'pdf' });

    const existing = session.pitch_output?.pdfUrl;
    if (existing && req.query.redirect === '1') {
      return res.redirect(appendDownloadParam(existing, pdfFilename));
    }
    if (existing && !req.query.regenerate) {
      return res.json({
        pdfUrl: appendDownloadParam(existing, pdfFilename),
        pdfFilename,
      });
    }

    let buffer;
    try {
      buffer = await buildPitchDeckPdf(
        pitchDeck,
        {
          title: session.concept_summary?.summary || session.concept_summary?.productType,
          summary: session.concept_summary?.summary,
        },
        {
          imageUrls: Array.isArray(session.pitch_output?.slideImageUrls)
            ? session.pitch_output.slideImageUrls
            : [],
          citations: Array.isArray(session.scan_result?.citations)
            ? session.scan_result.citations
            : [],
        }
      );
    } catch (err) {
      console.error('On-demand pitch PDF build failed:', err);
      return res.status(503).json({
        error: 'PDF_RENDERER_UNAVAILABLE',
        message:
          'Pitch deck PDF could not be generated on the server. The headless browser failed to start. ' +
          'Please retry shortly or contact support if this persists.',
      });
    }

    const path = `${req.user.id}/pitch-${session.id}.pdf`;
    const rawUrl = await uploadFile('exports', path, buffer, 'application/pdf');
    const pdfUrl = appendDownloadParam(rawUrl, pdfFilename);

    await updateSession(session.id, {
      pitch_output: {
        ...(session.pitch_output || {}),
        pdfUrl: rawUrl,
        pdfFilename,
      },
    }).catch((err) => console.warn('Persist pdfUrl failed:', err.message));

    if (req.query.redirect === '1') return res.redirect(pdfUrl);
    res.json({ pdfUrl, pdfFilename });
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
