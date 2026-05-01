import type { ClinicalExtraction, FieldScores, MedScore, VitalsScore } from "@test-evals/shared";

// ---- String normalization and fuzzy matching ----

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenize(s: string): string[] {
  return normalize(s).split(" ").filter(Boolean);
}

function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(tokenize(a));
  const setB = new Set(tokenize(b));
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;
  const intersection = [...setA].filter((x) => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size;
  return intersection / union;
}

function fuzzyMatch(a: string, b: string, threshold = 0.3): boolean {
  return jaccardSimilarity(a, b) >= threshold;
}

// ---- Frequency normalization ----

const FREQ_MAP: Record<string, string> = {
  bid: "twice daily",
  "b.i.d": "twice daily",
  "twice a day": "twice daily",
  "2x daily": "twice daily",
  qd: "once daily",
  "q day": "once daily",
  "once a day": "once daily",
  "1x daily": "once daily",
  qid: "four times daily",
  "q.i.d": "four times daily",
  "four times a day": "four times daily",
  "4x daily": "four times daily",
  tid: "three times daily",
  "t.i.d": "three times daily",
  "three times a day": "three times daily",
  "3x daily": "three times daily",
  prn: "as needed",
  "as needed": "as needed",
  "q6h": "every 6 hours",
  "every 6h": "every 6 hours",
  "q8h": "every 8 hours",
  "every 8h": "every 8 hours",
  "q12h": "every 12 hours",
  "every 12h": "every 12 hours",
};

function normalizeFrequency(f: string | null): string {
  if (!f) return "";
  const n = normalize(f);
  for (const [key, val] of Object.entries(FREQ_MAP)) {
    if (n === key || n.includes(key)) return val;
  }
  return n;
}

function normalizeDose(d: string | null): string {
  if (!d) return "";
  return normalize(d).replace(/\s+/g, "");
}

// ---- Chief complaint ----

function scoreChiefComplaint(pred: string, gold: string): number {
  return jaccardSimilarity(pred, gold);
}

// ---- Vitals ----

function scoreVitals(pred: ClinicalExtraction["vitals"], gold: ClinicalExtraction["vitals"]): VitalsScore {
  function matchBp(a: string | null, b: string | null): number {
    if (a === null && b === null) return 1;
    if (a === null || b === null) return 0;
    return a.trim() === b.trim() ? 1 : 0;
  }
  function matchNum(a: number | null, b: number | null, tol = 0): number {
    if (a === null && b === null) return 1;
    if (a === null || b === null) return 0;
    return Math.abs(a - b) <= tol ? 1 : 0;
  }

  const bp = matchBp(pred.bp, gold.bp);
  const hr = matchNum(pred.hr, gold.hr, 0);
  const temp_f = matchNum(pred.temp_f, gold.temp_f, 0.2);
  const spo2 = matchNum(pred.spo2, gold.spo2, 0);
  return { bp, hr, temp_f, spo2, average: (bp + hr + temp_f + spo2) / 4 };
}

// ---- Set F1 helper ----

function setF1<T>(
  preds: T[],
  golds: T[],
  matches: (a: T, b: T) => boolean,
): MedScore {
  if (preds.length === 0 && golds.length === 0) {
    return { precision: 1, recall: 1, f1: 1 };
  }
  if (preds.length === 0) return { precision: 1, recall: 0, f1: 0 };
  if (golds.length === 0) return { precision: 0, recall: 1, f1: 0 };

  const goldMatched = new Set<number>();
  let truePos = 0;

  for (const pred of preds) {
    for (let gi = 0; gi < golds.length; gi++) {
      if (!goldMatched.has(gi) && matches(pred, golds[gi]!)) {
        truePos++;
        goldMatched.add(gi);
        break;
      }
    }
  }

  const precision = truePos / preds.length;
  const recall = truePos / golds.length;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  return { precision, recall, f1 };
}

// ---- Medications ----

function medsMatch(
  a: ClinicalExtraction["medications"][0],
  b: ClinicalExtraction["medications"][0],
): boolean {
  const nameMatch = fuzzyMatch(a.name, b.name, 0.4);
  const doseMatch = normalizeDose(a.dose) === normalizeDose(b.dose);
  const freqMatch = normalizeFrequency(a.frequency) === normalizeFrequency(b.frequency);
  return nameMatch && doseMatch && freqMatch;
}

function scoreMedications(
  pred: ClinicalExtraction["medications"],
  gold: ClinicalExtraction["medications"],
): MedScore {
  return setF1(pred, gold, medsMatch);
}

