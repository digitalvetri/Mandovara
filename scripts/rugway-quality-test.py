"""Compare page 5 at three resolutions:
 - embedded JPEG (whatever the PDF stores)
 - PyMuPDF rendered at 150 DPI (default is 72)
 - PyMuPDF rendered at 300 DPI
If the source is a flattened raster, the higher-DPI renders are just
upscales of the same pixels and file size / detail won't grow much."""
import pymupdf
from pathlib import Path

PDF = Path(r"C:\Users\Administrator\Downloads\product catalog\Rugway Rugs-.pdf")
OUT = Path(r"C:\Users\Administrator\Downloads\dv-mandavora\scripts\rugway-quality")
OUT.mkdir(exist_ok=True)

doc = pymupdf.open(PDF)
page = doc[4]  # 0-indexed → page 5

# Embedded raster
for im in page.get_images(full=True):
    info = doc.extract_image(im[0])
    dst = OUT / f"embedded.{info['ext']}"
    dst.write_bytes(info["image"])
    print(f"embedded: {info['width']}x{info['height']} · {info['ext']} · {dst.stat().st_size} bytes")

# Render at 150 DPI (zoom 2×)
pix2 = page.get_pixmap(matrix=pymupdf.Matrix(2, 2))
pix2.save(OUT / "render-150dpi.png")
print(f"render 150dpi: {pix2.width}x{pix2.height} · {(OUT / 'render-150dpi.png').stat().st_size} bytes")

# Render at 300 DPI (zoom ~4.17× ; 300/72)
pix4 = page.get_pixmap(matrix=pymupdf.Matrix(300/72, 300/72))
pix4.save(OUT / "render-300dpi.png")
print(f"render 300dpi: {pix4.width}x{pix4.height} · {(OUT / 'render-300dpi.png').stat().st_size} bytes")
