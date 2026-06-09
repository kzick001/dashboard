#!/usr/bin/env python3
"""Synthesize the 13 SFX as 16-bit mono WAVs. Stdlib only, deterministic."""
import wave, struct, math, random, os

SR = 22050
OUT = 'assets/audio'
os.makedirs(OUT, exist_ok=True)
random.seed(42)

def write_wav(name, samples):
    with wave.open(f'{OUT}/{name}.wav', 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        frames = b''.join(struct.pack('<h', int(max(-1.0, min(1.0, s)) * 32000)) for s in samples)
        w.writeframes(frames)
    print(f'  {name}.wav ({len(samples)/SR:.2f}s)')

def env(i, n, attack_s=0.003, curve=6.0):
    a = min(1.0, (i / SR) / attack_s) if attack_s > 0 else 1.0
    return a * math.exp(-curve * i / n)

def gunshot(dur, lp=0.45, curve=9.0, thump=0.0, thump_f=90, gain=0.9):
    """Lowpassed noise burst + optional low sine thump."""
    n = int(SR * dur)
    out, prev = [], 0.0
    for i in range(n):
        x = random.uniform(-1, 1)
        prev = prev + lp * (x - prev)
        s = prev * env(i, n, 0.002, curve) * gain
        if thump:
            s += thump * math.sin(2 * math.pi * thump_f * i / SR) * math.exp(-12 * i / n)
        out.append(s)
    return out

def sweep(dur, f0, f1, wave_fn='sine', curve=4.0, gain=0.7, trem_hz=0):
    n = int(SR * dur)
    out, phase = [], 0.0
    for i in range(n):
        t = i / n
        f = f0 + (f1 - f0) * t
        phase += 2 * math.pi * f / SR
        if wave_fn == 'saw':
            v = 2 * ((phase / (2 * math.pi)) % 1.0) - 1
        else:
            v = math.sin(phase)
        a = env(i, n, 0.004, curve)
        if trem_hz:
            a *= 0.6 + 0.4 * math.sin(2 * math.pi * trem_hz * i / SR)
        out.append(v * a * gain)
    return out

def mix(*layers):
    n = max(len(L) for L in layers)
    out = [0.0] * n
    for L in layers:
        for i, s in enumerate(L):
            out[i] += s
    return out

def cat(*parts):
    out = []
    for p in parts:
        out.extend(p)
    return out

# ---- Gunfire family ----
write_wav('pistol',  gunshot(0.12, lp=0.55, curve=10))
write_wav('smg',     gunshot(0.07, lp=0.60, curve=13, gain=0.8))
write_wav('rifle',   gunshot(0.15, lp=0.45, curve=8,  thump=0.25, thump_f=120))
write_wav('assault', gunshot(0.12, lp=0.50, curve=9,  thump=0.18, thump_f=110))
write_wav('shotgun', gunshot(0.30, lp=0.22, curve=6,  thump=0.55, thump_f=72))
write_wav('lmg',     gunshot(0.18, lp=0.30, curve=7,  thump=0.40, thump_f=85))

# ---- Energy weapons ----
write_wav('eradicator', mix(sweep(0.25, 950, 180, 'saw', curve=6, gain=0.5),
                            gunshot(0.15, lp=0.5, curve=10, gain=0.4)))
write_wav('cryo', cat(sweep(0.14, 300, 1200, 'sine', curve=2, gain=0.55, trem_hz=22),
                      sweep(0.18, 1200, 380, 'sine', curve=5, gain=0.55, trem_hz=22)))

# ---- World SFX ----
write_wav('explosion', mix(gunshot(0.80, lp=0.08, curve=4, gain=1.0),
                           sweep(0.70, 60, 38, 'sine', curve=4, gain=0.7)))
write_wav('acid', [s * (0.5 + 0.5 * math.sin(2 * math.pi * 28 * i / SR))
                   for i, s in enumerate(gunshot(0.25, lp=0.10, curve=6, gain=0.9))])
write_wav('crate_spawn', mix(sweep(0.16, 110, 70, 'sine', curve=7, gain=0.85),
                             gunshot(0.03, lp=0.6, curve=14, gain=0.5)))
write_wav('crate_pickup', cat(sweep(0.09, 660, 660, 'sine', curve=4, gain=0.5),
                              sweep(0.14, 990, 990, 'sine', curve=5, gain=0.5)))
write_wav('enemy_die', mix(gunshot(0.14, lp=0.10, curve=8, gain=0.8),
                           sweep(0.12, 110, 55, 'sine', curve=8, gain=0.5)))

print('DONE:', len(os.listdir(OUT)), 'WAVs')
