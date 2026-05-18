/**
 * formatResponse — lightweight markdown parser for Gemma's chat output.
 *
 * Supported syntax:
 *   ## Section heading    → large bold section title
 *   ### Sub-heading       → smaller bold sub-title
 *   **bold text**         → bold inline
 *   1. 2. 3.              → numbered list items
 *   blank line            → paragraph break
 *
 * Also strips Gemma 4's chain-of-thought reasoning block (lines starting
 * with * or indented *) before parsing.
 *
 * Returns structured data — zero React Native imports — fully testable.
 */

// ─── Strip thinking ───────────────────────────────────────────────────────────

/**
 * Gemma 4 prepends chain-of-thought as lines starting with * or `    *`.
 * Discard everything up to and including the last such line.
 */
export function stripThinking(raw: string): string {
  const lines = raw.split('\n');
  let lastThinkingLine = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*\*/.test(lines[i] ?? '')) {
      lastThinkingLine = i;
    }
  }
  if (lastThinkingLine === -1) return raw.trim();
  return lines.slice(lastThinkingLine + 1).join('\n').trim();
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InlinePart {
  text: string;
  bold: boolean;
}

export type Block =
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'paragraph'; parts: InlinePart[] }
  | { type: 'numbered'; number: number; parts: InlinePart[] };

// ─── Parser ───────────────────────────────────────────────────────────────────

export function parseMarkdown(raw: string): Block[] {
  const lines = raw.replace(/\r\n/g, '\n').trim().split('\n');
  const blocks: Block[] = [];
  const paraBuffer: string[] = [];

  function flushParagraph() {
    const text = paraBuffer.join(' ').trim();
    paraBuffer.length = 0;
    if (text) blocks.push({ type: 'paragraph', parts: parseInline(text) });
  }

  for (const line of lines) {
    const trimmed = line.trim();

    // ## Section heading
    if (trimmed.startsWith('## ')) {
      flushParagraph();
      blocks.push({ type: 'h2', text: trimmed.slice(3).trim() });
      continue;
    }

    // ### Sub-heading
    if (trimmed.startsWith('### ')) {
      flushParagraph();
      blocks.push({ type: 'h3', text: trimmed.slice(4).trim() });
      continue;
    }

    // Numbered list item: "1. text"
    const numbered = /^(\d+)\.\s+(.+)$/.exec(trimmed);
    if (numbered) {
      flushParagraph();
      blocks.push({
        type: 'numbered',
        number: parseInt(numbered[1] ?? '0', 10),
        parts: parseInline(numbered[2] ?? ''),
      });
      continue;
    }

    // Dash bullet "- text" → paragraph (model sometimes uses these despite instructions)
    if (trimmed.startsWith('- ')) {
      flushParagraph();
      blocks.push({ type: 'paragraph', parts: parseInline(trimmed.slice(2)) });
      continue;
    }

    // Empty line → paragraph break
    if (!trimmed) {
      flushParagraph();
      continue;
    }

    paraBuffer.push(trimmed);
  }

  flushParagraph();
  return blocks;
}

// ─── Inline bold parser ───────────────────────────────────────────────────────

function parseInline(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    if (match.index > cursor) {
      parts.push({ text: text.slice(cursor, match.index), bold: false });
    }
    parts.push({ text: match[1] ?? '', bold: true });
    cursor = re.lastIndex;
  }

  if (cursor < text.length) {
    parts.push({ text: text.slice(cursor), bold: false });
  }

  return parts.length ? parts : [{ text, bold: false }];
}
