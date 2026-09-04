import { ExtractionData, Flashcard } from '../types';

const LLM_API_KEY = process.env.EXPO_PUBLIC_LLM_API_KEY;
const LLM_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

function sanitizeJsonResponse(rawText: string): string {
    let cleaned = rawText.trim();
    if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    return cleaned;
}

export async function extractStudyMaterial(base64Image: string): Promise<ExtractionData> {
    if (!LLM_API_KEY) {
        throw new Error('EXPO_PUBLIC_LLM_API_KEY is not configured in environment variables.');
    }

    const promptText = `
Analyze this image of a whiteboard/lecture slide/notes.
Extract structured study content and return ONLY a valid JSON object strictly matching this schema:
{
  "subject": string,          // 2-4 words, used for folder grouping (e.g. "Calculus II", "Data Structures")
  "title": string,            // short title for this note
  "topics": [{ "heading": string, "bullets": string[] }],
  "tasks": [{ "title": string, "dueDate": string | null, "notes": string | null }],
  "rawText": string,          // best-effort OCR transcript
  "generatedNotes": string    // 150-300 word human-readable study summary
}
Constraints:
- Return ONLY the JSON object. Do not wrap in markdown code blocks or add preambles/postscript.
- If no due dates are visible, "dueDate" must be null.
- "generatedNotes" should read like a cohesive written summary, not a bullet dump.
`;

    const response = await fetch(LLM_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${LLM_API_KEY}`,
        },
        body: JSON.stringify({
            model: 'llama-3.1-8b-instant',
            temperature: 0.2,
            messages: [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: promptText },
                        {
                            type: 'image_url',
                            image_url: { url: `data:image/jpeg;base64,${base64Image}` },
                        },
                    ],
                },
            ],
        }),
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`LLM Vision Request Failed (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || '';
    const parsed: ExtractionData = JSON.parse(sanitizeJsonResponse(rawContent));
    return parsed;
}

export async function generateFlashcards(extraction: ExtractionData): Promise<Flashcard[]> {
    if (!LLM_API_KEY) {
        throw new Error('EXPO_PUBLIC_LLM_API_KEY is not configured in environment variables.');
    }

    const promptText = `
Based on the following extracted study material, generate approximately 8 high-quality flashcards for learning and self-testing.
Return ONLY a JSON object matching this schema:
{ "flashcards": [{ "question": string, "answer": string }] }

No preambles, no markdown fences.

Extracted Data:
${JSON.stringify(extraction)}
`;

    try {
        const response = await fetch(LLM_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${LLM_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'llama-3.1-8b-instant',
                temperature: 0.3,
                messages: [{ role: 'user', content: promptText }],
            }),
        });

        if (!response.ok) {
            throw new Error(`LLM Flashcard Request Failed with status ${response.status}`);
        }

        const data = await response.json();
        const rawContent = data.choices?.[0]?.message?.content || '';
        const parsed = JSON.parse(sanitizeJsonResponse(rawContent));
        return parsed.flashcards || [];
    } catch (err) {
        console.warn('Flashcard generation failed, gracefully falling back to empty list:', err);
        return [];
    }
}