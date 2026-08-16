"""Print all text-with-bbox + image-with-bbox on a given page so we can see
how {code}-N labels line up with embedded swatch images.

Usage: python scripts/fedora-inspect-page.py 10
"""
import re
import sys
import pymupdf
from pathlib import Path

PDF = Path(r"C:\Users\Administrator\Downloads\ARTBOOK VOL. 2_Fedora_GNI KOREA.pdf")
CODE_RE = re.compile(r"^\s*(57\d{3})-(\d{1,3})\s*$")

page_no = int(sys.argv[1]) if len(sys.argv) > 1 else 10
doc = pymupdf.open(PDF)
page = doc[page_no - 1]
print(f"page {page_no}: rect={page.rect}")

print("\n== text blocks matching {code}-N ==")
for block in page.get_text("dict")["blocks"]:
    if block.get("type") != 0:
        continue
    for line in block["lines"]:
        for span in line["spans"]:
            t = span["text"].strip()
            m = CODE_RE.match(t)
            if m:
                x0, y0, x1, y1 = span["bbox"]
                print(f"  label={t:>12} bbox=({x0:.0f},{y0:.0f})-({x1:.0f},{y1:.0f}) w={x1-x0:.0f} h={y1-y0:.0f}")

print("\n== embedded images with bbox on page ==")
for img in page.get_images(full=True):
    xref = img[0]
    try:
        rects = page.get_image_rects(xref)
    except Exception as e:
        print(f"  xref={xref}: error {e}")
        continue
    info = doc.extract_image(xref)
    for r in rects:
        print(f"  xref={xref:>5} native={info['width']}x{info['height']} .{info['ext']} bbox=({r.x0:.0f},{r.y0:.0f})-({r.x1:.0f},{r.y1:.0f}) w={r.width:.0f} h={r.height:.0f}")
