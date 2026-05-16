const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { supabaseAnon, ensureUserProfile, getUserProfile } = require('../services/supabase');
const memory = require('../services/memoryStore');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();
const memoryMode = memory.useMemory();

function formatAuthResponse(session, user) {
  return {
    user: { id: user.id, email: user.email },
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_in: session.expires_in,
  };
}

router.post(
  '/signup',
  asyncHandler(async (req, res) => {
    const { email, password, name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'VALIDATION', message: 'email and password are required' });
    }

    if (memoryMode) {
      const id = uuidv4();
      await ensureUserProfile(id);
      return res.status(201).json({
        user: { id, email },
        access_token: `memory-${id}`,
        refresh_token: `refresh-${id}`,
        expires_in: 3600,
      });
    }

    const { data, error } = await supabaseAnon.auth.signUp({
      email,
      password,
      options: name ? { data: { name } } : undefined,
    });

    if (error) {
      return res.status(400).json({ error: 'SIGNUP_FAILED', message: error.message });
    }

    if (!data.session) {
      return res.status(201).json({
        message: 'Check your email to confirm your account',
        user: { id: data.user?.id, email: data.user?.email },
      });
    }

    await ensureUserProfile(data.user.id);
    res.status(201).json(formatAuthResponse(data.session, data.user));
  })
);

router.post(
  '/signin',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'VALIDATION', message: 'email and password are required' });
    }

    if (memoryMode) {
      const id = memory.DEV_USER.id;
      await ensureUserProfile(id);
      return res.json({
        user: { id, email: email || memory.DEV_USER.email },
        access_token: `memory-${id}`,
        refresh_token: `refresh-${id}`,
        expires_in: 3600,
      });
    }

    const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });
    if (error) {
      return res.status(401).json({ error: 'SIGNIN_FAILED', message: error.message });
    }

    await ensureUserProfile(data.user.id);
    res.json(formatAuthResponse(data.session, data.user));
  })
);

router.post('/signout', (req, res) => {
  res.json({ ok: true });
});

router.get(
  '/me',
  asyncHandler(async (req, res) => {
    const profile = await getUserProfile(req.user.id);
    res.json({
      id: req.user.id,
      email: req.user.email,
      tier: profile.tier,
      pitch_count: profile.pitch_count,
      campaign_count: profile.campaign_count,
    });
  })
);

module.exports = router;
