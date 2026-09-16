"""Build recording.json + narration.json with computed audio offsets.

The narration is anchored to specific steps. On-screen time is modelled from
the step list (waits divided by their speed ramp, pauses, typing, cursor moves,
zooms) so each line can be placed at the right offset instead of relying on
naive concatenation.
"""
import json

RAIL = 'nav[aria-label="Workflow stages"] a:has-text("%s")'
S, NARR = [], []

CURSOR_MOVE = 0.45      # average cursor travel before a click
CLICK_OVERHEAD = 0.15

def anchor(text):
    """Pin a narration line to the current point in the timeline."""
    NARR.append({"at": len(S), "text": text})

def step(**kw): S.append(kw)
def wait(ms, speed=None):
    d = {"action": "wait", "ms": ms}
    if speed: d["speed"] = speed
    step(**d)
def click(sel, after=1200, **kw): step(action="click", selector=sel, pauseAfter=after, **kw)
def type_(sel, text, delay=20, after=1200):
    step(action="type", selector=sel, text=text, delay=delay, pauseAfter=after)
def scroll(y, after=2500): step(action="scroll", y=y, pauseAfter=after)
def zoom(scale, selector=None, duration=800):
    d = {"action": "zoom", "scale": scale, "duration": duration}
    if selector: d["selector"] = selector
    step(**d)
def rail(stage, after=2600): click(RAIL % stage, after)

# ═══ 1 · Open on the product ══════════════════════════════════════════
anchor("Assalam-o-alaikum. Yeh hai SIGIL — aik AI brand identity studio. Yeh koi logo generator nahi hai. Yeh aik poora design process hai, jahan har faisla aap karte hain.")
wait(2800)
zoom(1.3, "main h1"); wait(5400)
anchor("Discovery se le kar final brand package tak — pooray das stages. AI kaam karta hai, lekin creative control aap ke paas rehta hai.")
wait(4200); zoom(1); wait(1600)

# ═══ 2 · Create the project ═══════════════════════════════════════════
anchor("Chaliye aik asli client ke saath shuru karte hain. Meeras Estates — Lahore ki aik property firm.")
click('button:has-text("New project") >> nth=0', 1500); wait(3400)
anchor("Pehla field: company ka naam. Bilkul wahi spelling likhein jo final logo pe aani hai.")
type_('input[placeholder="Nexora"]', "Meeras Estates", 95, 2600)
anchor("Doosra field: industry. Main likh raha hoon — verified-title residential plots.")
type_('input[placeholder="AI consulting for industrial operations"]',
      "Real estate — verified-title residential plots", 40, 2400)
anchor("Aur yahan company ki kahani. Do bhaiyon ne dou hazaar gyara mein yeh firm banai, jab un ki apni khandani zameen jaali kaghzaat pe chali gayi. Ab har plot pehle title verification se guzarta hai.")
type_('textarea',
      "Lahore-based property brokerage founded in 2011 by two brothers, after their family's ancestral farmland was lost to a forged transfer deed. Every plot is forensically title-verified before it is listed.",
      14, 4200)
click('button:has-text("Create and start discovery")', 1200); wait(4200)

# ═══ 3 · Discovery is an interview ════════════════════════════════════
anchor("Yahan koi lamba form nahi hai. AI aap se interview karta hai — bilkul jaise aik senior designer client se karta hai.")
zoom(1.22, "main h1"); wait(5200); zoom(1); wait(1400)

Q = [
 ("textarea", "COOs and plant directors at $50M–$500M manufacturers",
  "First-time plot buyers, and overseas Pakistanis purchasing remotely who cannot inspect the documents themselves.",
  "Audience kaun hai? Pehli baar plot khareedne wali families, aur overseas Pakistani jo khud kaghaz check nahi kar sakte."),
 ("textarea", "That these people are serious, precise, and already ahead",
  "Relief. That someone has finally checked the papers properly, and nobody can take this land away from them.",
  "Brand dekh kar kya mehsoos hona chahiye? Sukoon. Ke kisi ne aakhir-kaar papers theek se check kar liye."),
 ("input", "precise, confident, human, unflashy",
  "trustworthy, meticulous, rooted, protective, unflashy",
  "Personality ke paanch lafz — trustworthy, meticulous, rooted, protective, aur unflashy."),
 ("input", "Palantir, Scale AI, local consultancies",
  "Large property portals and local commission dealers",
  "Aur muqabla kis se hai — baray property portals aur local commission dealers."),
]
for tag, ph, val, line in Q:
    anchor(line)
    type_(f'{tag}[placeholder="{ph}"]', val, 15 if tag == "textarea" else 26, 900)
    click(f'section:has({tag}[placeholder="{ph}"]) button:has-text("Answer")', 2600)

