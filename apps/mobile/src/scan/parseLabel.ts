export type ParsedLabelResult = {
  nameCandidate: string;
  strengthCandidate?: string;
  instructionsCandidate?: string;
  timesSuggested: string[];
};

const strengthRegex = /(\b\d+(?:\.\d+)?\s?(?:mg|mcg|g|ml|units?)\b)/i;
const instructionRegex = /(take|once|twice|daily|with food|every|bedtime|morning|evening)/i;

function normalizeLines(rawText: string): string[] {
  return rawText
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/\s+/g, ' '))
    .filter((line) => line.length > 0);
}

function chooseNameLine(lines: string[]): string {
  const ignored = /^(rx|qty|lot|exp|refill|directions?)\b/i;
  const candidate = lines.find((line) => !ignored.test(line));
  return candidate ?? 'Medication';
}

function chooseInstructions(lines: string[]): string | undefined {
  return lines.find((line) => instructionRegex.test(line));
}

function inferTimes(rawText: string): string[] {
  const source = rawText.toLowerCase();

  if (
    source.includes('twice daily') ||
    source.includes('2 times daily') ||
    source.includes('every 12 hours') ||
    source.includes('morning and evening')
  ) {
    return ['08:00', '20:00'];
  }

  if (
    source.includes('once daily') ||
    source.includes('once a day') ||
    source.includes('daily')
  ) {
    return ['09:00'];
  }

  if (source.includes('bedtime')) {
    return ['21:00'];
  }

  return ['09:00'];
}

export function parseLabelText(rawText: string): ParsedLabelResult {
  const lines = normalizeLines(rawText);
  const bestNameLine = chooseNameLine(lines);
  const strengthMatch = rawText.match(strengthRegex)?.[1];

  const nameCandidate = strengthMatch
    ? bestNameLine.replace(strengthRegex, '').replace(/[-,]+\s*$/, '').trim() || 'Medication'
    : bestNameLine;

  return {
    nameCandidate,
    strengthCandidate: strengthMatch,
    instructionsCandidate: chooseInstructions(lines),
    timesSuggested: inferTimes(rawText),
  };
}
