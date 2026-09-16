#!/usr/bin/env python3
"""Lay the narration onto the recording at per-scene offsets.

Each clip is delayed to the scene it belongs to and mixed into one track,
rather than concatenated blindly, so narration stays with the picture.
"""
import json, subprocess, sys, glob, os

def probe(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                          "-of", "csv=p=0", path], capture_output=True, text=True).stdout.strip()
    return float(out)

video = sys.argv[1] if len(sys.argv) > 1 else sorted(glob.glob("testreel-output/recording-*.mp4"))[-1]
out   = sys.argv[2] if len(sys.argv) > 2 else "testreel-output/sigil-walkthrough.mp4"
manifest = json.load(open("narration.json"))

# The offsets in narration.json were computed from the PLANNED step timings.
# The recording's real durations differ (network, model latency), so recompute
# each anchor's position from testreel's own log of what actually happened.
import re
LOG = "/private/tmp/claude-501/-Users-shozibsayyed-Projects-12NexusBPO/8ab8c48f-96fe-44ff-adff-9094e8c7367a/scratchpad/rec5.log"
definition = json.load(open("recording.json"))
rows = re.findall(r"\[(\d+)/\d+\]\s+\S+.*?\(([\d.]+)s\)", open(LOG).read())

vdur = probe(video)
raw = probe(sorted(glob.glob("testreel-output/recording-*.mp4"))[0])
real_total = sum(float(d) for _, d in rows)
lead = max(0.0, raw - real_total) # testreel starts capturing before step 1

screen_at, t = {}, lead
for idx, dur in rows:
    i = int(idx) - 1
    screen_at[i] = t
    t += float(dur) / definition["steps"][i].get("speed", 1)

for m in manifest:
    anchor = m.get("at")
    if anchor is None:
        continue
    # anchors reference the step index the line should start on
    m["offset"] = round(screen_at.get(anchor, m["offset"]), 2)

print(f"video    : {video}  ({vdur/60:.2f} min)")
print(f"offsets  : recomputed from the actual recording")

clips = [(m, f"audio/{m['out']}") for m in manifest if os.path.exists(f"audio/{m['out']}")]
print(f"narration: {len(clips)} clips")

# Drop anything that would start after the picture ends.
clips = [(m, f) for m, f in clips if m["offset"] < vdur - 0.5]

args = ["ffmpeg", "-y", "-i", video]
for _, f in clips:
    args += ["-i", f]

# A silent bed fixes the mix length to the video, so -shortest never clips
# the tail and the track never ends early on a quiet scene.
filters = [f"anullsrc=r=24000:cl=mono:d={vdur:.3f}[bed]"]
labels = ["[bed]"]
for i, (m, _) in enumerate(clips, start=1):
    delay = int(m["offset"] * 1000)
    filters.append(f"[{i}:a]aresample=24000,adelay={delay}|{delay},volume=1.6[a{i}]")
    labels.append(f"[a{i}]")

filters.append(
    f"{''.join(labels)}amix=inputs={len(labels)}:normalize=0:dropout_transition=0"
    f",loudnorm=I=-16:TP=-1.5:LRA=11,alimiter=limit=0.95[mix]"
)

args += [
    "-filter_complex", ";".join(filters),
    "-map", "0:v", "-map", "[mix]",
    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
    "-movflags", "+faststart", "-shortest", out,
]

print("muxing…")
r = subprocess.run(args, capture_output=True, text=True)
if r.returncode != 0:
    print(r.stderr[-2500:]); sys.exit(1)

print(f"✓ {out}  ({probe(out)/60:.2f} min, {os.path.getsize(out)/1e6:.1f} MB)")
