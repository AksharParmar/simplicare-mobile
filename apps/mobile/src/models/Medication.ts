export type Medication = {
  id: string;
  name: string;
  strength?: string;
  instructions?: string;
  scanText?: string;
  scanSource?: 'pasted' | 'ocr';
  scanCapturedAt?: string;
  createdAt: string;
};
