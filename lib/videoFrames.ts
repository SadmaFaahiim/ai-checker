import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import fs from "fs/promises";
import os from "os";
import path from "path";

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

/**
 * Extracts up to `count` evenly-spaced frames from a video file and returns
 * their raw JPEG buffers. Uses a scratch temp directory that is always
 * cleaned up, even if extraction or reading fails partway through.
 */
export async function extractFrames(
  videoPath: string,
  count = 8
): Promise<Buffer[]> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "frames-"));

  try {
    await new Promise<void>((resolve, reject) => {
      ffmpeg(videoPath)
        .on("end", () => resolve())
        .on("error", (err) => reject(err))
        .screenshots({
          count,
          folder: tmpDir,
          filename: "frame-%i.jpg",
        });
    });

    const files = (await fs.readdir(tmpDir)).sort();
    const buffers = await Promise.all(
      files.map((f) => fs.readFile(path.join(tmpDir, f)))
    );

    return buffers;
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}
