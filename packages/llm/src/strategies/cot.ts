import type Anthropic from "@anthropic-ai/sdk";

export const COT_SYSTEM = `You are a clinical data extraction assistant. Given a doctor-patient encounter transcript, extract structured clinical information using the extract_clinical_data tool.

Before calling the tool, think step by step through the transcript:
1. CHIEF COMPLAINT: What is the patient's primary reason for the visit? Use their words or a brief clinical paraphrase.
2. VITALS: Scan for any numbers in brackets or mentioned explicitly (BP, HR, Temp, SpO2). Only record what is stated; null otherwise.
3. MEDICATIONS: List every drug mentioned — name, dose, frequency, route. Normalize frequencies (BID = twice daily, QID = four times daily, PRN = as needed). Route defaults to PO.
4. DIAGNOSES: What does the doctor conclude? Include ICD-10 only if confident.
5. PLAN: List each discrete action item. One action per item.
6. FOLLOW-UP: Is a return visit or timeline mentioned? Convert to days (e.g., "2 weeks" = 14 days).

Rules:
- Do NOT hallucinate values. If information is absent, use null.
- Grounding check: every value you extract should have explicit textual support in the transcript.
- After your reasoning, call extract_clinical_data with the structured result.`;

export function buildCotSystem(): Anthropic.TextBlockParam[] {
  return [
    {
      type: "text",
      text: COT_SYSTEM,
      cache_control: { type: "ephemeral" },
    },
  ];
}

export function buildCotMessages(transcript: string): Anthropic.MessageParam[] {
  return [
    {
      role: "user",
      content: `Please reason through the following transcript step by step, then call the extract_clinical_data tool with your findings.\n\n${transcript}`,
    },
  ];
}
