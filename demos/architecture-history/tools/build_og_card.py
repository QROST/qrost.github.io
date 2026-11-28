#!/usr/bin/env python3
"""Render the 1200 x 630 share card from the published manifest.

The card used to be drawn once by hand, so its figures went stale with every
publish (it still announced 19 works and 0 verified in November 2026). This
script reads ``assets/data/manifest.json``, draws the card, and stores the
figures it drew in a ``counts`` tEXt chunk, so ``test_page_contract.py`` fails
when the card no longer matches the manifest.

Run it after ``db.py export`` whenever the manifest counts change, and commit
the PNG together with the data:

    python3 tools/build_og_card.py

Font paths default to the macOS system fonts named by the page's font stack;
pass --cjk / --serif / --sans to render the same card elsewhere.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from PIL.PngImagePlugin import PngInfo

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "assets" / "data" / "manifest.json"
CONFIG = ROOT / "assets" / "data" / "methodology" / "wikidata-coverage-config.json"
OUTPUT = ROOT / "assets" / "img" / "architecture-history-og.png"

WIDTH, HEIGHT = 1200, 630
SUPERSAMPLE = 4  # the line art is drawn at 4x and reduced, for smooth strokes

# Palette and type follow assets/css/architecture-history.css (:root).
PAPER = (244, 240, 232)
LINE = (216, 209, 197)
INK = (30, 41, 45)
INK_SOFT = (83, 96, 102)
COBALT = (49, 93, 120)
TERRACOTTA = (153, 70, 50)
GREEN = (53, 107, 83)
AMBER = (128, 81, 14)
AMBER_SOFT = (247, 234, 208)

DEFAULT_CJK = "/System/Library/Fonts/Supplemental/Songti.ttc"
DEFAULT_SERIF = "/System/Library/Fonts/Supplemental/Iowan Old Style.ttc"
DEFAULT_SANS = "/System/Library/Fonts/Supplemental/Arial.ttf"
DEFAULT_SANS_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"


def font(path: str, size: int, index: int = 0) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size, index=index)


def tracked(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    text: str,
    face: ImageFont.FreeTypeFont,
    fill: tuple[int, int, int],
    tracking: float,
) -> None:
    """Draw letter-spaced text; Pillow has no tracking of its own."""
    x, y = xy
    for character in text:
        draw.text((x, y), character, font=face, fill=fill, anchor="ls")
        x += draw.textlength(character, font=face) + tracking


def dashed_line(
    draw: ImageDraw.ImageDraw,
    start: tuple[float, float],
    end: tuple[float, float],
    fill: tuple[int, int, int],
    width: int,
    dash: float,
    gap: float,
) -> None:
    x0, y0 = start
    x1, y1 = end
    length = ((x1 - x0) ** 2 + (y1 - y0) ** 2) ** 0.5
    step = 0.0
    while step < length:
        stop = min(step + dash, length)
        draw.line(
            (
                (x0 + (x1 - x0) * step / length, y0 + (y1 - y0) * step / length),
                (x0 + (x1 - x0) * stop / length, y0 + (y1 - y0) * stop / length),
            ),
            fill=fill,
            width=width,
        )
        step += dash + gap


def line_art() -> Image.Image:
    """Three line-drawn buildings with a dashed roofline, as on the first card."""
    scale = SUPERSAMPLE
    layer = Image.new("RGBA", (WIDTH * scale, HEIGHT * scale), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)

    def box(x0: float, y0: float, x1: float, y1: float) -> None:
        draw.rectangle((x0 * scale, y0 * scale, x1 * scale, y1 * scale),
                       outline=COBALT + (255,), width=3 * scale)

    def line(points: list[tuple[float, float]], colour=COBALT, width: float = 3) -> None:
        draw.line([(x * scale, y * scale) for x, y in points],
                  fill=colour + (255,), width=int(width * scale), joint="curve")

    ground = 456.0
    box(694, 270, 782, ground)  # left tower
    line([(694, 270), (737, 136), (782, 270)])  # its spire
    box(818, 315, 973, ground)  # central hall
    draw.arc(((895 - 52) * scale, (315 - 52) * scale, (895 + 52) * scale, (315 + 52) * scale),
             start=180, end=360, fill=COBALT + (255,), width=3 * scale)  # its dome
    line([(840, 350), (840, ground)])  # the doorway
    line([(950, 350), (950, ground)])
    line([(840, 350), (950, 350)])
    box(985, 245, 1063, ground)  # right tower
    line([(985, 245), (1024, 199), (1063, 245)])  # its roof

    # The dashed roofline ties the three spires together.
    dashed_line(draw, (737 * scale, 136 * scale), (895 * scale, 268 * scale),
                TERRACOTTA + (255,), 2 * scale, 9 * scale, 7 * scale)
    dashed_line(draw, (895 * scale, 268 * scale), (1024 * scale, 199 * scale),
                TERRACOTTA + (255,), 2 * scale, 9 * scale, 7 * scale)
    for cx, cy in ((737, 136), (895, 268), (1024, 199)):
        radius = 7 * scale
        draw.ellipse(((cx * scale - radius), (cy * scale - radius),
                      (cx * scale + radius), (cy * scale + radius)),
                     fill=PAPER + (255,), outline=TERRACOTTA + (255,), width=2 * scale)

    return layer.resize((WIDTH, HEIGHT), Image.LANCZOS)


def render(counts: dict, cells_run: int, cells_total: int, data_version: str,
           cjk: str, serif: str, sans: str, sans_bold: str) -> Image.Image:
    card = Image.new("RGBA", (WIDTH, HEIGHT), PAPER + (255,))
    draw = ImageDraw.Draw(card)

    for x in (105, 1095):  # the page's hairline frame
        draw.line(((x, 0), (x, HEIGHT)), fill=LINE, width=1)
    for y in (115, 512):
        draw.line(((0, y), (WIDTH, y)), fill=LINE, width=1)

    tracked(draw, (107, 80), "CURIOSARC LAB  ·  ARCHITECTURE LINEAGES",
            font(sans, 19), INK_SOFT, 1.4)
    draw.text((100, 250), "建筑谱系", font=font(cjk, 88, index=0), fill=INK, anchor="ls")
    draw.text((103, 300), "Architecture Lineages", font=font(serif, 50), fill=COBALT, anchor="ls")
    draw.text((104, 366), "来源优先的建筑、建筑师、事务所与关系浏览器",
              font=font(cjk, 27, index=1), fill=INK_SOFT, anchor="ls")

    metrics = (
        (f"{counts['works']:,}", "works", INK),
        (f"{counts['people']:,}", "people", INK),
        (f"{counts['verified_entities_and_relations']:,}", "verified", GREEN),
    )
    figure_face = font(serif, 35, index=1)
    label_face = font(sans, 16)
    x = 105.0
    for figure, label, colour in metrics:
        draw.text((x, 462), figure, font=figure_face, fill=colour, anchor="ls")
        x += draw.textlength(figure, font=figure_face) + 12
        draw.text((x, 460), label, font=label_face, fill=INK_SOFT, anchor="ls")
        x += draw.textlength(label, font=label_face) + 40
    if x - 40 > 670:
        raise SystemExit(f"metrics row ends at x={x - 40:.0f} and would run into the line art")

    draw.rounded_rectangle(((104, 548), (334, 586)), radius=19,
                           fill=AMBER_SOFT, outline=AMBER, width=2)
    draw.ellipse(((123, 563), (133, 573)), fill=AMBER)
    tracked(draw, (143, 573), "CURATED PILOT", font(sans_bold, 17), AMBER, 1.6)

    footer = f"coverage {cells_run} / {cells_total} cells  ·  bilingual ZH / EN"
    draw.text((1094 - draw.textlength(footer, font=font(sans, 18)), 573), footer,
              font=font(sans, 18), fill=INK_SOFT, anchor="ls")

    return Image.alpha_composite(card, line_art()).convert("RGB")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cjk", default=DEFAULT_CJK)
    parser.add_argument("--serif", default=DEFAULT_SERIF)
    parser.add_argument("--sans", default=DEFAULT_SANS)
    parser.add_argument("--sans-bold", default=DEFAULT_SANS_BOLD)
    args = parser.parse_args()

    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    grid = json.loads(CONFIG.read_text(encoding="utf-8"))["coverage_grid"]
    counts = manifest["counts"]
    cells_total = grid["cell_count"]
    cells_run = len(manifest["coverage"]["cells"])
    data_version = manifest["data_version"]

    image = render(counts, cells_run, cells_total, data_version,
                   args.cjk, args.serif, args.sans, args.sans_bold)
    metadata = PngInfo()
    metadata.add_text("counts", json.dumps(counts, sort_keys=True))
    metadata.add_text("cells", json.dumps({"run": cells_run, "total": cells_total}))
    metadata.add_text("data_version", data_version)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    image.save(OUTPUT, format="PNG", optimize=True, pnginfo=metadata)
    print(f"Wrote {OUTPUT.relative_to(ROOT)}: "
          f"{counts['works']:,} works, {counts['people']:,} people, "
          f"{counts['verified_entities_and_relations']:,} verified, "
          f"coverage {cells_run}/{cells_total}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
