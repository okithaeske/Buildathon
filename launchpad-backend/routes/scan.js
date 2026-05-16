const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { assertSessionOwner } = require('../middleware/auth');
const { getSession, updateSession } = require('../services/supabase');
const { search } = require('../services/webSearch');
const { chatComplete } = require('../services/minimax');
const { scanMergePrompt, scanQueries } = require('../prompts/scan');
const { parseJsonWithRetry } = require('../utils/parseJson');
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
      const results = await Promise.all(
        queries.map((q) =>
          search(q).catch((err) => {
            console.warn('Scan search failed:', err.message);
            return { answer: `Search unavailable for: ${q}`, citations: [] };
          })
        )
      );
      const allCitations = results.flatMap((r) => r.citations);
      const researchBundle = results.map((r, i) => `### Query ${i + 1}\n${r.answer}`).join('\n\n');
      const { system, user } = scanMergePrompt(concept, researchBundle);
      scanResult = await parseJsonWithRetry(
        await chatComplete(system, user),
        () =>
          chatComplete(
            `${system}\n\nYour last reply was not valid JSON. Return only one JSON object with real string values.`,
            user,
            { temperature: 0.3 }
          )
      );
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
