"use client";

// Per-branch geofence editor for self check-in / check-out.
// Owner sets latitude, longitude and radius (metres). "Use my current
// location" fills lat/lng from browser geolocation so they don't have
// to look it up on a map. Clearing all three disables the fence for
// that branch (falls back to legacy accept-any-GPS).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Loader2, Save, XCircle } from "lucide-react";
import { setBranchGeofence } from "@/modules/admin/actions";

interface BranchRow {
  id:                string;
  name:              string;
  latitude:          number | null;
  longitude:         number | null;
  attendanceRadiusM: number | null;
}

interface Props {
  branches: BranchRow[];
}

export function BranchGeofenceSection({ branches }: Props) {
  if (branches.length === 0) return null;
  return (
    <div className="rounded-[14px] bg-surface border border-rule p-5 sm:p-6">
      <div className="mb-4">
        <div className="font-display text-[18px] font-semibold">Attendance geofence</div>
        <div className="text-[11.5px] text-text-dim mt-0.5">
          Set the location + radius that check-in and check-out will accept for each branch.
          Leave a branch blank to allow check-in from anywhere.
        </div>
      </div>
      <div className="space-y-3">
        {branches.map((b) => (
          <BranchRowEditor key={b.id} initial={b} />
        ))}
      </div>
    </div>
  );
}

function BranchRowEditor({ initial }: { initial: BranchRow }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [lat, setLat] = useState(initial.latitude == null ? "" : String(initial.latitude));
  const [lng, setLng] = useState(initial.longitude == null ? "" : String(initial.longitude));
  const [radius, setRadius] = useState(initial.attendanceRadiusM == null ? "" : String(initial.attendanceRadiusM));
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [gpsBusy, setGpsBusy] = useState(false);

  async function useMyLocation() {
    setMsg(null);
    setGpsBusy(true);
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) => {
        navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 8000 });
      });
      setLat(pos.coords.latitude.toFixed(6));
      setLng(pos.coords.longitude.toFixed(6));
      if (!radius) setRadius("150");
    } catch {
      setMsg({ tone: "err", text: "Could not get your location — check browser permissions." });
    } finally {
      setGpsBusy(false);
    }
  }

  function save() {
    setMsg(null);
    const latN = lat.trim() === "" ? null : Number(lat);
    const lngN = lng.trim() === "" ? null : Number(lng);
    const radN = radius.trim() === "" ? null : Number(radius);
    if (latN != null && (Number.isNaN(latN) || latN < -90 || latN > 90)) {
      setMsg({ tone: "err", text: "Latitude must be between -90 and 90." });
      return;
    }
    if (lngN != null && (Number.isNaN(lngN) || lngN < -180 || lngN > 180)) {
      setMsg({ tone: "err", text: "Longitude must be between -180 and 180." });
      return;
    }
    if (radN != null && (Number.isNaN(radN) || radN < 10 || radN > 50_000)) {
      setMsg({ tone: "err", text: "Radius must be between 10m and 50,000m." });
      return;
    }
    start(async () => {
      const res = await setBranchGeofence({
        branchId:  initial.id,
        latitude:  latN,
        longitude: lngN,
        radiusM:   radN,
      });
      if (!res.ok) { setMsg({ tone: "err", text: res.error ?? "Save failed" }); return; }
      setMsg({ tone: "ok", text: "Saved" });
      router.refresh();
    });
  }

  function clearFence() {
    setLat(""); setLng(""); setRadius("");
    start(async () => {
      const res = await setBranchGeofence({ branchId: initial.id, latitude: null, longitude: null, radiusM: null });
      if (!res.ok) { setMsg({ tone: "err", text: res.error ?? "Clear failed" }); return; }
      setMsg({ tone: "ok", text: "Fence cleared" });
      router.refresh();
    });
  }

  const isEnabled = initial.latitude != null && initial.longitude != null && initial.attendanceRadiusM != null;

  return (
    <div className="rounded-[10px] border border-rule bg-surface-2/40 p-4">
      <div className="flex flex-wrap items-start justify-between mb-3 gap-3">
        <div>
          <div className="text-[13px] font-medium text-text">{initial.name}</div>
          <div className="text-[10.5px] text-text-dim mt-0.5">
            {isEnabled
              ? <>Fence active · {initial.attendanceRadiusM}m from ({initial.latitude?.toFixed(4)}, {initial.longitude?.toFixed(4)})</>
              : <>No fence — check-in allowed from anywhere</>}
          </div>
        </div>
        <button
          type="button"
          onClick={useMyLocation}
          disabled={gpsBusy || pending}
          className="inline-flex items-center gap-1.5 h-[26px] px-2.5 rounded-[5px] text-[11px] font-medium text-text-dim border border-rule hover:text-accent hover:border-accent/50 transition-colors disabled:opacity-60"
        >
          {gpsBusy ? <Loader2 size={11} className="animate-spin" /> : <MapPin size={11} />}
          Use my location
        </button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-[1fr_1fr_140px_auto] gap-2">
        <input
          value={lat}
          onChange={(e) => setLat(e.target.value)}
          placeholder="Latitude"
          className="h-[30px] px-2 bg-surface border border-rule rounded-[5px] text-[12px] text-text tabular outline-none focus:border-accent"
        />
        <input
          value={lng}
          onChange={(e) => setLng(e.target.value)}
          placeholder="Longitude"
          className="h-[30px] px-2 bg-surface border border-rule rounded-[5px] text-[12px] text-text tabular outline-none focus:border-accent"
        />
        <input
          value={radius}
          onChange={(e) => setRadius(e.target.value)}
          placeholder="Radius (m)"
          inputMode="numeric"
          className="h-[30px] px-2 bg-surface border border-rule rounded-[5px] text-[12px] text-text tabular outline-none focus:border-accent lg:col-auto col-span-1"
        />
        <div className="flex items-center gap-1 col-span-1">
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="inline-flex items-center gap-1 h-[30px] px-3 rounded-[5px] text-[11.5px] font-medium bg-accent text-white hover:bg-accent-hover disabled:opacity-60 transition-colors"
          >
            {pending ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
            Save
          </button>
          {isEnabled && (
            <button
              type="button"
              onClick={clearFence}
              disabled={pending}
              title="Disable fence for this branch"
              className="h-[30px] w-[30px] grid place-items-center rounded-[5px] text-text-dim hover:text-fault hover:bg-fault/8 disabled:opacity-60 transition-colors"
            >
              <XCircle size={13} />
            </button>
          )}
        </div>
      </div>
      {msg && (
        <div className={`mt-2 text-[11px] ${msg.tone === "ok" ? "text-solid" : "text-fault"}`}>
          {msg.text}
        </div>
      )}
    </div>
  );
}
