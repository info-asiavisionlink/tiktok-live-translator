import { execFile } from "node:child_process";
import fs from "node:fs";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const PROBE_TIMEOUT_MS = 20_000;

export function resolveFfmpegPath(): string {
  if (fs.existsSync("/usr/bin/ffmpeg")) {
    return "/usr/bin/ffmpeg";
  }

  const fromEnv = process.env.FFMPEG_PATH?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  return "ffmpeg";
}

export function resolveFfprobePath(): string {
  const fromEnv = process.env.FFPROBE_PATH?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  if (fs.existsSync("/usr/bin/ffprobe")) {
    return "/usr/bin/ffprobe";
  }

  const ffmpegPath = resolveFfmpegPath();
  if (ffmpegPath.endsWith("ffmpeg")) {
    const sibling = `${ffmpegPath.slice(0, -6)}ffprobe`;
    if (fs.existsSync(sibling)) {
      return sibling;
    }
  }

  return "ffprobe";
}

function stderrFromExecError(error: unknown): string {
  if (
    error &&
    typeof error === "object" &&
    "stderr" in error &&
    error.stderr != null
  ) {
    const stderr = error.stderr;
    return Buffer.isBuffer(stderr) ? stderr.toString("utf8") : String(stderr);
  }
  return "";
}

async function probeWithFfprobe(url: string): Promise<boolean> {
  const ffprobe = resolveFfprobePath();

  const { stdout } = await execFileAsync(
    ffprobe,
    [
      "-v",
      "error",
      "-select_streams",
      "a",
      "-show_entries",
      "stream=codec_type",
      "-of",
      "csv=p=0",
      "-analyzeduration",
      "10000000",
      "-probesize",
      "10000000",
      "-user_agent",
      "Mozilla/5.0",
      url,
    ],
    { timeout: PROBE_TIMEOUT_MS, maxBuffer: 1024 * 1024 },
  );

  return stdout
    .trim()
    .split("\n")
    .some((line) => line.trim().toLowerCase() === "audio");
}

async function probeWithFfmpeg(url: string): Promise<boolean> {
  const ffmpeg = resolveFfmpegPath();

  try {
    await execFileAsync(
      ffmpeg,
      [
        "-v",
        "error",
        "-hide_banner",
        "-analyzeduration",
        "10000000",
        "-probesize",
        "10000000",
        "-user_agent",
        "Mozilla/5.0",
        "-i",
        url,
      ],
      { timeout: PROBE_TIMEOUT_MS, maxBuffer: 4 * 1024 * 1024 },
    );
    return false;
  } catch (error) {
    const output = stderrFromExecError(error);
    return /Stream #\d+:\d+.*Audio:|Audio:/i.test(output);
  }
}

export async function streamHasAudioStream(url: string): Promise<boolean> {
  try {
    return await probeWithFfprobe(url);
  } catch {
    try {
      return await probeWithFfmpeg(url);
    } catch {
      return false;
    }
  }
}
