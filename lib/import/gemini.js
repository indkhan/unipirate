import 'server-only';

// Gemini fallback for fields the regex pass missed, plus a wording-only
// coherence pass for checklists. Hard rules:
//  - LLM values must be VERBATIM substrings of the paste (the same substring
//    gate re-validates them after this call — anything else is dropped).
//  - Anything extra the model noticed goes to llm_extra, never into facts.
//  - No key / any failure → null, and the import proceeds regex-only.

const MODEL = 'gemini-3.5-flash';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const TIMEOUT_MS = 20_000;

export const geminiEnabled = () => !!process.env.GEMINI_API_KEY;

async function callGemini(prompt, responseSchema) {
  if (!geminiEnabled()) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema,
          temperature: 0,
        },
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error('[gemini] HTTP', res.status, await res.text().catch(() => ''));
      return null;
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return text ? JSON.parse(text) : null;
  } catch (e) {
    console.error('[gemini] failed:', e.message || e);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const FIELD_DESCRIPTIONS = {
  course_name: 'the name of the study programme/course',
  uni_name: 'the full name of the university or institution',
  city: 'the city where the course is located',
  degree: 'the degree awarded (e.g. "Master of Science in …")',
  language: 'the teaching language',
  fulltime: 'full-time or part-time',
  duration: 'the programme duration (e.g. "4 semesters")',
  semester: 'when the programme begins (e.g. "Winter semester")',
  application_deadline: 'the application deadline',
  admission_requirements: 'the academic admission requirements',
  language_requirements: 'the language requirements',
  submit_to: 'where/how to submit the application',
  tuition: 'tuition fees per semester',
  semester_contribution: 'the semester contribution amount',
  summary: 'the programme description/content',
};

// Extract the listed missing fields from the raw paste. Returns
// { fields: {key: string|null}, extra: string|null } or null on failure.
export async function extractFieldsLLM(rawText, missingKeys) {
  const keys = missingKeys.filter((k) => FIELD_DESCRIPTIONS[k]);
  if (!keys.length) return null;

  const fieldLines = keys.map((k) => `- "${k}": ${FIELD_DESCRIPTIONS[k]}`).join('\n');
  const prompt = `You extract facts from a pasted university course web page.

Find these fields:
${fieldLines}

STRICT RULES:
1. Every value must be a VERBATIM substring copied character-for-character from the page text. Do not paraphrase, translate, reformat, or summarize.
2. If a field is not present in the text, return null for it. Never guess.
3. In "extra", you may note (in your own words) anything important about applying that the fields above do not capture, or null if nothing.

PAGE TEXT:
${rawText.slice(0, 100_000)}`;

  const properties = Object.fromEntries(
    keys.map((k) => [k, { type: 'string', nullable: true }])
  );
  const schema = {
    type: 'object',
    properties: {
      fields: { type: 'object', properties },
      extra: { type: 'string', nullable: true },
    },
    required: ['fields'],
  };

  const out = await callGemini(prompt, schema);
  if (!out || typeof out.fields !== 'object') return null;
  return { fields: out.fields, extra: out.extra ?? null };
}
