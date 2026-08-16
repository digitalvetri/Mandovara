"""Scan each page for embedded design/colourway codes (57xxx and 57xxx-N)."""
import re
import pymupdf
from pathlib import Path
from collections import defaultdict

PDF = Path(r"C:\Users\Administrator\Downloads\ARTBOOK VOL. 2_Fedora_GNI KOREA.pdf")

CODE_RE = re.compile(r"\b(57\d{3})(?:-(\d{1,3}))?\b")

doc = pymupdf.open(PDF)
by_page = {}
for i, page in enumerate(doc, start=1):
    text = page.get_text("text") or ""
    hits = defaultdict(set)          # design -> {colourway suffix or "" if only bare design}
    for m in CODE_RE.finditer(text):
        design, suffix = m.group(1), m.group(2)
        hits[design].add(suffix or "")
    by_page[i] = hits

# per-page report
print("== per-page codes ==")
for pg, hits in by_page.items():
    if not hits:
        print(f"p{pg:02d}: (no codes)")
        continue
    parts = []
    for d in sorted(hits):
        suffixes = sorted(x for x in hits[d] if x)
        parts.append(f"{d}({','.join(suffixes) if suffixes else '-'})")
    print(f"p{pg:02d}: {' '.join(parts)}")

# aggregate: design -> {suffixes seen anywhere} and detail-page list
print("\n== aggregate ==")
agg_suffixes = defaultdict(set)
detail_pages = defaultdict(list)
for pg, hits in by_page.items():
    for d, suf in hits.items():
        agg_suffixes[d].update(x for x in suf if x)
        if any(x for x in suf if x):
            detail_pages[d].append(pg)

designs = sorted(agg_suffixes)
print(f"designs found: {len(designs)}")
for d in designs:
    ss = sorted(int(x) for x in agg_suffixes[d]) if agg_suffixes[d] else []
    print(f"  {d}: {len(ss)} colourways {ss} — detail pages {detail_pages[d]}")