anchor("Ab dekhiye kamaal. AI ne jawab parh kar khud naye sawal bana diye — logo kahan use hoga, signboards pe ya legal documents pe. Yeh fixed form nahi hai, yeh sochta hai.")
click('button:has-text("Continue the interview")', 600)
wait(34000, speed=7); wait(8000)

# ═══ 4 · Brand brief ══════════════════════════════════════════════════
anchor("Jab AI ke paas kaafi maloomat ho jaye, tab hum brand brief likhwate hain.")
scroll(-3000, 1600)   # the stage-header action is at the top of the page
click('button:has-text("Write the brief") >> nth=0', 1400); wait(3000)
click('button:has-text("Write the brand brief")', 700)
wait(45000, speed=7); wait(5600)
anchor("Yeh raha brand brief. Positioning, audience, personality — aur sab se important, Avoid section.")
scroll(680, 3800); scroll(820, 4000); scroll(1200, 3000)
anchor("Yahan AI ne khud likh diya ke kin cheezon se bachna hai — skyline, glass tower, ghar ka outline, chaabi. Yani real estate ke ghisay-pitay clichés.")
zoom(1.25, "h2:has-text('Avoid')", 800); wait(6400); zoom(1); wait(1400)
anchor("Aur har field editable hai. Yeh AI ka faisla nahi — yeh aap ka document hai.")
scroll(-3200, 4200)
anchor("Aur jab tak aap approve nahi karte, aage kuch bhi generate nahi hota. Yeh pehla human gate hai.")
click('button:has-text("Approve brief") >> nth=0', 1400); wait(4200)

# ═══ 5 · Creative territories ═════════════════════════════════════════
anchor("Ab AI aath creative territories banata hai. Yeh logo nahi hain — yeh alag alag ideas hain. Abhi tak koi artwork nahi bana.")
click('button:has-text("Develop")', 700)
wait(58000, speed=8); wait(6400)
anchor("Har territory ke saath strengths aur risks likhe hain. AI apni kamzoriyan khud bata deta hai.")
scroll(460, 4600); scroll(440, 4600)
anchor("Do approve, aur aik reject. Yeh rejection yaad rakhi jati hai, aage har generation us territory se bachegi.")
click("xpath=(//article)[1]//button[normalize-space()='Approve']", 2400)
click("xpath=(//article)[2]//button[normalize-space()='Approve']", 2600)
scroll(620, 2200)   # bring the second grid row up before clicking it
click("xpath=(//article)[3]//button[normalize-space()='Reject']", 4600)

# ═══ 6 · Exploration ══════════════════════════════════════════════════
anchor("Ab asli logo banenge. Har approved territory ke andar alag alag concepts — sirf rang badal kar nahi, poori construction alag.")
scroll(-3000, 1800)   # StageHeader is not sticky — bring it back on screen
click('button:has-text("Generate logos from")', 1600); wait(3400)
click('button:has-text("Generate concepts")', 1700)
step(action="fill", selector="[role=dialog] input[type=number] >> nth=0", text="3", pauseAfter=3000)
anchor("Aik click, aur poora batch chal parta hai. Aap pause kar sakte hain, cancel kar sakte hain, ya sirf failed wale dobara chala sakte hain.")
click('[role=dialog] button:has-text("Generate")', 900)
wait(32000, speed=6); wait(5600)
wait(55000, speed=6); wait(6800)
anchor("Aur yeh raha nateeja. Har mark ka apna naam hai, apna idea hai.")
scroll(540, 5200)

# ═══ 7 · Curation ═════════════════════════════════════════════════════
anchor("Yahan se insaan ka kaam shuru hota hai. Favourite, shortlist, reject. AI faisla nahi karta — aap karte hain.")
click("xpath=(//article)[1]//button[@aria-label='Favourite']", 1800)
click("xpath=(//article)[2]//button[@aria-label='Shortlist']", 1800)
click("xpath=(//article)[3]//button[@aria-label='Shortlist']", 4200)

