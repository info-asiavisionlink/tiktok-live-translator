import { type ChildProcess, spawn } from "node:child_process";
import { resolveFfmpegPath } from "./stream-probe";
import {
  OpenAiRealtimeTranscriber,
  REALTIME_PCM_SAMPLE_RATE,
} from "./openai-realtime-transcriber";

const PCM_CHUNK_BYTES = REALTIME_PCM_SAMPLE_RATE * 2 * 0.1;

export type PcmPipeProcess = ChildProcess;

export function startPcmAudioPipe(
  streamUrl: string,
  onPcmChunk: (chunk: Buffer) => void,
  onError: (error: Error) => void,
): PcmPipeProcess {
  const isHls = streamUrl.toLowerCase().includes(".m3u8");
  const args = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-reconnect",
    "1",
    "-reconnect_streamed",
    "1",
    "-reconnect_delay_max",
    "5",
    "-user_agent",
    "Mozilla/5.0",
    "-analyzeduration",
    "10000000",
    "-probesize",
    "10000000",
  ];

  if (isHls) {
    args.push("-live_start_index", "0");
  }

  args.push(
    "-i",
    streamUrl,
    "-vn",
    "-acodec",
    "pcm_s16le",
    "-ac",
    "1",
    "-ar",
    String(REALTIME_PCM_SAMPLE_RATE),
    "-f",
    "s16le",
    "pipe:1",
  );

  const process = spawn(resolveFfmpegPath(), args, {
    stdio: ["ignore", "pipe", "pipe"],
  });

  let pending = Buffer.alloc(0);

  process.stdout?.on("data", (data: Buffer) => {
    pending = Buffer.concat([pending, data]);

    while (pending.length >= PCM_CHUNK_BYTES) {
      const chunk = pending.subarray(0, PCM_CHUNK_BYTES);
      pending = pending.subarray(PCM_CHUNK_BYTES);
      onPcmChunk(chunk);
    }
  });

  process.stderr?.on("data", (data: Buffer) => {
    const message = data.toString("utf8").trim();
    if (message) {
      console.error("[Audio] FFmpeg PCM stderr:", message);
    }
  });

  process.on("error", (error) => {
    onError(error);
  });

  process.on("close", (code, signal) => {
    if (pending.length > 0) {
      onPcmChunk(pending);
      pending = Buffer.alloc(0);
    }

    if (code !== 0 && code !== null && signal !== "SIGTERM") {
      onError(new Error(`FFmpeg PCM pipe exited with code ${code}`));
    }
  });

  console.info(
    `[Audio] PCM pipe started (${REALTIME_PCM_SAMPLE_RATE}Hz mono s16le)`,
  );

  return process;
}

export function stopPcmAudioPipe(process: PcmPipeProcess | null): void {
  if (!process) {
    return;
  }

  try {
    process.kill("SIGTERM");
  } catch {
    // ignore
  }
}

export function pipePcmToRealtime(
  streamUrl: string,
  transcriber: OpenAiRealtimeTranscriber,
  onFatalError: (error: Error) => void,
): PcmPipeProcess {
  return startPcmAudioPipe(
    streamUrl,
    (chunk) => transcriber.appendAudio(chunk),
    onFatalError,
  );
}
