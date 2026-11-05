# -*- coding: utf-8 -*-
"""按实际 bbox 抠图：白色背景 -> 透明，保持高光不被挖空"""
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
import os

SRC = r"C:\Users\逸愉\.dsh\attachments\v1\objects\49\49768771eca27785de4b9400e45b734368f20c9790988ff90d3c5b4e0f27c8f4"
OUT = r"C:\Users\逸愉\Documents\my_game\dist\toy"

im = Image.open(SRC).convert("RGB")
W, H = im.size
a = np.array(im).astype(np.int16)
white = (a[:, :, 0] > 246) & (a[:, :, 1] > 246) & (a[:, :, 2] > 246)
ys, xs = np.where(~white)
x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
bw, bh = x1 - x0 + 1, y1 - y0 + 1
print(f"图标实际区域: ({x0},{y0}) - ({x1},{y1})  {bw}x{bh}")

# 圆角半径：只在 bbox 内比较
best = None
for r in range(int(bw * 0.10), int(bw * 0.32), 2):
    m = Image.new("L", (bw, bh), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, bw - 1, bh - 1], radius=r, fill=255)
    mm = np.array(m) > 127
    sub = ~white[y0:y1 + 1, x0:x1 + 1]
    diff = np.logical_xor(mm, sub).mean()
    if best is None or diff < best[1]:
        best = (r, diff)
r = best[0]
print(f"圆角半径 {r}px（占宽 {r/bw*100:.1f}%），形状差异 {best[1]*100:.2f}%")

# 用 bbox + 圆角造 alpha
mask = Image.new("L", (W, H), 0)
ImageDraw.Draw(mask).rounded_rectangle([x0, y0, x1, y1], radius=r, fill=255)
mask = mask.filter(ImageFilter.GaussianBlur(1.5))

rgba = Image.new("RGBA", (W, H), (0, 0, 0, 0))
rgba.paste(im, (0, 0), mask)

# 裁到 bbox 再缩放到 500（保证图标撑满 500 画布）
crop = rgba.crop((x0, y0, x1 + 1, y1 + 1))
side = max(crop.size)
canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
canvas.paste(crop, ((side - crop.width) // 2, (side - crop.height) // 2), crop)

final = canvas.resize((500, 500), Image.LANCZOS)
final.save(os.path.join(OUT, "图标_1x1_新.png"))
final.resize((128, 128), Image.LANCZOS).save(os.path.join(OUT, "预览_128px_新.png"))
final.resize((80, 80), Image.LANCZOS).save(os.path.join(OUT, "预览_80px_新.png"))

# 检查透明角
aa = np.array(final)
print("四角透明度:", aa[2, 2, 3], aa[2, -3, 3], aa[-3, 2, 3], aa[-3, -3, 3])
print("中心不透明度:", aa[250, 250, 3])
