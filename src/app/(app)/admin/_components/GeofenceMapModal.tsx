"use client";

// "View on Map" — see the geofence before it locks someone out.
//
// The owner's point (2026-08-29): latitude, longitude and radius are
// three raw numbers, and a typo in any of them is invisible until an
// employee is standing at the showroom unable to punch in. A digit
// dropped from the longitude puts the fence in another district and
// nothing on the form looks wrong.
//
// No mapping library and no API key. OpenStreetMap's embed renders a
// bounding box we compute ourselves, and the radius circle is drawn over
// it — which is only honest if the box and the frame agree, so:
//
//   · the bounding box is built square IN METRES, correcting longitude
//     for latitude (a degree of longitude shrinks by cos(lat)),
//   · the frame is forced square by aspect-ratio,
//   · the circle's diameter is therefore exactly 1/MARGIN of the frame.
//
// Get any of those three wrong and the circle would be a decoration that
// lies about coverage, which is worse than no circle at all.

import { X, ExternalLink } from "lucide-react";

/** How many radii wide the viewport is. 2.5 leaves visible context. */
const MARGIN = 2.5;
const METRES_PER_DEG_LAT = 111_320;

interface Props {
  lat:    number;
  lng:    number;
  radius: number;
  label:  string;
  onClose: () => void;
}

export function GeofenceMapModal({ lat, lng, radius, label, onClose }: Props) {
  const halfSpanM = radius * MARGIN;
  const dLat = halfSpanM / METRES_PER_DEG_LAT;
  // cos(lat) guarded: at the poles this collapses, and a division by ~0
  // would produce an infinite box.
  const cos = Math.max(Math.cos((lat * Math.PI) / 180), 0.01);
  const dLng = halfSpanM / (METRES_PER_DEG_LAT * cos);

  const bbox = [lng - dLng, lat - dLat, lng + dLng, lat + dLat]
    .map((n) => n.toFixed(6))
    .join(",");

  const src =
    `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}` +
    `&layer=mapnik&marker=${lat.toFixed(6)},${lng.toFixed(6)}`;

  // Circle spans 2 radii of a 2*MARGIN-radius-wide box.
  const circlePct = (1 / MARGIN) * 100;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Geofence map for ${label}`}
    >
      <div className="w-full max-w-[560px] rounded-[14px] border border-rule bg-surface p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-text">{label} — check-in area</h2>
            <p className="mt-0.5 text-[12.5px] text-text-dim tabular-nums">
              {lat.toFixed(6)}, {lng.toFixed(6)} · {radius}m radius
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close map"
            className="rounded-[6px] p-1 text-text-dim transition-colors hover:bg-surface-2 hover:text-text"
          >
            <X size={16} />
          </button>
        </div>

        <div className="relative w-full overflow-hidden rounded-[10px] border border-rule" style={{ aspectRatio: "1 / 1" }}>
          <iframe
            title={`Map of ${label}`}
            src={src}
            className="absolute inset-0 h-full w-full"
            style={{ border: 0 }}
            loading="lazy"
          />
          {/* Radius overlay. pointer-events-none so the map stays draggable. */}
          <div
            aria-hidden
            className="pointer-events-none absolute rounded-full border-2 border-accent"
            style={{
              width: `${circlePct}%`,
              height: `${circlePct}%`,
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              backgroundColor: "rgba(27, 138, 126, 0.15)",
            }}
          />
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-[12px] text-text-dim">
            The shaded circle is the area a punch is accepted from. If it is not
            over your showroom, the coordinates are wrong.
          </p>
          <a
            href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1 text-[12.5px] text-accent hover:underline"
          >
            Open larger <ExternalLink size={11} />
          </a>
        </div>
      </div>
    </div>
  );
}
