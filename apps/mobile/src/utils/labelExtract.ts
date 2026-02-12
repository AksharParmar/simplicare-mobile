export type ConfidenceLevel = 'low' | 'med' | 'high';

export type LabelExtractResult = {
  nameCandidate?: string;
  strengthCandidate?: string;
  instructionsCandidate?: string;
  confidence: {
    name: ConfidenceLevel;
    strength: ConfidenceLevel;
    instructions: ConfidenceLevel;
  };
  cleanedText: string;
};

const NOISE_KEYWORDS = [
  'RX ONLY',
  'NDC',
  'LOT',
  'EXP',
  'REFILL',
  'PRESCRIBED',
  'TABLETS',
  'CAPSULES',
  'DIRECTIONS',
  'WARNING',
  'KEEP OUT',
  'STORE',
  'MFG',
  'PHARMACY',
];

const INSTRUCTION_HINTS = [
  'take',
  'once',
  'daily',
  'twice',
  'every',
  'by mouth',
  'with food',
  'at bedtime',
  'as needed',
];

const STRENGTH_PATTERN = /\b\d+(?:\.\d+)?\s?(?:mg|mcg|g|ml|mL|IU)\b/gi;

function cleanLine(line: string): string {
  return line.replace(/\s+/g, ' ').trim();
}

function splitLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map(cleanLine)
    .filter(Boolean);
}

function scoreNameLine(line: string): number {
  const upper = line.toUpperCase();
  const tokenCount = line.split(/\s+/).length;

  let score = 0;

  if (tokenCount >= 1 && tokenCount <= 4) {
    score += 3;
  }

  if (line.length >= 3 && line.length <= 40) {
    score += 2;
  }

  if (/^[A-Za-z][A-Za-z0-9\-\s]+$/.test(line)) {
    score += 2;
  }

  if (/^[A-Z][a-z]/.test(line)) {
    score += 2;
  }

  if (/\d/.test(line)) {
    score -= 2;
  }

  if (NOISE_KEYWORDS.some((keyword) => upper.includes(keyword))) {
    score -= 6;
  }

  return score;
}

function getNameCandidate(lines: string[]): { value?: string; confidence: ConfidenceLevel } {
  if (lines.length === 0) {
    return { confidence: 'low' };
  }

  const scored = lines.map((line, index) => ({ line, score: scoreNameLine(line), index }));
  scored.sort((a, b) => b.score - a.score || a.index - b.index);

  const best = scored[0];
  const second = scored[1];

  if (!best || best.score <= 0) {
    return { confidence: 'low' };
  }

  const confidence: ConfidenceLevel =
    best.score >= 6 && (!second || best.score - second.score >= 2) ? 'high' : 'med';

  return {
    value: best.line.replace(STRENGTH_PATTERN, '').trim() || best.line,
    confidence,
  };
}

function getStrengthCandidate(lines: string[]): { value?: string; confidence: ConfidenceLevel } {
  const allMatches: Array<{ value: string; lineIndex: number }> = [];

  lines.forEach((line, lineIndex) => {
    const matches = line.match(STRENGTH_PATTERN);
    if (!matches) {
      return;
    }

    matches.forEach((match) => {
      allMatches.push({ value: match.trim(), lineIndex });
    });
  });

  if (allMatches.length === 0) {
    return { confidence: 'low' };
  }

  if (allMatches.length > 1) {
    return { value: allMatches[0].value, confidence: 'low' };
  }

  const match = allMatches[0];
  const nearbyName = match.lineIndex <= 2;

  return {
    value: match.value,
    confidence: nearbyName ? 'high' : 'med',
  };
}

function getInstructionsCandidate(lines: string[]): { value?: string; confidence: ConfidenceLevel } {
  const match = lines.find((line) => {
    const lower = line.toLowerCase();
    return INSTRUCTION_HINTS.some((keyword) => lower.includes(keyword));
  });

  if (!match) {
    return { confidence: 'low' };
  }

  const lower = match.toLowerCase();
  const hasTake = lower.includes('take');
  const hasFrequency = /\b(once|twice|daily|every)\b/.test(lower);

  const confidence: ConfidenceLevel = hasTake && hasFrequency ? 'high' : 'med';

  return { value: match, confidence };
}

export function normalizeOcrText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(cleanLine)
    .filter(Boolean)
    .join('\n');
}

export function extractLabelCandidates(rawText: string): LabelExtractResult {
  const cleanedText = normalizeOcrText(rawText);
  const lines = splitLines(cleanedText);

  const name = getNameCandidate(lines);
  const strength = getStrengthCandidate(lines);
  const instructions = getInstructionsCandidate(lines);

  return {
    nameCandidate: name.value,
    strengthCandidate: strength.value,
    instructionsCandidate: instructions.value,
    confidence: {
      name: name.confidence,
      strength: strength.confidence,
      instructions: instructions.confidence,
    },
    cleanedText,
  };
}
