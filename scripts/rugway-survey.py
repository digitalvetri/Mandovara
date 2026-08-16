"""Survey the Rugway PDF: page count, embedded-image count per page,
average image resolution, and any text near each image (names/prices)."""
import pymupdf
from pathlib import Path

PDF = Path(r"C:\Users\Administrator\Downloads\product catalog\Rugway Rugs-.pdf")
doc = pymupdf.open(PDF)

print(f"pages: {doc.page_count}")
total_imgs = 0
for i, page in enumerate(doc):
    imgs = page.get_images(full=True)
    total_imgs += len(imgs)
    print(f"page {i+1}: {len(imgs)} images")
    if i < 2:
        # sample first two pages for detail
        for j, im in enumerate(imgs[:5]):
            xref = im[0]
            info = doc.extract_image(xref)
            print(f"  img {j+1}: xref={xref} ext={info['ext']} {info['width']}x{info['height']}")
        # also show any text on the page
        text = page.get_text().strip()
        if text:
            print(f"  --- text (first 300 chars) ---")
            print(f"  {text[:300]}")
print(f"total images: {total_imgs}")
