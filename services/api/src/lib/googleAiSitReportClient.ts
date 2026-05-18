/**
 * Google AI (Gemini API) sit-report client.
 *
 * Conforms to the same shape as the RunPod client in `sitReportClient.ts`:
 *
 *   client.generate({ prompt, maxTokens, temperature, topP, stop })
 *     → { text, latencyMs, model, promptTokens, completionTokens }
 *
 * This is the production fallback when RunPod isn't configured. It only
 * requires GOOGLE_AI_KEY, which the mobile app already uses for snake
 * identification — so no new infrastructure is needed.
 *
 * The model is `gemma-4-26b-a4b-it` — the same Gemma 4 cloud model the
 * mobile Identify/Learn screens hit via `apps/mobile/src/lib/gemma.ts`.
 *
 * Unlike RunPod's queue + poll dance, the Google AI REST endpoint is
 * synchronous — one POST returns the full text. No state machine, no
 * polling loop.
 */
import { z } from 'zod';
import type {
  SitReportClient,
  SitReportGenerateRequest,
  SitReportGenerationResult,
} from './sitReportClient.js';

export interface GoogleAiSitReportClientConfig {
  apiKey: string;
  /** Override default model. */
  model?: string;
  /** Override fetch — used by tests. */
  fetchImpl?: typeof fetch;
  /** Override base URL — used by tests. */
  baseUrl?: string;
  /** Override clock — used by tests. */
  now?: () => number;
}

const DEFAULT_MODEL   = 'gemma-4-26b-a4b-it';
const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

// Minimal Gemini-API response shape — only the parts we care about.
const GeminiResponseSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z
          .object({
            parts: z
              .array(
                z.object({
                  text: z.string().optional(),
                }),
              )
              .optional(),
          })
          .optional(),
        finishReason: z.string().optional(),
      }),
    )
    .optional(),
  usageMetadata: z
    .object({
      promptTokenCount: z.number().optional(),
      candidatesTokenCount: z.number().optional(),
      totalTokenCount: z.number().optional(),
    })
    .optional(),
  error: z
    .object({
      code: z.number().optional(),
      message: z.string().optional(),
      status: z.string().optional(),
    })
    .optional(),
});

export class GoogleAiError extends Error {
  public readonly code: string;
  public readonly status?: number;
  constructor(code: string, message: string, status?: number) {
    super(message);
    this.name = 'GoogleAiError';
    this.code = code;
    if (status !== undefined) this.status = status;
  }
}

export function createGoogleAiSitReportClient(
  config: GoogleAiSitReportClientConfig,
): SitReportClient {
  const fetchImpl = config.fetchImpl ?? fetch;
  const model     = config.model ?? DEFAULT_MODEL;
  const baseUrl   = config.baseUrl ?? DEFAULT_BASE_URL;
  const now       = config.now ?? (() => Date.now());

  async function generate(
    body: SitReportGenerateRequest,
  ): Promise<SitReportGenerationResult> {
    const started = now();

    const url = `${baseUrl}/${model}:generateContent?key=${encodeURIComponent(config.apiKey)}`;

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [{ text: body.prompt }],
        },
      ],
      generationConfig: {
        temperature: body.temperature ?? 0.3,
        topP:        body.topP ?? 0.9,
        maxOutputTokens: body.maxTokens ?? 1200,
        // Gemma is finicky about stop sequences — only pass if explicitly set.
        ...(body.stop && body.stop.length > 0 ? { stopSequences: body.stop } : {}),
      },
    };

    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    const rawJson = await res.json().catch(() => null);
    if (!res.ok) {
      const parsedErr = GeminiResponseSchema.safeParse(rawJson);
      const msg = parsedErr.success
        ? (parsedErr.data.error?.message ?? `Google AI returned ${res.status}`)
        : `Google AI returned ${res.status}`;
      throw new GoogleAiError('http_error', msg, res.status);
    }

    const parsed = GeminiResponseSchema.safeParse(rawJson);
    if (!parsed.success) {
      throw new GoogleAiError(
        'invalid_response',
        'Google AI response did not match expected schema',
      );
    }

    const text = parsed.data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? '')
      .join('')
      .trim();

    if (!text) {
      const finish = parsed.data.candidates?.[0]?.finishReason;
      throw new GoogleAiError(
        'empty_output',
        finish
          ? `Google AI returned empty text (finishReason=${finish})`
          : 'Google AI returned empty text',
      );
    }

    return {
      text,
      latencyMs: now() - started,
      model,
      promptTokens:     parsed.data.usageMetadata?.promptTokenCount     ?? 0,
      completionTokens: parsed.data.usageMetadata?.candidatesTokenCount ?? 0,
    };
  }

  return {
    generate,
    // The shared interface includes `_submit` / `_poll` for the RunPod
    // tests. For Google AI there's no queue, so we expose harmless stubs
    // that go through `generate` so any caller that probed them stays
    // working.
    _submit: async () => {
      throw new GoogleAiError(
        'not_supported',
        '_submit is RunPod-only; use generate() with Google AI client',
      );
    },
    _poll: async () => {
      throw new GoogleAiError(
        'not_supported',
        '_poll is RunPod-only; use generate() with Google AI client',
      );
    },
  };
}
