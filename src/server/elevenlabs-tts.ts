type SynthesizeSpeechInput = {
  text: string;
  userId: string;
  language: 'en' | 'es';
};

type ElevenLabsTimestamps = {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
};

type ElevenLabsResponse = {
  audio_base64?: string;
  alignment?: ElevenLabsTimestamps | null;
  normalized_alignment?: ElevenLabsTimestamps | null;
  detail?: {
    message?: string;
  };
};

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

export async function synthesizeSpeechWithElevenLabs(input: SynthesizeSpeechInput) {
  const apiKey = getRequiredEnv('ELEVENLABS_API_KEY');
  const voiceId = getRequiredEnv('ELEVENLABS_VOICE_ID');
  const modelId = process.env.ELEVENLABS_MODEL_ID?.trim() || 'eleven_multilingual_v2';
  const outputFormat = process.env.ELEVENLABS_OUTPUT_FORMAT?.trim() || 'mp3_44100_128';
  const baseUrl = (process.env.ELEVENLABS_BASE_URL?.trim() || 'https://api.elevenlabs.io').replace(/\/$/, '');

  const response = await fetch(
    `${baseUrl}/v1/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps?output_format=${encodeURIComponent(outputFormat)}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: input.text,
        model_id: modelId,
        language_code: input.language,
      }),
    },
  );

  const payload = (await response.json().catch(() => null)) as ElevenLabsResponse | null;
  if (!response.ok) {
    throw new Error(`ElevenLabs TTS request failed (${response.status}): ${payload?.detail?.message || response.statusText}`);
  }
  if (!payload?.audio_base64) {
    throw new Error('ElevenLabs TTS returned no audio data');
  }

  const alignment = payload.normalized_alignment || payload.alignment || null;
  let durationMs = 0;
  if (alignment?.character_end_times_seconds?.length) {
    const last = alignment.character_end_times_seconds[alignment.character_end_times_seconds.length - 1] || 0;
    durationMs = Math.round(last * 1000);
  }

  return {
    audioBuffer: Buffer.from(payload.audio_base64, 'base64'),
    contentType: 'audio/mpeg',
    durationMs,
    timestamps: alignment,
    requestId: null,
  };
}
