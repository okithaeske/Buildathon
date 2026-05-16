const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { assertSessionOwner } = require('../middleware/auth');
const { getSession, updateSession } = require('../services/supabase');
const { search } = require('../services/perplexity');
const { chatComplete } = require('../services/minimax');
const { auditQuery, auditMergePrompt } = require('../prompts/audit');
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

    const concept = session.concept_summary;
    let auditResult;

    if (isMock()) {
      auditResult = fixtures.audit;
    } else {
      const query = auditQuery(concept);
      const { answer, citations } = await search(query);
      const { system, user } = auditMergePrompt(concept, answer, citations);
      const raw = await chatComplete(system, user);
      auditResult = parseJson(raw);
      auditResult.citations = [...new Set([...(auditResult.citations || []), ...citations])];
    }

    await updateSession(sessionId, { stage: 'audited', audit_result: auditResult });

    res.json({
      risks: auditResult.risks,
      citations: auditResult.citations,
      disclaimer: 'Surface-level AI scan — consult a qualified lawyer for legal decisions.',
    });
  })
);

module.exports = router;
