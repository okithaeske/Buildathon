const { updateJob } = require('./supabase');

const PITCH_STAGES = [
  { key: 'queued', label: 'Queued' },
  { key: 'generating_content', label: 'Writing pitch deck, investor Q&A, and marketing copy…' },
  { key: 'generating_slide_images', label: 'Designing slide visuals…' },
  { key: 'generating_pdf', label: 'Building pitch deck PDF…' },
  { key: 'tts', label: 'Generating voiceover…' },
  { key: 'music', label: 'Creating background music…' },
  { key: 'mixing', label: 'Mixing audio…' },
  { key: 'uploading', label: 'Uploading pitch audio…' },
  { key: 'done', label: 'Complete' },
];

const CAMPAIGN_STAGES = [
  { key: 'queued', label: 'Queued' },
  { key: 'scraping_url', label: 'Reading product website…' },
  { key: 'generating_copy', label: 'Writing ad copy and captions…' },
  { key: 'generating_banner', label: 'Generating banner image…' },
  { key: 'generating_voice', label: 'Generating voiceover…' },
  { key: 'generating_music', label: 'Creating background music…' },
  { key: 'mixing_audio', label: 'Mixing campaign audio…' },
  { key: 'generating_video', label: 'Generating promo video…' },
  { key: 'done', label: 'Complete' },
];

const STAGES_BY_TYPE = {
  pitch: PITCH_STAGES,
  campaign: CAMPAIGN_STAGES,
};

/**
 * Update job progress for polling UI (GET /api/jobs/:jobId).
 */
async function setJobStage(jobId, type, stageKey, { status } = {}) {
  const patch = { progress: stageKey };
  if (status) patch.status = status;
  else if (stageKey !== 'queued') patch.status = 'processing';
  await updateJob(jobId, patch);
}

function getStagesForType(type) {
  return STAGES_BY_TYPE[type] ?? [];
}

function formatJobProgress(job) {
  const type = job.type;
  const stages = getStagesForType(type);
  const progress = job.progress || 'queued';
  const index = stages.findIndex((s) => s.key === progress);
  const progressIndex = index >= 0 ? index : 0;
  const pipelineEnd = Math.max(stages.length - 2, 1); // exclude terminal "done"
  let progressPercent = 0;
  if (progress === 'done') progressPercent = 100;
  else if (progress === 'failed') progressPercent = progressIndex > 0 ? Math.round((progressIndex / pipelineEnd) * 100) : 0;
  else progressPercent = Math.min(99, Math.round((progressIndex / pipelineEnd) * 100));

  return {
    progress,
    progressLabel: stages[progressIndex]?.label ?? progress,
    progressIndex,
    progressTotal: stages.length,
    progressPercent,
    stages: stages.map(({ key, label }) => ({ key, label })),
  };
}

function formatJobResponse(job) {
  return {
    jobId: job.id,
    type: job.type,
    status: job.status,
    result: job.result,
    error: job.error,
    ...formatJobProgress(job),
  };
}

module.exports = {
  PITCH_STAGES,
  CAMPAIGN_STAGES,
  setJobStage,
  formatJobProgress,
  formatJobResponse,
  getStagesForType,
};
