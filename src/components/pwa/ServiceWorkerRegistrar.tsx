"use client";

import { useEffect } from "react";

/** Registers the service worker AND reloads the page when a new SW takes
 *  over — so a deploy that changes server-action IDs doesn't leave the
 *  user stuck on a stale bundle throwing "Server Action X was not found". */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // The message from sw.js's activate handler after clients.claim().
    // Guarded so a first-install (no prior controller) doesn't reload.
    const hadControllerAtLoad = !!navigator.serviceWorker.controller;
    let reloaded = false;
    function forceReloadOnce() {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    }
    function onMessage(e: MessageEvent) {
      if (e.data?.type === "SW_ACTIVATED" && hadControllerAtLoad) forceReloadOnce();
    }
    function onControllerChange() {
      if (hadControllerAtLoad) forceReloadOnce();
    }
    navigator.serviceWorker.addEventListener("message", onMessage);
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    // Registering after load keeps it off the critical path.
    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.warn("[pwa] service worker registration failed:", err);
      });
    };
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });

    return () => {
      window.removeEventListener("load", onLoad);
      navigator.serviceWorker.removeEventListener("message", onMessage);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  return null;
}
