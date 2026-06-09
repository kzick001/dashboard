#!/usr/bin/env python3
"""Generate all SVG sprites for Undead Barrage as crisp pixel-art grids."""
import os, random

OUT = 'assets/svgs'
os.makedirs(OUT, exist_ok=True)

def grid_svg(rows, palette, w_out, h_out):
    h = len(rows)
    w = max(len(r) for r in rows)
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" '
             f'width="{w_out}" height="{h_out}" shape-rendering="crispEdges">']
    for y, row in enumerate(rows):
        x = 0
        while x < len(row):
            c = row[x]
            if c == '.':
                x += 1
                continue
            x2 = x
            while x2 < len(row) and row[x2] == c:
                x2 += 1
            parts.append(f'<rect x="{x}" y="{y}" width="{x2 - x}" height="1" fill="{palette[c]}"/>')
            x = x2
    parts.append('</svg>')
    return '\n'.join(parts)

def write(name, svg):
    with open(f'{OUT}/{name}.svg', 'w') as f:
        f.write(svg)
    print(f'  {name}.svg')

# ============ PLAYER (top-down soldier, facing up) ============
write('player', grid_svg([
    ".......Gg.......",
    ".......Gg.......",
    ".......Gg.......",
    "......sGgs......",
    ".....vsGGsv.....",
    "....vvHHHHvv....",
    "...vvHHHHHHvv...",
    "...vHHDDDDHHv...",
    "...vHDDDDDDHv...",
    "...vHHDDDDHHv...",
    "...vvHHHHHHvv...",
    "....VVHHHHVV....",
    "....VVVVVVVV....",
    ".....VVVVVV.....",
    ".....VV..VV.....",
    "................",
], {'G': '#27272a', 'g': '#52525b', 's': '#d4a373', 'H': '#3b82f6',
    'D': '#1d4ed8', 'V': '#1e293b', 'v': '#334155'}, 64, 64))

# ============ PROJECTILES ============
write('bullet', grid_svg([
    ".oYYYYYy",
    "oYYYYYyW",
    "oYYYYYyW",
    ".oYYYYYy",
], {'Y': '#eab308', 'y': '#facc15', 'o': '#a16207', 'W': '#fef9c3'}, 16, 8))

write('grenade', grid_svg([
    "......LLL.......",
    "......LPL.......",
    ".....LLLLL......",
    "....OOOOOOO.....",
    "...OOoOOoOOO....",
    "..OOOOOOOOOOO...",
    "..OoOOoOOoOOo...",
    "..OOOOOOOOOOO...",
    "..OoOOoOOoOOo...",
    "..OOOOOOOOOOO...",
    "..OoOOoOOoOOo...",
    "...OOOOOOOOO....",
    "....OOOOOOO.....",
    ".....OOOOO......",
    "................",
    "................",
], {'O': '#4d5d2a', 'o': '#3a4720', 'L': '#9ca3af', 'P': '#6b7280'}, 32, 32))

# ============ ENEMIES ============
write('grunt', grid_svg([
    "...ss......ss...",
    "...SS......SS...",
    "...SS.SSSS.SS...",
    "...SSSSSSSSSS...",
    "...sSEsSSsESs...",
    "....SSSSSSSS....",
    "....CSSSSSSC....",
    "...CCCSRRSCCC...",
    "..CCcCCCCCCcCC..",
    "..Cc.CCCCCC.cC..",
    ".....CCCCCC.....",
    ".....CcCCcC.....",
    ".....CCCCCC.....",
    ".....cC..Cc.....",
    ".....SS..SS.....",
    "................",
], {'S': '#8da05e', 's': '#6f8147', 'C': '#5b4636', 'c': '#473628',
    'R': '#7f1d1d', 'E': '#1c1917'}, 48, 48))

