"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Mode = "light" | "dark";

function readMode(): Mode {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.classList.contains("light") ? "light" : "dark";
}

export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>("dark");

  useEffect(() => { setMode(readMode()); }, []);

  function toggle() {
    const next: Mode = mode === "light" ? "dark" : "light";
    document.documentElement.classList.toggle("light", next === "light");
    try { localStorage.setItem("theme", next); } catch {}
    setMode(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={mode === "dark" ? "Switch to Porcelain (light)" : "Switch to Midnight Court (dark)"}
      title={mode === "dark" ? "Switch to Porcelain (light)" : "Switch to Midnight Court (dark)"}
      className="h-[38px] w-[38px] inline-flex items-center justify-center rounded-[8px] bg-surface border border-rule text-text-dim hover:text-text hover:bg-surface-hover transition-colors"
    >
      {mode === "dark"
        ? <Sun size={15} strokeWidth={1.9} />
        : <Moon size={15} strokeWidth={1.9} />}
    </button>
  );
}
