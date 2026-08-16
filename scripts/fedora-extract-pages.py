"""Extract each page's flattened image from the Fedora / GNI KOREA artbook so we can inspect the grid layout."""
import pymupdf
from pathlib import Path

PDF = Path(r"C:\Users\Administrator\Downloads\ARTBOOK VOL. 2_Fedora_GNI KOREA.pdf")
OUT = Path(r"C:\Users\Administrator\Downloads\dv-mandavora\scripts\fedora-pages")
OUT.mkdir(parents=True, exist_ok=True)

DPI = 200

doc = pymupdf.open(PDF)
print(f"pages={doc.page_count}")
for i, page in enumerate(doc):
    pix = page.get_pixmap(dpi=DPI)
    out = OUT / f"page-{i+1:02d}.png"
    pix.save(out)
    print(f"page {i+1:02d}: {pix.width}x{pix.height} -> {out.name}")

print(f"wrote {doc.page_count} pages at {DPI}dpi to {OUT}")
