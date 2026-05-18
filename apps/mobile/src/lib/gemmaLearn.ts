/**
 * gemmaLearn — conversational snake-education chat backend.
 *
 * Cloud path calls Gemma 4 (26B A4B MoE) via the Google AI REST API using
 * plain fetch — no SDK, no polyfills, works in React Native out of the box.
 *
 * Set EXPO_PUBLIC_GOOGLE_AI_KEY in apps/mobile/.env to enable cloud mode.
 * When the key is absent the app falls back to on-device llama.rn (needs .gguf).
 *
 * Image support: pass a local file URI as imageUri to have Gemma 4 describe
 * or identify what's in the photo (vision understanding, not generation).
 */
import * as Network from 'expo-network';
import type { Language } from '@ishvenom/shared-types';

async function isOnline(): Promise<boolean> {
  const state = await Network.getNetworkStateAsync();
  // isInternetReachable is null on many Android devices even when online —
  // treat null as "probably reachable" and let the fetch fail if it isn't
  return Boolean(state.isConnected && state.isInternetReachable !== false);
}

export async function resolveInferenceMode(): Promise<'cloud' | 'on-device'> {
  if (!process.env.EXPO_PUBLIC_GOOGLE_AI_KEY) return 'on-device';
  const state = await Network.getNetworkStateAsync();
  return state.isConnected !== false ? 'cloud' : 'on-device';
}

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a snake-safety educator for sub-Saharan Africa helping community health workers and rural communities.

