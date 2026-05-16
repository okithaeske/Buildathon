const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { assertSessionOwner } = require('../middleware/auth');
const { getSession, updateSession } = require('../services/supabase');
const { chatComplete } = require('../services/minimax');
const { validatePrompt } = require('../prompts/validate');
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

    if (!session.idea_profile) {
      return res.status(400).json({ error: 'INVALID_STATE', message: 'Complete refine before validate' });
    }

    let viability;
    if (isMock()) {
      viability = fixtures.validate;
    } else {
      const { system, user } = validatePrompt(session);
      const raw = await chatComplete(system, user);
      viability = parseJson(raw);
    }

    await updateSession(sessionId, { stage: 'validated', viability_score: viability });

    res.json(viability);
  })
);

module.exports = router;
