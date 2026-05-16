const { supabaseAdmin } = require('./supabase');
const memory = require('./memoryStore');

/**
 * Best-effort remove of known storage objects for a pitch session.
 */
async function removeSessionFiles(userId, sessionId) {
  if (memory.useMemory() || !supabaseAdmin) return;

  const pathsByBucket = {
    audio: [`${userId}/pitch-${sessionId}.mp3`, ...[0, 1, 2, 3, 4].map((i) => `${userId}/refine-q${i}.mp3`)],
    exports: [`${userId}/pitch-${sessionId}.pptx`],
  };

  for (const [bucket, paths] of Object.entries(pathsByBucket)) {
    const { error } = await supabaseAdmin.storage.from(bucket).remove(paths);
    if (error) console.warn(`Storage cleanup ${bucket}:`, error.message);
  }
}

async function removeCampaignFiles(userId, campaignId) {
  if (memory.useMemory() || !supabaseAdmin) return;

  const paths = [
    `${userId}/campaign-${campaignId}.mp3`,
    `${userId}/campaign-${campaignId}-banner.png`,
  ];
  const { error: audioErr } = await supabaseAdmin.storage.from('audio').remove([paths[0]]);
  if (audioErr) console.warn('Storage cleanup audio:', audioErr.message);
  const { error: imgErr } = await supabaseAdmin.storage.from('images').remove([paths[1]]);
  if (imgErr) console.warn('Storage cleanup images:', imgErr.message);
}

module.exports = { removeSessionFiles, removeCampaignFiles };
