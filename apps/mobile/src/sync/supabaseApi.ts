import type { DoseLog, Medication, Schedule } from '../models';
import { getSupabaseClient } from '../config/supabase';
import type { CloudMedicationLogRow, CloudMedicationRow } from './types';

export function medicationToCloudRow(input: {
  userId: string;
  medication: Medication;
  schedules: Schedule[];
  updatedAt: string;
}): CloudMedicationRow {
  const allTimes = Array.from(new Set(input.schedules.flatMap((schedule) => schedule.times))).sort();
  const firstSchedule = input.schedules[0];

  return {
    id: input.medication.id,
    user_id: input.userId,
    name: input.medication.name,
    strength: input.medication.strength ?? null,
    instructions: input.medication.instructions ?? null,
    dose_times: allTimes,
    timezone: firstSchedule?.timezone ?? null,
    start_date: firstSchedule?.startDate ?? null,
    days_of_week: firstSchedule?.daysOfWeek ?? null,
    scan_text: input.medication.scanText ?? null,
    scan_source: input.medication.scanSource ?? null,
    scan_captured_at: input.medication.scanCapturedAt ?? null,
    created_at: input.medication.createdAt,
    updated_at: input.updatedAt,
    deleted_at: null,
  };
}

export function logToCloudRow(userId: string, log: DoseLog): CloudMedicationLogRow {
  return {
    id: log.id,
    user_id: userId,
    medication_id: log.medicationId,
    scheduled_at: log.scheduledAt,
    status: log.status,
    logged_at: log.loggedAt,
    note: log.note ?? null,
    created_at: log.loggedAt,
    updated_at: log.updatedAt ?? log.loggedAt,
    deleted_at: null,
  };
}

export async function fetchAllMedicationRows(userId: string): Promise<CloudMedicationRow[]> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('medications')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as CloudMedicationRow[];
}

export async function fetchMedicationRowsSince(
  userId: string,
  sinceIso: string,
): Promise<CloudMedicationRow[]> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('medications')
    .select('*')
    .eq('user_id', userId)
    .or(`updated_at.gt.${sinceIso},deleted_at.gt.${sinceIso}`)
    .order('updated_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as CloudMedicationRow[];
}

export async function fetchAllMedicationLogs(userId: string): Promise<CloudMedicationLogRow[]> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('medication_logs')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as CloudMedicationLogRow[];
}

export async function fetchMedicationLogsSince(
  userId: string,
  sinceIso: string,
): Promise<CloudMedicationLogRow[]> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('medication_logs')
    .select('*')
    .eq('user_id', userId)
    .or(`updated_at.gt.${sinceIso},deleted_at.gt.${sinceIso}`)
    .order('updated_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as CloudMedicationLogRow[];
}

export async function upsertMedicationRows(rows: CloudMedicationRow[]): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  const client = getSupabaseClient();
  const { error } = await client.from('medications').upsert(rows, { onConflict: 'id' });
  if (error) {
    throw new Error(error.message);
  }
}

export async function softDeleteMedicationRow(input: {
  userId: string;
  medicationId: string;
  deletedAt: string;
}): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await client
    .from('medications')
    .update({ deleted_at: input.deletedAt, updated_at: input.deletedAt })
    .eq('id', input.medicationId)
    .eq('user_id', input.userId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function upsertMedicationLogs(rows: CloudMedicationLogRow[]): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  const client = getSupabaseClient();
  const { error } = await client.from('medication_logs').upsert(rows, { onConflict: 'id' });
  if (error) {
    throw new Error(error.message);
  }
}
