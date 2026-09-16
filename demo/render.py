#!/usr/bin/env python3
"""Render the finished walkthrough from testreel's raw capture.

testreel's own post-processing builds the cursor's visibility as one deeply
nested if() chain — with 108 cursor events across a 19-minute recording it
exceeds ffmpeg's expression limit and the render dies after the capture
succeeds. The capture itself is fine, so this does the compositing instead:

  · a piecewise setpts ramp that speeds up only the generation waits
  · the window chrome and gradient background, pre-rendered as one PNG
  · scale and pad to 1920x1080

Step wall-clock times come from testreel's own verbose log, so the ramp lines
up with what was actually recorded rather than with what was planned.
"""
import json, re, subprocess, sys, glob, os

LOG   = sys.argv[1] if len(sys.argv) > 1 else "/private/tmp/claude-501/-Users-shozibsayyed-Projects-12NexusBPO/8ab8c48f-96fe-44ff-adff-9094e8c7367a/scratchpad/rec5.log"
RAW   = sys.argv[2] if len(sys.argv) > 2 else sorted(glob.glob("testreel-output/recording-*.mp4"))[-1]
OUT   = sys.argv[3] if len(sys.argv) > 3 else "testreel-output/walkthrough-silent.mp4"

definition = json.load(open("recording.json"))
steps = definition["steps"]

rows = re.findall(r"\[(\d+)/\d+\]\s+\S+.*?\(([\d.]+)s\)", open(LOG).read())
if len(rows) != len(steps):
    print(f"! parsed {len(rows)} step timings for {len(steps)} steps")

# Real elapsed start/end for each step, paired with the speed it should play at.
segments, t = [], 0.0
for idx, dur in rows:
    d = float(dur)
    speed = steps[int(idx) - 1].get("speed", 1) if int(idx) <= len(steps) else 1
    segments.append((t, t + d, float(speed)))
    t += d
real_end = t

probe = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                        "-of", "csv=p=0", RAW], capture_output=True, text=True).stdout.strip()
raw_dur = float(probe)

# testreel starts capturing slightly before step 1; shift so the ramp lines up.
offset = max(0.0, raw_dur - real_end)
segments = [(a + offset, b + offset, s) for a, b, s in segments]
if offset > 0.05:
    segments.insert(0, (0.0, offset, 1.0))

# A single nested if() chain over 138 segments blows ffmpeg's expression
# limit — the same wall testreel hit. Merge neighbouring segments that share a
# speed, then build a flat trim/setpts/concat graph instead: no nesting at all.
runs = []
for a, b, sp in segments:
    if runs and abs(runs[-1][2] - sp) < 1e-9 and abs(runs[-1][1] - a) < 1e-6:
        runs[-1][1] = b
    else:
        runs.append([a, b, sp])

out_t = sum((b - a) / sp for a, b, sp in runs)
print(f"raw            : {raw_dur/60:.2f} min")
print(f"after ramp     : {out_t/60:.2f} min  ({len(runs)} runs, was {len(segments)} segments)")

VID_W, VID_H, VID_X, VID_Y = 1472, 920, 224, 80

parts, labels = [], []
for i, (a, b, sp) in enumerate(runs):
    parts.append(
        f"[0:v]trim=start={a:.3f}:end={b:.3f},setpts=(PTS-STARTPTS)/{sp:.4f}[t{i}]"
    )
    labels.append(f"[t{i}]")

filt = ";".join(parts) + ";"
filt += "".join(labels) + f"concat=n={len(runs)}:v=1:a=0[cat];"
filt += (
    f"[cat]fps=30,scale={VID_W}:{VID_H}:flags=lanczos[v];"
    f"[1:v][v]overlay={VID_X}:{VID_Y}:format=auto,format=yuv420p[out]"
)
open("testreel-output/render-filter.txt", "w").write(filt)
print(f"filter graph   : {len(filt)/1024:.1f} KB")

cmd = ["ffmpeg", "-y", "-i", RAW, "-i", "testreel-output/chrome.png",
       "-filter_complex_script", "testreel-output/render-filter.txt",
       "-map", "[out]", "-an",
       "-c:v", "libx264", "-preset", "medium", "-crf", "20",
       "-pix_fmt", "yuv420p", "-movflags", "+faststart", OUT]

print("rendering…")
r = subprocess.run(cmd, capture_output=True, text=True)
if r.returncode != 0:
    print(r.stderr[-2500:]); sys.exit(1)
print(f"✓ {OUT} ({os.path.getsize(OUT)/1e6:.1f} MB)")
