/**
 * Cloud triage — sends the image to Gemma 4 via Gemini REST API and gets
 * back species identification + first-aid advice in a single call.
 *
 * This mirrors the Learn screen's sendToGemini approach (proven to work)
 * instead of two separate classify + generateFirstAid calls that both fail.
 */
import type { Language } from '@ishvenom/shared-types';

const CLOUD_INPUT_SIZE = 768;
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_MODEL = 'gemma-4-26b-a4b-it';

export interface CloudTriageResult {
  scientificName: string;
  commonName: string;
  venomous: 'non_venomous' | 'mildly_venomous' | 'deadly';
  summary: string;
  steps: Array<{ title: string; body: string }>;
  doNot: string[];
}

const SYSTEM_INSTRUCTION =
  `You are an expert snake-safety assistant for sub-Saharan Africa.\n` +
  `When shown a snake image, identify the species and provide first aid guidance.\n\n` +
  `Return ONLY a JSON object — no other text, no markdown, no explanation:\n` +
  `{"scientificName":"...","commonName":"...","venomous":"deadly|mildly_venomous|non_venomous","summary":"...","steps":[{"title":"...","body":"..."}],"doNot":["..."]}\n\n` +
  `Rules:\n` +
  `- scientificName: exact scientific name of the species, or "" if not identifiable\n` +
  `- commonName: common English name of the species\n` +
  `- venomous: one of exactly "deadly", "mildly_venomous", or "non_venomous"\n` +
  `- summary: one sentence describing the snake and its danger level\n` +
  `- steps: 3-5 first aid steps (title + body each)\n` +
  `- doNot: 2-4 things NOT to do\n` +
  `If no snake is visible, use scientificName "" and treat as potentially dangerous.`;

// Safe fallback used when JSON parsing fails entirely
const UNKNOWN_FALLBACK: CloudTriageResult = {
  scientificName: '',
  commonName: 'Unknown snake',
  venomous: 'deadly',
  summary: 'Could not identify snake — treat as dangerous.',
  steps: [
    { title: 'Stay calm', body: 'Keep the victim calm and still. Panic spreads venom faster.' },
    { title: 'Move away safely', body: 'Move at least 5 metres from the snake. Do not try to catch or kill it.' },
    { title: 'Immobilise the limb', body: 'Keep the bitten limb still and below heart level.' },
    { title: 'Go to hospital', body: 'Get to the nearest hospital immediately. Note the time of the bite.' },
  ],
  doNot: [
    'Do not cut the wound or try to suck out venom',
    'Do not apply a tourniquet',
    'Do not apply ice or electricity',
  ],
};

interface GeminiPart { text?: string; thought?: boolean }
interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: GeminiPart[] } }>;
  error?: { message: string };
}

/** Gemma 4 emits a thinking part first ({"text":"","thought":true}), then the real answer.
 *  Always grab the last part that has non-empty text and is NOT a thought token. */
function extractText(parts: GeminiPart[] | undefined): string {
  if (!parts) return '';
  // Prefer the last non-thought part with content
  const answer = [...parts].reverse().find((p) => !p.thought && p.text);
  return answer?.text ?? '';
}

export async function classifyAndTriage(
  imagePath: string,
  language: Language,
  wasBite: boolean,
): Promise<CloudTriageResult> {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_AI_KEY;
  if (!apiKey) throw new Error('no_api_key');

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { manipulateAsync, SaveFormat } = require('expo-image-manipulator') as typeof import('expo-image-manipulator');
  const resized = await manipulateAsync(
    imagePath,
    [{ resize: { width: CLOUD_INPUT_SIZE, height: CLOUD_INPUT_SIZE } }],
    { format: SaveFormat.JPEG, base64: true, compress: 0.8 },
  );
  const b64 = resized.base64;
  if (!b64) throw new Error('image_encode_failed');

  const userText =
    `Identify this snake and provide first aid guidance.\n` +
    `Context: wasBite=${wasBite ? 'yes' : 'no'}, language=${language}.\n` +
    `If wasBite is yes, include bite-specific first aid steps.\n` +
    `Output the JSON object now.`;

  const url = `${GEMINI_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
      contents: [{
        role: 'user',
        parts: [
          { inline_data: { mime_type: 'image/jpeg', data: b64 } },
          { text: userText },
        ],
      }],
      generationConfig: { maxOutputTokens: 768, temperature: 0.2 },
    }),
  });

  const json = (await res.json()) as GeminiResponse;
  if (!res.ok || json.error) throw new Error(json.error?.message ?? `HTTP ${res.status}`);

  const raw = extractText(json.candidates?.[0]?.content?.parts);
  const cleaned = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    .trim();

  // Try full JSON parse
  try {
    const obj = JSON.parse(cleaned) as Partial<CloudTriageResult>;
    if (obj.scientificName !== undefined && obj.steps && obj.steps.length > 0) {
      return {
        scientificName: String(obj.scientificName ?? ''),
        commonName: String(obj.commonName ?? 'Unknown'),
        venomous: (['deadly', 'mildly_venomous', 'non_venomous'].includes(obj.venomous ?? '') ? obj.venomous : 'deadly') as CloudTriageResult['venomous'],
        summary: String(obj.summary ?? ''),
        steps: Array.isArray(obj.steps) ? obj.steps : [],
        doNot: Array.isArray(obj.doNot) ? obj.doNot : [],
      };
    }
  } catch { /* fall through */ }

  // Try to extract JSON object substring
  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      const obj = JSON.parse(objMatch[0]) as Partial<CloudTriageResult>;
      if (obj.steps && obj.steps.length > 0) {
        return {
          scientificName: String(obj.scientificName ?? ''),
          commonName: String(obj.commonName ?? 'Unknown'),
          venomous: (['deadly', 'mildly_venomous', 'non_venomous'].includes(obj.venomous ?? '') ? obj.venomous : 'deadly') as CloudTriageResult['venomous'],
          summary: String(obj.summary ?? ''),
          steps: Array.isArray(obj.steps) ? obj.steps : [],
          doNot: Array.isArray(obj.doNot) ? obj.doNot : [],
        };
      }
    } catch { /* fall through */ }
  }

  // Safe fallback — never leave the user without first aid guidance
  return UNKNOWN_FALLBACK;
}