// ---- Diagnoses ----

function diagnosesMatch(
  a: ClinicalExtraction["diagnoses"][0],
  b: ClinicalExtraction["diagnoses"][0],
): boolean {
  const descMatch = fuzzyMatch(a.description, b.description, 0.3);
  return descMatch;
}

function scoreDiagnoses(
  pred: ClinicalExtraction["diagnoses"],
  gold: ClinicalExtraction["diagnoses"],
): MedScore {
  const base = setF1(pred, gold, diagnosesMatch);

  // Bonus credit for matching ICD-10 codes
  const goldMatched = new Set<number>();
  let icdBonus = 0;
  for (const p of pred) {
    if (!p.icd10) continue;
    for (let gi = 0; gi < gold.length; gi++) {
      const g = gold[gi]!;
      if (!goldMatched.has(gi) && g.icd10 && p.icd10 === g.icd10) {
        icdBonus++;
        goldMatched.add(gi);
        break;
      }
    }
  }
  const total = Math.max(pred.length, gold.length, 1);
  const bonus = (icdBonus / total) * 0.1;

  return {
    ...base,
    f1: Math.min(1, base.f1 + bonus),
  };
}

// ---- Plan ----

function scorePlan(pred: string[], gold: string[]): MedScore {
  return setF1(
    pred,
    gold,
    (a, b) => fuzzyMatch(a, b, 0.3),
  );
}

// ---- Follow-up ----

function scoreFollowUp(
  pred: ClinicalExtraction["follow_up"],
  gold: ClinicalExtraction["follow_up"],
): number {
  const intervalScore =
    pred.interval_days === gold.interval_days ? 1 : 0;

  let reasonScore = 0;
  if (pred.reason === null && gold.reason === null) {
    reasonScore = 1;
  } else if (pred.reason !== null && gold.reason !== null) {
    reasonScore = jaccardSimilarity(pred.reason, gold.reason);
  }

  return (intervalScore + reasonScore) / 2;
}

// ---- Main evaluator ----

export function evaluateCase(
  prediction: ClinicalExtraction,
  gold: ClinicalExtraction,
): FieldScores {
  const chiefComplaint = scoreChiefComplaint(prediction.chief_complaint, gold.chief_complaint);
  const vitals = scoreVitals(prediction.vitals, gold.vitals);
  const medications = scoreMedications(prediction.medications, gold.medications);
  const diagnoses = scoreDiagnoses(prediction.diagnoses, gold.diagnoses);
  const plan = scorePlan(prediction.plan, gold.plan);
  const followUp = scoreFollowUp(prediction.follow_up, gold.follow_up);

  const overall =
    (chiefComplaint + vitals.average + medications.f1 + diagnoses.f1 + plan.f1 + followUp) / 6;

  return {
    chief_complaint: chiefComplaint,
    vitals,
    medications,
    diagnoses,
    plan,
    follow_up: followUp,
    overall,
  };
}

export function aggregateFieldScores(scores: FieldScores[]): {
  chief_complaint: number;
  vitals: number;
  medications: number;
  diagnoses: number;
  plan: number;
  follow_up: number;
  overall: number;
} {
  if (scores.length === 0) {
    return { chief_complaint: 0, vitals: 0, medications: 0, diagnoses: 0, plan: 0, follow_up: 0, overall: 0 };
  }
  const sum = scores.reduce(
    (acc, s) => ({
      chief_complaint: acc.chief_complaint + s.chief_complaint,
      vitals: acc.vitals + s.vitals.average,
      medications: acc.medications + s.medications.f1,
      diagnoses: acc.diagnoses + s.diagnoses.f1,
      plan: acc.plan + s.plan.f1,
      follow_up: acc.follow_up + s.follow_up,
      overall: acc.overall + s.overall,
    }),
    { chief_complaint: 0, vitals: 0, medications: 0, diagnoses: 0, plan: 0, follow_up: 0, overall: 0 },
  );
  const n = scores.length;
  return {
    chief_complaint: sum.chief_complaint / n,
    vitals: sum.vitals / n,
    medications: sum.medications / n,
    diagnoses: sum.diagnoses / n,
    plan: sum.plan / n,
    follow_up: sum.follow_up / n,
    overall: sum.overall / n,
  };
}

// Re-export for use in tests
export { jaccardSimilarity, fuzzyMatch, normalizeDose, normalizeFrequency, medsMatch, setF1 };
