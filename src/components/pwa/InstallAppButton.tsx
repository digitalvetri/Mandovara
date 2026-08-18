"use client";

import { useEffect, useState } from "react";
import { Download, Check } from "lucide-react";

// Chrome/Edge/Android fire `beforeinstallprompt` and let us defer it to a
// button of our own. iOS Safari never fires it — installing there is
// Share → Add to Home Screen — so we show those instructions instead of a
// button that could not work.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallAppButton({ className = "" }: { className?: string }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    // Already running as an installed app — nothing to offer.
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS reports installed state on navigator, not via matchMedia.
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) { setInstalled(true); return; }

    const ua = window.navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !("MSStream" in window);
    if (isIOS) setIosHint(true);

    const onPrompt = (e: Event) => {
      e.preventDefault();               // stop Chrome's own mini-infobar
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => { setInstalled(true); setDeferred(null); };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) {
    return (
      <span className={`inline-flex items-center gap-1.5 text-[12px] text-solid ${className}`}>
        <Check size={13} strokeWidth={2} /> Installed
      </span>
    );
  }

  if (iosHint && !deferred) {
    return (
      <span className={`text-[11.5px] text-text-muted ${className}`}>
        To install: Share → <strong className="font-medium">Add to Home Screen</strong>
      </span>
    );
  }

  if (!deferred) return null;   // browser has not offered it (yet)

  return (
    <button
      type="button"
      onClick={async () => {
        await deferred.prompt();
        const { outcome } = await deferred.userChoice;
        if (outcome === "accepted") setInstalled(true);
        setDeferred(null);      // the event is single-use
      }}
      className={`inline-flex items-center gap-2 h-9 px-3.5 rounded-[8px] bg-gold/15 text-gold border border-gold/30 text-[12.5px] font-medium hover:bg-gold/25 transition-colors ${className}`}
    >
      <Download size={14} strokeWidth={1.75} />
      Install app
    </button>
  );
}
