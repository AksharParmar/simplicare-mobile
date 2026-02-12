export type DoseLogStatus = 'taken' | 'skipped' | 'late';

export type DoseLog = {
  id: string;
  medicationId: string;
  scheduledAt: string;
  status: DoseLogStatus;
  loggedAt: string;
  updatedAt?: string;
  note?: string;
};