# ═══ 8 · Critique ═════════════════════════════════════════════════════
anchor("Aur agar raye chahiye, to AI critic asli artwork dekh kar batata hai — chhote size pe kya hoga, embroidery mein kya hoga. Yeh tareef nahi karta, masle batata hai.")
click("xpath=(//article)[2]//img", 2200); wait(3400)
click('[role=tab]:has-text("AI critique")', 1700)
click('button:has-text("Run design critique")', 900)
wait(42000, speed=7); wait(6400)
scroll(480, 5600); scroll(-480, 1600)
anchor("Aur yeh asli test hai — bina rang ke mark kaam karta hai ya nahi.")
click('button:text-is("Pure B/W")', 6000)
click('[role=dialog] button[aria-label="Close"]', 2600)

# ═══ 9 · Refinement ═══════════════════════════════════════════════════
anchor("Ab feedback dijiye, apne alfaaz mein. Main keh raha hoon — symbol theek hai, lekin wordmark halka lag raha hai.")
rail("Refinement", 3400)
click('button:has-text("Refine with feedback") >> nth=0', 1600); wait(2600)
type_('[role=dialog] textarea >> nth=0',
      "Symbol is right — keep the seal exactly as it is. The wordmark is too light; try a heavier, more official typeface.",
      15, 2200)
step(action="fill", selector="[role=dialog] input[type=number] >> nth=0", text="2", pauseAfter=2000)
anchor("AI is ko design instructions mein badal deta hai — kya rakhna hai, kya badalna hai, kya hatana hai. Aur yeh aap confirm karte hain, generate hone se pehle.")
click('button:has-text("Interpret feedback")', 900)
wait(34000, speed=7); wait(6400)
scroll(420, 5600); scroll(-420, 1600)
click('[role=dialog] button:has-text("Generate")', 1200)
wait(45000, speed=6); wait(6400)
anchor("Har variation apne parent concept se juda rehta hai, is liye design history kabhi tootti nahi.")
scroll(520, 5000)

# ═══ 10 · Finalists ═══════════════════════════════════════════════════
anchor("Sab se strong concept finalist banta hai — aur phir us ka poora lockup family: symbol, wordmark, horizontal, monochrome, aur reversed.")
click('button:has-text("Promote to finalist") >> nth=0', 2800)
rail("Finalists", 3600)
click('button:has-text("Build lockup family") >> nth=0', 900)
wait(125000, speed=9); wait(6800)
scroll(560, 5800)

# ═══ 11 · Client review + approvals ═══════════════════════════════════
anchor("Client ko dikhane ke liye bilkul alag presentation mode hai. Aur teen alag approvals — aap ki, client ki, aur final.")
scroll(-3000, 1800)   # back to the top for the non-sticky StageHeader action
click('button:has-text("Approve for client") >> nth=0', 1600); wait(4000)
click('button:has-text("Publish presentation") >> nth=0', 1600); wait(3600)
zoom(1.2, 'code', 800); wait(5000); zoom(1); wait(1400)
scroll(3000, 4000)
click('button[aria-label^="Record client approval of"] >> nth=0', 2400); wait(4000)
anchor("Teenon approvals alag alag record hoti hain. Project sirf tab finalize hota hai jab final approval di jaye.")
zoom(1.18, 'h2:has-text("Approval chain")', 800); wait(5600); zoom(1); wait(1400)
scroll(3000, 2000)
click('button:has-text("Approve as final")', 2800)
scroll(3000, 1600)
click('button:has-text("logo system")', 900)
wait(150000, speed=10); wait(6800)

# ═══ 12 · Delivery + brand kit ════════════════════════════════════════
anchor("Aur aakhir mein brand kit — colour palette, typography, clear space, aur minimum size.")
rail("Delivery", 3600)
scroll(3000, 4000)
click('button:has-text("Generate brand kit")', 900)
wait(55000, speed=7); wait(6000)
scroll(620, 5200); scroll(620, 5200)
anchor("Aur SIGIL saaf saaf batata hai: yeh files AI raster hain, production vector nahi. Jhoot nahi bolta.")
scroll(900, 5600)

