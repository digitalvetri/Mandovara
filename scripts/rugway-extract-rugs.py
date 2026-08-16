"""Crop the top and bottom flat-rug images from every detail page
(pages 4-25). Output filenames encode source page + slot so the DB
import can pair each file to the right rug."""
from PIL import Image
from pathlib import Path

PAGES = Path(r"C:\Users\Administrator\Downloads\dv-mandavora\scripts\rugway-pages")
OUT   = Path(r"C:\Users\Administrator\Downloads\dv-mandavora\scripts\rugway-crops")
OUT.mkdir(parents=True, exist_ok=True)

# All detail pages share the same 950×1430 layout (surveyed on
# pages 4/5/11/22/25). See rugway-crop-test.py for the coordinate
# hunt that produced these.
TOP_RUG    = (640, 295, 933, 690)
BOTTOM_RUG = (640, 935, 933, 1330)

FIRST_DETAIL_PAGE = 4   # inclusive
LAST_DETAIL_PAGE  = 25  # inclusive

count = 0
for page in range(FIRST_DETAIL_PAGE, LAST_DETAIL_PAGE + 1):
    src = PAGES / f"page-{page:02d}.jpeg"
    if not src.exists():
        print(f"skip missing {src.name}")
        continue
    img = Image.open(src)
    for slot, box in [("a", TOP_RUG), ("b", BOTTOM_RUG)]:
        crop = img.crop(box)
        dst = OUT / f"rug-p{page:02d}{slot}.jpg"
        crop.save(dst, "JPEG", quality=90)
        count += 1
print(f"wrote {count} rug crops to {OUT}")
