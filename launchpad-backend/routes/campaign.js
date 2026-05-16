const express = require('express');
const multer = require('multer');
const archiver = require('archiver');
const { asyncHandler } = require('../middleware/errorHandler');
const { assertCampaignOwner } = require('../middleware/auth');
const {
  saveCampaign,
  getCampaign,
  updateCampaign,
  createJob,
  deleteCampaign,
  deleteAllCampaignsForUser,
  listCampaignIds,
  uploadFile,
} = require('../services/supabase');
const { removeCampaignFiles } = require('../services/deleteResources');
const { enqueueJob } = require('../services/jobs');
const { getStagesForType } = require('../services/jobStages');

const VALID_TONES = ['energetic', 'professional', 'emotional', 'funny'];
const MAX_REFERENCE_IMAGE_BYTES = 5 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_REFERENCE_IMAGE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype?.startsWith('image/')) {
      cb(new Error('referenceImage must be an image (jpeg, png, or webp)'));
      return;
    }
    cb(null, true);
  },
});

function optionalReferenceUpload(req, res, next) {
  if (req.is('multipart/form-data')) {
    return upload.single('referenceImage')(req, res, (err) => {
      if (err?.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          error: 'VALIDATION',
          message: `referenceImage must be under ${MAX_REFERENCE_IMAGE_BYTES / 1024 / 1024}MB`,
        });
      }
      if (err) {
        return res.status(400).json({ error: 'VALIDATION', message: err.message });
      }
      next();
    });
  }
  next();
}

function refExtension(mimetype) {
  if (mimetype === 'image/png') return 'png';
  if (mimetype === 'image/webp') return 'webp';
  return 'jpg';
}

const router = express.Router();

router.post(
  '/',
  optionalReferenceUpload,
  asyncHandler(async (req, res) => {
    const { productUrl, description, tone, referenceImageUrl } = req.body;
    if (!description?.trim()) {
      return res.status(400).json({ error: 'VALIDATION', message: 'description is required' });
    }
    if (!tone || !VALID_TONES.includes(tone)) {
      return res.status(400).json({
        error: 'VALIDATION',
        message: `tone must be one of: ${VALID_TONES.join(', ')}`,
      });
    }

    let refUrl = typeof referenceImageUrl === 'string' ? referenceImageUrl.trim() || null : null;

    const campaign = await saveCampaign({
      user_id: req.user.id,
      product_url: productUrl || null,
      description,
      tone,
      reference_image_url: refUrl,
      status: 'processing',
    });

    if (req.file) {
      const ext = refExtension(req.file.mimetype);
      refUrl = await uploadFile(
        'images',
        `${req.user.id}/campaign-${campaign.id}-ref.${ext}`,
        req.file.buffer,
        req.file.mimetype
      );
      await updateCampaign(campaign.id, { reference_image_url: refUrl });
    }

    const job = await createJob({
      user_id: req.user.id,
      type: 'campaign',
      campaign_id: campaign.id,
      status: 'queued',
      progress: 'queued',
    });

    enqueueJob(job.id, 'campaign');

    res.status(202).json({
      jobId: job.id,
      campaignId: campaign.id,
      status: 'processing',
      progress: 'queued',
      referenceImageUrl: refUrl,
      stages: getStagesForType('campaign').map(({ key, label }) => ({ key, label })),
    });
  })
);

router.delete(
  '/',
  asyncHandler(async (req, res) => {
    const ids = await listCampaignIds(req.user.id);

    await Promise.all(
      ids.map((id) =>
        removeCampaignFiles(req.user.id, id).catch((err) =>
          console.warn('Bulk campaign file cleanup failed:', err.message)
        )
      )
    );

    const deletedIds = await deleteAllCampaignsForUser(req.user.id);

    res.json({
      ok: true,
      deletedCount: deletedIds.length,
      deletedIds,
    });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const campaign = await getCampaign(req.params.id);
    assertCampaignOwner(campaign, req.user.id);

    await removeCampaignFiles(req.user.id, campaign.id);
    await deleteCampaign(campaign.id);

    res.json({ ok: true, deletedId: campaign.id });
  })
);

router.get(
  '/:id/download',
  asyncHandler(async (req, res) => {
    const campaign = await getCampaign(req.params.id);
    assertCampaignOwner(campaign, req.user.id);

    if (campaign.status !== 'done') {
      return res.status(409).json({ error: 'NOT_READY', message: 'Campaign is still processing' });
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="campaign-${campaign.id}.zip"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);

    const manifest = {
      adScript: campaign.ad_script,
      taglines: campaign.taglines,
      captions: campaign.captions,
      emailCopy: campaign.email_copy,
      heroCopy: campaign.hero_copy,
      videoUrl: campaign.video_url,
      bannerUrl: campaign.banner_url,
      audioUrl: campaign.audio_url,
      referenceImageUrl: campaign.reference_image_url,
    };

    archive.append(JSON.stringify(manifest, null, 2), { name: 'campaign.json' });
    if (campaign.ad_script) archive.append(campaign.ad_script, { name: 'ad-script.txt' });
    if (campaign.email_copy) archive.append(campaign.email_copy, { name: 'email.txt' });
    if (campaign.hero_copy) archive.append(campaign.hero_copy, { name: 'hero-copy.txt' });

    await archive.finalize();
  })
);

module.exports = router;
