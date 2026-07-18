"use client";

import { motion } from "framer-motion";
import { Type, Image as ImageIcon, Music, Video, type LucideIcon } from "lucide-react";
import clsx from "clsx";

export type TabId = "text" | "image" | "audio" | "video";

export interface TabDefinition {
  id: TabId;
  label: string;
}

interface TabSwitcherProps {
  tabs: TabDefinition[];
  activeTab: TabId;
  onChange: (tab: TabId) => void;
}

const TAB_ICONS: Record<TabId, LucideIcon> = {
  text: Type,
  image: ImageIcon,
  audio: Music,
  video: Video,
};

export default function TabSwitcher({ tabs, activeTab, onChange }: TabSwitcherProps) {
  return (
    <div
      role="tablist"
      aria-label="Detection type"
      className="tab-glass flex w-full gap-1 rounded-full p-1 sm:inline-flex sm:w-auto sm:p-1.5"
    >
      {tabs.map((tab) => {
        const Icon = TAB_ICONS[tab.id];
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={clsx(
              "relative flex min-h-11 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-full px-2 py-2.5 text-xs font-medium outline-none transition-colors duration-200 sm:flex-none sm:gap-1.5 sm:px-5 sm:text-sm",
              "focus-visible:ring-2 focus-visible:ring-brand/50",
              isActive ? "text-text" : "text-text-2 hover:text-[var(--tab-hover-text)]"
            )}
          >
            {isActive && (
              <motion.span
                layoutId="tab-active-pill"
                className="absolute inset-0 rounded-full"
                style={{ background: "var(--tab-pill-bg)" }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
            <Icon className="relative z-10 h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden />
            <span className="relative z-10">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
