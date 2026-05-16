const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
const memory = require('./memoryStore');

const supabaseClientOptions = {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: ws },
};

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;
const memoryMode = memory.useMemory();

if (memoryMode) {
  console.warn('Using in-memory database (set SUPABASE_SERVICE_KEY for production)');
}

const supabaseAdmin = memoryMode ? null : createClient(supabaseUrl, serviceKey, supabaseClientOptions);

const supabaseAnon = memoryMode ? null : createClient(supabaseUrl, anonKey, supabaseClientOptions);

async function ensureUserProfile(userId) {
  if (memoryMode) return memory.ensureUserProfile(userId);
  const { data: existing } = await supabaseAdmin.from('users').select('*').eq('id', userId).single();
  if (existing) return existing;
  const { data, error } = await supabaseAdmin
    .from('users')
    .upsert({ id: userId, tier: 'free', pitch_count: 0, campaign_count: 0 })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function getUserProfile(userId) {
  if (memoryMode) return memory.getUserProfile(userId);
  const { data, error } = await supabaseAdmin.from('users').select('*').eq('id', userId).single();
  if (error && error.code !== 'PGRST116') throw error;
  if (!data) return ensureUserProfile(userId);
  return data;
}

async function saveSession(data) {
  if (memoryMode) return memory.saveSession(data);
  const { data: row, error } = await supabaseAdmin.from('sessions').insert(data).select().single();
  if (error) throw error;
  return row;
}

async function getSession(id) {
  if (memoryMode) return memory.getSession(id);
  const { data, error } = await supabaseAdmin.from('sessions').select('*').eq('id', id).single();
  if (error && error.code === 'PGRST116') return null;
  if (error) throw error;
  return data;
}

async function updateSession(id, patch) {
  if (memoryMode) return memory.updateSession(id, patch);
  const { data, error } = await supabaseAdmin
    .from('sessions')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function listSessions(userId) {
  if (memoryMode) return memory.listSessions(userId);
  const { data, error } = await supabaseAdmin
    .from('sessions')
    .select('id, stage, concept_summary, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data;
}

async function deleteSession(id) {
  if (memoryMode) {
    if (!memory.deleteSession(id)) {
      const err = new Error('Session not found');
      err.code = 'PGRST116';
      throw err;
    }
    return;
  }
  const { error: jobsError } = await supabaseAdmin.from('jobs').delete().eq('session_id', id);
  if (jobsError) throw jobsError;
  const { error } = await supabaseAdmin.from('sessions').delete().eq('id', id);
  if (error) throw error;
}

async function deleteCampaign(id) {
  if (memoryMode) {
    if (!memory.deleteCampaign(id)) {
      const err = new Error('Campaign not found');
      err.code = 'PGRST116';
      throw err;
    }
    return;
  }
  const { error: jobsError } = await supabaseAdmin.from('jobs').delete().eq('campaign_id', id);
  if (jobsError) throw jobsError;
  const { error } = await supabaseAdmin.from('campaigns').delete().eq('id', id);
  if (error) throw error;
}

async function saveCampaign(data) {
  if (memoryMode) return memory.saveCampaign(data);
  const { data: row, error } = await supabaseAdmin.from('campaigns').insert(data).select().single();
  if (error) throw error;
  return row;
}

async function getCampaign(id) {
  if (memoryMode) return memory.getCampaign(id);
  const { data, error } = await supabaseAdmin.from('campaigns').select('*').eq('id', id).single();
  if (error && error.code === 'PGRST116') return null;
  if (error) throw error;
  return data;
}

async function updateCampaign(id, patch) {
  if (memoryMode) return memory.updateCampaign(id, patch);
  const { data, error } = await supabaseAdmin
    .from('campaigns')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function createJob(data) {
  if (memoryMode) return memory.createJob(data);
  const { data: row, error } = await supabaseAdmin.from('jobs').insert(data).select().single();
  if (error) throw error;
  return row;
}

async function getJob(id) {
  if (memoryMode) return memory.getJob(id);
  const { data, error } = await supabaseAdmin.from('jobs').select('*').eq('id', id).single();
  if (error && error.code === 'PGRST116') return null;
  if (error) throw error;
  return data;
}

async function updateJob(id, patch) {
  if (memoryMode) return memory.updateJob(id, patch);
  const { data, error } = await supabaseAdmin
    .from('jobs')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function uploadFile(bucket, path, buffer, contentType) {
  if (memoryMode) return memory.uploadFile(bucket, path, buffer, contentType);
  const { data, error } = await supabaseAdmin.storage.from(bucket).upload(path, buffer, {
    contentType,
    upsert: true,
  });
  if (error) throw error;
  const { data: urlData } = supabaseAdmin.storage.from(bucket).getPublicUrl(data.path);
  return urlData.publicUrl;
}

module.exports = {
  supabaseAdmin,
  supabaseAnon,
  ensureUserProfile,
  getUserProfile,
  saveSession,
  getSession,
  updateSession,
  listSessions,
  deleteSession,
  saveCampaign,
  getCampaign,
  updateCampaign,
  deleteCampaign,
  createJob,
  getJob,
  updateJob,
  uploadFile,
};
