const fs = require('fs');
const path = require('path');
const {
  getJob,
  updateJob,
  getSession,
  updateSession,
  getCampaign,
  updateCampaign,
  uploadFile,
  supabaseAdmin,
} = require('./supabase');
const { chatComplete, textToSpeech, generateMusic, generateVideo } = require('./minimax');
const { generateImage } = require('./images');
const { mixAudio, createOutputPath } = require('./ffmpeg');
const { pitchDeckPrompt } = require('../prompts/pitch-deck');
const { investorQaPrompt } = require('../prompts/investor-qa');
const { marketingPrompt } = require('../prompts/marketing');
const { campaignPrompt } = require('../prompts/campaign');
const { parseJson } = require('../utils/parseJson');
const { isMock, fixtures } = require('../utils/mock');
const { setJobStage } = require('./jobStages');

async function processPitchJob(jobId) {
  const job = await getJob(jobId);
  if (!job || job.type !== 'pitch') return;

  try {
    await setJobStage(jobId, 'pitch', 'generating_content', { status: 'processing' });
    const session = await getSession(job.session_id);
    if (!session) throw new Error('Session not found');

    let pitchDeck, investorQA, marketingPack;

    if (isMock()) {
      pitchDeck = fixtures.pitchDeck;
      investorQA = fixtures.investorQA;
      marketingPack = fixtures.marketingPack;
    } else {
      const deckP = pitchDeckPrompt(session);
      const qaP = investorQaPrompt(session);
      const mktP = marketingPrompt(session);
      const [deckRaw, qaRaw, mktRaw] = await Promise.all([
        chatComplete(deckP.system, deckP.user),
        chatComplete(qaP.system, qaP.user),
        chatComplete(mktP.system, mktP.user),
      ]);
      pitchDeck = parseJson(deckRaw).pitchDeck ?? parseJson(deckRaw);
      investorQA = parseJson(qaRaw).investorQA ?? parseJson(qaRaw);
      marketingPack = parseJson(mktRaw).marketingPack ?? parseJson(mktRaw);
    }

    const narrative = pitchDeck.map((s) => `${s.title}: ${s.content}`).join('\n\n');
    let audioUrl = null;
    let audioWarning = null;

    if (isMock()) {
      audioUrl = 'https://example.com/audio/pitch-demo.mp3';
    } else {
      try {
        await setJobStage(jobId, 'pitch', 'tts');
        const voicePath = await textToSpeech(narrative);
        await setJobStage(jobId, 'pitch', 'music');
        const musicPath = await generateMusic('confident').catch((err) => {
          console.warn('Pitch music generation failed:', err.message);
          return null;
        });
        const outPath = createOutputPath('pitch-mix');
        await setJobStage(jobId, 'pitch', 'mixing');
        if (musicPath) {
          await mixAudio(voicePath, musicPath, outPath);
        } else if (fs.existsSync(voicePath)) {
          fs.copyFileSync(voicePath, outPath);
        }
        if (fs.existsSync(outPath)) {
          await setJobStage(jobId, 'pitch', 'uploading');
          const buffer = fs.readFileSync(outPath);
          audioUrl = await uploadFile('audio', `${job.user_id}/pitch-${job.session_id}.mp3`, buffer, 'audio/mpeg');
        }
      } catch (err) {
        console.warn('Pitch audio skipped:', err.message);
        audioWarning = err.message;
      }
    }

    const pitchOutput = { pitchDeck, investorQA, marketingPack };
    await updateSession(job.session_id, {
      stage: 'pitched',
      pitch_output: pitchOutput,
      audio_url: audioUrl,
    });

    await updateJob(jobId, {
      status: 'done',
      progress: 'done',
      result: { pitchDeck, investorQA, marketingPack, audioUrl, ...(audioWarning && { audioWarning }) },
    });

  } catch (err) {
    console.error('Pitch job failed:', err);
    await updateJob(jobId, { status: 'failed', error: err.message, progress: 'failed' });
  }
}

async function scrapeProductUrl(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'LaunchPadBot/1.0' },
      signal: AbortSignal.timeout(10000),
    });
    const html = await res.text();
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 8000);
  } catch {
    return '';
  }
}

