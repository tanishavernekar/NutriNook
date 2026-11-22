"""Turn painted source art (art/source) into layered web assets (src/assets).

Run: python3 scripts/build-assets.py   (needs Pillow: python3 -m pip install --user pillow)

Replace any file in art/source with your own painting at a similar
composition and rerun; the jar geometry manifest is re-measured each time.
"""

import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont
from cloud_palette import MATERIALS, cloud_paint, monochrome_paint

_save = Image.Image.save


def _atomic_save(self, fp, format=None, **params):
    """Write to a temp file and rename, so a running dev server never serves a
    half-written image (the browser caches the failed decode until reload)."""
    if not isinstance(fp, (str, Path)):
        return _save(self, fp, format, **params)
    path = Path(fp)
    if path.is_relative_to(OUT):
        relative = path.relative_to(OUT)
        key = relative.with_suffix("").as_posix()
        if key in MATERIALS or key == "kitchen/wall":
            save_export(self, PRESETS / "wood" / relative, format, params)
        if key in MATERIALS or key == "kitchen/wall" or key.startswith("categories/"):
            save_export(monochrome_paint(self, key), PRESETS / "mono" / relative, format, params)
        self = cloud_paint(self, key)
    save_export(self, path, format, params)


def save_export(self, path, format, params):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f".{path.stem}.tmp{path.suffix}")
    _save(self, tmp, format, **params)
    tmp.replace(path)


Image.Image.save = _atomic_save

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art" / "source"
OUT = ROOT / "src" / "assets"
PRESETS = ROOT / "src" / "preset-art"
JARS = OUT / "jars"
CONTENTS = JARS / "contents"
SHELF = OUT / "shelf"
for d in (CONTENTS, SHELF):
    d.mkdir(parents=True, exist_ok=True)

JAR_H = 640  # 2x the largest on-screen jar height
TILE = 320


def trim(im, pad=4):
    box = im.getchannel("A").point(lambda a: 255 if a > 12 else 0).getbbox()
    l, t, r, b = box
    return im.crop((max(0, l - pad), max(0, t - pad), min(im.width, r + pad), min(im.height, b + pad)))


def key_magenta(im):
    im = im.convert("RGBA")
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            # distance from pure magenta, with a soft edge
            m = min(r, b) - g
            if m > 150:
                px[x, y] = (0, 0, 0, 0)
            elif m > 22:
                # magenta-tinted fringe/shadow: keep it as a soft brown shadow
                k = (m - 22) / 128
                px[x, y] = (88, 52, 32, int(a * (1 - k) * 0.85))
    return im


def color_to_alpha(im, base):
    """GIMP-style colour-to-alpha: what remains is how the glass differs from
    its own interior colour (outlines, shading, highlights)."""
    out = Image.new("RGBA", im.size)
    src, dst = im.load(), out.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = src[x, y]
            if a == 0:
                dst[x, y] = (0, 0, 0, 0)
                continue
            al = 0.0
            for c, bc in zip((r, g, b), base):
                if c > bc:
                    al = max(al, (c - bc) / (255 - bc or 1))
                elif c < bc:
                    al = max(al, (bc - c) / (bc or 1))
            if al < 0.004:
                dst[x, y] = (0, 0, 0, 0)
                continue
            col = tuple(max(0, min(255, int((c - bc) / al + bc))) for c, bc in zip((r, g, b), base))
            dst[x, y] = (*col, int(al * a))
    return out


