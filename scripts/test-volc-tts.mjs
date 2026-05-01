import { writeFileSync } from 'fs';

const body = {
  app: { appid: "1725839450", cluster: "volcano_bigtts" },
  user: { uid: "test-node" },
  audio: { voice_type: "zh_female_vv_uranus_bigtts", encoding: "mp3", speed_ratio: 1.0 },
  request: { reqid: "node-001", text: "你好，欢迎参加访谈", operation: "query" }
};

console.log("text:", body.request.text);
console.log("Sending to volcano_bigtts...");

const res = await fetch("https://openspeech.bytedance.com/api/v1/tts", {
  method: "POST",
  headers: {
    "X-Api-App-Key": "1725839450",
    "X-Api-Access-Key": "MGSzF1O1KTrq9FekvqW-rjtMatg2ckuH",
    "X-Api-Resource-Id": "volc.service_type.10029",
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
});

const d = await res.json();
if (d.data) {
  const mp3 = Buffer.from(d.data, 'base64');
  writeFileSync('scripts/test.mp3', mp3);
  console.log("T1.1 PASS code=" + d.code + " mp3=" + mp3.length + "B");
} else {
  console.log("FAIL code=" + d.code + " msg=" + d.message);
}

// 也试 Authorization: Bearer 格式
console.log("\nTrying Authorization: Bearer format...");
const body2 = { ...body, app: { ...body.app, cluster: "volcano_tts", token: "MGSzF1O1KTrq9FekvqW-rjtMatg2ckuH" } };
body2.request.reqid = "node-002";

const res2 = await fetch("https://openspeech.bytedance.com/api/v1/tts", {
  method: "POST",
  headers: {
    "Authorization": "Bearer; MGSzF1O1KTrq9FekvqW-rjtMatg2ckuH",
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body2),
});
const d2 = await res2.json();
if (d2.data) {
  const mp3 = Buffer.from(d2.data, 'base64');
  writeFileSync('scripts/test2.mp3', mp3);
  console.log("T1.1 PASS (bearer) code=" + d2.code + " mp3=" + mp3.length + "B");
} else {
  console.log("Bearer FAIL code=" + d2.code + " msg=" + d2.message);
}
