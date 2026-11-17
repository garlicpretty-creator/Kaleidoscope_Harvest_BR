"""Pack icon and README banner for Kaleidoscope Harvest.

Built from the Fishing Voyage pack icon and banner so the series matches:
the teal of Fishing Voyage is re-hued to persimmon red, the second title
line becomes HARVEST (drawn in the same two-tone block letters), and the
rod / fish are swapped for Harvest's own corn and persimmon icons.

    python3 art_src/branding/make_branding.py FISHING_REPO [out_dir]

FISHING_REPO is a checkout of Kaleidoscope_Fishing_Voyage_BR. Needs Pillow;
not part of the Node build.
"""
import colorsys
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
HUE = 0.036  # persimmon red


def rehue(img):
    """Move every teal/cyan pixel to the persimmon hue, keeping S and V."""
    img = img.convert("RGBA")
    px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = px[x, y]
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if 0.22 < h < 0.62 and s > 0.12:
                r2, g2, b2 = colorsys.hsv_to_rgb(HUE, s, v)
                px[x, y] = (round(r2 * 255), round(g2 * 255), round(b2 * 255), a)
    return img


# Two-tone block letters in the style of the Fishing Voyage title:
# stems are two cells wide, and the last cell of each horizontal run is
# drawn in the darker shade.
GLYPHS = {
    "H": ["XX.XX", "XX.XX", "XXXXX", "XX.XX", "XX.XX"],
    "A": ["XXXXX", "XX.XX", "XXXXX", "XX.XX", "XX.XX"],
    "R": ["XXXX.", "XX.XX", "XXXX.", "XX.XX", "XX.XX"],
    "V": ["XX.XX", "XX.XX", "XX.XX", "XX.XX", ".XXX."],
    "E": ["XXXX", "XX..", "XXX.", "XX..", "XXXX"],
    "S": ["XXXX", "XX..", "XXXX", "..XX", "XXXX"],
    "T": ["XXXXXX", "..XX..", "..XX..", "..XX..", "..XX.."],
}


def word_cells(word):
    return sum(len(GLYPHS[c][0]) for c in word) + len(word) - 1


def draw_word(d, word, x, y, cell, light, shade):
    for ch in word:
        g = GLYPHS[ch]
        for gy, row in enumerate(g):
            for gx, v in enumerate(row):
                if v != "X":
                    continue
                run_end = gx + 1 >= len(row) or row[gx + 1] != "X"
                run_len2 = gx > 0 and row[gx - 1] == "X"
                col = shade if run_end and run_len2 else light
                X, Y = x + gx * cell, y + gy * cell
                d.rectangle([X, Y, X + cell - 1, Y + cell - 1], fill=col)
        x += (len(g[0]) + 1) * cell


def paste_icon(img, name, cx, cy, k):
    icon = Image.open(ROOT / "art" / "icons" / f"{name}.png").convert("RGBA")
    icon = icon.resize((icon.width * k, icon.height * k), Image.NEAREST)
    img.alpha_composite(icon, (cx - icon.width // 2, cy - icon.height // 2))


def make_icon(fishing):
    src = Image.open(fishing / "Kaleidoscope Fishing Voyage [RP]" / "pack_icon.png")
    return rehue(src)


def make_banner(fishing):
    img = rehue(Image.open(fishing / "docs" / "banner.png"))
    d = ImageDraw.Draw(img)
    bg = (17, 17, 17, 255)
    # sample the second line's colours before erasing it
    light = img.getpixel((200, 690))
    shade = img.getpixel((245, 690))
    # clear rod, fish and the second title line
    d.rectangle([150, 130, 560, 500], fill=bg)
    d.rectangle([990, 130, 1400, 500], fill=bg)
    d.rectangle([150, 660, 1410, 790], fill=bg)
    # corn and persimmon in place of rod and fish
    paste_icon(img, "corn", 380, 315, 20)
    paste_icon(img, "persimmon", 1190, 315, 20)
    cell = 20
    w = word_cells("HARVEST") * cell
    draw_word(d, "HARVEST", (img.width - w) // 2, 672, cell, light, shade)
    return img.convert("RGB")


if __name__ == "__main__":
    fishing = Path(sys.argv[1])
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT
    out.mkdir(parents=True, exist_ok=True)
    make_icon(fishing).save(out / "pack_icon.png")
    make_banner(fishing).save(out / "banner.png")
    print("wrote", out)
