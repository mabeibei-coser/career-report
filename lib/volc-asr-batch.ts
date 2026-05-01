import { randomUUID } from 'crypto';

/**
 * Transcribe audio using Volcano batch ASR flash endpoint.
 * @param audioBuffer - raw audio bytes (webm, mp4, wav, etc)
 * @returns recognized text string, or "" if transcription fails
 */
export async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
  const appKey = process.env.VOLC_TTS_APP_KEY;
  const accessKey = process.env.VOLC_TTS_ACCESS_KEY;
  const resourceId = process.env.VOLC_ASR_RESOURCE_ID || 'volc.bigasr.auc_turbo';

  if (!appKey || !accessKey) {
    console.error('[volc-asr-batch] Missing VOLC_TTS_APP_KEY or VOLC_TTS_ACCESS_KEY');
    return '';
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20_000);

  try {
    const response = await fetch(
      'https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-App-Key': appKey,
          'X-Api-Access-Key': accessKey,
          'X-Api-Resource-Id': resourceId,
          'X-Api-Request-Id': randomUUID(),
          'X-Api-Sequence': '-1',
        },
        body: JSON.stringify({
          user: { uid: randomUUID() },
          audio: { data: audioBuffer.toString('base64') },
          request: { model_name: 'bigmodel' },
        }),
        signal: controller.signal,
      }
    );

    const data = await response.json();

    if (data?.result?.text) {
      return data.result.text as string;
    }

    if (data?.header?.code !== undefined) {
      console.error('[volc-asr-batch] API error:', data.header.code, data.header.message);
    } else {
      console.error('[volc-asr-batch] Unexpected response:', JSON.stringify(data));
    }

    return '';
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      console.error('[volc-asr-batch] Request timed out after 20s');
    } else {
      console.error('[volc-asr-batch] Request failed:', err);
    }
    return '';
  } finally {
    clearTimeout(timeoutId);
  }
}
