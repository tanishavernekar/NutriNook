"""Color the default kitchen materials, never the food art or nutrient tints."""

from PIL import Image, ImageChops, ImageOps


RAMPS = {
    # The middle stops are sampled at 50% luminance in the source painting.
    "cabinet": ("#353955", "#91a8d6", "#e4e8ff"),
    "boards": ("#575374", "#adacd4", "#efe3f2"),
    "leaves": ("#34495a", "#85aaac", "#d9e7db"),
    "glass": ("#413e59", "#aeb3cd", "#fffdfb"),
    "paper": ("#574560", "#c6b5d8", "#fffaff"),
    "blue": ("#3b425f", "#95a9d3", "#eff3ff"),
    "blush": ("#60435f", "#d6accc", "#ffedf7"),
    "ink": ("#2e304b", "#545e8e", "#c2cceb"),
}

GROUPS = {
    "cabinet": "shelf/cabinet",
    "boards": "kitchen/wainscot",
    "leaves": "kitchen/ivy kitchen/plant kitchen/sprig",
    "glass": "jars/glass-back jars/glass-front book/ring",
    "paper": "book/page book/tab-open book/search plate/calendar ui/card",
    "blue": "book/portion book/check plate/empty plate/quantity jars/label ui/round-cream",
    "blush": ("book/tab book/side-tab book/portion-edit book/clear kitchen/crock jars/badge "
              "plate/pill plate/pill-custom plate/remove"),
    "ink": "book/thumb book/tab-active book/check-on book/divider plate/pill-dish ui/button-sage ui/round-sage",
}
MATERIALS = {key: ramp for ramp, keys in GROUPS.items() for key in keys.split()}

def monochrome_paint(image, key):
    value = image.convert("L")
    material = MATERIALS.get(key)
    if key == "kitchen/wall":
        value = value.point(lambda v: 247 + v // 32)
    elif material == "boards":
        value = value.point(lambda v: 172 + v // 3)
    elif material == "cabinet":
        value = ImageOps.colorize(value, "#353535", "#ffffff", "#dddddd").convert("L")
    elif material == "ink":
        value = ImageOps.colorize(value, "#101010", "#a8a8a8", "#363636").convert("L")
    elif material not in ("leaves", "glass") and not key.startswith("categories/"):
        value = ImageOps.colorize(value, "#252525", "#ffffff", "#cecece").convert("L")
    result = value.convert("RGB")
    if "A" in image.getbands():
        result.putalpha(image.getchannel("A"))
    return result


def cloud_paint(image, key):
    """Return a graded export. The source's brushwork and alpha stay intact."""
    if key == "kitchen/wall":
        # Keep the plaster's light and shade on a vertical twilight wash.
        wash = ImageOps.colorize(
            Image.linear_gradient("L"), "#92acd9", "#e5bbd6", "#cdc2df"
        ).resize(image.size)
        light = image.convert("L").point(lambda v: (v - 195) * 1.7 + 128)
        return ImageChops.add(wash, light.convert("RGB"), offset=-128)
    if key not in MATERIALS:
        return image
    dark, mid, light = RAMPS[MATERIALS[key]]
    painted = ImageOps.colorize(image.convert("L"), dark, light, mid)
    if key.startswith("jars/glass-"):
        # A hint of natural cork keeps the jars distinct from the painted shelf.
        band = (0, 0, image.width, round(image.height * 0.083))
        cork = Image.blend(painted.crop(band), image.convert("RGB").crop(band), 0.45)
        painted.paste(cork, band)
    if "A" in image.getbands():
        painted.putalpha(image.getchannel("A"))
    return painted
