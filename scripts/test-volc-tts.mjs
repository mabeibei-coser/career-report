// Explicit opt-in diagnostic; reads credentials from .env.local, never source literals.
// Run: node --env-file=.env.local scripts/test-volc-tts.mjs <output-in-temp.mp3>
import { writeFileSync } from 'node:fs';
import { synthesizeTTS } from '../lib/volc-tts.ts';
if (!process.argv[2]) throw new Error('Provide an output MP3 path in your temporary directory');
const audio = await synthesizeTTS('你好，欢迎参加访谈');
if (!audio) throw new Error('TTS returned no audio');
const bytes = Buffer.from(audio, 'base64');
writeFileSync(process.argv[2], bytes);
console.log(`TTS received ${bytes.length} bytes`);
