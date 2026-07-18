"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ShieldCheck, Sparkles } from "lucide-react";
import TabSwitcher, { type TabId } from "@/components/TabSwitcher";
import TextCheckPanel from "@/components/TextCheckPanel";
import ImageCheckPanel from "@/components/ImageCheckPanel";
import AudioCheckPanel from "@/components/AudioCheckPanel";
import VideoCheckPanel from "@/components/VideoCheckPanel";
import ThemeToggle from "@/components/ThemeToggle";

const TABS: { id: TabId; label: string }[] = [
  { id: "text", label: "Text" },
  { id: "image", label: "Image" },
  { id: "audio", label: "Audio" },
  { id: "video", label: "Video" },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.09, delayChildren: 0.05 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 30 },
  },
};

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>("text");

  return (
    <div className="relative flex flex-1 flex-col items-center">
      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>

      <main className="w-full max-w-2xl flex-1 px-4 py-10 sm:px-6 sm:py-14 lg:py-20">
        <motion.header
          variants={container}
          initial="hidden"
          animate="show"
          className="mb-8 flex flex-col items-center gap-4 text-center sm:mb-12 sm:gap-5 lg:mb-16"
        >
          <motion.div
            variants={item}
            style={{
              background: "var(--glass-bg)",
              borderColor: "rgba(99,102,241,0.2)",
            }}
            className="mb-2 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium text-brand backdrop-blur-xl sm:px-3.5 sm:py-1.5"
          >
            <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="whitespace-nowrap">AI-Powered Detection</span>
          </motion.div>

          <motion.div variants={item} className="relative flex flex-col items-center gap-3 sm:gap-4">
            <div className="relative flex h-12 w-12 items-center justify-center sm:h-16 sm:w-16">
              <div
                className="absolute inset-0 rounded-full"
                style={{ boxShadow: "0 0 0 8px rgba(99,102,241,0.08)" }}
                aria-hidden
              />
              <div className="gradient-border glass-card relative flex h-12 w-12 items-center justify-center rounded-xl sm:h-16 sm:w-16 sm:rounded-2xl">
                <ShieldCheck className="h-5 w-5 text-brand sm:h-7 sm:w-7" aria-hidden />
              </div>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-text sm:text-3xl md:text-4xl lg:text-5xl">
              AI-Checker
            </h1>
          </motion.div>

          <motion.p variants={item} className="max-w-md px-2 text-sm leading-relaxed text-text-2 sm:text-base lg:text-lg">
            Paste text, or upload an image or video, to get a likelihood signal for
            whether it&apos;s AI-generated.
          </motion.p>
        </motion.header>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.2 }}
        >
          <TabSwitcher tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

          <div className="relative mt-6 sm:mt-8">
            <AnimatePresence mode="popLayout" initial={false}>
              {activeTab === "text" && (
                <motion.div key="text" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: "none" }}>
                  <TextCheckPanel />
                </motion.div>
              )}
              {activeTab === "image" && (
                <motion.div key="image" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: "none" }}>
                  <ImageCheckPanel />
                </motion.div>
              )}
              {activeTab === "audio" && (
                <motion.div key="audio" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: "none" }}>
                  <AudioCheckPanel />
                </motion.div>
              )}
              {activeTab === "video" && (
                <motion.div key="video" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: "none" }}>
                  <VideoCheckPanel />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <p className="mt-8 border-t border-line pt-5 text-center text-xs leading-relaxed text-text-3 opacity-80 sm:mt-10">
            Results are provided by third-party detection APIs and may not always be accurate.
          </p>
        </motion.div>
      </main>
    </div>
  );
}