# ═══ 13 · Finale ══════════════════════════════════════════════════════
anchor("Aur yeh hai woh jo client dekhta hai. Saaf, simple — na prompts, na rejected concepts, na aap ke private notes. Sirf kaam.")
click('button[aria-label="Open client presentation"]', 2400); wait(5400)
scroll(600, 5200); scroll(700, 5200); scroll(700, 4800)
scroll(-2000, 2400)
anchor("Yeh tha SIGIL. Discovery se delivery tak — AI ki raftaar, aur insaan ka faisla. Dekhne ka shukriya.")
zoom(1.15, "header h1", 900); wait(6000); zoom(1); wait(4000)

# ── on-screen time model ─────────────────────────────────────────────
def screen_seconds(steps):
    t, out = 0.0, []
    for s in steps:
        out.append(t)
        a = s["action"]
        if a == "wait":
            t += s.get("ms", 1000) / 1000 / s.get("speed", 1)
            continue
        if a == "type":
            t += CURSOR_MOVE + len(s["text"]) * s.get("delay", 80) / 1000
        elif a == "click":
            t += CURSOR_MOVE + CLICK_OVERHEAD
        elif a == "fill":
            t += CURSOR_MOVE
        elif a == "scroll":
            t += 0.65
        elif a == "zoom":
            t += s.get("duration", 600) / 1000
        t += s.get("pauseAfter", 500) / 1000
    out.append(t)
    return out

offsets = screen_seconds(S)

# ── auto-pacing ──────────────────────────────────────────────────────
# Where a narration clip is longer than the scene it belongs to, widen the
# last pause of that scene until the line fits. Without this the next line
# starts while the previous one is still talking.
import os, subprocess

def clip_seconds(path):
    if not os.path.exists(path): return None
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                          "-of", "csv=p=0", path], capture_output=True, text=True).stdout.strip()
    return float(out) if out else None

HEADROOM = 0.7          # breathing room between one line ending and the next
widened = 0
for _pass in range(6):
    offsets = screen_seconds(S)
    changed = False
    for i, n in enumerate(NARR):
        dur = clip_seconds(f"audio/line{i:02d}.wav")
        if dur is None: continue
        start = offsets[n["at"]]
        end_step = NARR[i + 1]["at"] if i + 1 < len(NARR) else len(S)
        gap = offsets[end_step] - start
        deficit = dur + HEADROOM - gap
        if deficit > 0.05:
            target = S[end_step - 1]
            if target["action"] == "wait":
                # testreel ignores pauseAfter on a wait, so widen the wait
                # itself — scaled by its speed ramp to get real screen time.
                target["ms"] = int(target.get("ms", 1000) + deficit * 1000 * target.get("speed", 1))
            else:
                target["pauseAfter"] = int(target.get("pauseAfter", 500) + deficit * 1000)
            changed = True
            widened += 1
    if not changed:
        break

offsets = screen_seconds(S)
print(f"auto-pacing: {widened} scene extensions applied")

definition = {
  "url": "https://sigil.12nexusbpo.com",
  "viewport": {"width": 1440, "height": 900},
  "outputSize": {"width": 1920, "height": 1080},
  "outputFormat": "mp4",
  "colorScheme": "dark",
  "waitForSelector": "text=Projects",
  "cursor": {"style": "pointer", "size": 44, "rippleSize": 110},
  "chrome": {"enabled": True, "url": "sigil.12nexusbpo.com", "titleBarColor": "#1b1b22"},
  "background": {"enabled": True, "gradient": {"from": "#2b2119", "to": "#0a0a0e"},
                 "padding": 56, "borderRadius": 14},
  "steps": S,
}
json.dump(definition, open("recording.json", "w"), indent=2, ensure_ascii=False)

manifest = [{"out": f"line{i:02d}.wav", "voice": "Charon", "text": n["text"],
             "at": n["at"],                       # step index the line starts on
             "offset": round(offsets[n["at"]], 2)}
            for i, n in enumerate(NARR)]
json.dump(manifest, open("narration.json", "w"), indent=2, ensure_ascii=False)

print(f"steps      : {len(S)}")
print(f"narration  : {len(NARR)} lines")
print(f"video est. : {offsets[-1]/60:.1f} min")
print("\nfirst offsets:", [m["offset"] for m in manifest[:6]])
print("last offset :", manifest[-1]["offset"])
