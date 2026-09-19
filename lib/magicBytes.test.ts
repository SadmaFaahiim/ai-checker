import { describe, it, expect } from "vitest";
import {
  detectMagicBytes,
  validateMagicBytes,
} from "@/lib/magicBytes";

/** Helper: build a 12+ byte buffer from a signature prefix. */
const buf = (...bytes: number[]) => {
  const b = Buffer.alloc(16);
  Buffer.from(bytes).copy(b);
  return b;
};

// Real-world leading signatures (12 bytes each)
const JPEG = buf(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01);
const PNG = buf(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d);
const MP3_ID3 = buf(0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00);
const MP3_FRAME = buf(0xff, 0xfb, 0x90, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00);
const WAV = buf(0x52, 0x49, 0x46, 0x46, 0x24, 0x08, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45);
const MP4 = buf(0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d); // ....ftypisom
const OGG = buf(0x4f, 0x67, 0x67, 0x53, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00);
const FLAC = buf(0x66, 0x4c, 0x61, 0x43, 0x00, 0x00, 0x00, 0x22, 0x12, 0x00, 0x12, 0x00);
const WEBM = buf(0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x1f);
const EXE = buf(0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00); // MZ… Windows PE

describe("detectMagicBytes", () => {
  it.each([
    ["JPEG", JPEG],
    ["PNG", PNG],
    ["MP3", MP3_ID3],
    ["MP3", MP3_FRAME],
    ["WAV", WAV],
    ["MP4", MP4],
    ["OGG", OGG],
    ["FLAC", FLAC],
    ["WebM", WEBM],
  ])("detects %s", (format, buffer) => {
    expect(detectMagicBytes(buffer as Buffer)).toBe(format);
  });

  it("returns null for unrecognized bytes", () => {
    expect(detectMagicBytes(EXE)).toBeNull();
    expect(detectMagicBytes(Buffer.alloc(16, 0x00))).toBeNull();
  });

  it("returns null when buffer is too short to identify", () => {
    expect(detectMagicBytes(Buffer.from([0xff, 0xd8, 0xff]))).toBeNull();
    expect(detectMagicBytes(Buffer.alloc(0))).toBeNull();
  });
});

describe("validateMagicBytes", () => {
  it("accepts a genuine JPEG declared as image/jpeg", () => {
    expect(validateMagicBytes(JPEG, "image/jpeg")).toEqual({
      ok: true,
      detected: "JPEG",
    });
  });

  it("accepts image/jpg alias", () => {
    expect(validateMagicBytes(JPEG, "image/jpg").ok).toBe(true);
  });

  it.each([
    ["audio/mpeg", MP3_ID3],
    ["audio/mpeg", MP3_FRAME],
    ["audio/wav", WAV],
    ["audio/mp4", MP4],
    ["audio/ogg", OGG],
    ["audio/flac", FLAC],
    ["audio/webm", WEBM],
  ])("accepts genuine audio declared as %s", (mime, buffer) => {
    const result = validateMagicBytes(buffer as Buffer, mime);
    expect(result.ok).toBe(true);
  });

  it("accepts a genuine MP4 declared as video/mp4", () => {
    expect(validateMagicBytes(MP4, "video/mp4").ok).toBe(true);
  });

  it("rejects declared-vs-actual mismatch with a specific reason", () => {
    const result = validateMagicBytes(JPEG, "image/png");
    expect(result.ok).toBe(false);
    expect(result.detected).toBe("JPEG");
    expect(result.reason).toContain("image/png");
    expect(result.reason).toContain("JPEG");
  });

  it("rejects renamed executables (spoofed MIME)", () => {
    const result = validateMagicBytes(EXE, "image/png");
    expect(result.ok).toBe(false);
    expect(result.detected).toBeNull();
    expect(result.reason).toContain("Unrecognized");
  });

  it("rejects unknown declared MIME types", () => {
    const result = validateMagicBytes(JPEG, "application/pdf");
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("application/pdf");
  });

  it("does not let an MP4 pass as audio/wav (RIFF required)", () => {
    expect(validateMagicBytes(MP4, "audio/wav").ok).toBe(false);
  });
});
