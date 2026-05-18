/**
 * On-device Gemma 4 E2B wrapper (via llama.rn).
 *
 * Responsibilities:
 *   1. Lazy-load the quantized GGUF from the app bundle on first use.
 *   2. Expose a single typed call site: `generateFirstAid`, which takes a
 *      species + language + optional user context and returns a structured
 *      response adhering to the gold instruction schema categories.
 *   3. Hard-cap latency + token count, because we're on a $80 phone with
 *      no GPU and a user in an emergency.
 *
 * Why a thin dedicated wrapper (not a generic "chat" API): the model runs
 * in a sandbox where every token costs battery and every extra turn costs
 * seconds of the user's life. The call surface is deliberately small so
 * prompt engineering lives in one place and can be evaluated.
 *
 * Testing: the default runtime is `llama.rn`, but tests inject a mock
 * via `setRuntime`, so nothing under __tests__/ needs the native module.
 */
import type { Language } from '@ishvenom/shared-types';
import { stripThinking } from './formatResponse';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_MODEL = 'gemma-4-26b-a4b-it';

interface GeminiPart {
  text?: string;
  thought?: boolean;
}
interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: GeminiPart[] } }>;
  error?: { message: string };
}

/** Gemma 4 emits a thinking part first ({"text":"","thought":true}), then the real answer.
 *  Always grab the last part that has non-empty text and is NOT a thought token. */
function extractText(parts: GeminiPart[] | undefined): string {
  if (!parts) return '';
  const answer = [...parts].reverse().find((p) => !p.thought && p.text);
  return answer?.text ?? '';
}

export interface GemmaCompletionRequest {
  prompt: string;
  maxTokens: number;
  temperature: number;
  stop: string[];
}

export interface GemmaCompletionResult {
  text: string;
  tokensGenerated: number;
  latencyMs: number;
}

export interface GemmaRuntime {
  init(modelPath: string): Promise<void>;
  isReady(): boolean;
  complete(req: GemmaCompletionRequest): Promise<GemmaCompletionResult>;
  release(): Promise<void>;
}

/**
 * Default runtime backed by llama.rn. The import is deferred so Jest
 * never tries to resolve the native module.
 */
function createLlamaRuntime(): GemmaRuntime {
  let ctx: unknown = null;

  return {
    async init(modelPath: string) {
      if (ctx) return;
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { initLlama } = require('llama.rn') as {
        initLlama: (opts: {
          model: string;
          n_ctx: number;
          n_gpu_layers: number;
          use_mlock: boolean;
        }) => Promise<unknown>;
      };
      // initLlama() hits the native layer — throws Invariant Violation in Expo Go
      try {
        ctx = await initLlama({
          model: modelPath,
          n_ctx: 2048,
          n_gpu_layers: 0, // CPU-only on Android target hardware
          use_mlock: false,
        });
      } catch {
        throw new Error('on_device_unavailable');
      }
    },
    isReady() {
      return ctx !== null;
    },
    async complete(req) {
      if (!ctx) throw new Error('Gemma runtime not initialized');
      const started = Date.now();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res: { text: string; tokens_predicted?: number } = await (
        ctx as {
          completion: (p: {
            prompt: string;
            n_predict: number;
            temperature: number;
            stop: string[];
          }) => Promise<{ text: string; tokens_predicted?: number }>;
        }
      ).completion({
        prompt: req.prompt,
        n_predict: req.maxTokens,
        temperature: req.temperature,
        stop: req.stop,
      });
      return {
        text: res.text,
        tokensGenerated: res.tokens_predicted ?? 0,
        latencyMs: Date.now() - started,
      };
    },
    async release() {
      if (!ctx) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const c = ctx as { release: () => Promise<void> };
      await c.release();
      ctx = null;
    },
  };
}

let runtime: GemmaRuntime = createLlamaRuntime();

export function setRuntime(r: GemmaRuntime): void {
  runtime = r;
}

export async function ensureGemmaLoaded(modelPath: string): Promise<void> {
  if (!runtime.isReady()) await runtime.init(modelPath);
}

export async function releaseGemma(): Promise<void> {
  await runtime.release();
}

// ---------- prompt templates ----------

const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English',
  fr: 'French',
  ar: 'Modern Standard Arabic',
  ha: 'Hausa',
  sw: 'Kiswahili',
  tw: 'Twi',
};

/**
 * The prompt is intentionally rigid. We do NOT let the model free-form
 * medical advice — the gold corpus in assets/firstaid/ is the source of
 * truth. Gemma's job is to ADAPT the pre-written steps for the specific
 * species into the target language, preserving all "DO" and "DO NOT"
 * clauses exactly.
 */
