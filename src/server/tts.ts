import { synthesizeSpeechWithElevenLabs } from '@/server/elevenlabs-tts';
import { synthesizeSpeechWithVolcengine } from '@/server/volcengine-tts';

type SynthesizeSpeechInput = {
  text: string;
  userId: string;
  language: 'en' | 'es';
};

export async function synthesizeSpeech(input: SynthesizeSpeechInput) {
  const provider = (process.env.TTS_PROVIDER?.trim().toLowerCase() || 'elevenlabs');

  if (provider === 'volcengine') {
    return synthesizeSpeechWithVolcengine(input);
  }

  if (provider === 'elevenlabs') {
    return synthesizeSpeechWithElevenLabs(input);
  }

  throw new Error(`Unsupported TTS_PROVIDER: ${provider}`);
}
