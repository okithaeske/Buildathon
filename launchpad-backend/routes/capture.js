const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { saveSession } = require('../services/supabase');
const { chatComplete } = require('../services/minimax');
const { capturePrompt } = require('../prompts/capture');
const { parseJson } = require('../utils/parseJson');
const { isMock, fixtures } = require('../utils/mock');

const router = express.Router();

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { transcript } = req.body;
    if (!transcript?.trim()) {
      return res.status(400).json({ error: 'VALIDATION', message: 'transcript is required' });
    }

    let conceptSummary;
    if (isMock()) {
      conceptSummary = fixtures.conceptSummary;
    } else {
      const { system, user } = capturePrompt(transcript);
      const raw = await chatComplete(system, user);
      conceptSummary = parseJson(raw);
    }

    const session = await saveSession({
      user_id: req.user.id,
      stage: 'captured',
      idea_raw: transcript,
      concept_summary: conceptSummary,
    });

    res.status(201).json({
      sessionId: session.id,
      conceptSummary,
      disclaimer: 'AI-assisted analysis — not legal or financial advice.',
    });
  })
);

module.exports = router;
