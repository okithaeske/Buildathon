const express = require('express');
const fs = require('fs');
const { asyncHandler } = require('../middleware/errorHandler');
const { assertSessionOwner } = require('../middleware/auth');
const { getSession, updateSession, uploadFile } = require('../services/supabase');
const { chatComplete, textToSpeech } = require('../services/minimax');
const { getRefineQuestions, compileProfilePrompt } = require('../prompts/refine');
const { parseJson } = require('../utils/parseJson');
const { isMock, fixtures } = require('../utils/mock');

const router = express.Router();

async function questionAudioUrl(question, userId, index) {
  if (isMock()) return null;
  try {
    const ttsPath = await textToSpeech(question);
    const buffer = fs.readFileSync(ttsPath);
    return await uploadFile('audio', `${userId}/refine-q${index}.mp3`, buffer, 'audio/mpeg');
  } catch {
    return null;
  }
}

router.post(
  '/start',
  asyncHandler(async (req, res) => {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: 'VALIDATION', message: 'sessionId is required' });
    }

    const session = await getSession(sessionId);
    assertSessionOwner(session, req.user.id);

    const questions = getRefineQuestions();
    const question = questions[0];
    const audioUrl = await questionAudioUrl(question, req.user.id, 0);

    await updateSession(sessionId, {
      stage: 'refining',
      refine_questions: questions,
      refine_answers: [],
      refine_index: 0,
    });

    res.json({ questionIndex: 0, question, audioUrl, done: false });
  })
);

router.post(
  '/answer',
  asyncHandler(async (req, res) => {
    const { sessionId, questionIndex, answerTranscript } = req.body;
    if (!sessionId || questionIndex === undefined || !answerTranscript?.trim()) {
      return res.status(400).json({
        error: 'VALIDATION',
        message: 'sessionId, questionIndex, and answerTranscript are required',
      });
    }

    const session = await getSession(sessionId);
    assertSessionOwner(session, req.user.id);

    const questions = session.refine_questions || getRefineQuestions();
    const answers = [...(session.refine_answers || [])];
    answers[questionIndex] = { question: questions[questionIndex], answer: answerTranscript };

    const nextIndex = questionIndex + 1;
    const done = nextIndex >= questions.length;

    if (done) {
      await updateSession(sessionId, { refine_answers: answers, refine_index: nextIndex });
      return res.json({ questionIndex: nextIndex, done: true });
    }

    const question = questions[nextIndex];
    const audioUrl = await questionAudioUrl(question, req.user.id, nextIndex);

    await updateSession(sessionId, { refine_answers: answers, refine_index: nextIndex });

    res.json({ questionIndex: nextIndex, question, audioUrl, done: false });
  })
);

router.post(
  '/complete',
  asyncHandler(async (req, res) => {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: 'VALIDATION', message: 'sessionId is required' });
    }

    const session = await getSession(sessionId);
    assertSessionOwner(session, req.user.id);

    let ideaProfile;
    if (isMock()) {
      ideaProfile = fixtures.ideaProfile;
    } else {
      const qaPairs = session.refine_answers || [];
      const { system, user } = compileProfilePrompt(session.concept_summary, qaPairs);
      const raw = await chatComplete(system, user);
      ideaProfile = parseJson(raw);
    }

    await updateSession(sessionId, { stage: 'refined', idea_profile: ideaProfile });

    res.json({ ideaProfile });
  })
);

module.exports = router;
