"""Social preview cards: the 1200x630 image shown when a page's link is shared.

One card for the home page, one per module and one per lesson, drawn with Pillow using the
bundled DejaVu Sans fonts (scripts/assets/fonts, Bitstream Vera licence), so they look the same
on every machine that builds the site.
"""
from __future__ import annotations

import hashlib
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont
from PIL.PngImagePlugin import PngInfo

FONTS = Path(__file__).resolve().parent.parent / "assets" / "fonts"
W, H = 1200, 630
# the site's dark panel, its text greys, and the activation scale (viridis: started, practised, strong, mastered)
BG_TOP, BG_BOTTOM = (15, 13, 21), (23, 20, 31)
INK, INK_2, INK_3 = (241, 239, 247), (191, 186, 205), (142, 137, 160)
A1, A2, A3, A4 = (59, 82, 139), (33, 145, 140), (94, 201, 98), (253, 231, 37)
VERSION = 3                                                    # bump when the card design changes


def _font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONTS / ("DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf")), size)


def _hex(color: str) -> tuple[int, int, int]:
    color = color.lstrip("#")
    return tuple(int(color[i:i + 2], 16) for i in (0, 2, 4))


def _wrap(draw: ImageDraw.ImageDraw, text: str, font, width: int, max_lines: int) -> list[str]:
    words, lines, line = text.split(), [], ""
    for w in words:
        trial = (line + " " + w).strip()
        if draw.textlength(trial, font=font) <= width:
            line = trial
        else:
            if line:
                lines.append(line)
            line = w
    if line:
        lines.append(line)
    if len(lines) > max_lines:
        lines = lines[:max_lines]
        while draw.textlength(lines[-1] + "…", font=font) > width and " " in lines[-1]:
            lines[-1] = lines[-1].rsplit(" ", 1)[0]
        lines[-1] += "…"
    return lines


def _logo(img: Image.Image, x: int, y: int, size: int) -> None:
    """The site's mark, as in the top bar: a small network whose nodes climb the activation scale."""
    s = size / 32
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    ins, mid, out = [(6, 10), (6, 22)], [(16, 6), (16, 16), (16, 26)], (26, 16)
    p = lambda q: (x + q[0] * s, y + q[1] * s)
    for a in ins:
        for b in mid:
            d.line([p(a), p(b)], fill=(*INK, 90), width=max(1, int(1.2 * s)))
    for b in mid:
        d.line([p(b), p(out)], fill=(*INK, 90), width=max(1, int(1.2 * s)))
    for q, col, r in [(ins[0], A1, 3.2), (ins[1], A1, 3.2), (mid[0], A2, 3.2), (mid[1], A3, 3.2), (mid[2], A2, 3.2), (out, A4, 4)]:
        cx, cy = p(q)
        d.ellipse((cx - r * s, cy - r * s, cx + r * s, cy + r * s), fill=col)
    img.paste(layer, (0, 0), layer)


def render_card(path: Path, *, kicker: str, title: str, subtitle: str = "", chips: list[str] | None = None,
                brand: str = "Deep Learning Lab", course: str = "", site: str = "") -> None:
    # skip the drawing when an identical card is already on disk (the key is stored inside the PNG)
    key = hashlib.sha1(repr((VERSION, kicker, title, subtitle, chips, brand, course, site)).encode()).hexdigest()
    if path.exists():
        try:
            if Image.open(path).text.get("dlp-key") == key:
                return
        except Exception:
            pass
    img = Image.new("RGB", (W, H), BG_TOP)
    d = ImageDraw.Draw(img)
    for yy in range(H):                                        # soft vertical gradient
        t = yy / H
        d.line([(0, yy), (W, yy)], fill=tuple(int(BG_TOP[i] + (BG_BOTTOM[i] - BG_TOP[i]) * t) for i in range(3)))
    # a faint teal glow in the top-right corner, and the activation scale as a stripe down the left edge
    glow = Image.new("L", (W, H), 0)
    ImageDraw.Draw(glow).ellipse((W - 360, -260, W + 260, 300), fill=70)
    glow = glow.filter(ImageFilter.GaussianBlur(110))
    img.paste(Image.new("RGB", (W, H), A2), (0, 0), glow)
    d = ImageDraw.Draw(img)
    for i, col in enumerate((A1, A2, A3, A4)):
        d.rectangle((0, i * H // 4, 12, (i + 1) * H // 4), fill=col)

    x = 80
    _logo(img, x, 64, 56)
    d = ImageDraw.Draw(img)
    d.text((x + 76, 66), brand, font=_font(30, True), fill=INK)
    if course:
        d.text((x + 76, 104), course, font=_font(20), fill=INK_3)

    d.text((x, 196), kicker.upper(), font=_font(26, True), fill=A4)
    title_font = _font(66, True)
    lines = _wrap(d, title, title_font, W - 2 * x, 3)
    if len(lines) == 3:
        title_font = _font(56, True)
        lines = _wrap(d, title, title_font, W - 2 * x, 3)
    y = 240
    for ln in lines:
        d.text((x, y), ln, font=title_font, fill=INK)
        y += int(title_font.size * 1.18)
    if subtitle:
        for ln in _wrap(d, subtitle, _font(28), W - 2 * x, 2):
            d.text((x, y + 8), ln, font=_font(28), fill=INK_2)
            y += 38

    cx, cy = x, H - 96
    chip_font = _font(22, True)
    for c in chips or []:
        tw = d.textlength(c, font=chip_font)
        d.rounded_rectangle((cx, cy, cx + tw + 36, cy + 46), radius=10, outline=(59, 53, 73), width=2, fill=(33, 29, 43))
        d.text((cx + 18, cy + 10), c, font=chip_font, fill=INK)
        cx += tw + 52
    if site:
        sf = _font(20)
        d.text((W - 80 - d.textlength(site, font=sf), 82), site, font=sf, fill=INK_2)
    path.parent.mkdir(parents=True, exist_ok=True)
    info = PngInfo()
    info.add_text("dlp-key", key)
    img.save(path, "PNG", optimize=True, pnginfo=info)
