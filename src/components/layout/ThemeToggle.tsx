"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Mode = "light" | "dark";

export function ThemeToggle() {
  // Start as "light" so server and client initial renders always match (Moon
  // icon). useEffect then syncs to whatever class layout.tsx set from the cookie.
  const [mode, setMode] = useState<Mode>("light");

  useEffect(() => {
    setMode(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);

  function toggle() {
    const next: Mode = mode === "light" ? "dark" : "light";
    document.documentElement.classList.toggle("dark", next === "dark");
    document.documentElement.dataset.theme = next;
    document.cookie = `theme=${next};path=/;max-age=31536000;SameSite=Lax`;
    try { localStorage.setItem("theme", next); } catch { /* storage disabled */ }
    setMode(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={mode === "dark" ? "Switch to Studio Porcelain (light)" : "Switch to Malachite (dark)"}
      title={mode === "dark" ? "Switch to Studio Porcelain (light)" : "Switch to Malachite (dark)"}
      className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-[8px] on-chrome border"
    >
      {mode === "dark" ? <Sun size={15} strokeWidth={1.9} /> : <Moon size={15} strokeWidth={1.9} />}
    </button>
  );
}
