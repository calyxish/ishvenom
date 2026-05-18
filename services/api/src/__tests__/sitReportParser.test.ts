import { parseSitReportOutput } from '../lib/sitReportParser.js';

const GOOD_OUTPUT = `
## Ghana snakebite situation — week of 2026-03-24

Upper East region reported 42 encounters this week, up 80% from the
four-week rolling baseline. Eighteen were bites; *Echis ocellatus*
remains the dominant species.

Recommendations:
- Pre-position 40 additional vials of ASV in Bawku.
- Alert CHWs in Navrongo to nocturnal *Echis* activity.

\`\`\`json
{
  "totalEncounters": 73,
  "totalBites": 27,
  "hotspots": [
    {
      "district": "Upper East",
      "encounterCount": 42,
      "biteCount": 18,
      "topSpecies": "Echis ocellatus",
      "baselineRatio": 1.8
    }
  ],
  "recommendations": [
    "Pre-position 40 additional vials of ASV in Bawku",
    "Alert CHWs in Navrongo to nocturnal Echis activity"
  ]
}
\`\`\`
`;

test('extracts markdown and structured fields from a well-formed response', () => {
  const parsed = parseSitReportOutput(GOOD_OUTPUT);
  expect(parsed.markdown).toContain('Upper East region reported 42 encounters');
  expect(parsed.structured).not.toBeNull();
  expect(parsed.structured?.totalEncounters).toBe(73);
  expect(parsed.structured?.hotspots).toHaveLength(1);
  expect(parsed.parseWarnings).toEqual([]);
});

test('still returns markdown when JSON fence is missing', () => {
  const noFence = 'Situation is stable across the Ashanti Region.';
  const parsed = parseSitReportOutput(noFence);
  expect(parsed.markdown).toBe(noFence);
  expect(parsed.structured).toBeNull();
  expect(parsed.parseWarnings).toContain('no_json_block');
});

test('tolerates trailing commas in structured block', () => {
  const sloppy = `
Narrative here.

\`\`\`json
{
  "totalEncounters": 10,
  "totalBites": 3,
  "hotspots": [],
  "recommendations": ["watch"],
}
\`\`\`
`;
  const parsed = parseSitReportOutput(sloppy);
  expect(parsed.structured?.totalEncounters).toBe(10);
  expect(parsed.parseWarnings).not.toContain('structured_json_invalid');
});

test('marks schema mismatch without throwing', () => {
  const wrongShape = `
Narrative.

\`\`\`json
{ "this": "has the wrong shape" }
\`\`\`
`;
  const parsed = parseSitReportOutput(wrongShape);
  expect(parsed.structured).toBeNull();
  expect(parsed.parseWarnings).toContain('structured_schema_mismatch');
  expect(parsed.markdown).toContain('Narrative');
});

test('empty input is handled gracefully', () => {
  const parsed = parseSitReportOutput('');
  expect(parsed.markdown).toBe('');
  expect(parsed.structured).toBeNull();
  expect(parsed.parseWarnings).toContain('empty_markdown');
});
