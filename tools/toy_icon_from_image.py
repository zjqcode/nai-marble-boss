# -*- coding: utf-8 -*-
"""v4：只在外圈 6px 内做反解，内部严格保持原图，避免产生杂点"""
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
import os

SRC = r"C:\Users\逸愉\.dsh\attachments\v1\objects\49\49768771eca27785de4b9400e45b734368f20c9790988ff90d3c5b4e0f27c8f4"
OUT = r"C:\Users\逸愉\Documents\my_game\dist\toy"

im = Image.open(SRC).convert("RGB")
W, H = im.size
a = np.array(im).astype(np.float32)
mn = a.min(axis=2)

solid = mn < 236
rows = solid.sum(axis=1) >= 6
cols = solid.sum(axis=0) >= 6
y0, y1 = np.where(rows)[0][[0, -1]]
x0, x1 = np.where(cols)[0][[0, -1]]

sub = solid[y0:y1 + 1, x0:x1 + 1]
best = None
for r in range(int((x1 - x0) * 0.18), int((x1 - x0) * 0.32)):
    m = Image.new("L", (x1 - x0 + 1, y1 - y0 + 1), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, x1 - x0, y1 - y0], radius=r, fill=255)
    diff = np.logical_xor(np.array(m) > 127, sub).mean()
    if best is None or diff < best[1]:
        best = (r, diff)
r = best[0]
print(f"bbox ({x0},{y0})-({x1},{y1}) 圆角 {r} 差异 {best[1]*100:.2f}%")

# 原始遮罩（含边）+ 收 2px 的干净遮罩
raw = Image.new("L", (W, H), 0)
ImageDraw.Draw(raw).rounded_rectangle([x0, y0, x1, y1], radius=r, fill=255)
core = raw.filter(ImageFilter.MinFilter(5))            # 收 2px
core_np = np.array(core).astype(np.float32) / 255.0

# 外圈带：raw 内但 core 外（约 2px 宽），再放宽到 4px 便于去边
band_outer = np.array(raw.filter(ImageFilter.MaxFilter(3))) > 127
band_inner = np.array(raw.filter(ImageFilter.MinFilter(9))) > 127     # 内缩 4px
band = band_outer & (~band_inner)

alpha = core_np.copy()
# 外圈带：按离白程度给 alpha（并反解颜色）
LO, HI = 220.0, 250.0
afb = np.clip((HI - mn) / (HI - LO), 0.0, 1.0)
alpha[band] = np.minimum(core_np[band], afb[band])
alpha[~np.array(raw) > 127] = 0.0

alpha = np.array(Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))).astype(np.float32) / 255.0

rgb = a.copy()
safe = np.maximum(alpha, 0.12)[..., None]
un = np.clip((a - 255.0 * (1.0 - alpha[..., None])) / safe, 0, 255)
rgb[band] = un[band]          # 只有外圈带去白

rgba = np.dstack([rgb, alpha * 255.0]).astype(np.uint8)
img = Image.fromarray(rgba, "RGBA")

crop = img.crop((x0, y0, x1 + 1, y1 + 1))
side = max(crop.size)
canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
canvas.paste(crop, ((side - crop.width) // 2, (side - crop.height) // 2), crop)
final = canvas.resize((500, 500), Image.LANCZOS)
final.save(os.path.join(OUT, "图标_1x1_新.png"))
final.resize((80, 80), Image.LANCZOS).save(os.path.join(OUT, "预览_80px_新.png"))

bg = Image.new("RGBA", (500, 500), (18, 24, 34, 255))
comp = Image.alpha_composite(bg, final).convert("RGB")
ca = np.array(comp).astype(np.int16)
def nw(rg):
    return (((rg[:, :, 0] > 228) & (rg[:, :, 1] > 228) & (rg[:, :, 2] > 215)).mean() * 100)
pad = 5
print("深底各边 5px 近白: 左 %.3f%% 右 %.3f%% 上 %.3f%% 下 %.3f%%" %
      (nw(ca[60:440, pad:pad + 5]), nw(ca[60:440, -pad - 5:-pad]),
       nw(ca[pad:pad + 5, 60:440]), nw(ca[-pad - 5:-pad, 60:440])))
comp.save(os.path.join(OUT, "验收_深底.png"))
comp.crop((0, 100, 50, 400)).resize((400, 2400), Image.NEAREST).save(os.path.join(OUT, "验收_左边缘x8.png"))
print("done")
