const { chatComplete } = require('./minimax');

const SYSTEM = `You are an expert creative director writing prompts for the MiniMax image-01 text-to-image model.

Output ONLY the image prompt text — no markdown fences, no quotes, no explanation.
Maximum 1200 characters.

Rules for image-01:
- Describe visual scene, lighting, composition, color palette, and mood
- Match the campaign tone (energetic, professional, emotional, funny)
- Wide marketing banner composition, 16:9, commercial photography or premium illustration
- Leave negative space for overlaid copy (left third or top band)
- Do NOT ask for text, letters, words, logos, watermarks, or UI in the image
- If a reference product photo will be supplied, describe a fresh ad scene that features the same product/subject clearly`;

async function openaiChat(system, user) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_PROMPT_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.7,
      max_tokens: 600,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI prompt error: ${res.status} ${text}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content?.trim()) throw new Error('OpenAI returned empty prompt');
  return content.trim();
}

function fallbackPrompt(productInfo, tone) {
  return [
    `Professional wide marketing banner, 16:9, ${tone} mood.`,
    `For: ${productInfo.slice(0, 300)}.`,
    'Commercial photography, soft studio lighting, clean negative space for headline, no text or logos in image.',
  ].join(' ');
}

/**
 * Craft a MiniMax image-01 prompt from campaign context.
 * Uses OpenAI when OPENAI_API_KEY is set; falls back to MiniMax chat.
 */
async function buildCampaignBannerPrompt({ productInfo, tone, heroCopy, hasReferenceImage }) {
  const user = [
    `Business / product:\n${(productInfo || '').slice(0, 2500)}`,
    `Campaign tone: ${tone}`,
    heroCopy && `Hero headline / copy:\n${heroCopy.slice(0, 400)}`,
    hasReferenceImage
      ? 'A reference product or brand photo will be supplied — keep the same subject recognizable in a new ad environment.'
      : 'No reference photo — invent a fitting visual subject for the brand.',
  ]
    .filter(Boolean)
    .join('\n\n');

  let prompt = null;

  if (process.env.OPENAI_API_KEY?.trim()) {
    try {
      prompt = await openaiChat(SYSTEM, user);
    } catch (err) {
      console.warn('OpenAI banner prompt failed, trying MiniMax:', err.message);
    }
  }

  if (!prompt?.trim()) {
    try {
      prompt = await chatComplete(SYSTEM, user, { temperature: 0.6 });
    } catch (err) {
      console.warn('MiniMax banner prompt failed, using template:', err.message);
      prompt = fallbackPrompt(productInfo, tone);
    }
  }

  return prompt.replace(/^["']|["']$/g, '').trim().slice(0, 1500);
}

module.exports = { buildCampaignBannerPrompt, fallbackPrompt };
