const { supabaseAdmin, getUserProfile } = require('../services/supabase');
// supabaseAdmin may be null in memory mode

const PUBLIC_PATHS = [
  { method: 'GET', path: '/health' },
  { method: 'POST', path: '/api/auth/signup' },
  { method: 'POST', path: '/api/auth/signin' },
];

function isPublicRoute(req) {
  return PUBLIC_PATHS.some((p) => p.method === req.method && p.path === req.path);
}

async function requireAuth(req, res, next) {
  if (isPublicRoute(req)) return next();

  if (process.env.DEV_BYPASS_AUTH === 'true' && process.env.NODE_ENV !== 'production') {
    req.user = {
      id: '00000000-0000-4000-8000-000000000001',
      email: 'dev@launchpad.local',
      tier: 'studio',
      pitch_count: 0,
      campaign_count: 0,
    };
    return next();
  }

  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing or invalid Authorization header' });
  }

  const token = header.slice(7);

  if (token.startsWith('memory-')) {
    const userId = token.slice(7);
    const profile = await getUserProfile(userId);
    req.user = {
      id: userId,
      email: 'user@launchpad.local',
      tier: profile?.tier ?? 'free',
      pitch_count: profile?.pitch_count ?? 0,
      campaign_count: profile?.campaign_count ?? 0,
    };
    req.accessToken = token;
    return next();
  }

  try {
    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'CONFIG', message: 'Supabase not configured' });
    }
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid or expired token' });
    }

    const profile = await getUserProfile(data.user.id);
    req.user = {
      id: data.user.id,
      email: data.user.email,
      tier: profile?.tier ?? 'free',
      pitch_count: profile?.pitch_count ?? 0,
      campaign_count: profile?.campaign_count ?? 0,
    };
    req.accessToken = token;
    next();
  } catch (err) {
    next(err);
  }
}

function assertSessionOwner(session, userId) {
  if (!session) {
    const err = new Error('Session not found');
    err.status = 404;
    throw err;
  }
  if (session.user_id !== userId) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }
  return session;
}

function assertCampaignOwner(campaign, userId) {
  if (!campaign) {
    const err = new Error('Campaign not found');
    err.status = 404;
    throw err;
  }
  if (campaign.user_id !== userId) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }
  return campaign;
}

module.exports = { requireAuth, assertSessionOwner, assertCampaignOwner, isPublicRoute };
