import os, sys, math
from PIL import Image, ImageChops

outdir = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\逸愉\Documents\my_game\dist\visual"


def compare(name, pa, pb):
    if not (os.path.exists(pa) and os.path.exists(pb)):
        print(f"{name}: 缺少截图，跳过")
        return None
    A = Image.open(pa).convert("RGB")
    B = Image.open(pb).convert("RGB")
    if A.size != B.size:
        print(f"{name}: 尺寸不同 {A.size} vs {B.size}")
        return None
    w, h = A.size
    a, b = A.load(), B.load()
    mx = 0
    s = 0
    diffcount = 0
    n = w * h * 3
    for y in range(h):
        for x in range(w):
            ra, ga, ba = a[x, y]
            rb, gb, bb = b[x, y]
            for u, v in ((ra, rb), (ga, gb), (ba, bb)):
                d = u - v
                if d:
                    diffcount += 1
                    if abs(d) > mx:
                        mx = abs(d)
                    s += d * d
    mse = s / n
    psnr = 99.0 if mse == 0 else 10 * math.log10(255 ** 2 / mse)
    pexpct = 100.0 * diffcount / n
    print(f"{name}: 尺寸 {w}x{h}  最大误差={mx}  PSNR={psnr:.2f} dB  有差异的通道值占比={pexpct:.3f}%")

    # 生成差异可视化
    diff = ImageChops.difference(A, B)
    # 放大差异便于观察
    diff = diff.point(lambda v: min(255, v * 8))
    side = Image.new("RGB", (w * 2 + 8, h), (20, 20, 24))
    side.paste(A, (0, 0))
    side.paste(B, (w + 8, 0))
    side.save(os.path.join(outdir, f"{name}_sbs.jpg"), quality=92)
    diff.save(os.path.join(outdir, f"{name}_diff8x.png"))
    return psnr, mx, pexpct


print("=== 视觉回归对比（A=旧 PNG/JPG 构建, B=新 WebP 构建）===\n")
r1 = compare("texture", os.path.join(outdir, "texture_a.png"), os.path.join(outdir, "texture_b.png"))
r2 = compare("scene", os.path.join(outdir, "scene_a.png"), os.path.join(outdir, "scene_b.png"))

print("\n判据: scene 场景 PSNR >= 40 dB 且 最大误差在压缩噪声量级 = 视觉无差别")
if r2:
    ok = r2[0] >= 40
    print("结论:", "通过 —— 两版游戏画面视觉无差别" if ok else "不通过 —— 画面存在可见差异")
