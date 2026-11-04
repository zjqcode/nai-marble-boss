# -*- coding: utf-8 -*-
"""梦幻浅蓝 v2：贴纸风描边 + 实心投影，把球从浅底上分离出来"""
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

def layered(rim_col=(44, 78, 108), rim_alpha=240, rim_w=3,
            shadow=True, shadow_alpha=105, glow=True):
    out = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    if shadow:
        sh = Image.new("RGBA", (W, W), (0, 0, 0, 0))
        ImageDraw.Draw(sh).ellipse([cx - rad * 1.0, cy - rad * 0.92 + 10,
                                    cx + rad * 1.0, cy + rad * 1.02 + 10],
                                   fill=(40, 78, 116, shadow_alpha))
        sh = sh.filter(ImageFilter.GaussianBlur(16))
        out = Image.alpha_composite(out, sh)
    if glow:
        gl = Image.new("RGBA", (W, W), (0, 0, 0, 0))
        ImageDraw.Draw(gl).ellipse([cx - rad * 1.12, cy - rad * 1.12, cx + rad * 1.12, cy + rad * 1.12],
                                   fill=(255, 255, 255, 42))
        gl = gl.filter(ImageFilter.GaussianBlur(12))
        out = Image.alpha_composite(out, gl)
    ring = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    ImageDraw.Draw(ring).ellipse([cx - rad, cy - rad, cx + rad, cy + rad],
                                 outline=rim_col + (rim_alpha,), width=rim_w)
    out = Image.alpha_composite(out, ring)
    out = Image.alpha_composite(out, ball_img)
    return out

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

# A: 天蓝
bgA = bokeh(grad((208, 238, 255), (150, 202, 243)),
            [(110, 105, 52, 46, (255, 255, 255)), (395, 145, 38, 38, (255, 255, 255)),
             (85, 390, 34, 30, (255, 255, 255)), (415, 395, 44, 34, (255, 255, 255))])

# B: 浅蓝 -> 淡紫
bgB = bokeh(grad((212, 238, 255), (198, 204, 250)),
            [(150, 115, 62, 38, (255, 255, 255)), (385, 195, 46, 32, (245, 240, 255)),
             (105, 405, 40, 28, (255, 245, 255))])

variants = [("A_天蓝描边", bgA), ("B_蓝紫描边", bgB)]
cmp = Image.new("RGB", (W * 2 + 20, W + 40), (14, 20, 30))
smalls = Image.new("RGB", (80 * 2 + 12, 80), (14, 20, 30))
for i, (name, bg) in enumerate(variants):
    layer = layered()
    canvas = bg.copy()
    canvas.paste(layer, (0, 0), layer)
    canvas.save(os.path.join(OUT, f"图标bg_{name}.png"))
    cmp.paste(canvas, (i * (W + 20), 30))
    smalls.paste(canvas.resize((80, 80), Image.LANCZOS), (i * (80 + 12), 0))
cmp.save(os.path.join(OUT, "对比_浅蓝v2.png"))
smalls.resize((smalls.width * 3, smalls.height * 3), Image.NEAREST).save(os.path.join(OUT, "对比_浅蓝v2_80px.png"))

def lum(c):
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
rim_l = lum((44, 78, 108))
for name, bg in variants:
    bl = lum(tuple(int(v) for v in np.array(bg)[10, 10]))
    print(f"{name}: 背景亮度 {bl:.0f} / 描边亮度 {rim_l:.0f} → 描边与背景对比 {(bl+0.05)/(rim_l+0.05):.2f}:1")
print("已输出 v2 对比")
