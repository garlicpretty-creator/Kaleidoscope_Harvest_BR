"""Seed icons drawn in code, like vanilla wheat / melon seeds: a few small seeds scattered on a 16x16 grid.

Usage: python tools/art/seed_icons.py

RetroDiffusion draws "a pile of seeds" as one round blob, so every seed packet looked the same. Here each
seed kind has its own shape and colours, and the seeds are laid out on the same scatter for all of them.
Writes art/icons/<id>.png (the picked-icon folder that rd_icons.py `apply` copies into the pack) and
records the pick as "code" in art/icons/picks.json.
"""
import json
import os

from PIL import Image

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
ART = os.path.join(ROOT, "art", "icons")

# Seed shapes: rows of 'o' outline, 'b' body, 'h' highlight, 'w' mark (hilum, tip, inner seed; drawn in the
# kind's optional 6th colour), relative to the seed's top-left.
SHAPES = {
    "round": [".oo.", "ohbo", "obbo", ".oo."],
    "small": [".o.", "ohb", ".bo"],
    "flat": [".ooo.", "ohbbo", ".ooo."],
    "teardrop": [".o.", "ohb", "obb", ".o."],
    "kernel": ["oooo", "ohbo", "obbo", ".oo."],
    "spiky": ["o.o", ".h.", "obo"],
    "long": ["oh", "bb", "bo"],
    "ring": [".oo.", "o..b", "h..b", ".bb."],
    # 1.1
    "wedge": ["o...", "oho.", "obbo", ".ooo"],
    "ridged": ["o.o.", "ohbo", "obbo", ".o.o"],
    "tilted": [".oo", "ohb", "oo."],
    "bean": [".ooo.", "ohbbo", "obwbo", ".ooo."],
    "pea": [".oo.", "ohbo", "obwo", ".oo."],
    "husk": ["h.b", "owo", ".o."],
    "lotus": [".ow.", "ohbo", "obbo", "obbo", ".oo."],
}
# Where seeds go (top-left), the same scatter for every kind, kept inside the 16x16 frame
SCATTER = [(2, 3), (8, 1), (11, 6), (4, 8), (9, 10), (2, 12), (12, 12)]

SEEDS = {
    # id: (shape, outline, body, highlight, how many of the scatter to use)
    "napa_cabbage_seeds": ("small", (52, 30, 20), (98, 62, 40), (140, 98, 66), 7),
    "bok_choy_seeds": ("small", (60, 24, 18), (120, 52, 36), (160, 90, 64), 7),
    "spinach_seeds": ("spiky", (92, 82, 50), (176, 160, 104), (214, 204, 152), 6),
    "daikon_seeds": ("round", (78, 52, 30), (150, 108, 66), (196, 156, 108), 5),
    "eggplant_seeds": ("flat", (150, 136, 96), (222, 210, 168), (244, 238, 210), 5),
    "cucumber_seeds": ("flat", (170, 160, 130), (236, 230, 210), (252, 250, 240), 5),
    "corn_seeds": ("kernel", (176, 120, 20), (240, 196, 50), (252, 232, 140), 6),
    "onion_seeds": ("small", (20, 18, 16), (58, 52, 46), (110, 100, 92), 6),
    "scallion_seeds": ("teardrop", (14, 14, 18), (44, 44, 52), (96, 96, 108), 6),
    "coriander_seeds": ("round", (130, 100, 54), (196, 160, 98), (230, 204, 150), 6),
    "passion_fruit_seeds": ("teardrop", (20, 16, 12), (56, 44, 30), (230, 190, 60), 6),
    "sesame": ("small", (176, 160, 128), (238, 228, 204), (252, 250, 240), 7),
    "chopped_scallion": ("ring", (40, 110, 30), (96, 176, 56), (226, 240, 200), 7),
    "cumin": ("long", (74, 54, 30), (132, 100, 58), (176, 144, 92), 7),
    # 1.1 (id: (..., mark colour for 'w'))
    "water_spinach_seeds": ("wedge", (52, 38, 26), (90, 70, 50), (138, 112, 84), 6),
    "bitter_melon_seeds": ("ridged", (140, 120, 84), (200, 180, 140), (232, 218, 186), 5),
    "luffa_seeds": ("flat", (16, 14, 14), (40, 36, 34), (92, 86, 80), 5),
    "garlic_chive_seeds": ("tilted", (10, 10, 10), (30, 28, 26), (84, 80, 76), 7),
    "adzuki_bean": ("bean", (82, 16, 22), (150, 40, 50), (200, 100, 100), 6, (230, 222, 204)),
    "mung_bean": ("pea", (44, 80, 34), (80, 130, 60), (134, 178, 98), 7, (196, 216, 164)),
    "sichuan_peppercorns": ("husk", (108, 24, 20), (180, 50, 40), (228, 108, 84), 7, (26, 20, 18)),
    "lotus_seeds": ("lotus", (172, 156, 116), (236, 226, 190), (252, 248, 232), 5, (150, 112, 70)),
}


def draw(shape, outline, body, light, count, mark=None):
    im = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    rows = SHAPES[shape]
    for sx, sy in SCATTER[:count]:
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                px, py = sx + x, sy + y
                if ch == "." or not (0 <= px < 16 and 0 <= py < 16):
                    continue
                im.putpixel((px, py), {"o": outline, "b": body, "h": light, "w": mark}[ch] + (255,))
    return im


def write_png(img, path):
    """Save unless the file already holds these pixels, so a rerun leaves committed files byte-identical."""
    if os.path.exists(path):
        with Image.open(path) as old:
            if old.size == img.size and old.convert("RGBA").tobytes() == img.convert("RGBA").tobytes():
                return
    img.save(path)


def main():
    os.makedirs(ART, exist_ok=True)
    picks_path = os.path.join(ART, "picks.json")
    picks = json.load(open(picks_path, encoding="utf8")) if os.path.exists(picks_path) else {}
    for seed_id, spec in SEEDS.items():
        write_png(draw(*spec), os.path.join(ART, seed_id + ".png"))
        picks[seed_id] = "code"
    with open(picks_path, "w", encoding="utf8") as f:
        json.dump(dict(sorted(picks.items())), f, indent=1)
        f.write("\n")
    sheet = Image.new("RGBA", (len(SEEDS) * 72, 72), (139, 139, 139, 255))
    for i, seed_id in enumerate(SEEDS):
        icon = Image.open(os.path.join(ART, seed_id + ".png")).resize((64, 64), Image.NEAREST)
        sheet.paste(icon, (i * 72 + 4, 4), icon)
    os.makedirs(os.path.join(ROOT, "art", "previews"), exist_ok=True)
    write_png(sheet, os.path.join(ROOT, "art", "previews", "seed_icons.png"))
    print("wrote", len(SEEDS), "seed icons")


if __name__ == "__main__":
    main()
