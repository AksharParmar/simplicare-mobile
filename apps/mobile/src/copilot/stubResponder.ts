function normalize(text: string): string {
  return text.trim().toLowerCase();
}

export function getStubCopilotResponse(input: string): string {
  const text = normalize(input);

  if (text.includes('side effect') || text.includes('side effects')) {
    return 'I can share general safety guidance: check your medication label and speak with your doctor or pharmacist for side effects specific to you. If symptoms feel urgent, seek care right away.';
  }

  if (text.includes('when should i take') || text.includes('when do i take') || text.includes('when to take')) {
    return 'A safe default is to follow your saved schedule and label instructions. Open your medication details to confirm time-of-day guidance and food instructions.';
  }

  return 'I can help once connected to medication label data. For now, I can help you log doses and review schedules.';
}
