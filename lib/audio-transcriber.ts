import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import { dir } from "tmp-promise";
import type { FfmpegCommand } from "fluent-ffmpeg";
import { saveTranscript } from "./transcript-handler";
import { resolveLiveStreamUrlWithRetry } from "./tiktok-stream-url";
import { transcribeAudioFile } from "./whisper-transcribe";

const CHUNK_SECONDS = 7;
const CHUNK_GLOB = /^chunk_\d+\.mp3$/;
const POLL_INTERVAL_MS = 1000;
const STABLE_CHECK_INTERVAL_MS = 250;
const STABLE_CHECK_MAX_ATTEMPTS = 12;
const FFMPEG_RESTART_DELAY_MS = 3000;

type AudioTranscriberState = {
  active: boolean;
  stoppingIntentionally: boolean;
  tmpDir: string | null;
  cleanupTmp: (() => Promise<void>) | null;
  ffmpegCommand: FfmpegCommand | null;
  liveUrl: string | null;
  streamUrl: string | null;
  outputPattern: string | null;
  processedFilenames: Set<string>;
  pollLoopPromise: Promise<void> | null;
  isRestartingFfmpeg: boolean;
};

const globalForAudio = globalThis as typeof globalThis & {
  __audioTranscriberState?: AudioTranscriberState;
};

function getState(): AudioTranscriberState {
  if (!globalForAudio.__audioTranscriberState) {
    globalForAudio.__audioTranscriberState = {
      active: false,
      stoppingIntentionally: false,
      tmpDir: null,
      cleanupTmp: null,
      ffmpegCommand: null,
      liveUrl: null,
      streamUrl: null,
      outputPattern: null,
      processedFilenames: new Set(),
      pollLoopPromise: null,
      isRestartingFfmpeg: false,
    };
  }
  return globalForAudio.__audioTranscriberState;
}

function resolveFfmpegPath(): string {
  if (fs.existsSync("/usr/bin/ffmpeg")) {
    return "/usr/bin/ffmpeg";
  }

  const fromEnv = process.env.FFMPEG_PATH?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  return "ffmpeg";
}

