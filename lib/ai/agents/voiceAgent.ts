import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { v2 as cloudinary } from 'cloudinary';
import prisma from '@/lib/prisma';
import { AgentResponse } from '../dispatcher';
import { withFallback } from '../utils/withFallback';

if (process.env.CLOUDINARY_URL) {
  cloudinary.config(true);
}

async function generateEdgeTTS(text: string): Promise<Buffer> {
  console.log('[VoiceAgent] Using Microsoft Edge TTS...');
  const tts = new MsEdgeTTS();
  await tts.setMetadata("en-US-AriaNeural", OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

  return new Promise((resolve, reject) => {
    const { audioStream } = tts.toStream(text);
    const chunks: Buffer[] = [];

    audioStream.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    audioStream.on('close', () => {
      resolve(Buffer.concat(chunks));
    });

    audioStream.on('error', (err: Error) => {
      reject(err);
    });
  });
}

async function generateGoogleTTS(text: string): Promise<Buffer> {
  console.log('[VoiceAgent] Edge TTS failed, falling back to Google Translate TTS...');
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=en&client=tw-ob&q=${encodeURIComponent(text)}`;
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    },
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) {
    throw new Error(`Google TTS API returned HTTP ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function runVoiceAgent(text: string, userId: string): Promise<AgentResponse> {
  try {
    console.log(`[VoiceAgent] Synthesizing speech for: "${text.substring(0, 30)}..."`);
    
    // Execute TTS with Fallback Hardening
    const audioBuffer = await withFallback(
      () => generateEdgeTTS(text),
      () => generateGoogleTTS(text),
      'Voice Generation Agent'
    );

    // Upload to Cloudinary
    console.log('[VoiceAgent] Uploading audio buffer to Cloudinary...');
    if (!process.env.CLOUDINARY_URL) {
      throw new Error('CLOUDINARY_URL is not set');
    }

    const base64Audio = audioBuffer.toString('base64');
    const dataURI = `data:audio/mp3;base64,${base64Audio}`;

    // Cloudinary expects resource_type "video" for audio files (mp3, wav)
    const uploadResult = await cloudinary.uploader.upload(dataURI, {
      folder: 'synthox-ai-audio',
      resource_type: 'video',
    });

    const audioUrl = uploadResult.secure_url;

    // Save record in GeneratedFile
    try {
      await prisma.generatedFile.create({
        data: {
          userId,
          type: 'audio',
          url: audioUrl,
        },
      });
    } catch (dbError) {
      console.error('[VoiceAgent] Failed to save GeneratedFile to DB:', dbError);
    }

    return {
      agentType: 'voice_generation',
      content: 'Here is your read-aloud speech audio.',
      audioUrl,
      status: 'success',
    };
  } catch (error) {
    console.error('[VoiceAgent] Fatal Error:', error);
    return {
      agentType: 'voice_generation',
      content: `⚠️ Failed to generate voice speech: ${(error as Error).message}`,
      status: 'error',
    };
  }
}
