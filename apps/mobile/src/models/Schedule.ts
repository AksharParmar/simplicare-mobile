export type Schedule = {
  id: string;
  medicationId: string;
  times: string[];
  timezone: string;
  startDate: string;
  daysOfWeek?: number[];
  createdAt: string;
  updatedAt?: string;
};