async function processCampaignJob(jobId) {
  const job = await getJob(jobId);
  if (!job || job.type !== 'campaign') return;

  try {
    await setJobStage(jobId, 'campaign', 'generating_copy', { status: 'processing' });
    const campaign = await getCampaign(job.campaign_id);
    if (!campaign) throw new Error('Campaign not found');

    let productInfo = campaign.description || '';
    if (campaign.product_url) {
      await setJobStage(jobId, 'campaign', 'scraping_url');
      const scraped = await scrapeProductUrl(campaign.product_url);
      productInfo = `${productInfo}\n\nWebsite content:\n${scraped}`.trim();
      await setJobStage(jobId, 'campaign', 'generating_copy');
    }

    let copy;
    if (isMock()) {
      copy = fixtures.campaign;
    } else {
      const { system, user } = campaignPrompt(productInfo, campaign.tone);
      let raw = await chatComplete(system, user);
      try {
        copy = parseJson(raw);
      } catch (parseErr) {
        console.warn('Campaign JSON parse failed, retrying:', parseErr.message);
        raw = await chatComplete(
          `${system}\n\nYour last reply was not valid JSON. Return only one JSON object with real string values.`,
          user,
          { temperature: 0.3 }
        );
        copy = parseJson(raw);
      }
    }

    let bannerUrl = null;
    let audioUrl = null;
    let videoUrl = null;

    if (isMock()) {
      bannerUrl = copy.bannerUrl ?? fixtures.campaign.bannerUrl;
      audioUrl = copy.audioUrl ?? fixtures.campaign.audioUrl;
    } else {
      await setJobStage(jobId, 'campaign', 'generating_banner');
      bannerUrl = await generateImage(
        `Professional ad banner for: ${productInfo.slice(0, 200)}`,
        '1200x630',
        {
          userId: job.user_id,
          storagePath: `${job.user_id}/campaign-${campaign.id}-banner.png`,
        }
      ).catch((err) => {
        console.warn('Banner generation failed:', err.message);
        return null;
      });

      await setJobStage(jobId, 'campaign', 'generating_voice');
      const voicePath = await textToSpeech(copy.adScript).catch(() => null);

      if (voicePath) {
        await setJobStage(jobId, 'campaign', 'generating_music');
        const musicPath = await generateMusic(campaign.tone).catch(() => null);
        const outPath = createOutputPath('campaign-mix');
        await setJobStage(jobId, 'campaign', 'mixing_audio');
        if (musicPath) await mixAudio(voicePath, musicPath, outPath);
        else if (fs.existsSync(voicePath)) fs.copyFileSync(voicePath, outPath);
        if (fs.existsSync(outPath)) {
          const buffer = fs.readFileSync(outPath);
          audioUrl = await uploadFile(
            'audio',
            `${job.user_id}/campaign-${campaign.id}.mp3`,
            buffer,
            'audio/mpeg'
          );
        }
      }

      await setJobStage(jobId, 'campaign', 'generating_video');
      videoUrl = await generateVideo(`Short promo video: ${copy.adScript?.slice(0, 200)}`);
    }

    const updated = await updateCampaign(campaign.id, {
      status: 'done',
      ad_script: copy.adScript,
      taglines: copy.taglines,
      captions: copy.captions,
      email_copy: copy.emailCopy,
      hero_copy: copy.heroCopy,
      banner_url: bannerUrl,
      audio_url: audioUrl,
      video_url: videoUrl,
    });

    await updateJob(jobId, {
      status: 'done',
      progress: 'done',
      result: {
        campaignId: campaign.id,
        adScript: updated.ad_script,
        taglines: updated.taglines,
        captions: updated.captions,
        emailCopy: updated.email_copy,
        heroCopy: updated.hero_copy,
        videoUrl: updated.video_url,
        bannerUrl: updated.banner_url,
        audioUrl: updated.audio_url,
      },
    });
  } catch (err) {
    console.error('Campaign job failed:', err);
    await updateJob(jobId, { status: 'failed', error: err.message, progress: 'failed' });
    if (job.campaign_id) {
      await updateCampaign(job.campaign_id, { status: 'failed' }).catch(() => {});
    }
  }
}

function enqueueJob(jobId, type) {
  setImmediate(() => {
    if (type === 'pitch') processPitchJob(jobId);
    else if (type === 'campaign') processCampaignJob(jobId);
  });
}

module.exports = { processPitchJob, processCampaignJob, enqueueJob };
