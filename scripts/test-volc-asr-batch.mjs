/**
 * T1.2 火山录音文件识别大模型-极速版 验证脚本
 *
 * API: POST https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash
 * 同步返回识别结果，支持 base64 inline 音频
 *
 * 用法: node scripts/test-volc-asr-batch.mjs [audio_file]
 * 无参数则读 scripts/sample.wav
 */

import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';

const APP_KEY = "1725839450";
const ACCESS_KEY = "MGSzF1O1KTrq9FekvqW-rjtMatg2ckuH";
const ENDPOINT = "https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash";

// 极速版可能的 resource_id，按可能性排序
const RESOURCE_IDS = [
  "volc.bigasr.auc_turbo",   // 大模型极速版
  "volc.seedasr.auc",         // Seed ASR 版本
  "volc.bigasr.auc",          // 大模型标准版
];

const audioFile = process.argv[2] || 'scripts/sample.wav';
const wav = readFileSync(audioFile);
const base64Audio = wav.toString('base64');
console.log(`Audio: ${audioFile} (${wav.length} bytes → base64 ${base64Audio.length} chars)`);

async function tryResourceId(resourceId) {
  const reqId = randomUUID();
  console.log(`\n▶ resource_id: ${resourceId}`);

  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-App-Key': APP_KEY,
        'X-Api-Access-Key': ACCESS_KEY,
        'X-Api-Resource-Id': resourceId,
        'X-Api-Request-Id': reqId,
        'X-Api-Sequence': '-1',
      },
      body: JSON.stringify({
        user: { uid: `test-${reqId.slice(0, 8)}` },
        audio: { data: base64Audio },
        request: { model_name: 'bigmodel' },
      }),
      signal: AbortSignal.timeout(20000),
    });
  } catch (e) {
    console.error('  Fetch error:', e.message);
    return null;
  }

  const statusCode = res.headers.get('X-Api-Status-Code');
  const body = await res.text();
  console.log(`  HTTP ${res.status} | X-Api-Status-Code: ${statusCode ?? '(none)'}`);

  let json;
  try { json = JSON.parse(body); } catch { console.log('  Raw:', body.slice(0, 300)); return null; }

  if (json.result?.text) {
    return { resourceId, text: json.result.text, duration: json.audio_info?.duration };
  }
  console.log('  Response:', JSON.stringify(json).slice(0, 300));
  return null;
}

let success = null;
for (const rid of RESOURCE_IDS) {
  success = await tryResourceId(rid);
  if (success) break;
}

console.log('');
if (success) {
  console.log('✅ T1.2 PASS');
  console.log(`   resource_id:  ${success.resourceId}`);
  console.log(`   text:         "${success.text}"`);
  if (success.duration) console.log(`   duration:     ${success.duration}ms`);
  console.log('');
  console.log('📝 请把这行加到 .env.local：');
  console.log(`   VOLC_ASR_RESOURCE_ID=${success.resourceId}`);
} else {
  console.log('❌ T1.2 FAIL');
  console.log('   所有 resource_id 均失败。');
  console.log('   检查：火山控制台 → 我的服务 → 确认 AppID 1725839450 已绑定录音文件识别大模型');
  process.exit(1);
}
