import { randomUUID } from 'node:crypto';

type SynthesizeSpeechInput = {
  text: string;
  userId: string;
  language: 'en' | 'es';
};

type VolcengineTtsResponse = {
  reqid?: string;
  code?: number;
  message?: string;
  sequence?: number;
  data?: string;
  addition?: {
    duration?: string;
    frontend?: string;
  };
};

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

function resolveLanguage(language: 'en' | 'es') {
  if (language === 'es') return 'es';
  return 'en';
}

export async function synthesizeSpeechWithVolcengine(input: SynthesizeSpeechInput) {
  const baseUrl = (process.env.VOLCENGINE_TTS_BASE_URL?.trim() || 'https://openspeech.bytedance.com').replace(/\/$/, '');
  const appId = getRequiredEnv('VOLCENGINE_TTS_APP_ID');
  const accessToken = getRequiredEnv('VOLCENGINE_TTS_ACCESS_TOKEN');
  const cluster = getRequiredEnv('VOLCENGINE_TTS_CLUSTER');
  const voiceType = getRequiredEnv('VOLCENGINE_TTS_VOICE_TYPE');

  const encoding = process.env.VOLCENGINE_TTS_ENCODING?.trim() || 'mp3';
  const rate = Number(process.env.VOLCENGINE_TTS_RATE?.trim() || '24000');
  const speedRatio = Number(process.env.VOLCENGINE_TTS_SPEED_RATIO?.trim() || '1.0');
  const volumeRatio = Number(process.env.VOLCENGINE_TTS_VOLUME_RATIO?.trim() || '1.0');
  const pitchRatio = Number(process.env.VOLCENGINE_TTS_PITCH_RATIO?.trim() || '1.0');

  const response = await fetch(`${baseUrl}/api/v1/tts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer;${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      app: {
        appid: appId,
        token: accessToken,
        cluster,
      },
      user: {
        uid: input.userId,
      },
      audio: {
        voice_type: voiceType,
        encoding,
        rate,
        speed_ratio: speedRatio,
        volume_ratio: volumeRatio,
        pitch_ratio: pitchRatio,
        language: resolveLanguage(input.language),
      },
      request: {
        reqid: randomUUID(),
        text: input.text,
        text_type: 'plain',
        operation: 'query',
        with_timestamp: '1',
      },
    }),
  });

  const payload = (await response.json().catch(() => null)) as VolcengineTtsResponse | null;
  if (!response.ok) {
    throw new Error(`Volcengine TTS request failed (${response.status}): ${payload?.message || response.statusText}`);
  }

  if (!payload || payload.code !== 3000 || !payload.data) {
    throw new Error(`Volcengine TTS synthesis failed: ${payload?.message || 'Unknown error'}`);
  }

  let timestamps: unknown = null;
  if (payload.addition?.frontend) {
    try {
      timestamps = JSON.parse(payload.addition.frontend);
    } catch {
      timestamps = payload.addition.frontend;
    }
  }

  return {
    audioBuffer: Buffer.from(payload.data, 'base64'),
    contentType: encoding === 'mp3' ? 'audio/mpeg' : `audio/${encoding}`,
    durationMs: Number(payload.addition?.duration || '0') || 0,
    timestamps,
    requestId: payload.reqid || null,
  };
}