write('sprinter', grid_svg([
    "..K..........K..",
    "..Y..........Y..",
    "..Yy........yY..",
    "...Yy.YYYY.yY...",
    "...YYYYYYYYYY...",
    "....YEYYYYEY....",
    "....yYYYYYYy....",
    ".....YYYYYY.....",
    ".....yYYYYy.....",
    "......YYYY......",
    "......yYYy......",
    "......YYYY......",
    ".....Yy..yY.....",
    ".....Y....Y.....",
    "....Ky....yK....",
    "................",
], {'Y': '#b5c04a', 'y': '#8a9438', 'K': '#3f3f3f', 'E': '#dc2626'}, 48, 48))

write('spitter', grid_svg([
    "................",
    ".....PPPPPP.....",
    "....PPPPPPPP....",
    "....PEPPPPEP....",
    "....PPMMMMPP....",
    "....PMMMMMMP....",
    "...PPPMMMMPPP...",
    "..PPBBBBBBBBPP..",
    "..PBBbBBBBbBBP..",
    "..PBBBBBBBBBBP..",
    "..PBBbBBBBbBBP..",
    "..PPBBBBBBBBPP..",
    "...PPPPPPPPPP...",
    "....PP....PP....",
    "....PP....PP....",
    "................",
], {'P': '#6b8e23', 'B': '#9acd32', 'b': '#7fb024', 'M': '#1a1a1a',
    'E': '#111111'}, 48, 48))

write('tank', grid_svg([
    "..DD........DD..",
    ".DAAD......DAAD.",
    ".DAAAD....DAAAD.",
    ".DAAAAADDAAAAAD.",
    "..DAAAAAAAAAAD..",
    "..AAAHHHHHHAAA..",
    "..AAHHRHHRHHAA..",
    "..AAHHHHHHHHAA..",
    ".AAAAHHHHHHAAAA.",
    ".AaAAAAAAAAAAaA.",
    ".AaAADDDDDDAAaA.",
    ".AAAADaaaaDAAAA.",
    "..AAADDDDDDAAA..",
    "..AAAD....DAAA..",
    "..DDDD....DDDD..",
    "................",
], {'A': '#374151', 'a': '#4b5563', 'H': '#6b7280', 'R': '#dc2626',
    'D': '#1f2937'}, 64, 64))

write('burrower', grid_svg([
    ".......Uu.......",
    "......UUUu......",
    "......UEEu......",
    ".....KUUUUK.....",
    "....KKUUUUKK....",
    "....K.UUUu.K....",
    "......UUUu......",
    "......UuUu......",
    "......UUUu......",
    "......UuUu......",
    "......UUUu......",
    ".....UUUUUu.....",
    ".....UUUUUu.....",
    "......UUUu......",
    ".......Uu.......",
    "................",
], {'U': '#8b5a2b', 'u': '#6e4520', 'K': '#d6d3d1', 'E': '#fbbf24'}, 48, 48))

write('boss', grid_svg([
    "..T..................T..",
    "..LL................LL..",
    "..LLL...FFFFFFFF...LLL..",
    "...LLL.FFFFFFFFFF.LLL...",
    "....LLFFFFFFFFFFFFLL....",
    ".....FFFEEFFFFEEFFF.....",
    "....FFFFEEFFFFEEFFFF....",
    "....FFFFFFFFFFFFFFFF....",
    "...FFFFDTTTTTTTTDFFFF...",
    "...FFFFDDDDDDDDDDFFFF...",
    "..LFFFFFFFFFFFFFFFFFFL..",
    "..LLFFFfFFFFFFFFfFFFLL..",
    ".LLLFFFFFFFFFFFFFFFFLLL.",
    ".LL.FFFfFFFDDFFFfFFF.LL.",
    ".T..FFFFFFFDDFFFFFFF..T.",
    "....FFFFFFFFFFFFFFFF....",
    ".....FFFFFFFFFFFFFF.....",
    ".....FFFFffffffFFFF.....",
    "......FFFF....FFFF......",
    "......FFF......FFF......",
    ".....LFFF......FFFL.....",
    ".....LLL........LLL.....",
    "......T..........T......",
    "........................",
], {'F': '#7f1d1d', 'f': '#991b1b', 'D': '#450a0a', 'E': '#fbbf24',
    'T': '#d6d3d1', 'L': '#5b1212'}, 96, 96))

