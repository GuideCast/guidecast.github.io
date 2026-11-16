# Generates PWA icons: teal square with white "G" (same look as the header logo).
from PIL import Image, ImageDraw, ImageFont
TEAL = (13, 148, 136)  # tailwind teal-600
FONT = "C:/Windows/Fonts/arialbd.ttf"

def make(size, path, rounded, glyph_ratio):
    img = Image.new("RGBA", (size, size), TEAL + (255,) if not rounded else (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if rounded:
        d.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * 0.22), fill=TEAL + (255,))
    f = ImageFont.truetype(FONT, int(size * glyph_ratio))
    d.text((size / 2, size / 2), "G", font=f, fill="white", anchor="mm")
    img.save(path)

make(192, "public/icons/icon-192.png", True, 0.62)
make(512, "public/icons/icon-512.png", True, 0.62)
make(512, "public/icons/icon-maskable-512.png", False, 0.46)  # full bleed, glyph inside safe zone
make(180, "public/icons/apple-touch-icon.png", False, 0.56)
