const express = require('express');
const archiver = require('archiver');
const { asyncHandler } = require('../middleware/errorHandler');
const { assertCampaignOwner } = require('../middleware/auth');
const { saveCampaign, getCampaign, createJob } = require('../services/supabase');
const { enqueueJob } = require('../services/jobs');

const VALID_TONES = ['energetic', 'professional', 'emotional', 'funny'];

const router = express.Router();

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { productUrl, description, tone } = req.body;
    if (!description?.trim()) {
      return res.status(400).json({ error: 'VALIDATION', message: 'description is required' });
    }
    if (!tone || !VALID_TONES.includes(tone)) {
      return res.status(400).json({
        error: 'VALIDATION',
        message: `tone must be one of: ${VALID_TONES.join(', ')}`,
      });
    }

    const campaign = await saveCampaign({
      user_id: req.user.id,
      product_url: productUrl || null,
      description,
      tone,
      status: 'processing',
    });

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
    });
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
    };

    archive.append(JSON.stringify(manifest, null, 2), { name: 'campaign.json' });
    if (campaign.ad_script) archive.append(campaign.ad_script, { name: 'ad-script.txt' });
    if (campaign.email_copy) archive.append(campaign.email_copy, { name: 'email.txt' });
    if (campaign.hero_copy) archive.append(campaign.hero_copy, { name: 'hero-copy.txt' });

    await archive.finalize();
  })
);

module.exports = router;
