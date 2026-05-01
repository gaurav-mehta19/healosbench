import type Anthropic from "@anthropic-ai/sdk";

export const extractionTool: Anthropic.Tool = {
  name: "extract_clinical_data",
  description:
    "Extract structured clinical data from a doctor-patient transcript. Use ONLY information explicitly present in the transcript.",
  input_schema: {
    type: "object" as const,
    additionalProperties: false,
    required: ["chief_complaint", "vitals", "medications", "diagnoses", "plan", "follow_up"],
    properties: {
      chief_complaint: {
        type: "string",
        minLength: 1,
        description: "The patient's primary reason for the visit.",
      },
      vitals: {
        type: "object",
        additionalProperties: false,
        required: ["bp", "hr", "temp_f", "spo2"],
        properties: {
          bp: {
            type: ["string", "null"],
            description: 'Blood pressure as "systolic/diastolic", e.g. "128/82". Null if not mentioned.',
          },
          hr: {
            type: ["integer", "null"],
            description: "Heart rate in bpm. Null if not mentioned.",
          },
          temp_f: {
            type: ["number", "null"],
            description: "Temperature in Fahrenheit. Null if not mentioned.",
          },
          spo2: {
            type: ["integer", "null"],
            description: "Oxygen saturation percent. Null if not mentioned.",
          },
        },
      },
      medications: {
        type: "array",
        description: "Medications discussed in the encounter.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "dose", "frequency", "route"],
          properties: {
            name: { type: "string", minLength: 1 },
            dose: { type: ["string", "null"] },
            frequency: { type: ["string", "null"] },
            route: {
              type: ["string", "null"],
              description: "e.g. PO, IV, IM, topical, inhaled. Null if not specified.",
            },
          },
        },
      },
      diagnoses: {
        type: "array",
        description: "Working or confirmed diagnoses.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["description"],
          properties: {
            description: { type: "string", minLength: 1 },
            icd10: {
              type: "string",
              description: "ICD-10-CM code if you can determine it with confidence, e.g. J06.9",
            },
          },
        },
      },
      plan: {
        type: "array",
        description: "Plan items as concise free-text statements.",
        items: { type: "string", minLength: 1 },
      },
      follow_up: {
        type: "object",
        additionalProperties: false,
        required: ["interval_days", "reason"],
        properties: {
          interval_days: {
            type: ["integer", "null"],
            description: "Days until follow-up. Null if no specific interval given.",
          },
          reason: {
            type: ["string", "null"],
            description: "Reason for follow-up. Null if no follow-up scheduled.",
          },
        },
      },
    },
  },
};
