const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { assertSessionOwner } = require('../middleware/auth');
const { getSession, updateSession } = require('../services/supabase');
const { search } = require('../services/tavily');
const { chatComplete } = require('../services/minimax');
const { scanMergePrompt, scanQueries } = require('../prompts/scan');
const { parseJson } = require('../utils/parseJson');
const { isMock, fixtures } = require('../utils/mock');

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

    if (session.scan_result && session.scan_expires_at && new Date(session.scan_expires_at) > new Date()) {
      return res.json(session.scan_result);
    }

    const concept = session.concept_summary;
    let scanResult;

    if (isMock()) {
      scanResult = fixtures.scan;
    } else {
      const queries = scanQueries(concept);
      const results = await Promise.all(queries.map((q) => search(q)));
      const allCitations = results.flatMap((r) => r.citations);
      const researchBundle = results.map((r, i) => `### Query ${i + 1}\n${r.answer}`).join('\n\n');
      const { system, user } = scanMergePrompt(concept, researchBundle);
      const raw = await chatComplete(system, user);
      scanResult = parseJson(raw);
      scanResult.citations = [...new Set([...(scanResult.citations || []), ...allCitations])];
    }

    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await updateSession(sessionId, {
      stage: 'scanned',
      scan_result: scanResult,
      scan_expires_at: expires,
    });

    res.json(scanResult);
  })
);

module.exports = router;
