const DEFAULT_QUESTIONS = [
  'Who is your ideal customer, and what problem are they paying to solve today?',
  'How will the business make money — subscription, one-time, or commission?',
  'What stops a well-funded competitor from copying this in 6 months?',
  'How will your first 100 customers find you?',
  'Why are you the right person to build this?',
];

function getRefineQuestions() {
  return [...DEFAULT_QUESTIONS];
}

function generateRefineQuestionsPrompt(concept) {
  return {
    system: `You are a startup coach running a founder interview.

Generate exactly 5 questions tailored to the specific idea below. Respond with ONLY one JSON object — no markdown, no TypeScript types:

{
  "questions": [
    "First question as a complete sentence?",
    "Second question?",
    "Third question?",
    "Fourth question?",
    "Fifth question?"
  ]
}

Rules:
- Exactly 5 questions, each a string ending with ?
- Spoken-friendly (under ~25 words each)
- Cover: target customer & problem, revenue model, defensibility/moat, go-to-market, founder fit
- Reference specifics from the idea (industry, geography, product) when known
- Do not repeat the same theme twice`,
    user: `Idea to interview about:\n${JSON.stringify(concept, null, 2)}`,
  };
}

function compileProfilePrompt(concept, qaPairs) {
  return {
    system: `Compile interview answers into ONLY valid JSON — real strings, no TypeScript types:

{
  "customer": "Who buys and what problem is solved",
  "revenue": "How money is made",
  "moat": "Defensibility",
  "gtm": "Go-to-market",
  "founderFit": "Why this founder"
}`,
    user: `Concept:\n${JSON.stringify(concept)}\n\nQ&A:\n${JSON.stringify(qaPairs, null, 2)}`,
  };
}

module.exports = {
  getRefineQuestions,
  generateRefineQuestionsPrompt,
  compileProfilePrompt,
  DEFAULT_QUESTIONS,
};