function configureFfmpeg(): void {
  const ffmpegPath = resolveFfmpegPath();
  ffmpeg.setFfmpegPath(ffmpegPath);
  console.info("[Audio] Using FFmpeg:", ffmpegPath);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseChunkIndex(fileName: string): number {
  const match = /^chunk_(\d+)\.mp3$/.exec(fileName);
  return match ? Number.parseInt(match[1], 10) : -1;
}

function getNextSegmentStartNumber(tmpDir: string): number {
  try {
    const files = fs.readdirSync(tmpDir).filter((name) => CHUNK_GLOB.test(name));
    let maxIndex = -1;
    for (const fileName of files) {
      maxIndex = Math.max(maxIndex, parseChunkIndex(fileName));
    }
    return maxIndex + 1;
  } catch {
    return 0;
  }
}

async function waitForStableFile(filePath: string): Promise<boolean> {
  let lastSize = -1;

  for (let attempt = 0; attempt < STABLE_CHECK_MAX_ATTEMPTS; attempt += 1) {
    await sleep(STABLE_CHECK_INTERVAL_MS);

    try {
      const stat = await fs.promises.stat(filePath);
      if (stat.size > 0 && stat.size === lastSize) {
        return true;
      }
      lastSize = stat.size;
    } catch {
      return false;
    }
  }

  return false;
}

async function safeUnlink(filePath: string): Promise<void> {
  try {
    await fs.promises.unlink(filePath);
  } catch {
    // ignore missing files
  }
}

async function processChunkFile(filePath: string, fileName: string): Promise<void> {
  const state = getState();

  if (!state.active || state.processedFilenames.has(fileName)) {
    return;
  }

  console.info(`[Audio] Chunk created: ${fileName}`);

  const stable = await waitForStableFile(filePath);
  if (!stable) {
    return;
  }

  state.processedFilenames.add(fileName);

  const original = await transcribeAudioFile(filePath);
  await safeUnlink(filePath);

  if (!original.trim()) {
    return;
  }

  await saveTranscript(original);
  console.info("[Audio] Transcript stored");
}

async function scanAndProcessChunks(): Promise<void> {
  const state = getState();
  const tmpDir = state.tmpDir;

  if (!state.active || !tmpDir) {
    return;
  }

  let fileNames: string[];
  try {
    fileNames = (await fs.promises.readdir(tmpDir))
      .filter((name) => CHUNK_GLOB.test(name))
      .sort((a, b) => parseChunkIndex(a) - parseChunkIndex(b));
  } catch {
    return;
  }

  for (const fileName of fileNames) {
    if (!state.active) {
      return;
    }
    if (state.processedFilenames.has(fileName)) {
      continue;
    }

    try {
      await processChunkFile(path.join(tmpDir, fileName), fileName);
    } catch (error) {
      console.error("[Audio] Error: Chunk processing failed", error);
      await safeUnlink(path.join(tmpDir, fileName));
    }
  }
}

async function runPollLoop(): Promise<void> {
  const state = getState();

  while (state.active) {
    try {
      await scanAndProcessChunks();
    } catch (error) {
      console.error("[Audio] Error: Chunk scan failed", error);
    }

    if (!state.active) {
      break;
    }

    await sleep(POLL_INTERVAL_MS);
  }
}

function attachFfmpegHandlers(command: FfmpegCommand): void {
  const state = getState();

  command.on("start", () => {
    console.info("[Audio] FFmpeg started");
  });

  command.on("end", () => {
    if (!state.active || state.stoppingIntentionally) {
      console.info("[Audio] FFmpeg shutdown (normal)");
      return;
    }
    console.warn("[Audio] FFmpeg ended while stream active; scheduling restart");
    void scheduleFfmpegRestart();
  });

  command.on("error", (error) => {
    if (state.stoppingIntentionally) {
      console.info("[Audio] FFmpeg shutdown (normal)");
      return;
    }
    if (!state.active) {
      return;
    }

    const message = error.message ?? "";
    const looksLikeNormalStop =
      /code\s*255/i.test(message) ||
      /signal\s*15/i.test(message) ||
      /SIGTERM/i.test(message);

    if (looksLikeNormalStop) {
      console.info("[Audio] FFmpeg shutdown (normal)");
      return;
    }

    console.error("[Audio] Error: FFmpeg failed", message);
    void scheduleFfmpegRestart();
  });
}

async function scheduleFfmpegRestart(): Promise<void> {
  const state = getState();

  if (!state.active || state.stoppingIntentionally || state.isRestartingFfmpeg) {
    return;
  }

  state.isRestartingFfmpeg = true;

  try {
    await sleep(FFMPEG_RESTART_DELAY_MS);

    if (!state.active || state.stoppingIntentionally || !state.outputPattern || !state.tmpDir) {
      return;
    }

    if (state.ffmpegCommand) {
      try {
        state.ffmpegCommand.removeAllListeners();
        state.ffmpegCommand.kill("SIGTERM");
      } catch {
        // ignore
      }
      state.ffmpegCommand = null;
    }

    const streamUrl =
      (await resolveLiveStreamUrlWithRetry()) ?? state.streamUrl ?? undefined;
    if (!streamUrl) {
      console.error("[Audio] Error: Could not resolve stream URL for FFmpeg restart");
      return;
    }

    state.streamUrl = streamUrl;
    const segmentStart = getNextSegmentStartNumber(state.tmpDir);
    console.info(`[Audio] Restarting FFmpeg (segment_start_number=${segmentStart})`);
    state.ffmpegCommand = startFfmpegSegmenter(
      streamUrl,
      state.outputPattern,
      segmentStart,
    );
  } finally {
    state.isRestartingFfmpeg = false;
  }
}

function startFfmpegSegmenter(
  streamUrl: string,
  outputPattern: string,
  segmentStartNumber = 0,
): FfmpegCommand {
  const command = ffmpeg(streamUrl)
    .inputOptions([
      "-reconnect 1",
      "-reconnect_streamed 1",
      "-reconnect_delay_max 5",
    ])
    .noVideo()
    .audioChannels(1)
    .audioFrequency(16000)
    .audioCodec("libmp3lame")
    .audioBitrate("64k")
    .outputOptions([
      "-f segment",
      "-segment_format mp3",
      `-segment_time ${CHUNK_SECONDS}`,
      "-reset_timestamps 1",
      `-segment_start_number ${segmentStartNumber}`,
    ])
    .output(outputPattern);

  attachFfmpegHandlers(command);
  command.run();
  return command;
}

function killFfmpegCommand(): void {
  const state = getState();

  if (!state.ffmpegCommand) {
    return;
  }

  try {
    state.ffmpegCommand.removeAllListeners();
    state.ffmpegCommand.kill("SIGTERM");
  } catch (error) {
    console.error("[Audio] Error: Failed to stop FFmpeg", error);
  }

  state.ffmpegCommand = null;
}

export async function startAudioTranscription(liveUrl: string): Promise<void> {
  await stopAudioTranscription();

  console.info(`[Audio] Resolving stream URL for ${liveUrl}`);

  const streamUrl = await resolveLiveStreamUrlWithRetry();
  if (!streamUrl) {
    console.error(
      `[Audio] Error: Could not resolve stream URL for live: ${liveUrl}`,
    );
    return;
  }

  console.info("[Audio] Stream URL found");

  configureFfmpeg();

  const state = getState();
  const tmp = await dir({ prefix: "tiktok-audio-", unsafeCleanup: true });
  const outputPattern = path.join(tmp.path, "chunk_%03d.mp3");

  state.active = true;
  state.stoppingIntentionally = false;
  state.liveUrl = liveUrl;
  state.streamUrl = streamUrl;
  state.tmpDir = tmp.path;
  state.cleanupTmp = tmp.cleanup;
  state.outputPattern = outputPattern;
  state.processedFilenames.clear();

  try {
    state.ffmpegCommand = startFfmpegSegmenter(streamUrl, outputPattern, 0);
    state.pollLoopPromise = runPollLoop();
    console.info("[Audio] Audio transcription pipeline started");
  } catch (error) {
    console.error("[Audio] Error: Failed to start transcription", error);
    await stopAudioTranscription();
  }
}

export async function stopAudioTranscription(): Promise<void> {
  const state = getState();

  if (!state.active && !state.ffmpegCommand && !state.tmpDir) {
    return;
  }

  state.stoppingIntentionally = true;
  state.active = false;

  killFfmpegCommand();

  if (state.pollLoopPromise) {
    await state.pollLoopPromise.catch(() => undefined);
    state.pollLoopPromise = null;
  }

  if (state.tmpDir) {
    try {
      const files = await fs.promises.readdir(state.tmpDir);
      await Promise.all(
        files.map((file) => safeUnlink(path.join(state.tmpDir!, file))),
      );
    } catch {
      // ignore
    }
  }

  if (state.cleanupTmp) {
    try {
      await state.cleanupTmp();
    } catch (error) {
      console.error("[Audio] Error: Temp directory cleanup failed", error);
    }
  }

  state.tmpDir = null;
  state.cleanupTmp = null;
  state.liveUrl = null;
  state.streamUrl = null;
  state.outputPattern = null;
  state.processedFilenames.clear();
  state.isRestartingFfmpeg = false;
  state.stoppingIntentionally = false;

  console.info("[Audio] Audio transcription stopped");
}