export function buildFirstAidPrompt(params: {
  scientificName: string;
  commonName: string;
  venomous: 'non_venomous' | 'mildly_venomous' | 'deadly';
  language: Language;
  goldSteps: Array<{ title: string; body: string; severity: string }>;
}): string {
  const header = [
    '<start_of_turn>user',
    'You are a medical first-aid assistant for snakebite. Do not invent',
    'new advice. Only adapt the pre-written steps below into the target',
    'language. Preserve every "DO NOT" warning exactly. Output JSON.',
    '',
    `Species: ${params.scientificName} (${params.commonName})`,
    `Venomous: ${params.venomous}`,
    `Target language: ${LANGUAGE_NAMES[params.language]} (${params.language})`,
    '',
    'Pre-written steps (source of truth):',
  ].join('\n');

  const steps = params.goldSteps
    .map(
      (s, i) =>
        `${i + 1}. [${s.severity}] ${s.title}: ${s.body}`,
    )
    .join('\n');

  const footer = [
    '',
    'Output a JSON object with this shape:',
    '{"summary": "...", "steps": [{"title": "...", "body": "..."}], "do_not": ["..."]}',
    'Do not add any text outside the JSON object.',
    '<end_of_turn>',
    '<start_of_turn>model',
    '',
  ].join('\n');

  return `${header}\n${steps}\n${footer}`;
}

export interface FirstAidGeneration {
  summary: string;
  steps: Array<{ title: string; body: string }>;
  doNot: string[];
  latencyMs: number;
  fallback: boolean;
}

/**
 * Safely parse model output. If the JSON is malformed, we fall back to
 * a deterministic rendering of the gold steps — never a blank screen.
 */
export function parseFirstAidOutput(
  raw: string,
  fallback: {
    summary: string;
    goldSteps: Array<{ title: string; body: string; category: string }>;
  },
): FirstAidGeneration {
  const cleaned = raw
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    .trim();
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
    return buildFallback(fallback);
  }
  try {
    const parsed = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)) as {
      summary?: unknown;
      steps?: unknown;
      do_not?: unknown;
    };
    const summary =
      typeof parsed.summary === 'string' ? parsed.summary : fallback.summary;
    const steps = Array.isArray(parsed.steps)
      ? parsed.steps
          .filter(
            (s): s is { title: string; body: string } =>
              typeof s === 'object' &&
              s !== null &&
              typeof (s as { title?: unknown }).title === 'string' &&
              typeof (s as { body?: unknown }).body === 'string',
          )
          .slice(0, 10)
      : [];
    const doNot = Array.isArray(parsed.do_not)
      ? parsed.do_not.filter((x): x is string => typeof x === 'string').slice(0, 10)
      : [];

    if (steps.length === 0) return buildFallback(fallback);

    return {
      summary,
      steps,
      doNot,
      latencyMs: 0,
      fallback: false,
    };
  } catch {
    return buildFallback(fallback);
  }
}

function buildFallback(fallback: {
  summary: string;
  goldSteps: Array<{ title: string; body: string; category: string }>;
}): FirstAidGeneration {
  const doNot = fallback.goldSteps
    .filter((s) => s.category === 'do_not')
    .map((s) => s.body);
  const steps = fallback.goldSteps
    .filter((s) => s.category !== 'do_not')
    .map((s) => ({ title: s.title, body: s.body }));
  return { summary: fallback.summary, steps, doNot, latencyMs: 0, fallback: true };
}

async function generateFirstAidCloud(params: {
  scientificName: string;
  commonName: string;
  venomous: 'non_venomous' | 'mildly_venomous' | 'deadly';
  language: Language;
  goldSteps: Array<{ title: string; body: string; severity: string; category: string }>;
  summary: string;
}): Promise<FirstAidGeneration> {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_AI_KEY;
  if (!apiKey) throw new Error('no_api_key');

  const prompt = buildFirstAidPrompt(params);
  const url = `${GEMINI_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const started = Date.now();

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 512, temperature: 0.2 },
    }),
  });

  const json = (await res.json()) as GeminiResponse;
  if (!res.ok || json.error) throw new Error(json.error?.message ?? `HTTP ${res.status}`);

  const raw = extractText(json.candidates?.[0]?.content?.parts);
  const text = stripThinking(raw);
  const latencyMs = Date.now() - started;

  const parsed = parseFirstAidOutput(text, {
    summary: params.summary,
    goldSteps: params.goldSteps,
  });
  return { ...parsed, latencyMs };
}

export async function generateFirstAid(params: {
  scientificName: string;
  commonName: string;
  venomous: 'non_venomous' | 'mildly_venomous' | 'deadly';
  language: Language;
  goldSteps: Array<{ title: string; body: string; severity: string; category: string }>;
  summary: string;
}): Promise<FirstAidGeneration> {
  // Cloud-first: fast, no model download required
  if (process.env.EXPO_PUBLIC_GOOGLE_AI_KEY) {
    try {
      return await generateFirstAidCloud(params);
    } catch {
      // fall through to on-device
    }
  }

  // On-device fallback via llama.rn
  const prompt = buildFirstAidPrompt(params);
  const res = await runtime.complete({
    prompt,
    maxTokens: 512,
    temperature: 0.2,
    stop: ['<end_of_turn>', '<start_of_turn>'],
  });
  const parsed = parseFirstAidOutput(res.text, {
    summary: params.summary,
    goldSteps: params.goldSteps,
  });
  return { ...parsed, latencyMs: res.latencyMs };
}
