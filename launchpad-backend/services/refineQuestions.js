const { chatComplete } = require('./minimax');
const { parseJsonWithRetry } = require('../utils/parseJson');
const {
  getRefineQuestions,
  generateRefineQuestionsPrompt,
} = require('../prompts/refine');

function normalizeQuestionList(raw) {
  const list = Array.isArray(raw) ? raw : raw?.questions;
  if (!Array.isArray(list)) return null;

  const questions = list
    .map((q) => (typeof q === 'string' ? q.trim() : ''))
    .filter((q) => q.length > 0);

  if (questions.length < 5) return null;
  return questions.slice(0, 5);
}

/**
 * Personalized founder interview questions from concept_summary (MiniMax).
 * Falls back to DEFAULT_QUESTIONS on parse/validation/API errors.
 */
async function getRefineQuestionsForConcept(concept) {
  const { system, user } = generateRefineQuestionsPrompt(concept ?? {});

  try {
    const parsed = await parseJsonWithRetry(await chatComplete(system, user), () =>
      chatComplete(
        `${system}\n\nYour last reply was invalid. Return only {"questions":["q1","q2","q3","q4","q5"]} with five strings.`,
        user,
        { temperature: 0.3 }
      )
    );

    const questions = normalizeQuestionList(parsed);
    if (questions) return questions;

    console.warn('Personalized refine questions: invalid shape, using defaults');
  } catch (err) {
    console.warn('Personalized refine questions failed, using defaults:', err.message);
  }

  return getRefineQuestions();
}

module.exports = { getRefineQuestionsForConcept, normalizeQuestionList };
