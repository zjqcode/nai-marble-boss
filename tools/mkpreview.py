"""把 dist/shots/*.png（780x1688 @2x）缩放成 preview/*.jpg（390x844）。

2x 渲染再降采样，比 1x 直接渲染更清晰；同时控制文件体积，避免仓库里堆大图。
"""
import os
from PIL import Image

root = r"C:\Users\逸愉\Documents\my_game"
shots = os.path.join(root, "dist", "shots")
preview = os.path.join(root, "preview")
os.makedirs(preview, exist_ok=True)

W, H, Q = 390, 844, 88
total = 0
names = []
for f in sorted(os.listdir(shots)):
    if not f.endswith(".png"):
        continue
    name = f[:-4]
    im = Image.open(os.path.join(shots, f)).convert("RGB")
    im = im.resize((W, H), Image.LANCZOS)
    out = os.path.join(preview, name + ".jpg")
    im.save(out, "JPEG", quality=Q, optimize=True, progressive=True)
    size = os.path.getsize(out)
    total += size
    names.append(name)
    print(f"  {name:<10} {im.size[0]}x{im.size[1]}  {size/1024:5.1f} KB")

print(f"\n生成 {len(names)} 张，合计 {total/1024:.0f} KB")

# 删除不在新集合里的旧截图
stale = [f for f in os.listdir(preview)
         if f.endswith(".jpg") and f[:-4] not in names]
for f in stale:
    p = os.path.join(preview, f)
    print(f"  删除过期截图: {f} ({os.path.getsize(p)/1024:.0f} KB)")
    os.remove(p)
print("preview/ 现有:", ", ".join(sorted(x[:-4] for x in os.listdir(preview))))
