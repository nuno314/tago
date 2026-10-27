export class Pix {
  readonly w: number
  readonly h: number
  readonly px: Uint8Array
  ox = 0
  oy = 0

  constructor(w: number, h: number) {
    this.w = w
    this.h = h
    this.px = new Uint8Array(w * h)
  }

  get(x: number, y: number): number {
    const ix = Math.round(x)
    const iy = Math.round(y)
    if (ix < 0 || iy < 0 || ix >= this.w || iy >= this.h) return 0
    return this.px[iy * this.w + ix]
  }

  set(x: number, y: number, color: number) {
    if (color <= 0) return
    const ix = Math.round(x + this.ox)
    const iy = Math.round(y + this.oy)
    if (ix < 0 || iy < 0 || ix >= this.w || iy >= this.h) return
    this.px[iy * this.w + ix] = color
  }

  rect(x: number, y: number, w: number, h: number, color: number) {
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) this.set(x + xx, y + yy, color)
    }
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, color: number) {
    const radX = Math.max(0.4, rx)
    const radY = Math.max(0.4, ry)
    for (let y = Math.floor(cy - radY - 1); y <= Math.ceil(cy + radY + 1); y++) {
      for (let x = Math.floor(cx - radX - 1); x <= Math.ceil(cx + radX + 1); x++) {
        const dx = (x + 0.5 - cx) / radX
        const dy = (y + 0.5 - cy) / radY
        if (dx * dx + dy * dy <= 1) this.set(x, y, color)
      }
    }
  }

  tri(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, color: number) {
    const minX = Math.floor(Math.min(ax, bx, cx))
    const maxX = Math.ceil(Math.max(ax, bx, cx))
    const minY = Math.floor(Math.min(ay, by, cy))
    const maxY = Math.ceil(Math.max(ay, by, cy))
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
    if (area === 0) return
    const edge = (x0: number, y0: number, x1: number, y1: number, px: number, py: number) =>
      (px - x0) * (y1 - y0) - (py - y0) * (x1 - x0)
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5
        const py = y + 0.5
        const w0 = edge(bx, by, cx, cy, px, py)
        const w1 = edge(cx, cy, ax, ay, px, py)
        const w2 = edge(ax, ay, bx, by, px, py)
        const inside = area > 0 ? w0 >= 0 && w1 >= 0 && w2 >= 0 : w0 <= 0 && w1 <= 0 && w2 <= 0
        if (inside) this.set(x, y, color)
      }
    }
  }

  line(x0: number, y0: number, x1: number, y1: number, color: number) {
    let cx = Math.round(x0)
    let cy = Math.round(y0)
    const tx = Math.round(x1)
    const ty = Math.round(y1)
    const dx = Math.abs(tx - cx)
    const dy = Math.abs(ty - cy)
    const sx = cx < tx ? 1 : -1
    const sy = cy < ty ? 1 : -1
    let err = dx - dy
    for (;;) {
      this.set(cx, cy, color)
      if (cx === tx && cy === ty) break
      const e2 = 2 * err
      if (e2 > -dy) {
        err -= dy
        cx += sx
      }
      if (e2 < dx) {
        err += dx
        cy += sy
      }
    }
  }

  orb(cx: number, cy: number, rx: number, ry: number, body: number, shade: number, light: number, spec = 0) {
    const radX = Math.max(0.6, rx)
    const radY = Math.max(0.6, ry)
    for (let y = Math.floor(cy - radY - 1); y <= Math.ceil(cy + radY + 1); y++) {
      for (let x = Math.floor(cx - radX - 1); x <= Math.ceil(cx + radX + 1); x++) {
        const dx = (x + 0.5 - cx) / radX
        const dy = (y + 0.5 - cy) / radY
        const d2 = dx * dx + dy * dy
        if (d2 > 1) continue
        const lit = lambert(dx, dy)
        this.set(x, y, litTone(lit, d2 > 0.78, spec > 0 && lit > 0.7 && d2 < 0.22, body, shade, light, spec))
      }
    }
  }

  litRect(x: number, y: number, w: number, h: number, body: number, shade: number, light: number, spec = 0) {
    if (w <= 0 || h <= 0) return
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        const u = ((xx + 0.5) / w) * 2 - 1
        const v = ((yy + 0.5) / h) * 2 - 1
        const lit = lambert(u, v)
        const rim = xx >= w - 1 || yy >= h - 1
        const hot = spec > 0 && xx < w * 0.3 && yy < h * 0.3
        this.set(x + xx, y + yy, litTone(lit, rim, hot, body, shade, light, spec))
      }
    }
  }

  litTri(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, body: number, shade: number, light: number, spec = 0) {
    const minX = Math.floor(Math.min(ax, bx, cx))
    const maxX = Math.ceil(Math.max(ax, bx, cx))
    const minY = Math.floor(Math.min(ay, by, cy))
    const maxY = Math.ceil(Math.max(ay, by, cy))
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
    if (area === 0) return
    const gx = (ax + bx + cx) / 3
    const gy = (ay + by + cy) / 3
    let reach = 1
    for (const [px, py] of [
      [ax, ay],
      [bx, by],
      [cx, cy],
    ]) {
      reach = Math.max(reach, Math.hypot(px - gx, py - gy))
    }
    const edge = (x0: number, y0: number, x1: number, y1: number, px: number, py: number) =>
      (px - x0) * (y1 - y0) - (py - y0) * (x1 - x0)
    const span = Math.abs(area)
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5
        const py = y + 0.5
        const w0 = edge(bx, by, cx, cy, px, py)
        const w1 = edge(cx, cy, ax, ay, px, py)
        const w2 = edge(ax, ay, bx, by, px, py)
        const inside = area > 0 ? w0 >= 0 && w1 >= 0 && w2 >= 0 : w0 <= 0 && w1 <= 0 && w2 <= 0
        if (!inside) continue
        const lit = lambert((px - gx) / reach, (py - gy) / reach)
        const minB = Math.min(Math.abs(w0), Math.abs(w1), Math.abs(w2)) / span
        this.set(x, y, litTone(lit, minB < 0.1, spec > 0 && lit > 0.65 && minB > 0.18, body, shade, light, spec))
      }
    }
  }
}

