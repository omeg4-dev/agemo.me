// Turns the rendered sheet into a picture.
//
// Rather than rasterising HTML (foreignObject is unreliable on iPad), this
// reads back where every glyph landed and paints it on a canvas with the
// same fonts, the same jitter and the same paper. What you copy is what you
// saw.

const SKIP = new Set(['SCRIPT', 'STYLE']);

/** Baseline offset for a font, measured once per font string. */
function ascentOf(ctx, font, cache) {
  if (cache.has(font)) return cache.get(font);
  ctx.font = font;
  const m = ctx.measureText('Hxdp');
  const size = parseFloat(font.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? '16');
  const ascent = m.fontBoundingBoxAscent || m.actualBoundingBoxAscent || size * 0.8;
  cache.set(font, ascent);
  return ascent;
}

const fontString = (cs, weight) =>
  `${cs.fontStyle} ${weight ?? cs.fontWeight} ${parseFloat(cs.fontSize)}px ${cs.fontFamily}`;

/**
 * Walks the sheet and records what to paint. Called while the sheet has its
 * transforms switched off, so every rect is the plain layout position.
 */
export function collect(root, origin) {
  const ops = [];
  const rel = (r) => ({ x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height });

  const walk = (node) => {
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        if (!child.nodeValue.trim()) continue;
        const parent = child.parentElement;
        if (parent.closest('.katex-mathml') || parent.classList.contains('hw-g')) continue;
        const cs = getComputedStyle(parent);
        if (cs.visibility === 'hidden' || cs.display === 'none') continue;
        const range = document.createRange();
        range.selectNodeContents(child);
        for (const rect of range.getClientRects()) {
          if (!rect.width) continue;
          ops.push({ kind: 'text', text: child.nodeValue, box: rel(rect), font: fontString(cs), color: cs.color, alpha: 1 });
        }
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE || SKIP.has(child.tagName)) continue;
      const cs = getComputedStyle(child);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
      const box = rel(child.getBoundingClientRect());

      if (child.tagName === 'SVG' || child.tagName === 'svg') {
        ops.push({ kind: 'svg', node: child, box, color: cs.color });
        continue;
      }

      // One of our glyphs: paint the character ourselves, with its jitter.
      if (child.classList.contains('hw-g')) {
        const d = child.dataset;
        ops.push({
          kind: 'glyph',
          text: child.textContent,
          box,
          font: fontString(cs),
          color: cs.color,
          alpha: Number(d.a ?? 1),
          rot: Number(d.r ?? 0),
          dx: Number(d.x ?? 0) * parseFloat(cs.fontSize),
          dy: Number(d.y ?? 0) * parseFloat(cs.fontSize),
          scale: Number(d.s ?? 1),
          skew: Number(child.parentElement?.dataset.k ?? 0),
        });
        continue;
      }

      // KaTeX draws fraction bars and the like as borders and blocks.
      const border = parseFloat(cs.borderBottomWidth);
      if (border > 0.3 && box.w > 0) {
        ops.push({ kind: 'rect', box: { x: box.x, y: box.y + box.h - border, w: box.w, h: border }, color: cs.borderBottomColor });
      }
      const bg = cs.backgroundColor;
      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent' && box.h <= 4 && box.w > 0) {
        ops.push({ kind: 'rect', box, color: bg });
      }
      walk(child);
    }
  };
  walk(root);
  return ops;
}

function paintPaper(ctx, { paper, width, height, line, colors }) {
  if (paper !== 'none') {
    ctx.fillStyle = colors.paper;
    ctx.fillRect(0, 0, width, height);
  }
  if (paper === 'lined' || paper === 'grid') {
    ctx.strokeStyle = colors.rule;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = line; y < height; y += line) {
      ctx.moveTo(0, Math.round(y) + 0.5);
      ctx.lineTo(width, Math.round(y) + 0.5);
    }
    if (paper === 'grid') {
      for (let x = line; x < width; x += line) {
        ctx.moveTo(Math.round(x) + 0.5, 0);
        ctx.lineTo(Math.round(x) + 0.5, height);
      }
    }
    ctx.stroke();
  }
}

