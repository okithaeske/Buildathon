const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { assertSessionOwner } = require('../middleware/auth');
const { getSession, updateSession } = require('../services/supabase');
const { search } = require('../services/webSearch');
const { chatComplete } = require('../services/minimax');
const { auditQuery, auditMergePrompt } = require('../prompts/audit');
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

    const concept = session.concept_summary;
    let auditResult;

    if (isMock()) {
      auditResult = fixtures.audit;
    } else {
      const query = auditQuery(concept);
      let answer;
      let citations = [];
      try {
        ({ answer, citations } = await search(query));
      } catch (searchErr) {
        console.warn('Audit web search failed:', searchErr.message);
        answer =
          'Web search was unavailable. Base the risk analysis on the startup concept and general industry knowledge only.';
      }

      const { system, user } = auditMergePrompt(concept, answer, citations);
      auditResult = await parseJsonWithRetry(
        await chatComplete(system, user),
        () =>
          chatComplete(
            `${system}\n\nYour last reply was not valid JSON. Return only one JSON object with real string values.`,
            user,
            { temperature: 0.3 }
          )
      );
      auditResult.citations = [...new Set([...(auditResult.citations || []), ...citations])];
      if (!Array.isArray(auditResult.risks)) {
        throw new Error('Audit response missing risks array');
      }
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
