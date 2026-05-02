/**
 * 预生成访谈用静态 MP3 文件（开场白 + 10 题题库）
 *
 * 用法：
 *   node scripts/generate-tts-cache.mjs
 *
 * 需要 .env.local 配好 VOLC_TTS_APP_KEY / VOLC_TTS_ACCESS_KEY / VOLC_TTS_SPEAKER
 *
 * 输出到 public/audio/{greeting,q1,q2,...,q10}.mp3
 *
 * 题库变更后需重跑此脚本（题库源在 lib/interview-questions.ts）
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { randomUUID } from "crypto";
import { readFileSync } from "fs";
import path from "path";

// 简易 .env.local 解析（不引第三方包）
function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) {
    console.warn("⚠ .env.local not found, falling back to process.env");
    return;
  }
  const text = readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadEnv();

const APP_KEY = process.env.VOLC_TTS_APP_KEY;
const ACCESS_KEY = process.env.VOLC_TTS_ACCESS_KEY;
const SPEAKER = process.env.VOLC_TTS_SPEAKER ?? "zh_female_vv_uranus_bigtts";

if (!APP_KEY || !ACCESS_KEY) {
  console.error("✗ 缺少 VOLC_TTS_APP_KEY / VOLC_TTS_ACCESS_KEY，请检查 .env.local");
  process.exit(1);
}

// 题库数据（与 lib/interview-questions.ts 保持一致；变更后两边同步）
const GREETING =
  "你好，我是你的 AI 职业顾问，接下来我会问你两个问题，帮你完善这份定位报告。";

const BANK = [
  { id: "q1", text: "你是怎么确定自己想做这个方向的？有没有某个具体的时刻或者经历，让你觉得'就是这个'？" },
  { id: "q2", text: "在找工作这件事上，你给自己划了哪些绝对不能妥协的底线？" },
  { id: "q3", text: "如果朋友来问你怎么判断一份工作值不值得去，你会怎么跟他说？" },
  { id: "q4", text: "你身边有没有谁的职业路径让你印象很深——不管好坏？他们的经历对你有没有影响？" },
  { id: "q5", text: "你有没有经历过一件事，一开始很难坚持，但后来又想清楚撑过去了？当时是什么让你转变的？" },
  { id: "q6", text: "工作对你来说意味着什么？可以随便聊，不用给标准答案。" },
  { id: "q7", text: "你能回忆一下，哪段时间做某件事特别有劲儿、停不下来？那是什么？" },
  { id: "q8", text: "找工作这段时间，你有没有哪个瞬间特别迷茫或者不确定？当时是什么感觉？" },
  { id: "q9", text: "如果接下来找工作不太顺，你一般怎么让自己缓过来？有没有你自己摸索出来的方法？" },
  { id: "q10", text: "你觉得自己在找工作这件事上，最大的优势是什么？最大的不确定又是什么？" },
];

const OUT_DIR = path.resolve(process.cwd(), "public/audio");
mkdirSync(OUT_DIR, { recursive: true });

async function tts(text) {
  const res = await fetch("https://openspeech.bytedance.com/api/v1/tts", {
    method: "POST",
    headers: {
      "X-Api-App-Key": APP_KEY,
      "X-Api-Access-Key": ACCESS_KEY,
      "X-Api-Resource-Id": "volc.service_type.10029",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      app: { appid: APP_KEY, cluster: "volcano_bigtts" },
      user: { uid: "build-time" },
      audio: { voice_type: SPEAKER, encoding: "mp3", speed_ratio: 1.0 },
      request: { reqid: randomUUID(), text, operation: "query" },
    }),
  });
  const d = await res.json();
  if (!d.data) {
    throw new Error(`TTS 失败 (code=${d.code} msg=${d.message ?? "?"})`);
  }
  return Buffer.from(d.data, "base64");
}

async function generate(name, text) {
  const out = path.join(OUT_DIR, `${name}.mp3`);
  process.stdout.write(`→ ${name}.mp3 ... `);
  const buf = await tts(text);
  writeFileSync(out, buf);
  console.log(`${(buf.length / 1024).toFixed(1)} KB`);
}

async function main() {
  console.log("生成访谈静态 MP3 缓存");
  console.log("speaker:", SPEAKER);
  console.log("输出目录:", OUT_DIR);
  console.log("");

  await generate("greeting", GREETING);
  for (const q of BANK) {
    await generate(q.id, q.text);
  }

  console.log("");
  console.log(`✓ 已生成 ${BANK.length + 1} 个 MP3`);
}

main().catch((e) => {
  console.error("\n✗ 生成失败:", e.message ?? e);
  process.exit(1);
});
