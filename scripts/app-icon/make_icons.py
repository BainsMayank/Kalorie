"""Draws Kalorie's app icon, Android adaptive-icon layers, splash mark and favicon into assets/,
and the Play Store graphics (512×512 icon, 1024×500 feature graphic) into store/.

The mark is a katori (bowl) inside an almost-closed ring, the calorie ring from the Today
screen. Monochrome, like the rest of the app (SPEC §8.1). Run from the project root:

    python3 scripts/app-icon/make_icons.py

Needs Python 3 with Pillow (`pip3 install pillow`). Drawn 4× larger, then scaled down so the
edges come out smooth. The feature graphic's lettering uses Avenir Next, which comes with macOS.
"""

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / "assets"
STORE = ROOT / "store"
SIZE = 1024
SCALE = 4  # draw at 4096 px, then shrink
DARK = (20, 20, 20, 255)  # colors.light.text, #141414
LIGHT = (242, 242, 242, 255)  # colors.dark.text, #F2F2F2
MUTED = (168, 168, 168, 255)  # colors.dark.textSecondary, #A8A8A8
FONT = "/System/Library/Fonts/Avenir Next.ttc"
FONT_DEMI_BOLD, FONT_MEDIUM = 2, 5  # style numbers inside the .ttc


def draw_mark(draw: ImageDraw.ImageDraw, cx: float, cy: float, r: float, color) -> None:
    """The ring and the katori, centred on (cx, cy); r is the ring's outer radius."""
    s = SCALE
    stroke = r * 0.2
    # Ring: 300° clockwise from the top, with round ends.
    box = [(cx - r) * s, (cy - r) * s, (cx + r) * s, (cy + r) * s]
    start, end = -90, 210
    draw.arc(box, start, end, fill=color, width=round(stroke * s))
    mid = r - stroke / 2
    for angle in (start, end):
        a = math.radians(angle)
        x, y = cx + mid * math.cos(a), cy + mid * math.sin(a)
        draw.ellipse(
            [(x - stroke / 2) * s, (y - stroke / 2) * s, (x + stroke / 2) * s, (y + stroke / 2) * s],
            fill=color,
        )
    # Katori: the lower half of a circle, with a rim a little wider than the bowl.
    bowl = r * 0.5
    rim_h = stroke * 0.55
    top = cy - (bowl - rim_h) / 2  # rim top to bowl bottom is centred on cy
    draw.pieslice(
        [(cx - bowl) * s, (top - bowl) * s, (cx + bowl) * s, (top + bowl) * s], 0, 180, fill=color
    )
    rim_w = bowl * 1.18
    draw.rounded_rectangle(
        [(cx - rim_w) * s, (top - rim_h) * s, (cx + rim_w) * s, (top + rim_h * 0.15) * s],
        radius=rim_h * 0.5 * s,
        fill=color,
    )


def render(background, color, ring_radius: float) -> Image.Image:
    big = Image.new("RGBA", (SIZE * SCALE, SIZE * SCALE), background)
    draw_mark(ImageDraw.Draw(big), SIZE / 2, SIZE / 2, ring_radius, color)
    return big.resize((SIZE, SIZE), Image.LANCZOS)


def feature_graphic() -> Image.Image:
    """Play Store feature graphic, 1024×500: the mark on the left, the name and a short line on the right.

    Google may crop the edges on some screens, so everything stays well inside them.
    """
    w, h = 1024, 500
    big = Image.new("RGBA", (w * SCALE, h * SCALE), DARK)
    draw = ImageDraw.Draw(big)
    draw_mark(draw, 250, h / 2, 135, LIGHT)
    name = ImageFont.truetype(FONT, 112 * SCALE, index=FONT_DEMI_BOLD)
    line = ImageFont.truetype(FONT, 34 * SCALE, index=FONT_MEDIUM)
    x = 450 * SCALE
    draw.text((x, 248 * SCALE), "Kalorie", font=name, fill=LIGHT, anchor="ls")
    for i, text in enumerate(("Calorie & nutrition tracker", "for Indian food.")):
        draw.text((x, (312 + i * 46) * SCALE), text, font=line, fill=MUTED, anchor="ls")
    return big.resize((w, h), Image.LANCZOS)


def main() -> None:
    clear = (0, 0, 0, 0)
    # iOS and the store listing: full square, no transparency.
    render(DARK, LIGHT, 330).convert("RGB").save(ASSETS / "icon.png")
    # Android adaptive icon: the mark must sit inside the middle 66 % (the launcher crops the rest).
    render(clear, LIGHT, 250).save(ASSETS / "android-icon-foreground.png")
    Image.new("RGB", (SIZE, SIZE), DARK[:3]).save(ASSETS / "android-icon-background.png")
    render(clear, (255, 255, 255, 255), 250).save(ASSETS / "android-icon-monochrome.png")
    # Splash mark (dark, for a light background) and the web favicon.
    render(clear, DARK, 330).save(ASSETS / "splash-icon.png")
    render(DARK, LIGHT, 330).resize((48, 48), Image.LANCZOS).save(ASSETS / "favicon.png")
    # Play Store listing: 512×512 icon (no transparency; Google rounds the corners itself) and
    # the 1024×500 feature graphic (no transparency either).
    STORE.mkdir(exist_ok=True)
    render(DARK, LIGHT, 330).convert("RGB").resize((512, 512), Image.LANCZOS).save(
        STORE / "icon-512.png"
    )
    feature_graphic().convert("RGB").save(STORE / "feature-graphic.png")


if __name__ == "__main__":
    main()
