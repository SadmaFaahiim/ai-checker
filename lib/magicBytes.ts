/**
 * Magic-byte validation for uploaded files (TASKS.md R3).
 *
 * Upload routes previously trusted the client-declared `Content-Type` from the
 * multipart form, which is trivially spoofable. These helpers sniff the actual
 * file signature and reject payloads whose bytes do not match the declared
 * MIME type, before the buffer ever reaches a provider.
 */

/** Friendly label for a recognized file signature. */
export type FileFormat =
  | "JPEG"
  | "PNG"
  | "MP3"
  | "WAV"
  | "MP4"
  | "OGG"
  | "FLAC"
  | "WebM";

export interface MagicBytesResult {
  /** true when the actual bytes are consistent with the declared MIME type. */
  ok: boolean;
  /** Signature detected from the leading bytes, or null when unrecognized. */
  detected: FileFormat | null;
  /** Human-readable rejection reason; present only when ok is false. */
  reason?: string;
}

/**
 * Identify a file's format from its leading magic bytes.
 * Returns null when the buffer is too short or matches no known signature.
 */
export function detectMagicBytes(buffer: Buffer): FileFormat | null {
  if (buffer.length < 12) return null;

  const startsWith = (...bytes: number[]) =>
    bytes.every((b, i) => buffer[i] === b);
  const hasAscii = (text: string, offset: number) =>
    buffer
      .subarray(offset, offset + text.length)
      .toString("latin1") === text;

  // Images
  if (startsWith(0xff, 0xd8, 0xff)) return "JPEG";
  if (startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "PNG";

  // Audio
  if (hasAscii("ID3", 0)) return "MP3";
  // MPEG audio frame sync: 0xFF followed by 111x xxxx (covers FFFB/FFF3/FFF2…)
  if (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) return "MP3";
  if (hasAscii("RIFF", 0) && hasAscii("WAVE", 8)) return "WAV";
  if (hasAscii("fLaC", 0)) return "FLAC";
  if (hasAscii("OggS", 0)) return "OGG";
  if (startsWith(0x1a, 0x45, 0xdf, 0xa3)) return "WebM";

  // ISO base media (MP4/M4A): brand box "ftyp" at offset 4
  if (hasAscii("ftyp", 4)) return "MP4";

  return null;
}

/**
 * MIME types each route allows, mapped to the format their bytes must show.
 * Kept in one place so route allow-lists and byte checks cannot drift apart.
 */
const MIME_TO_FORMAT: Record<string, FileFormat> = {
  // image route
  "image/jpeg": "JPEG",
  "image/jpg": "JPEG",
  "image/png": "PNG",
  // audio route
  "audio/mpeg": "MP3",
  "audio/wav": "WAV",
  "audio/x-wav": "WAV",
  "audio/mp4": "MP4",
  "audio/ogg": "OGG",
  "audio/flac": "FLAC",
  "audio/x-flac": "FLAC",
  "audio/webm": "WebM",
  // video route
  "video/mp4": "MP4",
};

/**
 * Validate that the file's actual bytes match the declared MIME type.
 * Returns ok:false with a specific reason for unknown signatures and
 * declared-vs-detected mismatches.
 */
export function validateMagicBytes(
  buffer: Buffer,
  declaredMime: string
): MagicBytesResult {
  const detected = detectMagicBytes(buffer);
  const expected = MIME_TO_FORMAT[declaredMime] ?? null;

  if (!detected) {
    return {
      ok: false,
      detected: null,
      reason:
        "Unrecognized file format. The uploaded file does not match any supported signature.",
    };
  }

  if (expected !== detected) {
    return {
      ok: false,
      detected,
      reason: `File content does not match the declared type (declared ${declaredMime}, detected ${detected}).`,
    };
  }

  return { ok: true, detected };
}
