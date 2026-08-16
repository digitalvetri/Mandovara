"""Extract per-colourway swatch images from Fedora detail pages.

Pairs each embedded rectangular swatch image with the `{code}-N` label
that sits directly below it, then writes the image's raw bytes to
scripts/fedora-swatches/{code}-{N}.{ext}.

Vector-outlined labels (page 24 = 57225) don't extract as text, so
those crops fall back to hand-tuned rectangles at the end.
"""
import re
import pymupdf
from pathlib import Path

PDF = Path(r"C:\Users\Administrator\Downloads\ARTBOOK VOL. 2_Fedora_GNI KOREA.pdf")
OUT = Path(r"C:\Users\Administrator\Downloads\dv-mandavora\scripts\fedora-swatches")
OUT.mkdir(parents=True, exist_ok=True)

CODE_RE = re.compile(r"^\s*(57\d{3})-(\d{1,3})\s*$")

# Design code -> primary detail page (from the scan). Multi-page designs
# use the first page; second page's extras (if any) are picked up when
# scanning all pages anyway — the map is just "designs we care about".
DESIGN_PAGES = {
    "57233": [10, 11], "57232": [12, 13], "57231": [14, 15],
    "57230": [16, 17], "57229": [18, 19], "57228": [20],
    "57226": [22, 23], "57225": [24], "57224": [25],
    "57223": [26], "57222": [27], "57220": [28],
    "57219": [29], "57215": [30], "57210": [31, 33],
    "57208": [34], "57206": [35], "57205": [36],
    "57204": [37], "57202": [37], "57198": [38],
    "57196": [39], "57190": [40], "57189": [41],
    "57160": [42], "57149": [43],
}

# Manual fallback for pages where labels are vector outlines (not text)
# and can't be matched to images programmatically. Rects are in PDF
# user-space (points), same coordinate system as page.rect (768x1023).
# For 57225 page 24, the visible swatch-3 and swatch-4 tiles at bottom.
MANUAL_CROPS = {
    "57225-3": {"page": 24, "rect": (35, 830, 375, 970)},
    "57225-4": {"page": 24, "rect": (395, 830, 735, 970)},
}


def is_swatch_shape(w, h):
    """Heuristic: swatch tiles are small-ish rectangles, wider than tall,
    but the lifestyle photo can be big — filter it out. Real Fedora swatch
    tiles top out around 165x117; some pages use 204x117. Anything taller
    than ~230 is almost certainly an inset lifestyle photo."""
    if w < 40 or h < 40:
        return False
    if w > 380 or h > 230:
        return False
    return True


def label_matches_image(img_bbox, lbl_bbox, max_gap=50, max_overlap=40):
    """True if a label sits directly below (or slightly overlapping the
    bottom of) the given image. Layouts often overlap the label into the
    tile's bottom by a few points for tight visual grouping."""
    ix0, _iy0, ix1, iy1 = img_bbox
    lx0, ly0, lx1, _ly1 = lbl_bbox
    if not (iy1 - max_overlap <= ly0 <= iy1 + max_gap):
        return False
    lcx = (lx0 + lx1) / 2
    return ix0 - 8 <= lcx <= ix1 + 8


def main():
    doc = pymupdf.open(PDF)
    pairs = []  # (code_full, ext, bytes)
    pages_processed = set()

    for design_code, pages in DESIGN_PAGES.items():
        for pg_num in pages:
            if pg_num in pages_processed:
                continue
            pages_processed.add(pg_num)
            page = doc[pg_num - 1]

            # Collect labels on this page (any {code}-N).
            labels = []
            for block in page.get_text("dict")["blocks"]:
                if block.get("type") != 0:
                    continue
                for line in block["lines"]:
                    for span in line["spans"]:
                        m = CODE_RE.match(span["text"])
                        if not m:
                            continue
                        labels.append({
                            "code": m.group(1),
                            "n":    int(m.group(2)),
                            "bbox": span["bbox"],
                        })

            # Collect embedded images with their bounding boxes.
            imgs = []
            for img in page.get_images(full=True):
                xref = img[0]
                try:
                    rects = page.get_image_rects(xref)
                except Exception:
                    continue
                info = doc.extract_image(xref)
                for r in rects:
                    w, h = r.width, r.height
                    if not is_swatch_shape(w, h):
                        continue
                    imgs.append({
                        "xref": xref,
                        "bbox": (r.x0, r.y0, r.x1, r.y1),
                        "info": info,
                    })

            # Match each image to its nearest label directly below.
            used_labels = set()
            for image in imgs:
                candidates = []
                for i, lbl in enumerate(labels):
                    if i in used_labels:
                        continue
                    if label_matches_image(image["bbox"], lbl["bbox"]):
                        vgap = lbl["bbox"][1] - image["bbox"][3]
                        candidates.append((vgap, i, lbl))
                if not candidates:
                    continue
                candidates.sort(key=lambda t: t[0])
                _, best_idx, best_lbl = candidates[0]
                used_labels.add(best_idx)
                pairs.append({
                    "code_full": f"{best_lbl['code']}-{best_lbl['n']}",
                    "ext":       image["info"]["ext"],
                    "bytes":     image["info"]["image"],
                    "source":    f"p{pg_num}",
                })

    # Manual fallback crops for pages where labels aren't extractable.
    for code_full, spec in MANUAL_CROPS.items():
        page = doc[spec["page"] - 1]
        clip = pymupdf.Rect(*spec["rect"])
        pix = page.get_pixmap(clip=clip, dpi=200)
        pairs.append({
            "code_full": code_full,
            "ext":       "png",
            "bytes":     pix.tobytes("png"),
            "source":    f"p{spec['page']} manual",
        })

    # Decode JPX → JPG (browsers don't render JPEG-2000).
    decoded = []
    for p in pairs:
        ext = p["ext"]
        data = p["bytes"]
        if ext == "jpx":
            try:
                pix = pymupdf.Pixmap(data)
                if pix.n > 4:
                    pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
                data = pix.tobytes("jpg", jpg_quality=88)
                ext = "jpg"
            except Exception as e:
                print(f"  skip {p['code_full']}: JPX decode failed ({e})")
                continue
        decoded.append({**p, "ext": ext, "bytes": data})

    # Duplicate labels on the same page (e.g. 57160-39 appears near a
    # lifestyle inset AND under a swatch tile) mean the same code can
    # match TWO different images. Keep the SMALLEST — swatch tiles are
    # tightly cropped and small; misfired matches on lifestyle insets
    # weigh ~10-30x more.
    best = {}
    for p in decoded:
        cur = best.get(p["code_full"])
        if cur is None or len(p["bytes"]) < len(cur["bytes"]):
            best[p["code_full"]] = p

    # Also drop implausibly tiny matches (<3KB decoded) — those are
    # decorative dingbats, not real swatches. Leaves a gap the importer
    # will render as the hex-swatch fallback.
    written = 0
    dropped_small = 0
    for code_full, p in sorted(best.items()):
        if len(p["bytes"]) < 3000:
            dropped_small += 1
            print(f"  drop {code_full}: too small ({len(p['bytes'])} bytes) — likely icon")
            continue
        dst = OUT / f"{code_full}.{p['ext']}"
        dst.write_bytes(p["bytes"])
        written += 1
        print(f"  {code_full:>12} .{p['ext']} {len(p['bytes']):>7} bytes  <- {p['source']}")

    print(f"\nwrote {written} swatch images, dropped {dropped_small} implausibly small")


if __name__ == "__main__":
    main()
