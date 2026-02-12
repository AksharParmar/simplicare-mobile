export type ConfidenceLevel = 'low' | 'med' | 'high';

export type LabelExtractResult = {
  nameCandidate?: string;
  strengthCandidate?: string;
  instructionsCandidate?: string;
  timesSuggested: string[];
  confidence: {
    name: ConfidenceLevel;
    strength: ConfidenceLevel;
    instructions: ConfidenceLevel;
  };
};

const STRENGTH_REGEX = /\b\d+(?:\.\d+)?\s?(?:mg|mcg|g|ml|mL|IU)\b/i;
const INSTRUCTIONS_REGEX =
  /\b(take|once|twice|daily|every|by mouth|with food|at bedtime)\b/i;
const EXCLUDED_NAME_WORDS =
  /\b(tablets?|capsules?|rx only|ndc|lot|exp|qty|refill|directions?)\b/i;

function normalizeLines(rawText: string): string[] {
  return rawText
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/\s+/g, ' '))
    .filter(Boolean);
}

function selectStrength(rawText: string): { value?: string; confidence: ConfidenceLevel } {
  const match = rawText.match(STRENGTH_REGEX)?.[0];
  if (!match) {
    return { confidence: 'low' };
  }

  return { value: match, confidence: 'high' };
}

function selectName(lines: string[]): { value?: string; confidence: ConfidenceLevel } {
  if (lines.length === 0) {
    return { confidence: 'low' };
  }

  const primary = lines.slice(0, 3).find((line) => !EXCLUDED_NAME_WORDS.test(line));
  if (!primary) {
    return { confidence: 'low' };
  }

  const cleaned = primary.replace(STRENGTH_REGEX, '').trim();
  if (!cleaned) {
    return { confidence: 'low' };
  }

  if (cleaned.length <= 2) {
    return { value: cleaned, confidence: 'low' };
  }

  return { value: cleaned, confidence: lines[0] === primary ? 'high' : 'med' };
}

function selectInstructions(lines: string[]): { value?: string; confidence: ConfidenceLevel } {
  const matched = lines.find((line) => INSTRUCTIONS_REGEX.test(line));
  if (!matched) {
    return { confidence: 'low' };
  }

  const confidence: ConfidenceLevel =
    /\b(twice daily|once daily|every\s+\d+\s+hours)\b/i.test(matched) ? 'high' : 'med';

  return { value: matched, confidence };
}

function suggestTimes(rawText: string): string[] {
  const source = rawText.toLowerCase();

  if (
    source.includes('twice daily') ||
    source.includes('2 times daily') ||
    source.includes('every 12 hours')
  ) {
    return ['08:00', '20:00'];
  }

  if (source.includes('once daily') || source.includes('once a day') || source.includes('daily')) {
    return ['09:00'];
  }

  return [];
}

export function extractLabelFields(rawText: string): LabelExtractResult {
  const lines = normalizeLines(rawText);
  const name = selectName(lines);
  const strength = selectStrength(rawText);
  const instructions = selectInstructions(lines);

  return {
    nameCandidate: name.value,
    strengthCandidate: strength.value,
    instructionsCandidate: instructions.value,
    timesSuggested: suggestTimes(rawText),
    confidence: {
      name: name.confidence,
      strength: strength.confidence,
      instructions: instructions.confidence,
    },
  };
}
