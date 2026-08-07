"use client";

// The Measure & Material Engine, wired to a live playground.
// Type a dimension → the fabric metres / roll count / boxes update as
// you type. This is TRACK-B-CRAFT.md §6.4 test 5 in a single screen:
// "type a width and the fabric metres, roll count or box count updates
//  in the same breath, with the warning line beneath it."
//
// The calc functions in /lib/calc are pure, so this component runs the
// engine client-side — no server round-trip on every keystroke.

import { useMemo, useState } from "react";
import { AlertTriangle, Info } from "lucide-react";
import {
  calcWallpaper,
  WALLPAPER_ENGINE_VERSION,
  type PatternMatch as WallpaperPatternMatch,
} from "@/lib/calc/wallpaper";
import {
  calcFlooring,
  FLOORING_ENGINE_VERSION,
  type LayPattern,
} from "@/lib/calc/flooring";
import {
  calcCurtain,
  CURTAIN_ENGINE_VERSION,
  type PatternMatch as CurtainPatternMatch,
} from "@/lib/calc/curtain";

type Tab = "wallpaper" | "flooring" | "curtain";

export function EstimatorPlayground() {
  const [tab, setTab] = useState<Tab>("wallpaper");

  return (
    <div className="pb-10">
      {/* ── Tab strip ────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 mb-5 border-b border-rule">
        <TabButton active={tab === "wallpaper"} onClick={() => setTab("wallpaper")}>
          Wallpaper
        </TabButton>
        <TabButton active={tab === "flooring"} onClick={() => setTab("flooring")}>
          Flooring
        </TabButton>
        <TabButton active={tab === "curtain"} onClick={() => setTab("curtain")}>
          Curtains
        </TabButton>
      </div>

      {tab === "wallpaper" && <WallpaperPanel />}
      {tab === "flooring"  && <FlooringPanel  />}
      {tab === "curtain"   && <CurtainPanel   />}
    </div>
  );
}

// ── Wallpaper ──────────────────────────────────────────────────────
function WallpaperPanel() {
  const [wallWidth,  setWallWidth]  = useState(4000);
  const [wallHeight, setWallHeight] = useState(2700);
  const [rollWidth,  setRollWidth]  = useState(530);
  const [rollLength, setRollLength] = useState(10.05);
  const [match,      setMatch]      = useState<WallpaperPatternMatch>("FREE");
  const [repeat,     setRepeat]     = useState(0);

  const result = useMemo(() => {
    try {
      return {
        ok: true as const,
        value: calcWallpaper({
          wallWidthMm:     wallWidth,
          wallHeightMm:    wallHeight,
          rollWidthMm:     rollWidth,
          rollLengthM:     rollLength,
          patternMatch:    match,
          patternRepeatMm: match === "FREE" ? 0 : repeat,
          deductions:      [],
        }),
      };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  }, [wallWidth, wallHeight, rollWidth, rollLength, match, repeat]);

  return (
    <TwoColumn
      form={
        <>
          <NumField label="Wall width (mm)"  value={wallWidth}  onChange={setWallWidth}  />
          <NumField label="Wall height (mm)" value={wallHeight} onChange={setWallHeight} />
          <NumField label="Roll width (mm)"  value={rollWidth}  onChange={setRollWidth}  />
          <NumField label="Roll length (m)"  value={rollLength} onChange={setRollLength} step={0.05} />
          <SelectField
            label="Pattern match"
            value={match}
            onChange={(v) => setMatch(v as WallpaperPatternMatch)}
            options={[
              { value: "FREE",     label: "Free (no repeat)" },
              { value: "STRAIGHT", label: "Straight repeat" },
              { value: "OFFSET",   label: "Offset (half-drop)" },
            ]}
          />
          {match !== "FREE" && (
            <NumField label="Pattern repeat (mm)" value={repeat} onChange={setRepeat} />
          )}
        </>
      }
      result={
        result.ok ? (
          <>
            <HeroNumber label="Rolls required" value={result.value.rollsRequired} unit="rolls" />
            <StatRow>
              <Stat label="Cut length"     value={fmt(result.value.cutLengthMm)}  unit="mm" />
              <Stat label="Strips / roll"  value={result.value.stripsPerRoll} />
              <Stat label="Strips needed" value={result.value.stripsNeeded} />
            </StatRow>
            <Warnings warnings={result.value.warnings} version={WALLPAPER_ENGINE_VERSION} />
          </>
        ) : (
          <ErrorBanner message={result.error} />
        )
      }
    />
  );
}

// ── Flooring ───────────────────────────────────────────────────────
function FlooringPanel() {
  const [roomLength, setRoomLength] = useState(4000);
  const [roomWidth,  setRoomWidth]  = useState(3500);
  const [lay,        setLay]        = useState<LayPattern>("STRAIGHT");
  const [kind,       setKind]       = useState<"BOX" | "ROLL">("BOX");
  const [sqftPerBox, setSqftPerBox] = useState(2.2);
  const [rollWidth,  setRollWidth]  = useState(1220);

  const result = useMemo(() => {
    try {
      return {
        ok: true as const,
        value: calcFlooring({
          roomLengthMm: roomLength,
          roomWidthMm:  roomWidth,
          layPattern:   lay,
          product:
            kind === "BOX"
              ? { kind: "BOX",  areaPerBoxSqft: sqftPerBox }
              : { kind: "ROLL", rollWidthMm:    rollWidth  },
        }),
      };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  }, [roomLength, roomWidth, lay, kind, sqftPerBox, rollWidth]);

  return (
    <TwoColumn
      form={
        <>
          <NumField label="Room length (mm)" value={roomLength} onChange={setRoomLength} />
          <NumField label="Room width (mm)"  value={roomWidth}  onChange={setRoomWidth}  />
          <SelectField
            label="Lay pattern"
            value={lay}
            onChange={(v) => setLay(v as LayPattern)}
            options={[
              { value: "STRAIGHT",    label: "Straight (7% wastage)" },
              { value: "DIAGONAL",    label: "Diagonal (10% wastage)" },
              { value: "HERRINGBONE", label: "Herringbone (15% wastage)" },
            ]}
          />
          <SelectField
            label="Product kind"
            value={kind}
            onChange={(v) => setKind(v as "BOX" | "ROLL")}
            options={[
              { value: "BOX",  label: "Box-packed (planks / tiles)" },
              { value: "ROLL", label: "Roll film (vinyl / SPC roll)" },
            ]}
          />
          {kind === "BOX" ? (
            <NumField label="Area per box (sqft)" value={sqftPerBox} onChange={setSqftPerBox} step={0.1} />
          ) : (
            <NumField label="Roll width (mm)" value={rollWidth} onChange={setRollWidth} />
          )}
        </>
      }
      result={
        result.ok ? (
          <>
            {result.value.boxesRequired != null ? (
              <HeroNumber label="Boxes required" value={result.value.boxesRequired} unit="boxes" />
            ) : (
              <HeroNumber label="Roll length" value={result.value.rollLengthM ?? 0} unit="m" decimals={2} />
            )}
            <StatRow>
              <Stat label="Area"          value={result.value.areaSqft.toFixed(1)}            unit="sqft" />
              <Stat label="With wastage"  value={result.value.areaWithWastageSqft.toFixed(1)} unit="sqft" />
              <Stat label="Wastage"       value={result.value.wastagePct}                     unit="%" />
              <Stat label="Skirting"      value={result.value.skirtingRft.toFixed(2)}         unit="rft" />
              {result.value.seamCount != null && (
                <Stat label="Seams" value={result.value.seamCount} />
              )}
            </StatRow>
            <Warnings warnings={result.value.warnings} version={FLOORING_ENGINE_VERSION} />
          </>
        ) : (
          <ErrorBanner message={result.error} />
        )
      }
    />
  );
}

// ── Curtain ────────────────────────────────────────────────────────
function CurtainPanel() {
  const [winWidth,      setWinWidth]      = useState(1800);
  const [winHeight,     setWinHeight]     = useState(2100);
  const [fullness,      setFullness]      = useState(2.5);
  const [fabricWidth,   setFabricWidth]   = useState(1100);
  const [match,         setMatch]         = useState<CurtainPatternMatch>("FREE");
  const [repeat,        setRepeat]        = useState(0);
  const [railroadable,  setRailroadable]  = useState(false);
  const [railWidth,     setRailWidth]     = useState(2800);
  const [eyelet,        setEyelet]        = useState(false);
  const [lining,        setLining]        = useState(false);

  const result = useMemo(() => {
    try {
      return {
        ok: true as const,
        value: calcCurtain({
          windowWidthMm:  winWidth,
          windowHeightMm: winHeight,
          fullness,
          fabricWidthMm:  fabricWidth,
          patternMatch:   match,
          patternRepeatMm: match === "FREE" ? 0 : repeat,
          railroadable,
          ...(railroadable && { railroadedFabricWidthMm: railWidth }),
          ...(eyelet       && { headingType: "EYELET" as const }),
          ...(lining       && { liningRequired: true }),
        }),
      };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  }, [winWidth, winHeight, fullness, fabricWidth, match, repeat, railroadable, railWidth, eyelet, lining]);

  return (
    <TwoColumn
      form={
        <>
          <NumField label="Window width (mm)"  value={winWidth}    onChange={setWinWidth}    />
          <NumField label="Window height (mm)" value={winHeight}   onChange={setWinHeight}   />
          <NumField label="Fullness"           value={fullness}    onChange={setFullness}    step={0.1} />
          <NumField label="Fabric width (mm)"  value={fabricWidth} onChange={setFabricWidth} />
          <SelectField
            label="Pattern match"
            value={match}
            onChange={(v) => setMatch(v as CurtainPatternMatch)}
            options={[
              { value: "FREE",     label: "Free (no repeat)" },
              { value: "STRAIGHT", label: "Straight repeat" },
              { value: "OFFSET",   label: "Offset (half-drop)" },
            ]}
          />
          {match !== "FREE" && (
            <NumField label="Pattern repeat (mm)" value={repeat} onChange={setRepeat} />
          )}
          <CheckField label="Fabric is railroadable (wide bolt available)" checked={railroadable} onChange={setRailroadable} />
          {railroadable && (
            <NumField label="Wide-bolt width (mm)" value={railWidth} onChange={setRailWidth} />
          )}
          <CheckField label="Eyelet heading" checked={eyelet} onChange={setEyelet} />
          <CheckField label="With lining"    checked={lining} onChange={setLining} />
        </>
      }
      result={
        result.ok ? (
          <>
            <HeroNumber label="Fabric required" value={result.value.fabricMetres.toFixed(2)} unit="m" />
            <StatRow>
              <Stat label="Run" value={result.value.fabricRun === "RAILROADED" ? "Railroaded" : "Vertical"} />
              {result.value.panels != null && (
                <Stat label="Panels" value={result.value.panels} />
              )}
              {result.value.cutLengthMm != null && (
                <Stat label="Cut length" value={fmt(result.value.cutLengthMm)} unit="mm" />
              )}
              {result.value.liningMetres != null && (
                <Stat label="Lining" value={result.value.liningMetres.toFixed(2)} unit="m" />
              )}
              {result.value.eyeletCountPerPanel != null && (
                <Stat label="Eyelets / panel" value={result.value.eyeletCountPerPanel} />
              )}
            </StatRow>
            <Warnings warnings={result.value.warnings} version={CURTAIN_ENGINE_VERSION} />
          </>
        ) : (
          <ErrorBanner message={result.error} />
        )
      }
    />
  );
}

// ── UI atoms ──────────────────────────────────────────────────────

function TwoColumn({ form, result }: { form: React.ReactNode; result: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="rounded-[14px] bg-surface border border-rule p-6 space-y-4">{form}</div>
      <div className="rounded-[14px] bg-surface border border-rule p-6 space-y-5">{result}</div>
    </div>
  );
}

function TabButton({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-[38px] px-4 text-[12.5px] tracking-[0.02em] relative transition-colors ${
        active
          ? "text-text after:absolute after:left-0 after:right-0 after:-bottom-px after:h-[2px] after:bg-accent"
          : "text-text-dim hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}

function NumField({
  label, value, onChange, step,
}: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <label className="block">
      <div className="mb-1 text-[10.5px] tracking-[0.14em] uppercase text-text-dim">{label}</div>
      <input
        type="number"
        value={Number.isFinite(value) ? value : ""}
        step={step ?? 1}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
        className="w-full h-[36px] px-3 bg-white/60 border border-rule rounded-[6px] text-[13px] tabular outline-none focus:border-accent transition-colors"
      />
    </label>
  );
}

function SelectField({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <div className="mb-1 text-[10.5px] tracking-[0.14em] uppercase text-text-dim">{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-[36px] px-3 bg-white/60 border border-rule rounded-[6px] text-[13px] outline-none focus:border-accent transition-colors"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

function CheckField({
  label, checked, onChange,
}: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-[12.5px] text-text">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-[16px] w-[16px] accent-accent"
      />
      {label}
    </label>
  );
}

function HeroNumber({
  label, value, unit, decimals,
}: { label: string; value: number | string; unit?: string; decimals?: number }) {
  const display =
    typeof value === "number" && decimals != null ? value.toFixed(decimals) : String(value);
  return (
    <div className="pb-2">
      <div className="text-[10.5px] tracking-[0.16em] uppercase text-text-dim mb-1">{label}</div>
      <div className="flex items-baseline gap-2 relative">
        <span className="font-display text-[44px] leading-none tabular text-text">{display}</span>
        {unit && <span className="text-[13px] text-text-dim tracking-[0.06em] uppercase">{unit}</span>}
      </div>
      <div className="mt-2 h-[1px] w-[64px] bg-accent" />
    </div>
  );
}

function StatRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">{children}</div>;
}

function Stat({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div>
      <div className="text-[10.5px] tracking-[0.14em] uppercase text-text-dim mb-0.5">{label}</div>
      <div className="text-[15px] tabular text-text">
        {value}
        {unit && <span className="ml-1 text-[11px] text-text-dim uppercase tracking-[0.06em]">{unit}</span>}
      </div>
    </div>
  );
}

function Warnings({ warnings, version }: { warnings: readonly string[]; version: string }) {
  return (
    <div className="pt-3 border-t border-rule/60">
      {warnings.length === 0 ? (
        <div className="flex items-center gap-2 text-[11.5px] text-text-dim">
          <Info size={13} strokeWidth={1.75} />
          No warnings from the engine.
        </div>
      ) : (
        <ul className="space-y-2">
          {warnings.map((w, i) => (
            <li key={i} className="flex items-start gap-2 text-[12px] text-text bg-accent/8 border border-accent/25 rounded-[8px] px-3 py-2">
              <AlertTriangle size={13} strokeWidth={1.75} className="mt-[3px] text-accent shrink-0" />
              <span>{w}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 text-[10px] uppercase tracking-[0.18em] text-text-faint">
        Engine · {version}
      </div>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 text-[12px] text-bad bg-bad/8 border border-bad/30 rounded-[8px] px-3 py-2">
      <AlertTriangle size={13} strokeWidth={1.75} className="mt-[3px] shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
