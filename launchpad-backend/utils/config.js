const isProduction = process.env.NODE_ENV === 'production';

function isMockAi() {
  return process.env.MOCK_AI === 'true';
}

function validateConfig() {
  const errors = [];

  if (isProduction) {
    if (isMockAi()) errors.push('MOCK_AI must be false in production');
    if (process.env.DEV_BYPASS_AUTH === 'true') errors.push('DEV_BYPASS_AUTH must be false in production');
    if (process.env.USE_MEMORY_DB === 'true') errors.push('USE_MEMORY_DB must be false in production');

    const required = [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_KEY',
      'SUPABASE_ANON_KEY',
      'MINIMAX_API_KEY',
    ];
    for (const key of required) {
      if (!process.env[key]?.trim()) errors.push(`Missing ${key}`);
    }

    if (!process.env.MINIMAX_GROUP_ID?.trim()) {
      console.warn(
        'INFO: MINIMAX_GROUP_ID not set — OK for Token Plan (MINIMAX_API_KEY only). ' +
          'Set Group ID only if you use legacy pay-as-you-go billing.'
      );
    }
  } else if (!isMockAi()) {
    const recommended = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'MINIMAX_API_KEY'];
    for (const key of recommended) {
      if (!process.env[key]?.trim()) {
        console.warn(`WARN: ${key} not set — related features will fail unless MOCK_AI=true`);
      }
    }
  }

  if (errors.length) {
    throw new Error(`Configuration error:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  }
}

function getHealthStatus() {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    mockAi: isMockAi(),
    supabase: Boolean(process.env.SUPABASE_SERVICE_KEY),
    minimax: Boolean(process.env.MINIMAX_API_KEY),
    webSearch: process.env.MINIMAX_API_KEY ? 'minimax' : 'off',
    imageProvider: process.env.IMAGE_PROVIDER || (process.env.MINIMAX_API_KEY ? 'minimax' : 'pollinations'),
    ttsProvider:
      process.env.TTS_PROVIDER ||
      (process.env.OPENAI_API_KEY ? 'openai' : process.env.MINIMAX_API_KEY ? 'minimax' : 'none'),
  };
}

module.exports = { isProduction, isMockAi, validateConfig, getHealthStatus };
