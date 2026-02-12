export type LabelOcrSample = {
  id: string;
  label: string;
  text: string;
};

export const LABEL_OCR_SAMPLES: LabelOcrSample[] = [
  {
    id: 'metformin_rx',
    label: 'Metformin bottle',
    text: `METFORMIN HCL 500 mg\nTake one tablet twice daily with food\nRx only\nNDC 00123-456-78\nLOT A112`,
  },
  {
    id: 'lisinopril_once',
    label: 'Lisinopril once daily',
    text: `Lisinopril 10 mg\nTake 1 tablet by mouth once daily\nStore at room temperature`,
  },
  {
    id: 'levothyroxine',
    label: 'Levothyroxine',
    text: `Levothyroxine Sodium 50 mcg\nTake one tablet daily before breakfast\nRefill 2`,
  },
  {
    id: 'vitamin_d',
    label: 'Vitamin D supplement',
    text: `Vitamin D3\n125 mcg (5000 IU) softgels\nTake one daily with food`,
  },
  {
    id: 'ibuprofen',
    label: 'Ibuprofen PRN',
    text: `IBUPROFEN 200 mg\nTake 1-2 tablets every 6 hours as needed\nKeep out of reach of children`,
  },
  {
    id: 'amoxicillin',
    label: 'Amoxicillin course',
    text: `Amoxicillin 500mg Capsules\nTake one capsule by mouth three times daily\nFinish all medication`,
  },
];
