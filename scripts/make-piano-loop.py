"""Original soft classical piano loop for GEO QUEST. CC0 — Aliia / GEO QUEST."""

from __future__ import annotations

import math
import struct
import wave
from pathlib import Path

SR = 22050
BPM = 72
BEAT = 60.0 / BPM
BARS = 8
BEATS = BARS * 4
DURATION = BEATS * BEAT
FADE = 0.85


def midi_hz(m: float) -> float:
    return 440.0 * (2 ** ((m - 69) / 12))


def piano_note(freq: float, dur: float, vel: float) -> list[float]:
    n = int(dur * SR)
    out = [0.0] * n
    if n <= 0:
        return out
    attack = max(1, int(0.006 * SR))
    for i in range(n):
        t = i / SR
        env_a = min(1.0, i / attack)
        s = 0.0
        for h, w in enumerate((1.0, 0.55, 0.28, 0.14, 0.08, 0.04, 0.02), start=1):
            fn = freq * h * math.sqrt(1 + 0.00016 * h * h)
            decay = math.exp(-t * (1.55 + 0.55 * h))
            s += w * math.sin(2 * math.pi * fn * t) * decay
        felt = math.sin(2 * math.pi * freq * 0.5 * t) * math.exp(-t * 18) * 0.04
        out[i] = vel * env_a * (s + felt)
    return out


def mix_at(buf: list[float], start: float, note: list[float]) -> None:
    i0 = int(start * SR)
    for i, v in enumerate(note):
        j = i0 + i
        if 0 <= j < len(buf):
            buf[j] += v


def build() -> list[float]:
    n = int((DURATION + 1.2) * SR)
    buf = [0.0] * n

    # Original 8-bar phrase in C: C – Am – F – G (two bars each), nocturne-like.
    left = [
        # C
        (48, 0, 2.0, 0.22),
        (52, 0.5, 1.5, 0.12),
        (55, 1.0, 2.5, 0.16),
        (60, 2.0, 2.0, 0.18),
        (52, 3.0, 1.2, 0.1),
        (48, 4.0, 2.0, 0.2),
        (55, 5.0, 2.2, 0.14),
        (64, 6.0, 2.0, 0.12),
        (60, 7.0, 1.4, 0.1),
        # Am
        (45, 8.0, 2.0, 0.21),
        (48, 8.5, 1.5, 0.11),
        (52, 9.0, 2.5, 0.15),
        (57, 10.0, 2.0, 0.17),
        (48, 11.0, 1.2, 0.1),
        (45, 12.0, 2.0, 0.2),
        (52, 13.0, 2.2, 0.14),
        (60, 14.0, 2.0, 0.12),
        (57, 15.0, 1.4, 0.1),
        # F
        (41, 16.0, 2.0, 0.21),
        (45, 16.5, 1.5, 0.11),
        (48, 17.0, 2.5, 0.15),
        (53, 18.0, 2.0, 0.17),
        (45, 19.0, 1.2, 0.1),
        (41, 20.0, 2.0, 0.2),
        (48, 21.0, 2.2, 0.14),
        (57, 22.0, 2.0, 0.12),
        (53, 23.0, 1.4, 0.1),
        # G
        (43, 24.0, 2.0, 0.21),
        (47, 24.5, 1.5, 0.11),
        (50, 25.0, 2.5, 0.15),
        (55, 26.0, 2.0, 0.17),
        (47, 27.0, 1.2, 0.1),
        (43, 28.0, 2.0, 0.2),
        (50, 29.0, 1.8, 0.14),
        (59, 30.0, 1.6, 0.13),
        (55, 31.0, 1.2, 0.12),
        (52, 31.5, 1.0, 0.09),
    ]
    right = [
        (76, 1.0, 1.6, 0.13),
        (74, 2.5, 1.2, 0.11),
        (72, 4.0, 2.4, 0.12),
        (79, 7.0, 1.5, 0.1),
        (76, 9.0, 1.8, 0.12),
        (72, 11.0, 1.4, 0.1),
        (74, 12.5, 2.0, 0.11),
        (69, 15.0, 1.6, 0.1),
        (77, 17.0, 1.8, 0.12),
        (76, 19.0, 1.4, 0.1),
        (72, 20.5, 2.2, 0.11),
        (74, 23.0, 1.4, 0.1),
        (71, 25.0, 1.6, 0.11),
        (74, 26.5, 1.4, 0.1),
        (76, 28.0, 1.8, 0.12),
        (72, 30.0, 2.4, 0.13),
    ]

    for midi, beat, length, vel in (*left, *right):
        mix_at(buf, beat * BEAT, piano_note(midi_hz(midi), length * BEAT + 0.45, vel))

    # Soft room (two comb delays)
    wet = buf[:]
    for delay_s, amt in ((0.041, 0.22), (0.093, 0.14)):
        d = int(delay_s * SR)
        for i in range(d, len(wet)):
            wet[i] += buf[i - d] * amt
    buf = wet

    usable = int(DURATION * SR)
    fade_n = int(FADE * SR)
    loop = buf[:usable]
    for i in range(fade_n):
        t = i / fade_n
        loop[i] = loop[i] * t + loop[usable - fade_n + i] * (1 - t)
    loop = loop[: usable - fade_n]

    peak = max(1e-9, max(abs(x) for x in loop))
    gain = 0.32 / peak
    return [max(-1.0, min(1.0, x * gain)) for x in loop]


def write_wav(path: Path, samples: list[float]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        frames = b"".join(struct.pack("<h", int(x * 32767)) for x in samples)
        w.writeframes(frames)


if __name__ == "__main__":
    out = Path(__file__).resolve().parents[1] / "public" / "audio" / "piano-nocturne-loop.wav"
    write_wav(out, build())
    print(out, out.stat().st_size)
