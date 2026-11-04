# -*- coding: utf-8 -*-
"""奶球人脸 v3：完整保留原图（不裁切），只在球上画眼睛和嘴"""
from PIL import Image, ImageDraw, ImageFilter
import os

D = r"C:\Users\逸愉\Documents\my_game\dist\toy\user"
OUT = r"C:\Users\逸愉\Documents\my_game\dist\toy"

BASE = Image.open(os.path.join(D, "icon_base.jpg")).convert("RGB")
BW, BH = BASE.size
CX, CY, R = 156.4, 168.3, 64.0
UP = 5
IRIS = (150, 196, 104)
IRIS_EDGE = (104, 146, 70)

def render(eye_r, eye_dx, eye_dy, mouth_w, mouth_dy, mouth_drope, tag, out_size=500):
    W = BW * UP
    canvas = BASE.resize((W, W), Image.LANCZOS)
    canvas = canvas.filter(ImageFilter.UnsharpMask(radius=2.0, percent=110, threshold=1))
    d = ImageDraw.Draw(canvas, "RGBA")

    cx, cy, r = CX * UP, CY * UP, R * UP
    iris = r * eye_r
    dx = r * eye_dx
    ey = cy - r * eye_dy

    for sx in (-1, 1):
        ex = cx + sx * dx
        d.ellipse([ex - iris * 1.18, ey - iris * 1.02 + iris * 0.20,
                   ex + iris * 1.18, ey + iris * 1.20 + iris * 0.20], fill=(112, 74, 26, 32))
        d.ellipse([ex - iris * 1.02, ey - iris * 1.02, ex + iris * 1.02, ey + iris * 1.02], fill=IRIS_EDGE)
        steps = max(8, int(iris))
        for i in range(steps, 0, -1):
            t = i / steps
            k = 1 - t
            col = (int(IRIS[0] + 14 * k), int(IRIS[1] + 10 * k), int(IRIS[2] + 8 * k))
            d.ellipse([ex - iris * t * 0.95, ey - iris * t * 0.95,
                       ex + iris * t * 0.95, ey + iris * t * 0.95], fill=col + (255,))
        pr = iris * 0.58
        d.ellipse([ex - pr, ey - pr + iris * 0.04, ex + pr, ey + pr + iris * 0.04], fill=(18, 20, 18, 255))
        hr = iris * 0.24
        hx, hy = ex - iris * 0.33, ey - iris * 0.37
        d.ellipse([hx - hr, hy - hr, hx + hr, hy + hr], fill=(255, 255, 255, 240))
        hr2 = iris * 0.10
        d.ellipse([ex + iris * 0.30 - hr2, ey + iris * 0.30 - hr2,
                   ex + iris * 0.30 + hr2, ey + iris * 0.30 + hr2], fill=(228, 248, 228, 160))

    mw = r * mouth_w
    my = cy + r * mouth_dy
    lw = max(4, int(r * 0.050))
    d.arc([cx - mw / 2, my - mw * mouth_drope, cx + mw / 2, my + mw * mouth_drope],
          18, 162, fill=(126, 72, 30, 255), width=lw)

    final = canvas.resize((out_size, out_size), Image.LANCZOS)
    final.save(os.path.join(OUT, f"图标_蓝底奶球_{tag}.png"))
    print("ok:", f"图标_蓝底奶球_{tag}.png")

render(0.230, 0.355, 0.020, 0.30, 0.40, 0.30, "A")
render(0.255, 0.365, 0.010, 0.33, 0.42, 0.32, "B")
render(0.205, 0.340, 0.030, 0.27, 0.38, 0.28, "C")
