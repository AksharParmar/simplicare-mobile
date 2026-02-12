import type { DoseLogStatus } from '../models';

export type CloudMedicationRow = {
  id: string;
  user_id: string;
  name: string;
  strength: string | null;
  instructions: string | null;
  dose_times: string[];
  timezone: string | null;
  start_date: string | null;
  days_of_week: number[] | null;
  scan_text: string | null;
  scan_source: 'pasted' | 'ocr' | null;
  scan_captured_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type CloudMedicationLogRow = {
  id: string;
  user_id: string;
  medication_id: string;
  scheduled_at: string;
  status: DoseLogStatus;
  logged_at: string;
  note: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};
