"use client";

import { motion } from "framer-motion";
import { Type, Image as ImageIcon, Video, type LucideIcon } from "lucide-react";
import clsx from "clsx";

export type TabId = "text" | "image" | "video";

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
  video: Video,
};

export default function TabSwitcher({ tabs, activeTab, onChange }: TabSwitcherProps) {
  return (
    <div
      role="tablist"
      aria-label="Detection type"
      className="tab-glass flex w-full gap-1 rounded-full p-1.5 sm:inline-flex sm:w-auto"
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
              "relative flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-medium outline-none transition-colors duration-200 sm:flex-none sm:px-5",
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
            <Icon className="relative z-10 h-4 w-4" aria-hidden />
            <span className="relative z-10">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
