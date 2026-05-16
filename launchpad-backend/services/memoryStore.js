const { v4: uuidv4 } = require('uuid');

const users = new Map();
const sessions = new Map();
const campaigns = new Map();
const jobs = new Map();

const DEV_USER = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'dev@launchpad.local',
  tier: 'studio',
  pitch_count: 0,
  campaign_count: 0,
};

function useMemory() {
  if (process.env.NODE_ENV === 'production') return false;
  if (process.env.USE_MEMORY_DB === 'true') return true;
  return !process.env.SUPABASE_SERVICE_KEY?.trim();
}

async function ensureUserProfile(userId) {
  if (!users.has(userId)) users.set(userId, { id: userId, tier: 'free', pitch_count: 0, campaign_count: 0 });
  return users.get(userId);
}

async function getUserProfile(userId) {
  return ensureUserProfile(userId);
}

async function saveSession(data) {
  const row = { id: uuidv4(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...data };
  sessions.set(row.id, row);
  return row;
}

async function getSession(id) {
  return sessions.get(id) ?? null;
}

async function updateSession(id, patch) {
  const row = sessions.get(id);
  if (!row) throw new Error('Session not found');
  const updated = { ...row, ...patch, updated_at: new Date().toISOString() };
  sessions.set(id, updated);
  return updated;
}

async function listSessions(userId) {
  return [...sessions.values()]
    .filter((s) => s.user_id === userId)
    .map(({ id, stage, concept_summary, created_at, updated_at }) => ({
      id,
      stage,
      concept_summary,
      created_at,
      updated_at,
    }));
}

async function saveCampaign(data) {
  const row = { id: uuidv4(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...data };
  campaigns.set(row.id, row);
  return row;
}

async function getCampaign(id) {
  return campaigns.get(id) ?? null;
}

async function updateCampaign(id, patch) {
  const row = campaigns.get(id);
  if (!row) throw new Error('Campaign not found');
  const updated = { ...row, ...patch, updated_at: new Date().toISOString() };
  campaigns.set(id, updated);
  return updated;
}

async function createJob(data) {
  const row = { id: uuidv4(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...data };
  jobs.set(row.id, row);
  return row;
}

async function getJob(id) {
  return jobs.get(id) ?? null;
}

async function updateJob(id, patch) {
  const row = jobs.get(id);
  if (!row) throw new Error('Job not found');
  const updated = { ...row, ...patch, updated_at: new Date().toISOString() };
  jobs.set(id, updated);
  return updated;
}

async function uploadFile(bucket, path, buffer, contentType) {
  return `https://memory.local/${bucket}/${path}`;
}

module.exports = {
  useMemory,
  DEV_USER,
  ensureUserProfile,
  getUserProfile,
  saveSession,
  getSession,
  updateSession,
  listSessions,
  saveCampaign,
  getCampaign,
  updateCampaign,
  createJob,
  getJob,
  updateJob,
  uploadFile,
};
