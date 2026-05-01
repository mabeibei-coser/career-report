/**
 * T1.2 Volcano SAUC 流式 ASR 协议验证脚本
 *
 * 用法: node scripts/test-volc-sauc.mjs [pcm_or_wav_file]
 * 无参数则读 scripts/sample.wav
 *
 * 二进制帧协议（4-byte header + payload）：
 *   byte[0]: (protocolVersion=1) << 4 | (headerSize=1)   → 0x11
 *   byte[1]: (messageType) << 4 | flags
 *   byte[2]: (serialization=JSON=1) << 4 | (compression=Gzip=1)  → 0x11
 *   byte[3]: 0 (reserved)
 *   byte[4..7]: sequence (int32 BE)
 *   byte[8..11]: payloadSize (uint32 BE)
 *   byte[12..]: gzip-compressed payload
 *
 * messageType:
 *   0b0001 = Full Client Request (握手 + 配置)
 *   0b0010 = Audio-Only Request (音频数据)
 *   0b1001 = Full Server Response (服务端结果)
 */

import WebSocket from 'ws';
import { gzipSync, gunzipSync } from 'zlib';
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';

const APP_KEY = "1725839450";
const ACCESS_KEY = "MGSzF1O1KTrq9FekvqW-rjtMatg2ckuH";
const RESOURCE_ID = process.env.RESOURCE_ID || "volc.bigasr.sauc.duration";
const BASE_URL = "wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_async";
const WS_URL = BASE_URL;
const REQ_ID = randomUUID();

const CHUNK_SAMPLES = 3200;  // 200ms @ 16kHz
const CHUNK_BYTES = CHUNK_SAMPLES * 2;  // 16-bit = 2 bytes/sample

// ── 帧封包 ──────────────────────────────────────────────

function makeHeader(messageType, flagsLast = false) {
  const buf = Buffer.alloc(4);
  buf[0] = (1 << 4) | 1;  // protocolVersion=1, headerSize=1 (×4 bytes)
  buf[1] = (messageType << 4) | (flagsLast ? 0b0010 : 0);
  buf[2] = (1 << 4) | 1;  // JSON + Gzip
  buf[3] = 0;
  return buf;
}

function makeFrame(messageType, payload, seq, isLast = false) {
  const compressed = gzipSync(payload);
  const seqBuf = Buffer.alloc(4); seqBuf.writeInt32BE(seq, 0);
  const sizeBuf = Buffer.alloc(4); sizeBuf.writeUInt32BE(compressed.length, 0);
  return Buffer.concat([makeHeader(messageType, isLast), seqBuf, sizeBuf, compressed]);
}

function makeFullClientRequest(uuid) {
  const config = {
    user: { uid: `test-${uuid.slice(0, 8)}` },
    audio: { format: "pcm", rate: 16000, bits: 16, channel: 1 },
    request: {
      model_name: "bigmodel",
      enable_punc: true,
      enable_nonstream: true,
      end_window_size: 800,
    },
  };
  return makeFrame(0b0001, Buffer.from(JSON.stringify(config)), 1);
}

function makeAudioFrame(pcm, seq, isLast = false) {
  return makeFrame(0b0010, pcm, seq, isLast);
}

function parseServerResponse(buf) {
  // header(4) + sequence(4) + payloadSize(4) + payload
  if (buf.length < 12) return null;
  const msgType = (buf[1] >> 4) & 0xf;
  try {
    const compressed = buf.slice(12);
    const json = JSON.parse(gunzipSync(compressed).toString('utf8'));
    return { msgType, json };
  } catch (e) {
    return { msgType, raw: buf.slice(12).toString('hex').slice(0, 80) };
  }
}

// ── PCM 准备（从 WAV 读取并重采样到 16kHz）────────────────

function wavToPcm16k(filePath) {
  const buf = readFileSync(filePath);
  // 检查 WAV 头
  const riff = buf.slice(0, 4).toString();
  if (riff !== 'RIFF') throw new Error('not a WAV file');
  const audioFormat = buf.readUInt16LE(20);
  const numChannels = buf.readUInt16LE(22);
  const sampleRate = buf.readUInt32LE(24);
  const bitsPerSample = buf.readUInt16LE(34);
  console.log(`WAV: format=${audioFormat} channels=${numChannels} rate=${sampleRate} bits=${bitsPerSample}`);

  // 找 data chunk
  let offset = 12;
  while (offset < buf.length) {
    const chunkId = buf.slice(offset, offset + 4).toString();
    const chunkSize = buf.readUInt32LE(offset + 4);
    if (chunkId === 'data') {
      const pcmRaw = buf.slice(offset + 8, offset + 8 + chunkSize);
      // 重采样到 16kHz mono 16-bit
      return resampleToMono16k(pcmRaw, numChannels, sampleRate, bitsPerSample);
    }
    offset += 8 + chunkSize;
  }
  throw new Error('no data chunk');
}

