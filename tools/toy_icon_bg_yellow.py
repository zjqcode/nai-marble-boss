# -*- coding: utf-8 -*-
"""浅黄背景：奶油黄 / 黄粉渐变，配暖棕描边保证分离"""
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
import os

SRC = r"C:\Users\逸愉\.dsh\attachments\v1\objects\c9\c9e19a2fb989ec61aa37786cd74b558bb82cfba7b1f8a53c5c944f495346c1c1"
OUT = r"C:\Users\逸愉\Documents\my_game\dist\toy\bg"
os.makedirs(OUT, exist_ok=True)
W = 500

im = Image.open(SRC).convert("RGB")
a = np.array(im).astype(np.float32)
r_, g_, b_ = a[:, :, 0], a[:, :, 1], a[:, :, 2]
ball = (r_ > 150) & (g_ > 120) & (b_ < 140)
ys, xs = np.where(ball)
cx, cy = xs.mean(), ys.mean()
rad = np.sqrt(ball.sum() / np.pi) + 3.0

mask = Image.new("L", (W, W), 0)
ImageDraw.Draw(mask).ellipse([cx - rad, cy - rad, cx + rad, cy + rad], fill=255)
mask = mask.filter(ImageFilter.GaussianBlur(0.7))
ball_img = Image.new("RGBA", (W, W), (0, 0, 0, 0))
ball_img.paste(im, (0, 0), mask)

def layered(rim_col, shadow_col, shadow_alpha=105, glow_alpha=48, rim_w=3):
    out = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    sh = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse([cx - rad, cy - rad * 0.92 + 10, cx + rad, cy + rad * 1.02 + 10],
                               fill=shadow_col + (shadow_alpha,))
    sh = sh.filter(ImageFilter.GaussianBlur(16))
    out = Image.alpha_composite(out, sh)
    gl = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    ImageDraw.Draw(gl).ellipse([cx - rad * 1.12, cy - rad * 1.12, cx + rad * 1.12, cy + rad * 1.12],
                               fill=(255, 255, 255, glow_alpha))
    gl = gl.filter(ImageFilter.GaussianBlur(12))
    out = Image.alpha_composite(out, gl)
    ring = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    ImageDraw.Draw(ring).ellipse([cx - rad, cy - rad, cx + rad, cy + rad],
                                 outline=rim_col + (242,), width=rim_w)
    out = Image.alpha_composite(out, ring)
    return Image.alpha_composite(out, ball_img)

def grad(top, bot):
    c = Image.new("RGB", (W, W))
    d = ImageDraw.Draw(c)
    for y in range(W):
        t = y / W
        d.line([(0, y), (W, y)], fill=(int(top[0] + (bot[0] - top[0]) * t),
                                       int(top[1] + (bot[1] - top[1]) * t),
                                       int(top[2] + (bot[2] - top[2]) * t)))
    return c

def bokeh(canvas, spots, blur=10):
    layer = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for (x, y, rr, al, col) in spots:
        d.ellipse([x - rr, y - rr, x + rr, y + rr], fill=col + (al,))
    layer = layer.filter(ImageFilter.GaussianBlur(blur))
    return Image.alpha_composite(canvas.convert("RGBA"), layer).convert("RGB")

# A 奶油黄
bgA = bokeh(grad((255, 250, 232), (255, 231, 168)),
            [(115, 105, 52, 44, (255, 255, 255)), (390, 150, 38, 36, (255, 255, 255)),
             (90, 395, 34, 30, (255, 252, 240)), (410, 390, 44, 32, (255, 255, 245))])
# B 浅黄 -> 浅粉
bgB = bokeh(grad((255, 248, 220), (255, 219, 208)),
            [(150, 115, 60, 40, (255, 255, 255)), (385, 190, 44, 30, (255, 240, 240)),
             (105, 400, 38, 26, (255, 250, 235))])

variants = [
    ("A_奶油黄", bgA, (118, 78, 26), (128, 92, 44)),
    ("B_黄粉", bgB, (112, 74, 42), (140, 96, 78)),
]

cmp = Image.new("RGB", (W * 2 + 20, W + 40), (14, 20, 30))
smalls = Image.new("RGB", (80 * 2 + 12, 80), (14, 20, 30))
for i, (name, bg, rim, sh) in enumerate(variants):
    layer = layered(rim, sh)
    canvas = bg.copy()
    canvas.paste(layer, (0, 0), layer)
    canvas.save(os.path.join(OUT, f"图标bg_{name}.png"))
    cmp.paste(canvas, (i * (W + 20), 30))
    smalls.paste(canvas.resize((80, 80), Image.LANCZOS), (i * (80 + 12), 0))
cmp.save(os.path.join(OUT, "对比_浅黄.png"))
smalls.resize((smalls.width * 3, smalls.height * 3), Image.NEAREST).save(os.path.join(OUT, "对比_浅黄_80px.png"))

def lum(c):
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
ball_l = lum((249, 210, 85))
print(f"金球亮度 {ball_l:.0f}")
for name, bg, rim, sh in variants:
    bgc = tuple(int(v) for v in np.array(bg)[10, 10])
    print(f"{name}: 背景 {bgc} 亮度 {lum(bgc):.0f} | 球vs背景 {(max(lum(bgc), ball_l)+0.05)/(min(lum(bgc), ball_l)+0.05):.2f}:1"
          f" | 描边vs背景 {(lum(bgc)+0.05)/(lum(rim)+0.05):.2f}:1")
print("已输出浅黄对比")