Do not narrate your reasoning. Begin your response directly with the first ## heading.
Use ## for main sections and ### for sub-sections.
Number all steps: 1. 2. 3. — never use bullet points or dashes.
Wrap urgent warnings in **double asterisks**.
Keep total response under 200 words. No emoji.
If shown a photo: start with ## What I see, then ## Identification (with confidence level), then ## What to do.
Never guess about venomousness — if unsure, say so.
If bites, symptoms or treatment are mentioned, end with: Seek professional medical help immediately.`;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  /** Local file URI of an image the user attached to this message */
  imageUri?: string;
}

// ─── Gemini REST API ──────────────────────────────────────────────────────────

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_MODEL = 'gemma-4-26b-a4b-it';

interface GeminiPart {
  text?: string;
  thought?: boolean;
  inline_data?: { mime_type: string; data: string };
}
interface GeminiContent { role: string; parts: GeminiPart[] }
interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] };
  }>;
  error?: { message: string; code: number };
}

/** Gemma 4 emits a thinking part first ({"text":"","thought":true}), then the real answer.
 *  Always grab the last part that has non-empty text and is NOT a thought token. */
function extractText(parts: GeminiPart[] | undefined): string {
  if (!parts) return '';
  const answer = [...parts].reverse().find((p) => !p.thought && p.text);
  return answer?.text ?? '';
}

async function readImageBase64(uri: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { manipulateAsync, SaveFormat } = require('expo-image-manipulator') as typeof import('expo-image-manipulator');
  const resized = await manipulateAsync(
    uri,
    [{ resize: { width: 768, height: 768 } }],
    { format: SaveFormat.JPEG, base64: true, compress: 0.8 },
  );
  if (!resized.base64) throw new Error('image_encode_failed');
  return resized.base64;
}

async function sendToGemini(
  history: ChatMessage[],
  userText: string,
  language: Language,
  imageUri?: string,
): Promise<string> {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_AI_KEY;
  if (!apiKey) throw new Error('no_api_key');

  const langNote =
    language !== 'en'
      ? ` Reply in the user's language (${language}) if possible.`
      : '';

  // Previous turns — images in history referenced by text summary only
  const contents: GeminiContent[] = history.map((m) => {
    const parts: GeminiPart[] = [];
    if (m.imageUri) parts.push({ text: '[user shared an image]' });
    parts.push({ text: m.text });
    return { role: m.role === 'assistant' ? 'model' : 'user', parts };
  });

  // Current user turn — may include an image
  const userParts: GeminiPart[] = [];
  if (imageUri) {
    const b64 = await readImageBase64(imageUri);
    userParts.push({ inline_data: { mime_type: 'image/jpeg', data: b64 } });
  }
  userParts.push({ text: userText || 'What is in this image?' });
  contents.push({ role: 'user', parts: userParts });

  const url = `${GEMINI_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      // systemInstruction is the correct field — model follows it more reliably
      // than injecting it as a fake user/model turn pair
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT + langNote }] },
      contents,
      generationConfig: { maxOutputTokens: 512, temperature: 0.7 },
    }),
  });

  const json = (await res.json()) as GeminiResponse;
  if (!res.ok || json.error) {
    throw new Error(json.error?.message ?? `HTTP ${res.status}`);
  }

  const raw = extractText(json.candidates?.[0]?.content?.parts);
  if (!raw) throw new Error('empty_response');

  // Strip any remaining <think> blocks, then strip reasoning narration before the first ## heading.
  const stripped = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const firstHeading = stripped.search(/^##\s/m);
  return firstHeading > 0 ? stripped.slice(firstHeading).trim() : stripped;
}

// ─── On-device path ───────────────────────────────────────────────────────────

import { getLocalModelPath } from './modelDownload';
const MODEL_PATH = getLocalModelPath();

async function sendOnDevice(
  history: ChatMessage[],
  userText: string,
  language: Language,
): Promise<string> {
  // On-device model was fine-tuned WITHOUT a system turn — training format was
  // plain user→model pairs. Injecting a system turn causes the model to ignore
  // it (it was never seen during LoRA training). Instead embed context in user text.
  const langSuffix = language !== 'en' ? ` Reply in ${language}.` : '';
  const instruction = `${userText}${langSuffix}`;

  const turns = history
    .map((m) =>
      m.role === 'user'
        ? `<start_of_turn>user\n${m.text}<end_of_turn>`
        : `<start_of_turn>model\n${m.text}<end_of_turn>`,
    )
    .join('\n');

  // Matches the exact training format from ml/kaggle/02-gemma-lora.ipynb:
  // <start_of_turn>user\n{instruction}<end_of_turn>\n<start_of_turn>model\n
  const prompt =
    `${turns ? turns + '\n' : ''}` +
    `<start_of_turn>user\n${instruction}<end_of_turn>\n` +
    `<start_of_turn>model\n`;

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { initLlama } = require('llama.rn') as {
      initLlama: (opts: {
        model: string;
        n_ctx: number;
        n_gpu_layers: number;
      }) => Promise<{
        completion: (p: {
          prompt: string;
          n_predict: number;
          temperature: number;
          stop: string[];
        }) => Promise<{ text: string }>;
      }>;
    };
    // n_ctx=2048 instead of 4096 — halves KV-cache memory, reduces OOM risk.
    // The model was trained on max_seq_len=1024; 2048 is sufficient for full
    // conversation history and still fits in constrained Android heap.
    const ctx = await initLlama({ model: MODEL_PATH, n_ctx: 2048, n_gpu_layers: 0 });
    const result = await ctx.completion({
      prompt,
      n_predict: 300,
      temperature: 0.7,
      stop: ['<end_of_turn>', '<start_of_turn>'],
    });
    return result.text.trim();
  } catch (e: unknown) {
    // Surface OOM separately so the UI can show a memory-specific message
    // instead of a generic "unavailable" error.
    const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
    if (msg.includes('memory') || msg.includes('oom') || msg.includes('alloc') || msg.includes('failed to')) {
      throw new Error('on_device_oom');
    }
    throw new Error('on_device_unavailable');
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function sendLearnMessage(
  history: ChatMessage[],
  userText: string,
  language: Language,
  imageUri?: string,
  forceLocal = false,
): Promise<string> {
  const hasKey = Boolean(process.env.EXPO_PUBLIC_GOOGLE_AI_KEY);
  const online = await isOnline();

  if (!forceLocal && hasKey && online) {
    // Cloud path — all errors surface to the caller
    return sendToGemini(history, userText, language, imageUri);
  }

  // No API key or offline — on-device requires the GGUF model to be downloaded
  if (forceLocal) {
    return sendOnDevice(history, userText, language);
  }
  throw new Error('cloud_required');
}

export function isCloudMode(): boolean {
  return Boolean(process.env.EXPO_PUBLIC_GOOGLE_AI_KEY);
}