# ============ WEAPONS — TOP-DOWN IN-HAND (barrel points up) ============
GUN_PAL = {'b': '#3f3f46', 'B': '#27272a', 'W': '#7c4a21', 'A': '#22d3ee',
           'O': '#4d5d2a', 'M': '#52525b'}

def topdown(barrel, body, grip=2, accent=None, wide=False):
    rows = []
    bar = '.bMb..' if not wide else '.bMMb.'
    for _ in range(barrel):
        rows.append(bar if not wide else '.bMMb.')
    for i in range(body):
        c = accent if (accent and i == 0) else 'B'
        rows.append('.b' + c + c + 'b.')
    for _ in range(grip):
        rows.append('..BB..')
    return rows

write('wpn_0', grid_svg(topdown(3, 3), GUN_PAL, 32, 32))                 # Pistol
write('wpn_1', grid_svg(topdown(3, 5), GUN_PAL, 32, 32))                 # SMG
write('wpn_2', grid_svg(topdown(7, 3), GUN_PAL, 32, 32))                 # Shotgun
write('wpn_3', grid_svg(topdown(6, 4, accent='W'), GUN_PAL, 32, 32))     # AK
write('wpn_4', grid_svg(topdown(5, 5), GUN_PAL, 32, 32))                 # M4
write('wpn_5', grid_svg(topdown(4, 6, wide=True), GUN_PAL, 32, 32))      # LMG
write('wpn_6', grid_svg(topdown(5, 5, accent='O', wide=True), GUN_PAL, 32, 32))  # Launcher
write('wpn_7', grid_svg(topdown(4, 5, accent='A'), GUN_PAL, 32, 32))     # Eradicator

# ============ WEAPONS — SIDE VIEW (HUD / shop) ============
SIDE_PAL = {'b': '#3f3f46', 'B': '#27272a', 'M': '#71717a', 'W': '#7c4a21',
            'A': '#22d3ee', 'O': '#4d5d2a', 'o': '#3a4720'}

write('wpn_side_0', grid_svg([
    "................",
    "....bbbbbbbbbM..",
    "....bMMMMMMMbb..",
    "....bbbbBB......",
    "......BBBB......",
    "......BBb.......",
    "......BBb.......",
    "................",
], SIDE_PAL, 48, 24))

write('wpn_side_1', grid_svg([
    "................",
    "..b.............",
    "..bbbbbbbbbbbMM.",
    "..bMMMMMMMMMbb..",
    "...BBbbbbbbbb...",
    "...BB..bBBb.....",
    ".......bBBb.....",
    ".......bBb......",
], SIDE_PAL, 48, 24))

write('wpn_side_2', grid_svg([
    "................",
    "................",
    "..WWbbbbbbbbbbbM",
    "..WWWWbMMMMbbbbM",
    "...WWW..MMM.....",
    "................",
    "................",
    "................",
], SIDE_PAL, 48, 24))

write('wpn_side_3', grid_svg([
    "................",
    "..........b.....",
    "..WWWbbbbbbbbbbM",
    "..WWWWbbbbbbbbbM",
    "...WW..bbWW.....",
    ".......bWW......",
    "......bWW.......",
    "................",
], SIDE_PAL, 48, 24))

write('wpn_side_4', grid_svg([
    ".......bbb......",
    "..bbbbbbbbbbbbM.",
    "..bBBBBBBBBbbbM.",
    "...BB..bBBb.....",
    "...BB..bBBb.....",
    ".......bBb......",
    "................",
    "................",
], SIDE_PAL, 48, 24))

