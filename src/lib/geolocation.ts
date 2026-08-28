// Why location failed, in words an employee can act on.
//
// The deployed app showed "Location access is required to check in.
// Please allow location access and try again" and a "Location denied"
// badge — advice that cannot work, because the most common cause on this
// deployment is not a denied permission at all.
//
// Browsers only expose geolocation in a SECURE CONTEXT: https://, or
// localhost. The production app is served over plain http:// (see the
// "Not Secure" badge in the address bar), so the API is blocked before
// any permission prompt is ever shown. That is why it worked on
// localhost and failed live, and why "please allow location access"
// left people stuck — there was nothing to allow.
//
// So this module names the real cause and says who can fix it. Only the
// site being moved to HTTPS fixes the insecure-context case; no amount
// of clicking in browser settings will.

export type GeoFailure =
  | "unsupported"
  | "insecure-context"
  | "denied"
  | "unavailable"
  | "timeout"
  | "unknown";

export interface GeoDiagnosis {
  kind:    GeoFailure;
  /** One line stating what went wrong. */
  title:   string;
  /** What to do about it. Empty when the user genuinely cannot. */
  advice:  string;
  /** False when retrying cannot possibly help — an insecure origin will
   *  fail identically every time, and offering a button implies
   *  otherwise. */
  retryable: boolean;
}

/** True when the browser will allow geolocation at all on this origin. */
export function isGeoAvailable(): boolean {
  if (typeof window === "undefined") return false;
  if (!("geolocation" in navigator)) return false;
  // isSecureContext is true for https:// and for localhost/127.0.0.1.
  return window.isSecureContext !== false;
}

export function diagnoseGeoError(err: unknown): GeoDiagnosis {
  if (typeof window !== "undefined" && !("geolocation" in navigator)) {
    return {
      kind: "unsupported",
      title: "This browser cannot share your location.",
      advice: "Open the site in Chrome or Safari and try again.",
      retryable: false,
    };
  }

  // Checked BEFORE the error code, because an insecure origin surfaces
  // as PERMISSION_DENIED in most browsers — which would otherwise send
  // the employee into their settings to fix something that is not
  // broken there.
  if (typeof window !== "undefined" && window.isSecureContext === false) {
    return {
      kind: "insecure-context",
      title: "This site is not on a secure (HTTPS) address, so your browser blocks location.",
      advice:
        "Nothing you change on your phone will fix this — the site itself needs to be served over https://. Send this message to your administrator.",
      retryable: false,
    };
  }

  const code = (err as GeolocationPositionError | undefined)?.code;

  if (code === 1 /* PERMISSION_DENIED */) {
    return {
      kind: "denied",
      title: "Location is blocked for this site.",
      advice:
        "Tap the icon at the left of the address bar → Permissions → allow Location, then press Retry. On iPhone also check Settings → Privacy → Location Services → Safari.",
      retryable: true,
    };
  }
  if (code === 2 /* POSITION_UNAVAILABLE */) {
    return {
      kind: "unavailable",
      title: "Your device could not get a location fix.",
      advice: "Turn on GPS / Location Services, step near a window or outside, then press Retry.",
      retryable: true,
    };
  }
  if (code === 3 /* TIMEOUT */) {
    return {
      kind: "timeout",
      title: "Finding your location took too long.",
      advice: "Signal is weak where you are standing. Press Retry — it usually works on a second attempt.",
      retryable: true,
    };
  }

  return {
    kind: "unknown",
    title: "Could not read your location.",
    advice: "Press Retry. If it keeps failing, tell your administrator what this message says.",
    retryable: true,
  };
}

/**
 * Read the current position, rejecting with the raw
 * GeolocationPositionError so the caller can diagnose it.
 *
 * The timeout is generous: 8s was tight for a first fix on a cold GPS
 * indoors, and a timeout reads to an employee as "the app is broken".
 */
export function readPosition(timeoutMs = 15_000): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      reject(new Error("unsupported"));
      return;
    }
    if (window.isSecureContext === false) {
      reject(new Error("insecure-context"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { timeout: timeoutMs, enableHighAccuracy: true, maximumAge: 30_000 },
    );
  });
}
