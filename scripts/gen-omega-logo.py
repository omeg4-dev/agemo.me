#!/usr/bin/env python3
"""Turn the fastfetch ANSI logo into an inline SVG.

One-shot, run by hand — it reads a file outside the repo, so it is NOT part of
the build. Regenerate with:

    python3 scripts/gen-omega-logo.py ~/.config/fastfetch/logo.ansi \
        src/components/omega-logo.svg

The logo is drawn with Ω (U+03A9) and ω (U+03C9), neither of which is in the
font subset — the subset deliberately excludes them and a whole-page test
asserts they never appear as literal text (task-4-addendum §4). So each
character cell becomes a dot instead: Ω a large one, ω a small one, each
keeping its exact per-cell colour from the ANSI. That preserves the gradient
and the light/dark structure of the original without needing either glyph.
"""
import re
import sys

CELL_W, CELL_H = 10.0, 20.0   # terminal cells are about twice as tall as wide
R_BIG, R_SMALL = 3.6, 2.2

src, out = sys.argv[1], sys.argv[2]
lines = open(src, encoding="utf-8").read().split("\n")

# Two escape alternatives, not one: an SGR sequence carries colour, and any
# OTHER CSI (\x1b[0K, \x1b[?25l ...) must be consumed whole. Matching only
# m-terminated CSI leaves the rest of such a sequence to fall through the
# printable branch, where every one of its bytes advances x and shifts the
# remainder of the row to the right.
token = re.compile(r"\x1b\[([0-9;]*)m|\x1b\[[0-9;?]*[A-Za-z]|([^\x1b])")
cells = []
cols = 0
for y, line in enumerate(lines):
    colour, x = "#ffffff", 0
    for m in token.finditer(line):
        if m.group(1) is not None:
            p = m.group(1).split(";")
            if len(p) >= 5 and p[0] == "38" and p[1] == "2":
                colour = "#%02x%02x%02x" % (int(p[2]), int(p[3]), int(p[4]))
            elif p in ([""], ["0"]):
                colour = "#ffffff"   # a reset must not leak the previous colour
            continue
        ch = m.group(2)
        if ch in ("Ω", "ω"):
            cells.append((x, y, colour, R_BIG if ch == "Ω" else R_SMALL))
        x += 1
        cols = max(cols, x)

if not cells:
    sys.exit(f"{src}: no Ω or ω found — is this really a fastfetch logo.ansi?")
rows = max(c[1] for c in cells) + 1
w, h = cols * CELL_W, rows * CELL_H
dots = "".join(
    f'<circle cx="{x * CELL_W + CELL_W / 2:.1f}" cy="{y * CELL_H + CELL_H / 2:.1f}"'
    f' r="{r}" fill="{c}"/>'
    for x, y, c, r in cells
)
open(out, "w", encoding="utf-8").write(
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.0f}"'
    f' role="img" aria-label="Omega" fill="none">{dots}</svg>\n'
)
print(f"{out}: {len(cells)} dots, {cols}x{rows} cells")