write('wpn_side_5', grid_svg([
    "................",
    "..bbbbbbbbbbbbbM",
    "..bBBBBBBBBBbbbM",
    "..bBBBBBBBBBbb..",
    "...BB.BBBB.b.b..",
    "......BBBB.b.b..",
    "......BBBB......",
    "................",
], SIDE_PAL, 48, 24))

write('wpn_side_6', grid_svg([
    "................",
    "..OOOOOOOOOOOoo.",
    "..OoOOOOOOOOOOOO",
    "..OOOOOOOOOOOOOO",
    "...BB...OOOOOoo.",
    "...BB...........",
    "................",
    "................",
], SIDE_PAL, 48, 24))

write('wpn_side_7', grid_svg([
    "......bbbb......",
    "..bbbbbAAbbbbAA.",
    "..bBBAAAAAAbbAA.",
    "..bbbbbAAbbbbAA.",
    "...BB...........",
    "...BB...........",
    "................",
    "................",
], SIDE_PAL, 48, 24))

# ============ PICKUPS / UI ============
write('coin', grid_svg([
    "..GGGG..",
    ".GWWGGg.",
    "GWGddGGg",
    "GWGdGGGg",
    "GGGdddGg",
    "GGGGGdGg",
    ".GGdddg.",
    "..gggg..",
], {'G': '#fbbf24', 'g': '#d97706', 'W': '#fef3c7', 'd': '#a16207'}, 16, 16))

write('crate', grid_svg([
    "oDDDDDDDDDDDDDDo",
    "DOOOOOoOOOOOOOOD",
    "DOOOOOoOOOOOOOOD",
    "DDDDDDDDDDDDDDDD",
    "DOOOOOoOOOOOOOOD",
    "DOWWOWoWOWWOWWOD",
    "DOOOOOoOOOOOOOOD",
    "DOWOWWoWWOWOWWOD",
    "DOOOOOoOOOOOOOOD",
    "DDDDDDDDDDDDDDDD",
    "DOOOOOoOOOOOOOOD",
    "DOOOOOoOOOOOOOOD",
    "DOOOOOoOOOOOOOOD",
    "DOOOOOoOOOOOOOOD",
    "oDDDDDDDDDDDDDDo",
    "................",
], {'O': '#5b6b3a', 'o': '#46522c', 'D': '#2e3520', 'W': '#c9cfa3'}, 32, 32))

write('grenade_pickup', grid_svg([
    "....LLL.....",
    "....LPL.....",
    "...LLLL.....",
    "..OOOOOO....",
    ".OOoOOoOO...",
    ".OOOOOOOO...",
    ".OoOOoOOo...",
    ".OOOOOOOO...",
    ".OoOOoOOo...",
    "..OOOOOO....",
    "...OOOO.....",
    "............",
], {'O': '#4d5d2a', 'o': '#3a4720', 'L': '#9ca3af', 'P': '#6b7280'}, 24, 24))

write('barricade', grid_svg([
    "....SSSSSsSSSSSsSSSS....",
    "...SsSSSSSsSSSSSsSSSs...",
    "..SSSSSsSSSSSsSSSSSsSS..",
    ".sSSSsSSSSSsSSSSSsSSSSs.",
    ".SSSSSSsSSSSSsSSSSSsSSS.",
    ".dssssssssssssssssssssd.",
    ".SSSsSSSSSsSSSSSsSSSSSS.",
    ".SsSSSSSsSSSSSsSSSSSsSS.",
    ".SSSSsSSSSSsSSSSSsSSSSS.",
    ".dssssssssssssssssssssd.",
    "CCCCCCCCCCCCCCCCCCCCCCCC",
    "CcCCCcCCCCCcCCCCCcCCCCcC",
    "CCCCCCCCCCCCCCCCCCCCCCCC",
    "........................",
    "........................",
    "........................",
], {'S': '#b8a47e', 's': '#9a8662', 'd': '#6b5d45', 'C': '#7c7c82',
    'c': '#65656b'}, 48, 32))

