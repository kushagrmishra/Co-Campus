import { ExtractionData, Flashcard } from '../types';

const LLM_API_KEY = process.env.EXPO_PUBLIC_LLM_API_KEY;
const LLM_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

function sanitizeJsonResponse(rawText: string): string {
    let cleaned = rawText.trim();
    if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    return cleaned;
}

export async function extractStudyMaterial(
    base64Images: string[] | string,
    targetSubject?: string,
    existingExtraction?: ExtractionData
): Promise<ExtractionData> {
    if (!GEMINI_API_KEY) {
        throw new Error('EXPO_PUBLIC_GEMINI_API_KEY is not configured in environment variables.');
    }

    const images = Array.isArray(base64Images) ? base64Images : [base64Images];
    if (images.length === 0) {
        throw new Error('At least one image is required for analysis.');
    }

    const subjectInstruction = targetSubject
        ? `The user has designated the subject folder as: "${targetSubject}". You MUST set the "subject" field strictly to "${targetSubject}".`
        : `Deduce a clear, concise subject (2-4 words, e.g. "Calculus II", "Data Structures", "Organic Chemistry") for folder grouping.`;

    const existingContextInstruction = existingExtraction
        ? `\nNOTE: You are appending new pages/photos to an existing note titled "${existingExtraction.title}" in subject "${existingExtraction.subject}".
Existing summary: "${existingExtraction.generatedNotes}"
Existing topics: ${JSON.stringify(existingExtraction.topics)}
Please merge and synthesize the previous study material with the content from these new images into a cohesive, updated note, keeping existing topics and adding new ones where appropriate.`
        : '';

    const promptText = `
Analyze the ${images.length} provided image(s) of a whiteboard/lecture slides/notebook pages.
${subjectInstruction}
${existingContextInstruction}

Extract structured study content and return ONLY a valid JSON object strictly matching this schema:
{
  "subject": string,          // Subject name for folder grouping
  "title": string,            // Short descriptive title for this note
  "topics": [{ "heading": string, "bullets": string[] }],
  "tasks": [{ "title": string, "dueDate": string | null, "notes": string | null }],
  "rawText": string,          // Best-effort OCR transcript of all images
  "generatedNotes": string    // 150-400 word cohesive, human-readable study summary
}
Constraints:
- Return ONLY the JSON object. Do not wrap in markdown code blocks or add preambles/postscript.
- If no due dates are visible, "dueDate" must be null.
- "generatedNotes" should read like a cohesive written summary, synthesizing all pages, not just a bullet dump.
`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${GEMINI_API_KEY}`;

    const parts: any[] = [{ text: promptText }];
    for (const img of images) {
        parts.push({
            inlineData: {
                mimeType: 'image/jpeg',
                data: img,
            },
        });
    }

    const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [
                {
                    parts,
                },
            ],
            generationConfig: {
                temperature: 0.2,
                responseMimeType: 'application/json',
            },
        }),
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini Vision Request Failed (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const rawContent =
        data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const parsed: ExtractionData = JSON.parse(sanitizeJsonResponse(rawContent));
    if (targetSubject) {
        parsed.subject = targetSubject;
    }
    return parsed;
}

export async function generateFlashcards(extraction: ExtractionData): Promise<Flashcard[]> {
    if (!LLM_API_KEY) {
        throw new Error('EXPO_PUBLIC_LLM_API_KEY is not configured in environment variables.');
    }

    const promptText = `
Based on the following extracted study material, generate at least 10 high-quality flashcards for learning and self-testing.
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

export interface ExtractedExamInfo {
    subject: string;
    examTitle: string;
    examDate: string;
    examTag: string;
}

export async function extractExamFromSyllabus(base64Image: string): Promise<ExtractedExamInfo> {
    if (!GEMINI_API_KEY) {
        throw new Error('EXPO_PUBLIC_GEMINI_API_KEY is not configured in environment variables.');
    }

    const promptText = `
Analyze this syllabus, course schedule, or exam sheet document image.
Detect any upcoming exams, midterms, finals, or major academic tests.
Extract:
1. "subject": The course name or code (e.g. "Automata Theory", "Discrete Mathematics", "Biology 101").
2. "examTitle": Title of the exam (e.g. "Midterm Exam 1", "Final Exam").
3. "examDate": Date of the exam (e.g. "Oct 24", "Nov 12, 2025").
4. "examTag": A concise countdown or date tag (e.g. "Exam in 4 days", "Midterm: Oct 24", or "Finals: Dec 15").

Return ONLY a JSON object:
{
  "subject": string,
  "examTitle": string,
  "examDate": string,
  "examTag": string
}
No preambles, no markdown blocks.
`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${GEMINI_API_KEY}`;

    const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [
                {
                    parts: [
                        { text: promptText },
                        {
                            inlineData: {
                                mimeType: 'image/jpeg',
                                data: base64Image,
                            },
                        },
                    ],
                },
            ],
        }),
    });

    if (!response.ok) {
        throw new Error(`Gemini Syllabus Analysis failed with status ${response.status}`);
    }

    const result = await response.json();
    const candidate = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidate) {
        throw new Error('No response returned from syllabus analysis.');
    }

    const parsed = JSON.parse(sanitizeJsonResponse(candidate));
    return {
        subject: parsed.subject || 'Course Exam',
        examTitle: parsed.examTitle || 'Upcoming Exam',
        examDate: parsed.examDate || 'Scheduled',
        examTag: parsed.examTag || `Exam: ${parsed.examDate || 'Upcoming'}`,
    };
}

export interface MCQQuestion {
    id: string;
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
    level: 'Foundations' | 'Standard' | 'Hard';
    subject: string;
}

const CURATED_MCQS: MCQQuestion[] = [
    // Automata Theory - Foundations
    {
        id: 'at_f_1',
        subject: 'Automata Theory',
        level: 'Foundations',
        question: 'What does DFA stand for in formal language and computation theory?',
        options: [
            'Deterministic Finite Automaton',
            'Dynamic Function Analysis',
            'Direct Formulation Algorithm',
            'Discrete Finite Architecture',
        ],
        correctIndex: 0,
        explanation: 'A DFA is a Deterministic Finite Automaton where every transition is strictly determined by the current state and symbol.',
    },
    {
        id: 'at_f_2',
        subject: 'Automata Theory',
        level: 'Foundations',
        question: 'How many start states can a standard Deterministic Finite Automaton (DFA) possess?',
        options: ['Exactly one (q0)', 'At least two', 'Arbitrary number', 'None if language is empty'],
        correctIndex: 0,
        explanation: 'In the formal 5-tuple (Q, Sigma, delta, q0, F), q0 in Q is the unique designated start state.',
    },
    // Automata Theory - Standard
    {
        id: 'at_s_1',
        subject: 'Automata Theory',
        level: 'Standard',
        question: 'What is the primary scientific purpose of applying the Pumping Lemma in regular languages?',
        options: [
            'To prove a given language is NOT regular by contradiction',
            'To minimize the number of states in a DFA',
            'To convert an NFA into a regular expression',
            'To construct a Pushdown Automaton',
        ],
        correctIndex: 0,
        explanation: 'The Pumping Lemma is a necessary property of regular languages. Showing a language violates it proves non-regularity.',
    },
    {
        id: 'at_s_2',
        subject: 'Automata Theory',
        level: 'Standard',
        question: 'Which machine model is capable of recognizing Context-Free Languages (CFL)?',
        options: [
            'Pushdown Automaton (PDA)',
            'Deterministic Finite Automaton (DFA)',
            'Linear Bounded Automaton',
            'Static Register Machine',
        ],
        correctIndex: 0,
        explanation: 'Pushdown Automata augment finite states with a single LIFO stack, exactly matching Context-Free Grammars.',
    },
    // Automata Theory - Hard
    {
        id: 'at_h_1',
        subject: 'Automata Theory',
        level: 'Hard',
        question: 'For L = {0^n 1^n | n >= 0}, why does pumping s = 0^p 1^p violate the regular pumping lemma?',
        options: [
            'Because y lies in 0^p, pumping y changes the count of 0s without matching 1s',
            'Because the string exceeds maximum machine memory limit',
            'Because the alphabet Sigma contains multiple symbols',
            'Because the empty string is rejected by definition',
        ],
        correctIndex: 0,
        explanation: 'Since |xy| <= p, the pumped substring y consists entirely of 0s. Pumping y^i disrupts the equal 0/1 balance.',
    },
    // Discrete Mathematics - Foundations
    {
        id: 'dm_f_1',
        subject: 'Discrete Mathematics',
        level: 'Foundations',
        question: 'What does the Handshaking Lemma state for an undirected graph G = (V, E)?',
        options: [
            'The sum of all vertex degrees equals 2 * |E|',
            'Every vertex has an even degree',
            'The number of vertices must be greater than edges',
            'The graph must contain at least one cycle',
        ],
        correctIndex: 0,
        explanation: 'Each undirected edge contributes exactly 1 degree to each of its two endpoint vertices, so sum(deg(v)) = 2|E|.',
    },
    {
        id: 'dm_f_2',
        subject: 'Discrete Mathematics',
        level: 'Foundations',
        question: 'What is the cardinality of the power set P(S) of a set with n elements?',
        options: ['2^n', 'n^2', '2n', 'n!'],
        correctIndex: 0,
        explanation: 'Each element has 2 independent choices (included or excluded), giving exactly 2^n distinct subsets.',
    },
    // Discrete Mathematics - Standard
    {
        id: 'dm_s_1',
        subject: 'Discrete Mathematics',
        level: 'Standard',
        question: 'Which three mathematical properties define an Equivalence Relation?',
        options: [
            'Reflexive, Symmetric, and Transitive',
            'Reflexive, Antisymmetric, and Transitive',
            'Irreflexive, Symmetric, and Associative',
            'Symmetric, Commutative, and Invertible',
        ],
        correctIndex: 0,
        explanation: 'An equivalence relation partitions a set and must satisfy reflexivity, symmetry, and transitivity.',
    },
    {
        id: 'dm_s_2',
        subject: 'Discrete Mathematics',
        level: 'Standard',
        question: 'A simple graph G is bipartite if and only if it satisfies which condition?',
        options: [
            'G contains no odd cycles',
            'G has an even number of vertices',
            'G is planar with chromatic number 4',
            'G contains a Hamiltonian cycle',
        ],
        correctIndex: 0,
        explanation: 'König theorem proves that a graph is 2-colorable (bipartite) if and only if every cycle has even length (no odd cycles).',
    },
    // Discrete Mathematics - Hard
    {
        id: 'dm_h_1',
        subject: 'Discrete Mathematics',
        level: 'Hard',
        question: 'Under modular arithmetic, when does an integer a have a multiplicative inverse modulo m?',
        options: [
            'When gcd(a, m) = 1 (a and m are coprime)',
            'When m is an even composite integer',
            'When a > m and m divides a evenly',
            'When a is a prime number greater than 2',
        ],
        correctIndex: 0,
        explanation: 'By Bézout identity, ax + my = gcd(a, m). A solution for ax = 1 (mod m) exists if and only if gcd(a, m) = 1.',
    },
];

export async function generateMCQs(
    subject: string,
    level: 'Foundations' | 'Standard' | 'Hard',
    noteText?: string
): Promise<MCQQuestion[]> {
    // Check if Gemini can generate bespoke MCQs from note context
    if (GEMINI_API_KEY && noteText && noteText.trim().length > 30) {
        try {
            const prompt = `
Generate 4 multiple-choice exam practice questions (MCQ) for the subject "${subject}" at difficulty level "${level}".
Context Notes: "${noteText.substring(0, 1200)}"

Return ONLY a JSON array of questions strictly following this structure:
[
  {
    "question": string,
    "options": [string, string, string, string],
    "correctIndex": number (0 to 3),
    "explanation": string
  }
]
No preambles, no markdown formatting.
`;
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${GEMINI_API_KEY}`;
            const response = await fetch(geminiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.3, responseMimeType: 'application/json' },
                }),
            });
            if (response.ok) {
                const resData = await response.json();
                const rawText = resData.candidates?.[0]?.content?.parts?.[0]?.text;
                if (rawText) {
                    const parsed = JSON.parse(sanitizeJsonResponse(rawText));
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        return parsed.map((item, idx) => ({
                            id: `ai_mcq_${Date.now()}_${idx}`,
                            subject,
                            level,
                            question: item.question,
                            options: item.options || ['A', 'B', 'C', 'D'],
                            correctIndex: typeof item.correctIndex === 'number' ? item.correctIndex : 0,
                            explanation: item.explanation || 'Verified correct choice based on course principles.',
                        }));
                    }
                }
            }
        } catch (e) {
            console.warn('Gemini MCQ generation fallback to curated bank:', e);
        }
    }

    // Filter curated questions by subject & level, or fallback intelligently
    const matching = CURATED_MCQS.filter(
        (q) =>
            (q.subject.toLowerCase().includes(subject.toLowerCase()) ||
                subject.toLowerCase().includes(q.subject.toLowerCase()) ||
                subject === 'All') &&
            q.level === level
    );

    if (matching.length > 0) return matching;

    const bySubject = CURATED_MCQS.filter(
        (q) =>
            q.subject.toLowerCase().includes(subject.toLowerCase()) ||
            subject.toLowerCase().includes(q.subject.toLowerCase()) ||
            subject === 'All'
    );
    if (bySubject.length > 0) return bySubject;

    return CURATED_MCQS;
}

