"""Test crop coordinates on a detail page. The flat rug lives in the
right-hand column of each product half. Pages are 950×1430 raw JPEG."""
from PIL import Image
from pathlib import Path

PAGES = Path(r"C:\Users\Administrator\Downloads\dv-mandavora\scripts\rugway-pages")
OUT = Path(r"C:\Users\Administrator\Downloads\dv-mandavora\scripts\rugway-crops-test")
OUT.mkdir(parents=True, exist_ok=True)

# Layout probe (image is 950 wide × 1430 tall on inspection):
#   header 0-90     — RUG WAY logo + collection name
#   product 1: 90-720  (top rug + room)
#   divider around 720
#   product 2: 720-1360
#   footer 1360-1430
# Right-column flat rug: from ~x=620 to x=940, sits after the price
# table (~y_start+120) and before the "runner set" strip (~y_end-130).

TOP_RUG    = (640, 295, 933, 690)   # (left, top, right, bottom)
BOTTOM_RUG = (640, 935, 933, 1330)

for page in [4, 5, 11, 22, 25]:
    src = PAGES / f"page-{page:02d}.jpeg"
    img = Image.open(src)
    print(f"page {page}: {img.size}")
    top = img.crop(TOP_RUG)
    bot = img.crop(BOTTOM_RUG)
    top.save(OUT / f"p{page:02d}-top.jpg", "JPEG", quality=90)
    bot.save(OUT / f"p{page:02d}-bot.jpg", "JPEG", quality=90)
print(f"wrote crops to {OUT}")
