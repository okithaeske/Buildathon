const { isMock } = require('../utils/mock');

async function generateImage(prompt, size = '1024x1024') {
  if (isMock()) {
    return `https://placehold.co/1200x630/png?text=${encodeURIComponent(prompt.slice(0, 40))}`;
  }

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DALL-E error: ${res.status} ${text}`);
  }

  const data = await res.json();
  return data.data[0].url;
}

module.exports = { generateImage };
