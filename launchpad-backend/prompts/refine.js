const DEFAULT_QUESTIONS = [
  'Who is your ideal customer, and what problem are they paying to solve today?',
  'How will the business make money — subscription, one-time, or commission?',
  'What stops a well-funded competitor from copying this in 6 months?',
  'How will your first 100 customers find you?',
  'Why are you the right person to build this?',
];

function getRefineQuestions() {
  return DEFAULT_QUESTIONS;
}

function compileProfilePrompt(concept, qaPairs) {
  return {
    system: `Compile interview answers into ONLY valid JSON:
{
  "customer": string,
  "revenue": string,
  "moat": string,
  "gtm": string,
  "founderFit": string
}`,
    user: `Concept:\n${JSON.stringify(concept)}\n\nQ&A:\n${JSON.stringify(qaPairs, null, 2)}`,
  };
}

module.exports = { getRefineQuestions, compileProfilePrompt, DEFAULT_QUESTIONS };
