# -*- coding: utf-8 -*-
"""奶蛋图标 v3：彻底抹除原眼 + 更大更清晰的眼睛"""
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance
import numpy as np
import os

GAME = r"C:\Users\逸愉\Documents\my_game"
OUT = os.path.join(GAME, "dist", "toy")
S = 500
UP = 6

src = Image.open(os.path.join(GAME, "assets_orig", "egg.webp")).convert("RGBA")
src = src.crop(src.getbbox())
sw, sh = src.size
EYES = [(101.3, 61.9), (176.0, 60.6)]
ER = 13.8

big = src.resize((sw * UP, sh * UP), Image.LANCZOS)
big = big.filter(ImageFilter.UnsharpMask(radius=2.4, percent=130, threshold=2))
big = ImageEnhance.Color(big).enhance(1.10)
big = ImageEnhance.Brightness(big).enhance(1.05)
arr = np.array(big)

# ---- 抹除：大圆 + 取外圈肤色 ----
draw = ImageDraw.Draw(big)
for (ex, ey) in EYES:
    cx, cy = ex * UP, ey * UP
    r = ER * UP
    # 取 "外圈" 肤色（2.2r~3.2r）
    x0, y0 = int(cx - r * 3.4), int(cy - r * 3.4)
    x1, y1 = int(cx + r * 3.4), int(cy + r * 3.4)
    patch = arr[max(0, y0):y1, max(0, x0):x1]
    yy, xx = np.mgrid[0:patch.shape[0], 0:patch.shape[1]]
    ccx, ccy = (cx - max(0, x0)), (cy - max(0, y0))
    dist = np.sqrt((xx - ccx) ** 2 + (yy - ccy) ** 2)
    ring = (dist > r * 2.0) & (dist < r * 3.2) & (patch[:, :, 3] > 200)
    px = patch[:, :, :3][ring]
    skin = tuple(int(v) for v in np.median(px, axis=0)) if len(px) else (250, 212, 132)
    draw.ellipse([cx - r * 2.05, cy - r * 2.05, cx + r * 2.05, cy + r * 2.05], fill=skin + (255,))

# 眼球区域轻微模糊（消除补丁硬边），其余保持锐利
target = big.filter(ImageFilter.GaussianBlur(UP * 2.2))
mask = Image.new("L", big.size, 0)
md = ImageDraw.Draw(mask)
for (ex, ey) in EYES:
    cx, cy, r = ex * UP, ey * UP, ER * UP * 2.05
    md.ellipse([cx - r, cy - r, cx + r, cy + r], fill=255)
mask = mask.filter(ImageFilter.GaussianBlur(UP * 1.6))
big = Image.composite(target, big, mask)

# ---- 重画眼睛（更大、更清晰）----
draw = ImageDraw.Draw(big)
for (ex, ey) in EYES:
    cx, cy = ex * UP, ey * UP
    r = ER * UP * 1.16
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(48, 92, 50, 255))
    draw.ellipse([cx - r * 0.98, cy - r * 0.98, cx + r * 0.98, cy + r * 0.98],
                 outline=(24, 54, 28, 255), width=max(2, int(UP * 0.9)))
    pr = r * 0.62
    draw.ellipse([cx - pr, cy - pr, cx + pr, cy + pr], fill=(6, 8, 6, 255))
    hr = r * 0.27
    hx, hy = cx - r * 0.34, cy - r * 0.36
    draw.ellipse([hx - hr, hy - hr, hx + hr, hy + hr], fill=(255, 255, 255, 245))
    hr2 = r * 0.13
    draw.ellipse([cx + r * 0.32 - hr2, cy + r * 0.32 - hr2,
                  cx + r * 0.32 + hr2, cy + r * 0.32 + hr2], fill=(200, 230, 205, 170))

W = max(big.size)

def compose(dark_bg, dst):
    canvas = Image.new("RGB", (W, W), (10, 34, 33) if dark_bg else (255, 255, 255))
    d = ImageDraw.Draw(canvas)
    for y in range(W):
        t = y / W
        if dark_bg:
            d.line([(0, y), (W, y)], fill=(9 + int(24 * t), 32 + int(46 * t), 31 + int(38 * t)))
        else:
            d.line([(0, y), (W, y)], fill=(255 - int(3 * t), 253 - int(4 * t), 248 - int(9 * t)))

    if dark_bg:
        glow = Image.new("RGBA", (W, W), (0, 0, 0, 0))
        gd = ImageDraw.Draw(glow)
        for i in range(int(W * 0.66), 0, -8):
            a = int(60 * (1 - i / (W * 0.66)))
            gd.ellipse([W // 2 - i, int(W * 0.46) - i, W // 2 + i, int(W * 0.46) + i],
                       fill=(255, 214, 140, a))
        canvas = Image.alpha_composite(canvas.convert("RGBA"), glow).convert("RGB")

    sh = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse([int(W * 0.27), int(W * 0.865), int(W * 0.73), int(W * 0.94)],
                               fill=(0, 0, 0, 130 if dark_bg else 100))
    sh = sh.filter(ImageFilter.GaussianBlur(int(W * 0.026)))
    canvas = Image.alpha_composite(canvas.convert("RGBA"), sh).convert("RGB")

    th = int(W * 0.87)
    sc = th / big.height
    egg = big.resize((int(big.width * sc), th), Image.LANCZOS)
    # 收边 1px：去掉抠图的浅色残边（深色背景上尤其明显）
    if dark_bg:
        a = egg.split()[3].filter(ImageFilter.MinFilter(3))
        egg.putalpha(a)
    canvas.paste(egg, ((W - egg.width) // 2, int(W * 0.465) - egg.height // 2), egg)

    final = canvas.resize((S, S), Image.LANCZOS)
    m = Image.new("L", (S, S), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.18), fill=255)
    out = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    out.paste(final, (0, 0), m)
    out.save(os.path.join(OUT, dst))
    final.resize((80, 80), Image.LANCZOS).save(os.path.join(OUT, "预览_80px_" + dst))
    print("ok:", dst)

compose(False, "图标_1x1_A_白棚奶蛋.png")
compose(True, "图标_1x1_B_深绿奶蛋.png")