function lambert(nx: number, ny: number) {
  return -0.62 * nx - 0.78 * ny
}

function litTone(lit: number, rim: boolean, hot: boolean, body: number, shade: number, light: number, spec: number) {
  if (hot && spec > 0) return spec
  if (rim && lit < 0.25) return shade
  if (lit > 0.42) return light
  if (lit < -0.08) return shade
  return body
}

export function outline(src: Pix): Pix {
  const out = new Pix(src.w, src.h)
  for (let i = 0; i < src.px.length; i++) out.px[i] = src.px[i]
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      if (src.get(x, y)) continue
      if (src.get(x + 1, y) || src.get(x - 1, y) || src.get(x, y + 1) || src.get(x, y - 1)) {
        out.px[y * out.w + x] = 1
      }
    }
  }
  return out
}

export function scale2(src: Pix): Pix {
  const out = new Pix(src.w * 2, src.h * 2)
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const color = src.px[y * src.w + x]
      if (!color) continue
      const ox = x * 2
      const oy = y * 2
      out.px[oy * out.w + ox] = color
      out.px[oy * out.w + ox + 1] = color
      out.px[(oy + 1) * out.w + ox] = color
      out.px[(oy + 1) * out.w + ox + 1] = color
    }
  }
  return out
}

export function diffCount(a: Pix, b: Pix): number {
  let n = 0
  const len = Math.min(a.px.length, b.px.length)
  for (let i = 0; i < len; i++) if (a.px[i] !== b.px[i]) n += 1
  return n
}