# ============ BACKGROUNDS (procedural, deterministic) ============
random.seed(7)

def road_bg():
    W, H = 500, 1000
    p = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" '
         f'width="{W}" height="{H}" preserveAspectRatio="none">']
    p.append(f'<rect width="{W}" height="{H}" fill="#18181b"/>')
    # faded asphalt patches
    for _ in range(14):
        x, y = random.randint(0, W), random.randint(0, H)
        r = random.randint(30, 90)
        p.append(f'<ellipse cx="{x}" cy="{y}" rx="{r}" ry="{r * 2}" fill="#141417" opacity="0.6"/>')
    # edge lines
    p.append(f'<rect x="8" width="5" height="{H}" fill="#8a7a2f" opacity="0.45"/>')
    p.append(f'<rect x="{W - 13}" width="5" height="{H}" fill="#8a7a2f" opacity="0.45"/>')
    # dashed center line
    y = 0
    while y < H:
        p.append(f'<rect x="{W // 2 - 4}" y="{y}" width="8" height="42" fill="#6b7280" opacity="0.45"/>')
        y += 90
    # cracks
    for _ in range(12):
        x, y = random.randint(20, W - 20), random.randint(0, H)
        pts = f'{x},{y}'
        for _ in range(4):
            x += random.randint(-30, 30)
            y += random.randint(10, 60)
            pts += f' {x},{y}'
        p.append(f'<polyline points="{pts}" stroke="#0d0d0f" stroke-width="2" fill="none" opacity="0.8"/>')
    # dark stains
    for _ in range(8):
        x, y = random.randint(30, W - 30), random.randint(0, H)
        p.append(f'<ellipse cx="{x}" cy="{y}" rx="{random.randint(15, 40)}" '
                 f'ry="{random.randint(10, 25)}" fill="#000000" opacity="0.25"/>')
    p.append('</svg>')
    return '\n'.join(p)

def sidewalk_bg():
    W, H = 1000, 1000
    p = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" '
         f'width="{W}" height="{H}" preserveAspectRatio="none">']
    p.append(f'<rect width="{W}" height="{H}" fill="#232327"/>')
    # expansion joints
    for y in range(0, H, 100):
        p.append(f'<rect y="{y}" width="{W}" height="3" fill="#1a1a1d"/>')
    # cracks + debris
    for _ in range(20):
        x, y = random.randint(0, W), random.randint(0, H)
        pts = f'{x},{y}'
        for _ in range(3):
            x += random.randint(-40, 40)
            y += random.randint(15, 50)
            pts += f' {x},{y}'
        p.append(f'<polyline points="{pts}" stroke="#161618" stroke-width="2" fill="none" opacity="0.7"/>')
    for _ in range(30):
        x, y = random.randint(0, W), random.randint(0, H)
        p.append(f'<rect x="{x}" y="{y}" width="{random.randint(3, 10)}" '
                 f'height="{random.randint(3, 8)}" fill="#1a1a1d"/>')
    # overturned trash can
    p.append('<g transform="translate(180,460) rotate(80)">'
             '<rect width="36" height="52" rx="4" fill="#141416"/>'
             '<rect y="6" width="36" height="4" fill="#0e0e10"/>'
             '<rect y="20" width="36" height="4" fill="#0e0e10"/></g>')
    # dead tree silhouette
    p.append('<g fill="#101012">'
             '<rect x="760" y="700" width="14" height="160"/>'
             '<polyline points="767,720 730,660 712,610" stroke="#101012" stroke-width="9" fill="none"/>'
             '<polyline points="767,740 810,680 838,650" stroke="#101012" stroke-width="8" fill="none"/>'
             '<polyline points="767,710 780,640 776,600" stroke="#101012" stroke-width="7" fill="none"/></g>')
    p.append('</svg>')
    return '\n'.join(p)

write('road_bg', road_bg())
write('sidewalk_bg', sidewalk_bg())

print('DONE:', len(os.listdir(OUT)), 'SVGs')
