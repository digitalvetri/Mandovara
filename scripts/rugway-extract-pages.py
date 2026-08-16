"""Extract each page's flattened image so we can inspect the grid layout."""
import pymupdf
from pathlib import Path

PDF = Path(r"C:\Users\Administrator\Downloads\product catalog\Rugway Rugs-.pdf")
OUT = Path(r"C:\Users\Administrator\Downloads\dv-mandavora\scripts\rugway-pages")
OUT.mkdir(parents=True, exist_ok=True)

doc = pymupdf.open(PDF)
for i, page in enumerate(doc):
    for im in page.get_images(full=True):
        info = doc.extract_image(im[0])
        (OUT / f"page-{i+1:02d}.{info['ext']}").write_bytes(info["image"])
print(f"wrote {doc.page_count} page images to {OUT}")
