"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import toast from "react-hot-toast";
import { AnimatePresence, motion } from "framer-motion";
import { UploadCloud, ImageIcon, X, Sparkles, Search } from "lucide-react";
import ResultCard from "./ResultCard";
import type { CheckResult } from "@/lib/scoring";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB

function ResultSkeleton() {
  return (
    <motion.div
      animate={{ opacity: [0.7, 1, 0.7] }}
      transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
      className="glass-card shimmer w-full rounded-2xl p-6 sm:p-8"
    >
      <div className="flex flex-col items-center gap-3">
        <div className="h-12 w-28 rounded-lg bg-elevated" />
        <div className="h-6 w-40 rounded-full bg-elevated" />
      </div>
      <div className="mt-6 h-2.5 w-full rounded-full bg-elevated" />
      <div className="mt-6 flex items-center justify-center gap-1 text-sm text-text-2">
        <span>Analyzing image</span>
        <AnimatedDots />
      </div>
    </motion.div>
  );
}

function AnimatedDots() {
  return (
    <span className="inline-flex gap-0.5">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          animate={{ opacity: [0.2, 1, 0.2] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }}
        >
          .
        </motion.span>
      ))}
    </span>
  );
}

function EmptyState() {
  return (
    <div
      className="glass-card flex w-full flex-col items-center gap-3 rounded-2xl px-6 py-12 text-center"
      style={{ background: "var(--glass-bg-muted)" }}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-surface">
        <Search className="h-5 w-5 text-text-3" aria-hidden />
      </div>
      <p className="text-sm text-text-2">Analysis results will appear here</p>
    </div>
  );
}

export default function ImageCheckPanel() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const onDrop = useCallback((accepted: File[], rejections: FileRejection[]) => {
    if (rejections.length > 0) {
      const reason = rejections[0]?.errors[0]?.code;
      if (reason === "file-too-large") {
        toast.error("Image must be smaller than 10MB.");
      } else if (reason === "file-invalid-type") {
        toast.error("Only JPG and PNG images are supported.");
      } else {
        toast.error("That file couldn't be used, please try another.");
      }
      return;
    }

    const picked = accepted[0];
    if (picked) {
      setFile(picked);
      setResult(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/jpeg": [".jpg", ".jpeg"], "image/png": [".png"] },
    maxSize: MAX_IMAGE_BYTES,
    multiple: false,
  });

  const dropzoneRootProps = getRootProps();

  function clearFile() {
    setFile(null);
    setResult(null);
  }

  async function handleCheck() {
    if (!file || loading) return;

    setLoading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch("/api/check/image", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data?.error ?? "Something went wrong. Please try again.");
        return;
      }

      setResult(data as CheckResult);
    } catch {
      toast.error("Network error — please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="relative">
      <AnimatePresence mode="popLayout" initial={false}>
        {!file ? (
          <motion.div
            key="dropzone"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, pointerEvents: "none" }}
            whileHover={{ scale: 1.01 }}
          >
            <div
              {...dropzoneRootProps}
              className="glass-surface upload-dashed flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-14 text-center"
              style={isDragActive ? { borderColor: "var(--card-border-hover)" } : undefined}
            >
              <input {...getInputProps()} />
              <div
                className="animate-float flex h-12 w-12 items-center justify-center rounded-full"
                style={{ background: "var(--upload-icon-bg)" }}
              >
                <UploadCloud className="h-6 w-6 text-brand" aria-hidden />
              </div>
              <p className="text-sm text-text-2">Drag & drop a JPG/PNG, or click to browse</p>
              <div className="flex items-center gap-2">
                <span className="glass-border rounded-md bg-elevated/60 px-2.5 py-1 text-xs font-medium text-text-3">JPG</span>
                <span className="glass-border rounded-md bg-elevated/60 px-2.5 py-1 text-xs font-medium text-text-3">PNG</span>
              </div>
              <p className="text-xs text-text-3">Max size 10MB</p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="file"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, pointerEvents: "none" }}
            className="glass-card flex items-center gap-4 rounded-2xl p-4"
          >
            {previewUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="Preview of the uploaded image"
                className="h-16 w-16 shrink-0 rounded-xl object-cover"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate text-sm font-medium text-text">
                <ImageIcon className="h-3.5 w-3.5 shrink-0 text-text-3" aria-hidden />
                {file.name}
              </p>
              <p className="text-xs text-text-3">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
            <button
              type="button"
              onClick={clearFile}
              className="rounded-full p-1.5 text-text-3 transition-colors hover:bg-elevated hover:text-text"
              aria-label="Remove image"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      </div>

      <motion.button
        type="button"
        onClick={handleCheck}
        disabled={!file || loading}
        whileTap={file && !loading ? { scale: 0.98 } : undefined}
        className="btn-gradient inline-flex items-center justify-center gap-2 self-end rounded-lg px-5 py-2.5 text-sm shadow-lg shadow-brand/20 outline-none focus-visible:ring-2 focus-visible:ring-brand/50 disabled:cursor-not-allowed disabled:bg-elevated disabled:text-text-3 disabled:shadow-none disabled:opacity-60"
      >
        <Sparkles className="h-4 w-4" aria-hidden />
        {loading ? "Analyzing..." : "Check Image"}
      </motion.button>

      <div className="relative">
      <AnimatePresence mode="popLayout">
        {loading && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: "none" }}>
            <ResultSkeleton />
          </motion.div>
        )}
        {!loading && result && (
          <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: "none" }}>
            <ResultCard percentage={result.percentage} verdict={result.verdict} provider={result.provider} />
          </motion.div>
        )}
        {!loading && !result && (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: "none" }}>
            <EmptyState />
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}