function resampleToMono16k(raw, channels, srcRate, bitsPerSample) {
  // 转 Int16
  let samples;
  if (bitsPerSample === 16) {
    samples = new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2);
  } else if (bitsPerSample === 8) {
    const u8 = new Uint8Array(raw);
    samples = new Int16Array(u8.length);
    for (let i = 0; i < u8.length; i++) samples[i] = (u8[i] - 128) * 256;
  } else {
    throw new Error('unsupported bits ' + bitsPerSample);
  }

  // 多声道 → mono
  let mono;
  if (channels === 1) {
    mono = samples;
  } else {
    mono = new Int16Array(Math.floor(samples.length / channels));
    for (let i = 0; i < mono.length; i++) {
      let sum = 0;
      for (let c = 0; c < channels; c++) sum += samples[i * channels + c];
      mono[i] = Math.round(sum / channels);
    }
  }

  // 重采样
  if (srcRate === 16000) return Buffer.from(mono.buffer);
  const ratio = srcRate / 16000;
  const outLen = Math.floor(mono.length / ratio);
  const out = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const srcIdx = i * ratio;
    const lo = Math.floor(srcIdx);
    const hi = Math.min(lo + 1, mono.length - 1);
    const frac = srcIdx - lo;
    out[i] = Math.round(mono[lo] * (1 - frac) + mono[hi] * frac);
  }
  return Buffer.from(out.buffer);
}

// ── 主流程 ────────────────────────────────────────────────

const wavFile = process.argv[2] || 'scripts/sample.wav';
let pcmData;
try {
  pcmData = wavToPcm16k(wavFile);
  console.log(`PCM ready: ${pcmData.length} bytes (~${(pcmData.length/32000).toFixed(1)}s at 16kHz)`);
} catch (e) {
  console.error('PCM load failed:', e.message);
  process.exit(1);
}

// Try both auth formats
const AUTH_MODE = process.env.AUTH_MODE || "bearer";

// AUTH_MODE: bearer | bearer-noapk | xapi | xapi-noseq
const wsHeaders = {
  "bearer": {
    "Authorization": `Bearer; ${ACCESS_KEY}`,
    "X-Api-App-Key": APP_KEY,
    "X-Api-Resource-Id": RESOURCE_ID,
    "X-Api-Request-Id": REQ_ID,
    "X-Api-Sequence": "-1",
  },
  "bearer-noapk": {
    "Authorization": `Bearer; ${ACCESS_KEY}`,
    "X-Api-Resource-Id": RESOURCE_ID,
    "X-Api-Request-Id": REQ_ID,
    "X-Api-Sequence": "-1",
  },
  "xapi": {
    "X-Api-App-Key": APP_KEY,
    "X-Api-Access-Key": ACCESS_KEY,
    "X-Api-Resource-Id": RESOURCE_ID,
    "X-Api-Request-Id": REQ_ID,
    "X-Api-Sequence": "-1",
  },
  "xapi-noseq": {
    "X-Api-App-Key": APP_KEY,
    "X-Api-Access-Key": ACCESS_KEY,
    "X-Api-Resource-Id": RESOURCE_ID,
    "X-Api-Request-Id": REQ_ID,
  },
  "url-token": null,  // token in URL params
}[AUTH_MODE];

let finalUrl = WS_URL;
let finalHeaders;
if (AUTH_MODE === "url-token") {
  finalUrl = `${BASE_URL}?appid=${APP_KEY}&token=${ACCESS_KEY}&resource_id=${RESOURCE_ID}&request_id=${REQ_ID}&sequence=-1`;
  finalHeaders = {};
} else {
  finalHeaders = wsHeaders ?? {};
}

console.log("Auth mode:", AUTH_MODE, "URL:", finalUrl.split('?')[0]);
const ws = new WebSocket(finalUrl, { headers: finalHeaders });

ws.on('open', () => {
  console.log('WS connected');
  // 1. 发握手帧
  ws.send(makeFullClientRequest(REQ_ID));
  console.log('Sent Full Client Request');

  // 2. 分片发音频
  let seq = 2;
  let offset = 0;
  const interval = setInterval(() => {
    if (offset >= pcmData.length) {
      clearInterval(interval);
      const last = makeAudioFrame(Buffer.alloc(0), seq, true);
      ws.send(last);
      console.log(`Sent last audio frame (seq=${seq})`);
      return;
    }
    const chunk = pcmData.slice(offset, offset + CHUNK_BYTES);
    const isLast = (offset + CHUNK_BYTES) >= pcmData.length;
    ws.send(makeAudioFrame(chunk, seq, isLast));
    offset += CHUNK_BYTES;
    seq++;
  }, 200);
});

ws.on('message', (data) => {
  const result = parseServerResponse(data);
  if (!result) return;
  const { json } = result;
  if (!json) {
    console.log('Raw msg:', result.raw);
    return;
  }
  const type = json.is_final ? 'FINAL' : 'partial';
  const text = json.result?.text ?? json.text ?? '(empty)';
  const code = json.code ?? json.result?.code;
  console.log(`[${type}] ${text}${code ? ' code=' + code : ''}`);
  if (json.is_final) {
    ws.close();
    console.log('Done.');
  }
});

ws.on('unexpected-response', (req, res) => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    console.error(`WS rejected: HTTP ${res.statusCode}`);
    console.error('Response body:', body.slice(0, 500));
    process.exit(1);
  });
});

ws.on('error', (err) => {
  console.error('WS error:', err.message);
  process.exit(1);
});

ws.on('close', (code, reason) => {
  console.log(`WS closed: code=${code} reason=${reason?.toString?.() || ''}`);
});

setTimeout(() => {
  console.error('TIMEOUT after 30s');
  ws.close();
  process.exit(1);
}, 30000);