def build_jar():
    jar = trim(Image.open(SRC / "jar.png").convert("RGBA"))
    jar = jar.resize((round(jar.width * JAR_H / jar.height), JAR_H), Image.LANCZOS)
    w, h = jar.size
    rgb = jar.convert("RGB")
    # glass interior colour: median of the body centre
    sample = rgb.crop((w * 4 // 10, h * 45 // 100, w * 6 // 10, h * 70 // 100))
    bands = [sorted(sample.getchannel(i).getdata()) for i in range(3)]
    base = tuple(b[len(b) // 2] for b in bands)
    # interior = pixels near the base colour connected to the body centre
    diff = ImageChops.difference(rgb, Image.new("RGB", rgb.size, base)).convert("L")
    diff = diff.filter(ImageFilter.GaussianBlur(2)).point(lambda v: 255 if v < 26 else 0)
    flood = diff.copy()
    ImageDraw.floodfill(flood, (w // 2, h // 2), 128)
    mask = flood.point(lambda v: 255 if v == 128 else 0)
    # close holes left by highlight streaks, then pull in from the outline
    mask = mask.filter(ImageFilter.MaxFilter(15)).filter(ImageFilter.MinFilter(15))
    # fill each row between its outermost interior pixels (highlights break rows)
    filled = Image.new("L", mask.size, 0)
    fd = ImageDraw.Draw(filled)
    for y in range(h):
        xs = [x for x, v in enumerate(mask.crop((0, y, w, y + 1)).getdata()) if v > 128]
        if xs:
            fd.line((xs[0], y, xs[-1], y), fill=255)
    mask = filled
    # the flood stops at the painted base ellipse; extend to the true rounded
    # bottom by insetting the bottle silhouette by the glass wall thickness
    left_wall = next(x for x in range(w) if mask.getpixel((x, h * 6 // 10)) > 128)
    outer_left = next(x for x in range(w) if jar.getpixel((x, h * 6 // 10))[3] > 128)
    wall = max(3, left_wall - outer_left)
    inner = jar.getchannel("A").point(lambda v: 255 if v > 128 else 0)
    inner = inner.filter(ImageFilter.MinFilter(wall * 2 + 1))
    lower = Image.new("L", mask.size, 0)
    ImageDraw.Draw(lower).rectangle((0, h // 2, w, h), fill=255)
    mask = ImageChops.lighter(mask, ImageChops.multiply(inner, lower))
    mask = mask.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(1.2))
    # measure the body: shoulder = first row reaching 92% of the widest row
    rows = [sum(1 for v in mask.crop((0, y, w, y + 1)).getdata() if v > 128) for y in range(h)]
    widest = max(rows)
    body_top = next(y for y in range(h) if rows[y] >= widest * 0.92)
    bottom = max(y for y in range(h) if rows[y] > widest * 0.5)
    cols = [x for x in range(w) if mask.getpixel((x, (body_top + bottom) // 2)) > 128]
    interior_top = next(y for y in range(h) if rows[y] > 0)
    # contents never rise into the neck: cut the mask a little above the shoulder
    cut = Image.new("L", mask.size, 0)
    ImageDraw.Draw(cut).rectangle((0, body_top - 18, w, h), fill=255)
    mask = ImageChops.multiply(mask, cut.filter(ImageFilter.GaussianBlur(6)))
    jar.save(JARS / "glass-back.png", optimize=True)
    front = color_to_alpha(jar, base)
    front.save(JARS / "glass-front.png", optimize=True)
    m = Image.new("RGBA", jar.size, (0, 0, 0, 0))
    m.putalpha(mask)
    m.save(JARS / "interior-mask.png", optimize=True)
    geo = {
        "width": w,
        "height": h,
        "glassBase": "#%02x%02x%02x" % base,
        "interior": {
            "left": cols[0] / w,
            "right": cols[-1] / w,
            "neckTop": interior_top / h,
            "shoulder": body_top / h,
            "bottom": bottom / h,
        },
    }
    (JARS / "geometry.json").write_text(json.dumps(geo, indent=2) + "\n")
    return jar, front, m, geo


def build_contents():
    layout = json.loads((ROOT / "src/theme-layout-contents-v1.json").read_text())
    tiles = {}
    with Image.open(ROOT / "public/themes/painted-jars.png") as sheet:
        if sheet.size != (layout["width"], layout["height"]):
            raise ValueError("painted-jars.png must match the contents-only layout")
        for path, (x, y, w, h) in layout["slots"].items():
            tile = sheet.crop((x, y, x + w, y + h))
            tile.save(OUT / path, lossless=True, exact=True)
            tiles[Path(path).stem] = tile
    return tiles


def components(alpha, box):
    """Bounding boxes of separate painted items in one band of a sheet."""
    band = alpha.crop(box).point(lambda a: 255 if a > 40 else 0)
    w = band.width
    cols = [band.crop((x, 0, x + 1, band.height)).getbbox() is not None for x in range(w)]
    out, start = [], None
    for x, on in enumerate(cols + [False]):
        if on and start is None:
            start = x
        elif not on and start is not None:
            sub = band.crop((start, 0, x, band.height)).getbbox()
            out.append((box[0] + start, box[1] + sub[1], box[0] + x, box[1] + sub[3]))
            start = None
    return [b for b in out if b[2] - b[0] > 40]


def build_paper():
    sheet = Image.open(SRC / "paper-sheet.png").convert("RGBA")
    a = sheet.getchannel("A")
    labels = components(a, (0, 0, sheet.width, int(sheet.height * 0.72)))
    badges = components(a, (0, int(sheet.height * 0.72), sheet.width, sheet.height))
    label = sheet.crop(labels[0])
    label = label.resize((round(label.width * 300 / label.height), 300), Image.LANCZOS)
    badge = sheet.crop(badges[0])
    badge = badge.resize((200, round(badge.height * 200 / badge.width)), Image.LANCZOS)
    label.save(JARS / "label.png", optimize=True)
    badge.save(JARS / "badge.png", optimize=True)
    return label, badge


def build_shelf():
    shelf = trim(key_magenta(Image.open(SRC / "shelf.png")), pad=0)
    shelf = shelf.resize((1200, round(shelf.height * 1200 / shelf.width)), Image.LANCZOS)
    shelf.save(SHELF / "cabinet.webp", quality=86)
    return shelf


BOOK = OUT / "book"
# Reading order (rows top to bottom, left to right) of art/source/book-parts.png
PART_KEYS = [
    "tab", "tab-active",
    "search", "clear",
    "check", "check-on", "portion", "portion-edit",
    "side-tab", "thumb", "divider",
]


def runs_of(flags, min_len=1):
    out, start = [], None
    for i, on in enumerate(list(flags) + [False]):
        if on and start is None:
            start = i
        elif not on and start is not None:
            if i - start >= min_len:
                out.append((start, i))
            start = None
    return out


def open_tab(tab, page):
    """The selected tab: no bottom outline, side outlines run on so it can
    overlap the page rim, and paper tinted to the page parchment."""
    a = tab.getchannel("A")
    col = [a.getpixel((tab.width // 2, y)) for y in range(tab.height)]
    bottom = max(y for y, v in enumerate(col) if v > 128)
    # walk up through the dark bottom outline
    y = bottom
    while y > 0 and sum(tab.getpixel((tab.width // 2, y))[:3]) < 600:
        y -= 1
    cut = y - 1
    body = tab.crop((0, 0, tab.width, cut))
    extend = 24
    out = Image.new("RGBA", (tab.width, cut + extend))
    out.paste(body, (0, 0))
    row = tab.crop((0, cut - 1, tab.width, cut))
    for i in range(extend):
        out.paste(row, (0, cut + i))
    pw, ph = page.size
    paper = page.convert("RGB").crop((pw // 3, ph // 3, 2 * pw // 3, 2 * ph // 3)).resize((1, 1), Image.BOX).getpixel((0, 0))
    tw = body.convert("RGB").crop((tab.width // 3, cut // 2, 2 * tab.width // 3, cut - 2)).resize((1, 1), Image.BOX).getpixel((0, 0))
    scale = [p / max(t, 1) for p, t in zip(paper, tw)]
    px = out.load()
    for yy in range(out.height):
        for xx in range(out.width):
            r, g, b, al = px[xx, yy]
            if al and r + g + b > 540:
                px[xx, yy] = (min(255, round(r * scale[0])), min(255, round(g * scale[1])),
                              min(255, round(b * scale[2])), al)
    return out


def build_book():
    """Recipe book page (9-slice) and its painted controls.

    The rings are painted out of the page and exported as one tile
    (book/ring.png) that CSS repeats down the binding with `round`."""
    BOOK.mkdir(parents=True, exist_ok=True)
    src = Image.open(SRC / "book.png").convert("RGBA")
    a = src.getchannel("A").point(lambda v: 255 if v > 60 else 0)
    src = src.crop(a.getbbox())
    a = src.getchannel("A")
    w, h = src.size
    # rings: the first column (from the left) crossing many separate opaque runs
    def col_runs(x):
        return runs_of([a.getpixel((x, y)) > 128 for y in range(h)], 6)
    ring_x = next(x for x in range(w // 6) if len(col_runs(x)) >= 4)
    rings = [(s + e) / 2 for s, e in col_runs(ring_x + 4)]
    assert len(rings) >= 4, f"could not find binding rings ({rings})"
    period = round((rings[-1] - rings[0]) / (len(rings) - 1))
    gap = round((rings[0] + rings[1]) / 2)
    # how far right the rings reach: columns where a ring row differs from a gap row
    ring_row = round(rings[1])
    def px_diff(x, y0, y1):
        p, q = src.getpixel((x, y0)), src.getpixel((x, y1))
        return max(abs(p[i] - q[i]) for i in range(4))
    ring_right = max(x for x in range(w // 4) if px_diff(x, ring_row, gap) > 40) + 4
    # paint the rings out column by column: blend each ring's rows from the clean
    # paper/cover just above and below it, so the corners and texture stay painted
    half = min(round(period * 0.27), round((rings[1] - rings[0]) / 2) - 2)
    page = src.copy()
    for c in rings:
        y0, y1 = round(c) - half - 1, round(c) + half + 1
        for x in range(ring_right):
            p, q = src.getpixel((x, y0)), src.getpixel((x, y1))
            for y in range(y0 + 1, y1):
                t = (y - y0) / (y1 - y0)
                page.putpixel((x, y), tuple(round(p[i] + (q[i] - p[i]) * t) for i in range(4)))
    # ring tile: one period centred on a ring, keeping only what differs from the clean page
    t0 = round(rings[1] - period / 2)
    ring = Image.new("RGBA", (ring_right, period))
    for y in range(period):
        for x in range(ring_right):
            sp, pp = src.getpixel((x, t0 + y)), page.getpixel((x, t0 + y))
            d = max(abs(sp[i] - pp[i]) for i in range(4))
            ring.putpixel((x, y), (*sp[:3], min(sp[3], max(0, d - 10) * 8)))
    ring.save(BOOK / "ring.png", optimize=True)
    top = bottom = round(h * 0.12)
    left = round(w * 0.115)
    right = round(w * 0.075)
    ring_geo = {"top": round(rings[0] - period / 2), "bottom": h - round(rings[-1] + period / 2),
                "width": ring_right, "period": period}
    page.save(BOOK / "page.webp", quality=88)
    sheet = Image.open(SRC / "book-parts.png").convert("RGBA")
    sa = sheet.getchannel("A").point(lambda v: 255 if v > 40 else 0)
    bands = runs_of([sa.crop((0, y, sheet.width, y + 1)).getbbox() is not None for y in range(sheet.height)], 8)
    boxes = [b for y0, y1 in bands for b in components(sheet.getchannel("A"), (0, y0, sheet.width, y1))]
    assert len(boxes) == len(PART_KEYS), f"expected {len(PART_KEYS)} parts, found {len(boxes)}"
    parts, geo = {}, {"page": {"width": page.width, "height": page.height,
                               "slice": [top, right, bottom, left]}, "ring": ring_geo}
    for key, box in zip(PART_KEYS, boxes):
        im = sheet.crop((box[0] - 3, box[1] - 3, box[2] + 3, box[3] + 3))
        im = im.resize((round(im.width / 2), round(im.height / 2)), Image.LANCZOS)
        if key == "side-tab":
            # the button is rotated 180deg so its text reads upward
            im = im.rotate(180)
        im.save(BOOK / f"{key}.png", optimize=True)
        parts[key] = im
        geo[key] = {"width": im.width, "height": im.height}
    parts["tab-open"] = open_tab(parts["tab"], page)
    parts["tab-open"].save(BOOK / "tab-open.png", optimize=True)
    geo["tab-open"] = {"width": parts["tab-open"].width, "height": parts["tab-open"].height}
    (BOOK / "geometry.json").write_text(json.dumps(geo, indent=2) + "\n")
    return page, parts, geo


def spritesheet(jar, front, mask, geo, tiles, label, badge, shelf, book=None, kitchen=None, plate=None):
    """Size-reference sheet to paint over. Every item is shown at its exported
    pixel size, with the measured jar guides drawn in."""
    try:
        font = ImageFont.load_default(size=22)
        small = ImageFont.load_default(size=16)
    except TypeError:
        font = small = ImageFont.load_default()
    pad = 40
    sheet = Image.new("RGB", (max(2 * pad + 3 * (jar.width + pad) + 4 * (TILE // 2 + 24), shelf.width + 2 * pad), 8000), "#f6ead2")
    d = ImageDraw.Draw(sheet)
    ink = "#5a4030"
    guide = "#c0392b"

    def caption(x, y, text):
        d.text((x, y), text, fill=ink, font=font)

    x, y = pad, pad + 30
    caption(pad, pad - 10, "NutriNook asset sheet - every item at exported pixel size")
    for name, im in (("glass-back.png", jar), ("glass-front.png", front), ("interior-mask.png", mask)):
        bg = Image.new("RGBA", im.size, "#e3cfa8")
        bg.alpha_composite(im if name != "interior-mask.png" else Image.new("RGBA", im.size, (143, 166, 107, 0)))
        if name == "interior-mask.png":
            tint = Image.new("RGBA", im.size, (143, 166, 107, 255))
            bg.paste(tint, (0, 0), im.getchannel("A"))
            bg.alpha_composite(front)
        sheet.paste(bg.convert("RGB"), (x, y + 30))
        d.text((x, y - 18), f"jars/{name}", fill=ink, font=small)
        d.text((x, y + 4), f"{im.width}x{im.height}", fill=ink, font=small)
        if name == "interior-mask.png":
            g = geo["interior"]
            for k in ("shoulder", "bottom"):
                gy = y + 30 + int(g[k] * im.height)
                d.line((x, gy, x + im.width, gy), fill=guide, width=2)
                d.text((x + 4, gy - 18), f"{k} {g[k]:.3f}", fill=guide, font=small)
            for k in ("left", "right"):
                gx = x + int(g[k] * im.width)
                d.line((gx, y + 30, gx, y + 30 + im.height), fill=guide, width=1)
        x += jar.width + pad
    # contents tiles at half size
    cx, cy = x, y
    d.text((cx, cy - 18), f"jars/contents/<key>.webp  {TILE}x{TILE * 2}", fill=ink, font=small)
    d.text((cx, cy + 4), "detail from each painted filling, at 50%", fill=ink, font=small)
    for i, (key, tile) in enumerate(tiles.items()):
        tx = cx + (i % 4) * (TILE // 2 + 24)
        ty = cy + 40 + (i // 4) * (TILE // 2 + 40)
        sample = tile.crop((0, 0, TILE, TILE)).resize((TILE // 2, TILE // 2))
        sheet.paste(sample, (tx, ty))
        d.text((tx, ty + TILE // 2 + 4), key, fill=ink, font=small)
    # paper parts
    py = cy + 40 + 3 * (TILE // 2 + 40) + 20
    caption(cx, py, f"jars/label.png {label.width}x{label.height}    jars/badge.png {badge.width}x{badge.height}")
    sheet.paste(label, (cx, py + 34), label)
    sheet.paste(badge, (cx + label.width + 40, py + 34), badge)
    # shelf
    sy = max(y + 30 + jar.height, py + 34 + label.height) + 70
    caption(pad, sy, f"shelf/cabinet.webp  {shelf.width}x{shelf.height}  (9-slice: corners keep size, middle stretches)")
    sheet.paste(shelf, (pad, sy + 34), shelf)
    for v in (60, shelf.width - 60):
        d.line((pad + v, sy + 34, pad + v, sy + 34 + shelf.height), fill=guide, width=1)
    for v in (40, shelf.height - SHELF_BOTTOM):
        d.line((pad, sy + 34 + v, pad + shelf.width, sy + 34 + v), fill=guide, width=1)
    end = sy + 34 + shelf.height + pad
    if book:
        page, parts, bgeo = book
        by = end + 30
        sl = bgeo["page"]["slice"]
        caption(pad, by, f"book/page.webp  {page.width}x{page.height}  (9-slice; middle ring row repeats - rings painted out; book/ring.png repeats down the binding)")
        small_page = page.resize((page.width // 2, page.height // 2))
        sheet.paste(small_page, (pad, by + 34), small_page)
        for v in (sl[3], page.width - sl[1]):
            d.line((pad + v // 2, by + 34, pad + v // 2, by + 34 + page.height // 2), fill=guide, width=1)
        for v in (sl[0], page.height - sl[2]):
            d.line((pad, by + 34 + v // 2, pad + page.width // 2, by + 34 + v // 2), fill=guide, width=1)
        d.text((pad, by + 40 + page.height // 2), "shown at 50%", fill=ink, font=small)
        px, py2, rowh = pad + page.width // 2 + 50, by + 34, 0
        for key, im in parts.items():
            if px + im.width > sheet.width - pad:
                px, py2, rowh = pad + page.width // 2 + 50, py2 + rowh + 40, 0
            d.text((px, py2), f"book/{key}.png {im.width}x{im.height}", fill=ink, font=small)
            sheet.paste(im, (px, py2 + 22), im)
            px += max(im.width, 210) + 30
            rowh = max(rowh, im.height + 22)
        end = max(by + 34 + page.height // 2 + 40, py2 + rowh) + pad
    if kitchen:
        plaster, wainscot, decor = kitchen
        ky = end + 30
        grow = ky + 34 + plaster.height // 2 + 60 + wainscot.height + 60 + max(im.height for im in decor.values()) // 2 + pad
        if grow > sheet.height:
            grown = Image.new("RGB", (sheet.width, grow), "#f6ead2")
            grown.paste(sheet, (0, 0))
            sheet, d = grown, ImageDraw.Draw(grown)
        caption(pad, ky, f"kitchen/wall.webp  {plaster.width}x{plaster.height}  (covers the viewport; shown at 50%)")
        sheet.paste(plaster.resize((plaster.width // 2, plaster.height // 2)).convert("RGB"), (pad, ky + 34))
        wy = ky + 34 + plaster.height // 2 + 30
        caption(pad, wy, f"kitchen/wainscot.webp  {wainscot.width}x{wainscot.height}  (tiles left-right; edges must match)")
        for i in range(2):
            sheet.paste(wainscot.convert("RGB"), (pad + i * wainscot.width, wy + 30))
        d.line((pad + wainscot.width, wy + 30, pad + wainscot.width, wy + 30 + wainscot.height), fill=guide, width=1)
        dx, dy = pad, wy + 30 + wainscot.height + 30
        for key, im in decor.items():
            half = im.resize((im.width // 2, im.height // 2))
            d.text((dx, dy), f"kitchen/{key}.webp {im.width}x{im.height} (50%)", fill=ink, font=small)
            sheet.paste(half, (dx, dy + 22), half)
            dx += max(half.width, 260) + 30
        end = dy + 22 + max(im.height for im in decor.values()) // 2 + pad
    if plate:
        py3 = end + 10
        caption(pad, py3, "plate/  (pills are 9-slice; pill colours are derived from pill.png by the build script)")
        px = pad
        for key, im in plate.items():
            d.text((px, py3 + 34), f"{key if '/' in key else 'plate/' + key}.png {im.width}x{im.height}", fill=ink, font=small)
            sheet.paste(im, (px, py3 + 56), im)
            px += max(im.width, 230) + 30
        end = py3 + 56 + max(im.height for im in plate.values()) + pad
    if end > sheet.height:
        grown = Image.new("RGB", (sheet.width, end), "#f6ead2")
        grown.paste(sheet, (0, 0))
        sheet = grown
    sheet = sheet.crop((0, 0, sheet.width, end))
    (ROOT / "art").mkdir(exist_ok=True)
    sheet.save(ROOT / "art" / "spritesheet.png", optimize=True)


KITCHEN = OUT / "kitchen"
DECOR_KEYS = ["ivy", "crock", "plant", "sprig"]


def dark_runs(values, threshold):
    """Centres of runs of values below threshold (board seams, ledge lines)."""
    out, start = [], None
    for i, v in enumerate(values + [threshold + 1]):
        if v < threshold and start is None:
            start = i
        elif v >= threshold and start is not None:
            out.append((start + i - 1) // 2)
            start = None
    return out


def build_kitchen():
    """Full-bleed backdrop: a plaster wall that covers the viewport, a wainscot
    strip that tiles horizontally along the bottom, and edge decorations."""
    KITCHEN.mkdir(parents=True, exist_ok=True)
    wall = Image.open(SRC / "wall.png").convert("RGB")
    grey = wall.convert("L")
    w, h = wall.size
    rows = [sum(grey.crop((0, y, w, y + 1)).getdata()) / w for y in range(h)]
    # ledge top: first sharp darkening below the middle of the painting
    ledge = next(y for y in range(h // 2, h) if rows[y] < rows[y - 4] - 30)
    plaster = wall.crop((0, 0, w, ledge - 2))
    plaster.save(KITCHEN / "wall.webp", quality=80)
    boards = [sum(grey.crop((x, ledge + 60, x + 1, h - 20)).getdata()) / (h - ledge - 80) for x in range(w)]
    med = sorted(boards)[w // 2]
    seams = dark_runs(boards, med - 25)
    # crop seam-to-seam so one board seam starts each tile
    x0, x1 = seams[1], seams[-2]
    wainscot = wall.crop((x0, ledge - 4, x1, h))
    wainscot = wainscot.resize((round(wainscot.width / 2), round(wainscot.height / 2)), Image.LANCZOS)
    wainscot.save(KITCHEN / "wainscot.webp", quality=82)

    sheet = key_magenta(Image.open(SRC / "decor.png"))
    boxes = components(sheet.getchannel("A"), (0, 0, sheet.width, sheet.height))
    boxes = [b for b in boxes if (b[2] - b[0]) * (b[3] - b[1]) > 8000]
    assert len(boxes) == len(DECOR_KEYS), f"expected {len(DECOR_KEYS)} decor items, found {len(boxes)}"
    geo = {"wall": list(plaster.size), "wainscot": list(wainscot.size)}
    decor = {}
    for key, box in zip(DECOR_KEYS, boxes):
        im = trim(sheet.crop((box[0] - 6, box[1] - 6, box[2] + 6, box[3] + 6)))
        im.save(KITCHEN / f"{key}.webp", quality=86)
        decor[key] = im
        geo[key] = list(im.size)
    (KITCHEN / "geometry.json").write_text(json.dumps(geo, indent=2) + "\n")
    return plaster, wainscot, decor


PLATE = OUT / "plate"
PILL_COLOURS = {"pill": "#f3ddb4", "pill-dish": "#87945d", "pill-custom": "#e8b99b"}


def recolour(im, hex_colour):
    """Repaint the parchment fill in a new colour, keeping the ink outline and
    the watercolour texture (fill brightness relative to its average)."""
    target = tuple(int(hex_colour[i:i + 2], 16) for i in (1, 3, 5))
    rgba = im.convert("RGBA")
    lum = rgba.convert("L")
    fill = [v for v, a in zip(lum.getdata(), rgba.getchannel("A").getdata()) if a > 200 and v > 190]
    mean = sum(fill) / len(fill)
    out = []
    for (r, g, b, a), v in zip(rgba.getdata(), lum.getdata()):
        t = min(1, max(0, (v - 110) / 80))
        k = v / mean
        nr, ng, nb = (min(255, int(c * k)) for c in target)
        out.append((int(r + (nr - r) * t), int(g + (ng - g) * t), int(b + (nb - b) * t), a))
    rgba.putdata(out)
    return rgba


def build_plate():
    """Today's plate: calendar note, food pill in its three type colours, the
    remove button and the quantity pill."""
    PLATE.mkdir(parents=True, exist_ok=True)
    sheet = Image.open(SRC / "plate.png").convert("RGBA")
    boxes = components(sheet.getchannel("A"), (0, 0, sheet.width, sheet.height))
    assert len(boxes) == 4, f"expected 4 plate parts, found {len(boxes)}"
    note, pill, remove, qty = (trim(sheet.crop(b), 2) for b in boxes)
    note.save(PLATE / "calendar.png", optimize=True)
    remove.resize((remove.width // 2, remove.height // 2), Image.LANCZOS).save(PLATE / "remove.png", optimize=True)
    qty.save(PLATE / "quantity.png", optimize=True)
    empty = trim(Image.open(SRC / "empty-plate.png").convert("RGBA"), 2)
    empty = empty.resize((240, round(240 * empty.height / empty.width)), Image.LANCZOS)
    empty.save(PLATE / "empty.png", optimize=True)
    parts = {"calendar": note, "remove": remove, "quantity": qty, "empty": empty}
    for key, colour in PILL_COLOURS.items():
        im = recolour(pill, colour)
        im.save(PLATE / f"{key}.png", optimize=True)
        parts[key] = im
    geo = {k: [im.width, im.height] for k, im in parts.items()}
    (PLATE / "geometry.json").write_text(json.dumps(geo, indent=2) + "\n")
    return parts


UI = OUT / "ui"


def build_ui():
    """Shared painted parts for dialogs and controls: recipe card, sage and
    cream round buttons, sage wide button."""
    UI.mkdir(parents=True, exist_ok=True)
    sheet = Image.open(SRC / "ui.png").convert("RGBA")
    boxes = components(sheet.getchannel("A"), (0, 0, sheet.width, sheet.height))
    assert len(boxes) == 4, f"expected 4 ui parts, found {len(boxes)}"
    parts = {}
    for key, b in zip(["card", "round-sage", "round-cream", "button-sage"], boxes):
        im = trim(sheet.crop(b), 2)
        if key.startswith("round"):
            im = im.resize((120, round(120 * im.height / im.width)), Image.LANCZOS)
        im.save(UI / f"{key}.png", optimize=True)
        parts[key] = im
    return parts


CATEGORY_KEYS = [
    "fruits", "vegetables", "nuts", "legumes",
    "grains", "dairy", "protein", "essentials",
    "snacks", "beverages", "other",
]


def key_paper_white(im, floor=236):
    """Clears the white backdrop connected to the edges, leaving cream paint
    inside the outline opaque; a slight blur softens the cut edge."""
    from PIL import ImageDraw, ImageFilter
    grey = im.convert("L")
    near = grey.point(lambda v: 255 if v >= floor else 0)
    ImageDraw.floodfill(near, (0, 0), 128)
    bg = near.point(lambda v: 255 if v == 128 else 0).filter(ImageFilter.MaxFilter(3))
    alpha = Image.composite(Image.new("L", im.size, 0), Image.new("L", im.size, 255), bg)
    alpha = alpha.filter(ImageFilter.GaussianBlur(0.8)).point(lambda v: 0 if v < 8 else v)
    # Keep only the painting around the centre so stray flecks (e.g. faint
    # steam) don't stretch the trim box and push the icon off-centre.
    blob = alpha.point(lambda v: 255 if v > 40 else 0).filter(ImageFilter.MaxFilter(5))
    centre = (im.width // 2, im.height // 2)
    if blob.getpixel(centre):
        ImageDraw.floodfill(blob, centre, 128)
        keep = blob.point(lambda v: 255 if v == 128 else 0).filter(ImageFilter.MaxFilter(5))
        alpha = Image.composite(alpha, Image.new("L", im.size, 0), keep)
    im.putalpha(alpha)
    return im


def build_categories():
    """Category icons: a transparent 4x3 grid, one painted icon per cell."""
    out_dir = OUT / "categories"
    out_dir.mkdir(parents=True, exist_ok=True)
    rgba = Image.open(SRC / "categories.png").convert("RGBA")
    cw, ch = rgba.width / 4, rgba.height / 3
    for i, key in enumerate(CATEGORY_KEYS):
        cx, cy = i % 4, i // 4
        cell = rgba.crop((round(cx * cw), round(cy * ch), round((cx + 1) * cw), round((cy + 1) * ch)))
        im = trim(cell, pad=2)
        side = max(im.size)
        sq = Image.new("RGBA", (side, side))
        sq.paste(im, ((side - im.width) // 2, (side - im.height) // 2))
        sq.resize((96, 96), Image.LANCZOS).save(out_dir / f"{key}.webp", quality=88)
    # Single-icon sources painted later, e.g. art/source/category-dairy-protein.png
    for src in sorted(SRC.glob("category-*.png")):
        im = Image.open(src).convert("RGBA")
        if im.getextrema()[3][0] == 255:
            im = key_paper_white(im)
        im = trim(im, pad=2)
        side = max(im.size)
        sq = Image.new("RGBA", (side, side))
        sq.paste(im, ((side - im.width) // 2, (side - im.height) // 2))
        sq.resize((96, 96), Image.LANCZOS).save(out_dir / f"{src.stem[9:]}.webp", quality=88)

SHELF_BOTTOM = 0  # set after the shelf is measured

def build_preset_vectors():
    # SVG images cannot inherit the page's CSS variables. Keep one set of paths.
    import re
    palettes = {
        "#96577f": ("#b54a39", "#252525"),
        "#fffaff": ("#fff5df", "#ffffff"), "#dee5fa": ("#eadfc4", "#f5f5f5"),
        "#d6d1ea": ("#eddfbf", "#eeeeee"), "#aaa4c5": ("#c5ae86", "#bdbdbd"),
        "#817d9c": ("#907b5d", "#535353"), "#fffcff": ("#fff9eb", "#ffffff"),
        "#a29ab7": ("#ad9670", "#a4a4a4"),
    }
    for preset, idx in (("wood", 0), ("mono", 1)):
        for name in ("calendar-banner.svg", "ceramic-rim.svg"):
            svg = (PLATE / name).read_text()
            (PRESETS / preset / "plate" / name).write_text(
                re.sub(r"#[0-9a-fA-F]{6}\b", lambda m: palettes[m[0]][idx], svg)
            )

if __name__ == "__main__":
    jar, front, mask, geo = build_jar()
    tiles = build_contents()
    label, badge = build_paper()
    shelf = build_shelf()
    # plank top: first row from the bottom third whose mean colour turns light oak
    rgb = shelf.convert("RGB")
    lum = [sum(rgb.crop((0, y, shelf.width, y + 1)).convert("L").getdata()) / shelf.width for y in range(shelf.height)]
    start = shelf.height // 2
    plank_top = next(y for y in range(start, shelf.height) if lum[y] > lum[start] + 25)
    SHELF_BOTTOM = shelf.height - plank_top
    geo["shelf"] = {"width": shelf.width, "height": shelf.height, "plankTop": plank_top}
    (JARS / "geometry.json").write_text(json.dumps(geo, indent=2) + "\n")
    book = build_book()
    kitchen = build_kitchen()
    plate = build_plate()
    build_categories()
    plate.update({f"ui/{k}": v for k, v in build_ui().items()})
    build_preset_vectors()
    print("kitchen", (KITCHEN / "geometry.json").read_text())
    spritesheet(jar, front, mask, geo, tiles, label, badge, shelf, book, kitchen, plate)
    print(json.dumps(book[2]["page"]))
    print(json.dumps(geo, indent=2))
