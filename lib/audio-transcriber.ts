import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import { dir } from "tmp-promise";
import type { FfmpegCommand } from "fluent-ffmpeg";
import { saveTranscript } from "./transcript-handler";
import { resolveLiveStreamUrlWithRetry } from "./tiktok-stream-url";
import { transcribeAudioFile } from "./whisper-transcribe";

const CHUNK_SECONDS = 7;
const CHUNK_GLOB = /^chunk_\d+\.mp3$/;

type AudioTranscriberState = {
  active: boolean;
  tmpDir: string | null;
  cleanupTmp: (() => Promise<void>) | null;
  ffmpegCommand: FfmpegCommand | null;
  watcher: fs.FSWatcher | null;
  processing: Promise<void>;
  processedFiles: Set<string>;
  processingQueue: string[];
  isProcessingQueue: boolean;
};

const globalForAudio = globalThis as typeof globalThis & {
  __audioTranscriberState?: AudioTranscriberState;
};

function getState(): AudioTranscriberState {
  if (!globalForAudio.__audioTranscriberState) {
    globalForAudio.__audioTranscriberState = {
      active: false,
      tmpDir: null,
      cleanupTmp: null,
      ffmpegCommand: null,
      watcher: null,
      processing: Promise.resolve(),
      processedFiles: new Set(),
      processingQueue: [],
      isProcessingQueue: false,
    };
  }
  return globalForAudio.__audioTranscriberState;
}

function configureFfmpeg(): void {
  if (ffmpegStatic) {
    ffmpeg.setFfmpegPath(ffmpegStatic);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForStableFile(filePath: string): Promise<boolean> {
  let lastSize = -1;

  for (let attempt = 0; attempt < 12; attempt += 1) {
    await sleep(250);

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

async function processChunkFile(filePath: string): Promise<void> {
  const fileName = path.basename(filePath);
  console.info(`[Audio] Chunk created: ${fileName}`);

  const stable = await waitForStableFile(filePath);
  if (!stable) {
    console.error(`[Audio] Error: Chunk not stable ${fileName}`);
    return;
  }

  const original = await transcribeAudioFile(filePath);
  await safeUnlink(filePath);

  if (!original.trim()) {
    return;
  }

  await saveTranscript(original);
}

async function drainProcessingQueue(state: AudioTranscriberState): Promise<void> {
  if (state.isProcessingQueue) {
    return;
  }

  state.isProcessingQueue = true;

  while (state.processingQueue.length > 0 && state.active) {
    const filePath = state.processingQueue.shift();
    if (!filePath) {
      continue;
    }

    try {
      await processChunkFile(filePath);
    } catch (error) {
      console.error("[Audio] Error: Chunk processing failed", error);
      await safeUnlink(filePath);
    }
  }

  state.isProcessingQueue = false;
}

function enqueueChunk(filePath: string): void {
  const state = getState();

  if (!state.active || state.processedFiles.has(filePath)) {
    return;
  }

  state.processedFiles.add(filePath);
  state.processingQueue.push(filePath);
  state.processing = state.processing.then(() => drainProcessingQueue(state));
}

function watchChunkDirectory(tmpDir: string): void {
  const state = getState();

  state.watcher = fs.watch(tmpDir, (_event, filename) => {
    if (!filename || !CHUNK_GLOB.test(filename)) {
      return;
    }

    const fullPath = path.join(tmpDir, filename);
    enqueueChunk(fullPath);
  });
}

function startFfmpegSegmenter(streamUrl: string, outputPattern: string): FfmpegCommand {
  const command = ffmpeg(streamUrl)
    .inputOptions(["-reconnect 1", "-reconnect_streamed 1", "-reconnect_delay_max 5"])
    .noVideo()
    .audioChannels(1)
    .audioFrequency(16000)
    .audioCodec("libmp3lame")
    .audioBitrate("64k")
    .outputOptions([
      "-f segment",
      `-segment_time ${CHUNK_SECONDS}`,
      "-reset_timestamps 1",
    ])
    .output(outputPattern)
    .on("start", () => {
      console.info("[Audio] FFmpeg started");
    })
    .on("error", (error) => {
      console.error("[Audio] Error: FFmpeg failed", error.message);
    });

  command.run();
  return command;
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

  state.active = true;
  state.tmpDir = tmp.path;
  state.cleanupTmp = tmp.cleanup;
  state.processedFiles.clear();
  state.processingQueue = [];

  const outputPattern = path.join(tmp.path, "chunk_%03d.mp3");

  try {
    watchChunkDirectory(tmp.path);
    state.ffmpegCommand = startFfmpegSegmenter(streamUrl, outputPattern);
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

  state.active = false;

  if (state.watcher) {
    state.watcher.close();
    state.watcher = null;
  }

  if (state.ffmpegCommand) {
    try {
      state.ffmpegCommand.kill("SIGTERM");
    } catch (error) {
      console.error("[Audio] Error: Failed to stop FFmpeg", error);
    }
    state.ffmpegCommand = null;
  }

  await state.processing.catch(() => undefined);

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
  state.processedFiles.clear();
  state.processingQueue = [];
  state.isProcessingQueue = false;
  state.processing = Promise.resolve();

  console.info("[Audio] Audio transcription stopped");
}
