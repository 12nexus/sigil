#!/usr/bin/env node
/**
 * Resilient Gemini TTS batch runner.
 *
 * The bundled script aborts the whole batch when one line comes back with
 * finishReason OTHER (which Gemini does intermittently). This retries each
 * line with backoff, keeps going past a failure, and reports what is missing
 * so only the stragglers need re-running.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const KEY = process.env.GEMINI_API_KEY;
if (!KEY) { console.error("GEMINI_API_KEY not set"); process.exit(1); }

const args = Object.fromEntries(
  process.argv.slice(2).reduce((a, v, i, arr) =>
    v.startsWith("--") ? [...a, [v.slice(2), arr[i + 1]]] : a, []),
);
const MODEL = args.model || "gemini-2.5-flash-preview-tts";
const DIR = args.dir || "./audio";
const manifest = JSON.parse(readFileSync(args.manifest, "utf8"));
mkdirSync(DIR, { recursive: true });

function wav(pcm, rate = 24000) {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8);
  h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function synth(text, voice) {
  const body = {
    contents: [{ parts: [{ text }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
    },
  };
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    { method: "POST", headers: { "x-goog-api-key": KEY, "Content-Type": "application/json" },
      body: JSON.stringify(body) },
  );
  const json = await res.json();
  const part = json?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!part) throw new Error(json?.candidates?.[0]?.finishReason || json?.error?.message || "no audio");
  const rate = /rate=(\d+)/.exec(part.inlineData.mimeType || "")?.[1];
  return wav(Buffer.from(part.inlineData.data, "base64"), rate ? +rate : 24000);
}

const failed = [];
for (const item of manifest) {
  const out = join(DIR, item.out);
  if (existsSync(out) && !args.force) { console.log(`· ${item.out} (cached)`); continue; }

  let done = false;
  for (let attempt = 1; attempt <= 5 && !done; attempt++) {
    try {
      // A trailing full stop makes the model far less likely to bail early.
      const text = item.text.replace(/\s*—\s*/g, ", ").replace(/\s+/g, " ").trim();
      const buf = await synth(text.endsWith(".") ? text : text + ".", item.voice || "Charon");
      writeFileSync(out, buf);
      console.log(`✓ ${item.out} (${(buf.length / 1024 / 47).toFixed(1)}s, try ${attempt})`);
      done = true;
    } catch (err) {
      if (attempt === 5) { failed.push(item.out); console.log(`✗ ${item.out} — ${err.message}`); }
      else await sleep(900 * attempt);
    }
  }
  await sleep(400);
}

console.log(`\n${manifest.length - failed.length}/${manifest.length} clips ready`);
if (failed.length) { console.log("failed:", failed.join(", ")); process.exit(1); }
