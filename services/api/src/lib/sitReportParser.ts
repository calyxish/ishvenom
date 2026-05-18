/**
 * Parses raw Gemma output into { markdown, structured? }.
 *
 * Contract (matches buildSitReportPrompt): the model should emit
 *   <markdown narrative>
 *   ```json
 *   { ...structured... }
 *   ```
 *
 * Reality: sometimes the fences are missing, the JSON has a trailing
 * comma, or the model drops a sentence after the fence. This parser is
 * deliberately forgiving — it never throws. Callers that care about
 * structured data check whether `structured` is null.
 */
import {
  SitReportStructuredSchema,
  type SitReportStructured,
} from '@ishvenom/shared-types';

export interface ParsedSitReport {
  markdown: string;
  structured: SitReportStructured | null;
  parseWarnings: string[];
}

const JSON_FENCE_RE = /```(?:json)?\s*\n([\s\S]*?)\n```/i;

export function parseSitReportOutput(raw: string): ParsedSitReport {
  const warnings: string[] = [];
  const text = raw.trim();

  const fenceMatch = text.match(JSON_FENCE_RE);

  let markdown: string;
  let structured: SitReportStructured | null = null;

  if (fenceMatch) {
    markdown = text.slice(0, fenceMatch.index ?? 0).trim();
    structured = tryParseStructured(fenceMatch[1] ?? '', warnings);
  } else {
    // No fenced JSON — look for a trailing { ... } block.
    const lastOpen = text.lastIndexOf('{');
    const lastClose = text.lastIndexOf('}');
    if (lastOpen !== -1 && lastClose > lastOpen) {
      const jsonSlice = text.slice(lastOpen, lastClose + 1);
      const maybe = tryParseStructured(jsonSlice, warnings);
      if (maybe) {
        markdown = text.slice(0, lastOpen).trim();
        structured = maybe;
      } else {
        markdown = text;
        warnings.push('no_json_block');
      }
    } else {
      markdown = text;
      warnings.push('no_json_block');
    }
  }

  if (markdown.length === 0) {
    warnings.push('empty_markdown');
  }

  return { markdown, structured, parseWarnings: warnings };
}

function tryParseStructured(
  raw: string,
  warnings: string[],
): SitReportStructured | null {
  const cleaned = raw
    .trim()
    // strip trailing commas before } or ]
    .replace(/,(\s*[}\]])/g, '$1');
  try {
    const obj = JSON.parse(cleaned);
    const parsed = SitReportStructuredSchema.safeParse(obj);
    if (parsed.success) return parsed.data;
    warnings.push('structured_schema_mismatch');
    return null;
  } catch {
    warnings.push('structured_json_invalid');
    return null;
  }
}
