"use client";

import { useEffect } from "react";
import { TOOL_STORAGE_KEY } from "../lib/tools";

interface ToolUsageTrackerProps {
  toolId: string;
}

export default function ToolUsageTracker({ toolId }: ToolUsageTrackerProps) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(TOOL_STORAGE_KEY, toolId);
    } catch (error) {
      console.warn("记录工具使用情况失败", error);
    }
  }, [toolId]);

  return null;
}
