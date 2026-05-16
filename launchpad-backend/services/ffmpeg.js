const { execFile } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');
const { getTempDir } = require('./minimax');

const execFileAsync = promisify(execFile);

async function mixAudio(voicePath, musicPath, outputPath) {
  const hasVoice = fs.existsSync(voicePath) && fs.statSync(voicePath).size > 0;
  const hasMusic = fs.existsSync(musicPath) && fs.statSync(musicPath).size > 0;

  if (!hasVoice && !hasMusic) {
    fs.writeFileSync(outputPath, Buffer.alloc(0));
    return outputPath;
  }

  if (hasVoice && !hasMusic) {
    fs.copyFileSync(voicePath, outputPath);
    return outputPath;
  }

  if (!hasVoice && hasMusic) {
    fs.copyFileSync(musicPath, outputPath);
    return outputPath;
  }

  await execFileAsync('ffmpeg', [
    '-y',
    '-i', voicePath,
    '-i', musicPath,
    '-filter_complex', '[1:a]volume=0.15[music];[0:a][music]amix=inputs=2:duration=first',
    '-c:a', 'libmp3lame',
    outputPath,
  ]);

  return outputPath;
}

async function muxVideoAudio(videoPath, audioPath, outputPath) {
  if (!fs.existsSync(videoPath)) {
    if (fs.existsSync(audioPath)) fs.copyFileSync(audioPath, outputPath);
    return outputPath;
  }

  await execFileAsync('ffmpeg', [
    '-y',
    '-i', videoPath,
    '-i', audioPath,
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-shortest',
    outputPath,
  ]);

  return outputPath;
}

function createOutputPath(prefix) {
  return path.join(getTempDir(), `${prefix}-${Date.now()}.mp3`);
}

module.exports = { mixAudio, muxVideoAudio, createOutputPath };
