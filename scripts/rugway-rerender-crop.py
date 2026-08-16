"""Re-render detail pages 4-25 at 300 DPI (vs the embedded 950×1430
raster) and re-crop each rug. The PDF's source is a flattened raster,
so this doesn't add real detail — but it hands the browser ~5× more
pixels per rug (676×911 vs 293×395), which is enough to stop looking
blurry inside the /products card and PDP hero."""
import pymupdf
from PIL import Image
from pathlib import Path
from io import BytesIO

PDF = Path(r"C:\Users\Administrator\Downloads\product catalog\Rugway Rugs-.pdf")
OUT = Path(r"C:\Users\Administrator\Downloads\dv-mandavora\scripts\rugway-crops-hi")
OUT.mkdir(parents=True, exist_ok=True)

# Zoom factor to reach ~300 DPI. Page render will be ~2192×3300.
ZOOM = 300 / 72
matrix = pymupdf.Matrix(ZOOM, ZOOM)

# Crop coords were tuned against the 950×1430 embedded raster. Scale
# them proportionally to the 2192×3300 render space.
SCALE = 2192 / 950
TOP_RUG_LO    = (640, 295, 933, 690)
BOTTOM_RUG_LO = (640, 935, 933, 1330)
def scale(box):
    return tuple(round(v * SCALE) for v in box)
TOP_RUG    = scale(TOP_RUG_LO)
BOTTOM_RUG = scale(BOTTOM_RUG_LO)
print(f"TOP_RUG (hi-res) = {TOP_RUG}")
print(f"BOTTOM_RUG (hi-res) = {BOTTOM_RUG}")

doc = pymupdf.open(PDF)
FIRST, LAST = 4, 25
count = 0
for page_idx in range(FIRST - 1, LAST):
    page = doc[page_idx]
    pix = page.get_pixmap(matrix=matrix)
    img = Image.open(BytesIO(pix.tobytes("png"))).convert("RGB")
    if page_idx == FIRST - 1:
        print(f"render size = {img.size}")
    page_no = page_idx + 1
    for slot, box in [("a", TOP_RUG), ("b", BOTTOM_RUG)]:
        crop = img.crop(box)
        dst = OUT / f"rug-p{page_no:02d}{slot}.jpg"
        crop.save(dst, "JPEG", quality=92, optimize=True)
        count += 1
print(f"wrote {count} hi-res crops (~{TOP_RUG[2]-TOP_RUG[0]}×{TOP_RUG[3]-TOP_RUG[1]}) to {OUT}")
