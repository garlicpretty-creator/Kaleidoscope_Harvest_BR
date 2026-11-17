"""Item icons for the placeable drinks, drawn to look like the block each one places.

Usage: python tools/art/drink_icons.py   (after tools/art/food_models.py; it reads that file's colours)

The first icons were picked on their own and showed tall glasses with fruit on the rim, a clay mug and a bowl,
while the blocks (tools/art/food_models.py) are a corked square bottle with a kraft label, a squat wine bottle
with a red paper diamond, and a blue-banded porcelain cup on a saucer. An icon should be the thing you put
down, so these are painted from the same palettes and the same parts, front view, one drink colour each.

Writes art/icons/<id>.png and packs/RP/textures/kaleidoscope_harvest/items/<id>.png, records the pick as
"code" in art/icons/picks.json, and a contact sheet art/previews/drink_icons.png.
"""
import json
import os

from PIL import Image

import food_models as F

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
ITEMS = os.path.join(ROOT, "packs", "RP", "textures", "kaleidoscope_harvest", "items")
ART = os.path.join(ROOT, "art", "icons")


def outlined(px):
    """16x16 image of px {(x, y): rgb}, with a dark rim taken from the pixel it borders, as vanilla icons have."""
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    for (x, y), c in px.items():
        img.putpixel((x, y), tuple(c) + (255,))
    for y in range(16):
        for x in range(16):
            if (x, y) in px:
                continue
            near = [px[n] for n in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)) if n in px]
            if near:
                r, g, b = near[0]
                img.putpixel((x, y), (r * 2 // 5, g * 2 // 5, b * 2 // 5, 255))
    return img


def bottle(item):
    J = F.R(F.BOTTLES[item], 0.72, 1.18)
    stamp = F.R(F.MARKS[item], 0.72, 1.18)[2] if item in F.MARKS else J[0]
    px = {}
    for x in (7, 8):                                       # cork
        px[(x, 2)] = F.CORK[3]
        px[(x, 3)] = F.CORK[2]
    for y in (4, 5):                                       # neck
        for x in range(6, 10):
            px[(x, y)] = F.GLASS[4] if x == 6 else F.GLASS[2]
    for y in range(6, 15):                                 # body: headspace, juice, kraft band, juice
        for x in range(5, 11):
            if y == 6:
                c = F.GLASS[2]
            elif y == 7:
                c = J[4]                                   # the juice surface line
            elif 9 <= y <= 11:
                c = stamp if x in (7, 8) and y == 10 else (F.KRAFT[4] if x % 3 == 0 else F.KRAFT[3])
            elif y == 12:
                c = F.KRAFT[1]                             # the label's lower edge, in its own shadow
            else:
                c = J[1] if y == 14 else J[2]
            if x == 5 and y not in (9, 10, 11, 12):
                c = F.GLASS[4]                             # highlight streak
            px[(x, y)] = c
    return outlined(px)


def wine(item):
    J = F.R(F.BOTTLES[item], 0.72, 1.18)
    px = {}
    for x in range(6, 10):                                 # red paper seal, tied with gold string
        px[(x, 2)] = F.RED_PAPER[3] if x % 2 else F.RED_PAPER[2]
        px[(x, 3)] = (230, 190, 90)
    for y in range(4, 7):                                  # neck
        for x in (7, 8):
            px[(x, y)] = F.GLASS[4] if x == 7 else F.GLASS[2]
    for y in range(7, 15):                                 # squat body
        for x in range(4, 12):
            c = F.GLASS[2] if y == 7 else (J[4] if y == 8 else (J[1] if y == 14 else J[2]))
            d = abs(x - 7.5) + abs(y - 11)
            if d <= 1.6:
                c = (232, 196, 96) if d < 0.9 else F.RED_PAPER[2]   # a red diamond paper with a gold mark
            elif x == 4:
                c = F.GLASS[4]
            px[(x, y)] = c
    return outlined(px)


def teacup(item):
    T = F.R(F.TEAS[item], 0.7, 1.3)
    P, B = F.PORCELAIN, F.BLUE
    px = {}
    for x, y in ((7, 2), (8, 3), (7, 4)):                  # steam
        px[(x, y)] = (236, 240, 240)
    for x in range(4, 12):                                 # the tea, seen a little from above
        px[(x, 7)] = P[4] if x in (4, 11) else (T[4] if x == 6 else T[2])
        px[(x, 6)] = P[4] if x in (4, 11) else T[3]
    for x in range(5, 11):
        px[(x, 5)] = P[4]                                  # far lip
    for y in range(8, 13):                                 # cup
        for x in range(4, 12):
            if y == 12 and x in (4, 11):
                continue
            c = P[4] if y == 8 else (B[3] if y == 9 and x % 2 else (P[1] if y == 12 else P[2]))
            px[(x, y)] = c
    for x, y in ((12, 9), (13, 10), (12, 11)):             # handle
        px[(x, y)] = P[3]
    for x in range(2, 14):                                 # saucer
        px[(x, 13)] = B[3] if x in (3, 12) else P[3]
    for x in range(4, 12):
        px[(x, 14)] = P[1]
    return outlined(px)


def icons():
    out = {}
    for item in F.BOTTLES:
        out[item] = wine(item) if item.endswith("_wine") else bottle(item)
    for item in F.TEAS:
        out[item] = teacup(item)
    return out


def main():
    picks_path = os.path.join(ART, "picks.json")
    picks = json.load(open(picks_path, encoding="utf8")) if os.path.exists(picks_path) else {}
    made = icons()
    for item, icon in made.items():
        icon.save(os.path.join(ART, item + ".png"))
        icon.save(os.path.join(ITEMS, item + ".png"))
        picks[item] = "code"
    with open(picks_path, "w", encoding="utf8") as f:
        json.dump(dict(sorted(picks.items())), f, indent=1)
        f.write("\n")
    sheet = Image.new("RGBA", (len(made) * 72, 72), (139, 139, 139, 255))
    for i, icon in enumerate(made.values()):
        big = icon.resize((64, 64), Image.NEAREST)
        sheet.paste(big, (i * 72 + 4, 4), big)
    sheet.save(os.path.join(ROOT, "art", "previews", "drink_icons.png"))
    print("wrote", len(made), "drink icons")


if __name__ == "__main__":
    main()
