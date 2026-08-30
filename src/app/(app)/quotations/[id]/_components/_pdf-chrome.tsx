// The furniture of the quotation: identity block, meta cards, icons,
// section headings and the closing note.
//
// Built 2026-08-30 to the owner's reference design. Kept out of
// QuotePdf.tsx so that file stays the arrangement rather than the
// drawing, and under CLAUDE.md §10's line ceiling.
//
// Icons are drawn with react-pdf's Svg primitives. There is no icon font
// in a PDF and no lucide equivalent, so these are hand-built at the one
// size they are used — small, single-weight strokes that read at 9pt and
// print cleanly on a mono laser.

import { View, Text, Svg, Path, Circle, Rect } from "@react-pdf/renderer";
import { pdfStyles as s, BRAND, BRAND_DEEP } from "./_pdf-styles";

const STROKE = 1.4;

export function PhoneIcon({ size = 9, color = BRAND }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"
        stroke={color} strokeWidth={STROKE} fill="none"
      />
    </Svg>
  );
}

export function MailIcon({ size = 9, color = BRAND }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="2" y="4" width="20" height="16" rx="2" stroke={color} strokeWidth={STROKE} fill="none" />
      <Path d="M2 7l10 6 10-6" stroke={color} strokeWidth={STROKE} fill="none" />
    </Svg>
  );
}

export function PinIcon({ size = 9, color = BRAND }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" stroke={color} strokeWidth={STROKE} fill="none" />
      <Circle cx="12" cy="10" r="3" stroke={color} strokeWidth={STROKE} fill="none" />
    </Svg>
  );
}

export function DocIcon({ size = 9, color = BRAND }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke={color} strokeWidth={STROKE} fill="none" />
      <Path d="M14 2v6h6M8 13h8M8 17h5" stroke={color} strokeWidth={STROKE} fill="none" />
    </Svg>
  );
}

export function CalendarIcon({ size = 9, color = BRAND }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="3" y="5" width="18" height="16" rx="2" stroke={color} strokeWidth={STROKE} fill="none" />
      <Path d="M3 10h18M8 3v4M16 3v4" stroke={color} strokeWidth={STROKE} fill="none" />
    </Svg>
  );
}

export function ClockIcon({ size = 9, color = BRAND }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={STROKE} fill="none" />
      <Path d="M12 7v5l3 2" stroke={color} strokeWidth={STROKE} fill="none" />
    </Svg>
  );
}

export function InfoIcon({ size = 11, color = BRAND }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={STROKE} fill="none" />
      <Path d="M12 11v5M12 8h.01" stroke={color} strokeWidth={1.8} fill="none" />
    </Svg>
  );
}

export function ShieldIcon({ size = 10, color = BRAND }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke={color} strokeWidth={STROKE} fill="none" />
    </Svg>
  );
}

export function NoteIcon({ size = 10, color = BRAND }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 4h12l4 4v12H4z" stroke={color} strokeWidth={STROKE} fill="none" />
      <Path d="M8 11h8M8 15h6" stroke={color} strokeWidth={STROKE} fill="none" />
    </Svg>
  );
}

/** One contact line: icon, then text. */
export function ContactLine({
  icon, children,
}: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <View style={s.contactRow}>
      <View style={s.contactIcon}>{icon}</View>
      <Text style={s.contactText}>{children}</Text>
    </View>
  );
}

/**
 * One of the three cards top-right — quote number, date, valid until.
 * The tinted square is what stops them reading as a plain list.
 */
export function MetaCard({
  icon, label, value,
}: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View style={s.metaRow}>
      <View style={s.metaIconBox}>{icon}</View>
      <View>
        <Text style={s.metaLabel}>{label}</Text>
        <Text style={s.metaValue}>{value}</Text>
      </View>
    </View>
  );
}

/** A terms-column heading: icon, title, and a short rule beneath. */
export function SectionHeading({
  icon, title,
}: { icon: React.ReactNode; title: string }) {
  return (
    <View style={s.sectionHeadWrap}>
      <View style={s.sectionHeadRow}>
        <View style={s.sectionIcon}>{icon}</View>
        <Text style={s.sectionTitle}>{title}</Text>
      </View>
      <View style={s.sectionRule} />
    </View>
  );
}

/** A numbered clause with the number in the accent and a hanging indent. */
export function Clause({
  n, children, strong,
}: { n: number; children: string; strong?: boolean }) {
  return (
    <View style={s.clauseRow}>
      <Text style={s.clauseNum}>{n}.</Text>
      <Text style={strong ? s.clauseStrong : s.clauseText}>{children}</Text>
    </View>
  );
}

export { BRAND, BRAND_DEEP };