async function svgImage(node) {
  const clone = node.cloneNode(true);
  const rect = node.getBoundingClientRect();
  clone.setAttribute('width', String(rect.width));
  clone.setAttribute('height', String(rect.height));
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(clone))}`;
  const img = new Image();
  img.decoding = 'sync';
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = url;
  });
  return img;
}

/**
 * Pushes the pixels around along a smooth random field — the stroke wobble
 * of the preview's SVG filter, done in pixels so the picture matches.
 */
export function wobble(ctx, width, height, amount, seed) {
  if (amount < 0.4) return;
  const cell = 26;
  const cols = Math.ceil(width / cell) + 2;
  const rows = Math.ceil(height / cell) + 2;
  let a = seed >>> 0;
  const rand = () => {
    a = (a * 1664525 + 1013904223) >>> 0;
    return a / 4294967296;
  };
  const fx = new Float32Array(cols * rows);
  const fy = new Float32Array(cols * rows);
  for (let i = 0; i < fx.length; i++) {
    fx[i] = (rand() * 2 - 1) * amount;
    fy[i] = (rand() * 2 - 1) * amount;
  }
  const at = (f, cx, cy) => f[Math.min(rows - 1, cy) * cols + Math.min(cols - 1, cx)];
  const sample = (f, x, y) => {
    const gx = x / cell;
    const gy = y / cell;
    const cx = Math.floor(gx);
    const cy = Math.floor(gy);
    const tx = gx - cx;
    const ty = gy - cy;
    const a00 = at(f, cx, cy);
    const a10 = at(f, cx + 1, cy);
    const a01 = at(f, cx, cy + 1);
    const a11 = at(f, cx + 1, cy + 1);
    return a00 * (1 - tx) * (1 - ty) + a10 * tx * (1 - ty) + a01 * (1 - tx) * ty + a11 * tx * ty;
  };

  const src = ctx.getImageData(0, 0, width, height);
  const dst = ctx.createImageData(width, height);
  const s = src.data;
  const d = dst.data;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const sx = Math.round(x + sample(fx, x, y));
      const sy = Math.round(y + sample(fy, x, y));
      const from = ((sy < 0 || sy >= height || sx < 0 || sx >= width) ? (y * width + x) : (sy * width + sx)) * 4;
      const to = (y * width + x) * 4;
      d[to] = s[from];
      d[to + 1] = s[from + 1];
      d[to + 2] = s[from + 2];
      d[to + 3] = s[from + 3];
    }
  }
  ctx.putImageData(dst, 0, 0);
}

/**
 * Paints the sheet onto a canvas. `sheet` is the element with the paper,
 * `ink` the element holding the writing.
 */
export async function drawSheet({ sheet, ink, paper, colors, line, wobbleAmount = 0, seed = 1, scale = 2 }) {
  sheet.classList.add('is-measuring');
  const origin = sheet.getBoundingClientRect();
  const width = Math.round(origin.width);
  const height = Math.round(origin.height);
  let ops;
  try {
    ops = collect(ink, origin);
  } finally {
    sheet.classList.remove('is-measuring');
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  paintPaper(ctx, { paper, width, height, line, colors });

  const ascents = new Map();
  ctx.textBaseline = 'alphabetic';
  for (const op of ops) {
    if (op.kind === 'rect') {
      ctx.fillStyle = op.color;
      ctx.fillRect(op.box.x, op.box.y, op.box.w, Math.max(op.box.h, 0.8));
      continue;
    }
    if (op.kind === 'svg') {
      try {
        const img = await svgImage(op.node);
        ctx.drawImage(img, op.box.x, op.box.y, op.box.w, op.box.h);
      } catch { /* a symbol we cannot rasterise is better skipped than fatal */ }
      continue;
    }
    const ascent = ascentOf(ctx, op.font, ascents);
    ctx.save();
    ctx.font = op.font;
    ctx.fillStyle = op.color;
    if (op.kind === 'glyph') {
      ctx.globalAlpha = op.alpha;
      ctx.translate(op.box.x + op.box.w / 2 + op.dx, op.box.y + ascent + op.dy);
      ctx.rotate((op.rot * Math.PI) / 180);
      if (op.skew) ctx.transform(1, 0, Math.tan((-op.skew * Math.PI) / 180), 1, 0, 0);
      ctx.scale(op.scale, op.scale);
      ctx.textAlign = 'center';
      ctx.fillText(op.text, 0, 0);
    } else {
      ctx.textAlign = 'left';
      ctx.fillText(op.text, op.box.x, op.box.y + ascent);
    }
    ctx.restore();
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  wobble(ctx, canvas.width, canvas.height, wobbleAmount * scale, seed);
  return canvas;
}

export function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('canvas produced no image'))), 'image/png');
  });
}
