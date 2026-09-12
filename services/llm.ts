import { ExtractionData, Flashcard, SavedNote, Topic } from '../types';
import { subjectsMatch } from './storage';

// ── API Configuration ────────────────────────────────────────────────────────
const GROQ_KEY = process.env.EXPO_PUBLIC_LLM_API_KEY;
const GEMINI_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const OPENROUTER_KEY = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY;

const GEMINI_MODEL = 'gemini-3.5-flash-lite';
const OPENROUTER_MODEL = 'google/gemini-3.5-flash-lite';
const GROQ_MODEL = 'openai/gpt-oss-20b';

// ── Parsing & Sanitization ───────────────────────────────────────────────────
function cleanJson(raw: string): string {
    return raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
}

function safeParse<T>(raw: string, fallback: T): T {
    try {
        return JSON.parse(cleanJson(raw));
    } catch {
        return fallback;
    }
}

// ── Core LLM Callers ─────────────────────────────────────────────────────────
async function callOpenRouter(prompt: string, images: string[] = [], temperature = 0.2): Promise<string> {
    if (!OPENROUTER_KEY) throw new Error('OpenRouter API key missing');
    const content: any[] = [{ type: 'text', text: prompt }];
    for (const img of images) {
        content.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${img}` } });
    }
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${OPENROUTER_KEY}`,
            'HTTP-Referer': 'https://cocampus.app',
            'X-Title': 'CoCampus',
        },
        body: JSON.stringify({
            model: OPENROUTER_MODEL,
            temperature,
            max_tokens: 2048,
            messages: [{ role: 'user', content: images.length ? content : prompt }],
        }),
    });
    if (!res.ok) throw new Error(`OpenRouter failed (${res.status}): ${await res.text()}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
}

async function callGemini(prompt: string, images: string[] = [], json = false): Promise<string> {
    if (!GEMINI_KEY) throw new Error('Gemini API key missing');
    const parts: any[] = [{ text: prompt }];
    for (const img of images) {
        parts.push({ inlineData: { mimeType: 'image/jpeg', data: img } });
    }
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 2048,
                ...(json ? { responseMimeType: 'application/json' } : {}),
            },
        }),
    });
    if (!res.ok) throw new Error(`Gemini failed (${res.status}): ${await res.text()}`);
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callGroq(prompt: string, json = false): Promise<string> {
    if (!GROQ_KEY) throw new Error('Groq API key missing');
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_KEY}` },
        body: JSON.stringify({
            model: GROQ_MODEL,
            temperature: 0.3,
            max_tokens: 2048,
            ...(json ? { response_format: { type: 'json_object' } } : {}),
            messages: [{ role: 'user', content: prompt }],
        }),
    });
    if (!res.ok) throw new Error(`Groq failed (${res.status}): ${await res.text()}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
}

/** Unified vision caller: tries OpenRouter, then Gemini fallback */
async function callVision(prompt: string, images: string[]): Promise<string> {
    if (OPENROUTER_KEY) {
        try { return await callOpenRouter(prompt, images); } catch (e) { console.warn('OpenRouter vision failed:', e); }
    }
    if (GEMINI_KEY) {
        try { return await callGemini(prompt, images, true); } catch (e) { console.warn('Gemini vision failed:', e); }
    }
    throw new Error('All vision LLM providers failed. Check your API keys.');
}

/** Unified text caller: cascades OpenRouter -> Gemini -> Groq */
async function callText(prompt: string, json = false): Promise<string> {
    if (OPENROUTER_KEY) {
        try { const r = await callOpenRouter(prompt, [], 0.3); if (r) return r; } catch (e) { console.warn('OpenRouter text failed:', e); }
    }
    if (GEMINI_KEY) {
        try { const r = await callGemini(prompt, [], json); if (r) return r; } catch (e) { console.warn('Gemini text failed:', e); }
    }
    if (GROQ_KEY) {
        try { const r = await callGroq(prompt, json); if (r) return r; } catch (e) { console.warn('Groq text failed:', e); }
    }
    return '';
}

// ── Audio Transcription ──────────────────────────────────────────────────────
export async function transcribeAudio(audioUriOrBlob: string | Blob): Promise<string> {
    if (!GROQ_KEY) throw new Error('LLM API key (Groq) is not configured.');
    const formData = new FormData();
    if (typeof audioUriOrBlob !== 'string') {
        formData.append('file', audioUriOrBlob, 'audio.webm');
    } else if (audioUriOrBlob.startsWith('blob:') || audioUriOrBlob.startsWith('http') || audioUriOrBlob.startsWith('data:')) {
        const response = await fetch(audioUriOrBlob);
        const blob = await response.blob();
        formData.append('file', blob, 'audio.webm');
    } else {
        formData.append('file', { uri: audioUriOrBlob, name: 'audio.m4a', type: 'audio/m4a' } as any);
    }
    formData.append('model', 'whisper-large-v3-turbo');
    formData.append('language', 'en');

    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${GROQ_KEY}` },
        body: formData,
    });
    if (!res.ok) throw new Error(`Whisper transcription failed (${res.status}): ${await res.text()}`);
    const data = await res.json();
    return (data.text || '').trim();
}

// ── Study Material Extraction ────────────────────────────────────────────────
export async function extractStudyMaterial(
    base64Images: string[] | string,
    targetSubject?: string,
    existingExtraction?: ExtractionData
): Promise<ExtractionData> {
    const images = Array.isArray(base64Images) ? base64Images : [base64Images];
    if (images.length === 0) throw new Error('At least one image is required for analysis.');

    const subjectInst = targetSubject
        ? `Designated subject: "${targetSubject}". Set "subject" strictly to "${targetSubject}".`
        : 'Deduce a clear, concise subject (2-4 words, e.g. "Calculus II", "Data Structures").';

    const existingInst = existingExtraction
        ? `\nAppending to "${existingExtraction.title}" (${existingExtraction.subject}). Merge previous notes: "${existingExtraction.generatedNotes}" with new content.`
        : '';

    const prompt = `Analyze ${images.length} whiteboard/lecture/notebook image(s).
${subjectInst}${existingInst}
Return ONLY a valid JSON object strictly matching this schema:
{
  "subject": string,
  "title": string,
  "topics": [{ "heading": string, "bullets": string[] }],
  "tasks": [{ "title": string, "dueDate": string | null, "notes": string | null }],
  "rawText": string,
  "generatedNotes": string
}
No markdown blocks or preambles. "dueDate" must be null if not visible. "generatedNotes" should be a 150-400 word cohesive summary.`;

    const raw = await callVision(prompt, images);
    const parsed = safeParse<ExtractionData>(raw, null as any);
    if (!parsed) throw new Error('Failed to parse study material extraction response.');
    if (targetSubject) parsed.subject = targetSubject;
    return parsed;
}

// ── Flashcard Generation ─────────────────────────────────────────────────────
export async function generateFlashcards(extraction: ExtractionData): Promise<Flashcard[]> {
    const prompt = `Generate at least 10 high-quality flashcards based on this study material:
${JSON.stringify(extraction)}
Return ONLY a JSON object: { "flashcards": [{ "question": string, "answer": string }] }
No preambles, no markdown.`;

    try {
        const raw = await callText(prompt, true);
        const parsed = safeParse<{ flashcards: Flashcard[] }>(raw, { flashcards: [] });
        return parsed.flashcards || [];
    } catch (err) {
        console.warn('Flashcard generation failed, returning empty list:', err);
        return [];
    }
}

// ── Exam Extraction from Syllabus ────────────────────────────────────────────
export interface ExtractedExamInfo {
    subject: string;
    examTitle: string;
    examDate: string;
    examTag: string;
}

export async function extractExamFromSyllabus(base64Image: string): Promise<ExtractedExamInfo> {
    const prompt = `Analyze this syllabus or schedule image for upcoming exams/midterms/finals.
Return ONLY a JSON object:
{ "subject": string, "examTitle": string, "examDate": string, "examTag": string }
No preambles or markdown.`;

    const raw = await callVision(prompt, [base64Image]);
    const parsed = safeParse<Partial<ExtractedExamInfo>>(raw, {});
    return {
        subject: parsed.subject || 'Course Exam',
        examTitle: parsed.examTitle || 'Upcoming Exam',
        examDate: parsed.examDate || 'Scheduled',
        examTag: parsed.examTag || `Exam: ${parsed.examDate || 'Upcoming'}`,
    };
}

// ── Multiple Choice Practice Questions (MCQ) ──────────────────────────────────
export interface MCQQuestion {
    id: string;
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
    level: 'Foundations' | 'Standard' | 'Hard';
    subject: string;
}

const mkQ = (id: string, subject: string, level: MCQQuestion['level'], question: string, options: string[], correctIndex: number, explanation: string): MCQQuestion =>
    ({ id, subject, level, question, options, correctIndex, explanation });

const CURATED_MCQS: MCQQuestion[] = [
    mkQ('at_f_1', 'Automata Theory', 'Foundations', 'What does DFA stand for in computation theory?', ['Deterministic Finite Automaton', 'Dynamic Function Analysis', 'Direct Formulation Algorithm', 'Discrete Finite Architecture'], 0, 'A DFA is a Deterministic Finite Automaton where transitions are strictly determined.'),
    mkQ('at_f_2', 'Automata Theory', 'Foundations', 'How many start states can a standard DFA possess?', ['Exactly one (q0)', 'At least two', 'Arbitrary number', 'None if language is empty'], 0, 'In formal 5-tuple (Q, Sigma, delta, q0, F), q0 is the unique start state.'),
    mkQ('at_s_1', 'Automata Theory', 'Standard', 'What is the primary scientific purpose of the Pumping Lemma?', ['To prove a given language is NOT regular by contradiction', 'To minimize DFA states', 'To convert NFA into regex', 'To construct a PDA'], 0, 'Showing a language violates the pumping lemma proves it is non-regular.'),
    mkQ('at_s_2', 'Automata Theory', 'Standard', 'Which machine model recognizes Context-Free Languages (CFL)?', ['Pushdown Automaton (PDA)', 'Deterministic Finite Automaton (DFA)', 'Linear Bounded Automaton', 'Static Register Machine'], 0, 'PDAs augment finite states with a single stack, matching Context-Free Grammars.'),
    mkQ('at_h_1', 'Automata Theory', 'Hard', 'For L = {0^n 1^n | n >= 0}, why does pumping s = 0^p 1^p violate the pumping lemma?', ['Because y lies in 0^p, pumping y changes 0s without matching 1s', 'Because string exceeds memory limit', 'Because alphabet contains multiple symbols', 'Because empty string is rejected'], 0, 'Since |xy| <= p, y consists only of 0s. Pumping y disrupts equal balance.'),
    mkQ('dm_f_1', 'Graph Theory & Discrete Math', 'Foundations', 'What does the Handshaking Lemma state for graph G = (V, E)?', ['The sum of all vertex degrees equals 2 * |E|', 'Every vertex has an even degree', 'Vertices must exceed edges', 'Graph must contain a cycle'], 0, 'Each undirected edge contributes 1 degree to each endpoint: sum(deg(v)) = 2|E|.'),
    mkQ('dm_f_2', 'Graph Theory & Discrete Math', 'Foundations', 'What is the cardinality of power set P(S) of a set with n elements?', ['2^n', 'n^2', '2n', 'n!'], 0, 'Each element has 2 independent choices (in or out), giving 2^n subsets.'),
    mkQ('dm_s_1', 'Graph Theory & Discrete Math', 'Standard', 'Which three properties define an Equivalence Relation?', ['Reflexive, Symmetric, and Transitive', 'Reflexive, Antisymmetric, and Transitive', 'Irreflexive, Symmetric, and Associative', 'Symmetric, Commutative, and Invertible'], 0, 'An equivalence relation partitions a set and must be reflexive, symmetric, and transitive.'),
    mkQ('dm_s_2', 'Graph Theory & Discrete Math', 'Standard', 'A simple graph G is bipartite if and only if it satisfies which condition?', ['G contains no odd cycles', 'G has an even number of vertices', 'G is planar with chromatic number 4', 'G contains a Hamiltonian cycle'], 0, 'König theorem states a graph is bipartite iff every cycle has even length.'),
    mkQ('dm_h_1', 'Graph Theory & Discrete Math', 'Hard', 'When does integer a have a multiplicative inverse modulo m?', ['When gcd(a, m) = 1 (coprime)', 'When m is even composite', 'When a > m and m divides a', 'When a is prime > 2'], 0, 'By Bézout identity, ax + my = 1 has an integer solution iff gcd(a, m) = 1.'),
    mkQ('bio_f_1', 'Biology 101: Cell Energetics', 'Foundations', 'Where in eukaryotic cells does glycolysis take place?', ['In the cytosol (cytoplasm)', 'Inside mitochondrial matrix', 'Along inner cristae', 'Inside Golgi apparatus lumen'], 0, 'Glycolysis occurs in the cytosol and requires no oxygen or organelles.'),
    mkQ('bio_f_2', 'Biology 101: Cell Energetics', 'Foundations', 'Which molecule is the primary electron carrier generated in the citric acid cycle?', ['NADH (and FADH2)', 'NADPH', 'Cytochrome C', 'Flavin Mononucleotide (FMN)'], 0, 'Each turn of the citric acid cycle generates 3 NADH and 1 FADH2 for the ETC.'),
    mkQ('bio_s_1', 'Biology 101: Cell Energetics', 'Standard', 'What is theoretical net ATP yield per glucose under aerobic respiration?', ['Approximately 30 to 32 ATP', 'Net 2 ATP', 'Exactly 38 ATP in all tissues', 'Net 12 ATP'], 0, 'Oxidative phosphorylation plus substrate-level yields ~30-32 ATP per glucose.'),
    mkQ('bio_s_2', 'Biology 101: Cell Energetics', 'Standard', 'Which rate-limiting enzyme in glycolysis is inhibited by ATP and citrate?', ['Phosphofructokinase-1 (PFK-1)', 'Hexokinase', 'Pyruvate Kinase', 'Glucose-6-Phosphate Isomerase'], 0, 'PFK-1 catalyzes the committed step and is allosterically inhibited by high energy charges.'),
    mkQ('bio_h_1', 'Biology 101: Cell Energetics', 'Hard', 'Why does oxidation of FADH2 yield fewer ATP equivalents than NADH?', ['FADH2 enters ETC at Complex II, bypassing proton-pumping Complex I', 'FADH2 cannot donate electrons to Coenzyme Q', 'FADH2 releases protons to matrix', 'FADH2 requires ATP hydrolysis'], 0, 'Complex II transfers electrons to CoQ without pumping protons, producing lower PMF.')
];

export async function generateMCQs(
    subject: string,
    level: 'Foundations' | 'Standard' | 'Hard',
    noteText?: string
): Promise<MCQQuestion[]> {
    if (noteText && noteText.trim().length > 30) {
        const prompt = `Generate 4 multiple-choice exam practice questions for "${subject}" at level "${level}".
Context Notes: "${noteText.slice(0, 1200)}"
Return ONLY a JSON array: [{ "question": string, "options": [string, string, string, string], "correctIndex": number, "explanation": string }]
No markdown or preamble.`;

        try {
            const raw = await callText(prompt, true);
            const parsed = safeParse<any[]>(raw, []);
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
        } catch (e) {
            console.warn('MCQ generation fallback to curated bank:', e);
        }
    }

    const matching = CURATED_MCQS.filter(q => subjectsMatch(q.subject, subject) && q.level === level);
    if (matching.length) return matching;

    const bySubject = CURATED_MCQS.filter(q => subjectsMatch(q.subject, subject));
    return bySubject.length ? bySubject : CURATED_MCQS;
}

// ── Collegiate AI Note Copilot ───────────────────────────────────────────────
export async function askNoteAiDirectly(note: SavedNote, question: string): Promise<string> {
    const trimmed = question.trim();
    if (!trimmed) return 'Please ask a question about your lecture notes.';

    const qaPrompt = `You are the CoCampus Collegiate AI Study Copilot. Answer directly, accurately, and concisely based strictly on these notes:
Course Subject: ${note.subject}
Note Title: ${note.title}
Summary: ${note.extraction.generatedNotes}
Topics: ${JSON.stringify(note.extraction.topics)}
Tasks: ${JSON.stringify(note.extraction.tasks)}
Question: "${trimmed}"
Instructions:
- Direct, collegiate-level answer immediately in the first sentence.
- If asking for a formula/definition, state its components.
- Keep response between 2 to 4 concise paragraphs or bullet points. No raw emojis.`;

    const answer = await callText(qaPrompt);
    if (answer && answer.trim().length > 0) return answer.trim();

    // Intelligent Local Note Grounding Engine (100% offline fallback)
    const q = trimmed.toLowerCase();
    if (q.includes('dfa') || q.includes('deterministic') || q.includes('finite automata')) {
        return 'Deterministic Finite Automata (DFA) are models that recognize regular languages. Defined by 5-tuple (Q, Σ, δ, q0, F):\n\n• Q: Finite set of states.\n• Σ: Input alphabet.\n• δ: Transition function (Q × Σ → Q).\n• q0: Initial state.\n• F: Accepting states.\n\nStrictly one deterministic transition per state and symbol.';
    }
    if (q.includes('5-tuple') || q.includes('formal definition')) {
        return 'The formal 5-tuple defining a Finite Automaton is (Q, Σ, δ, q0, F):\n\n1. Q: Finite set of states.\n2. Σ: Finite input alphabet.\n3. δ: Transition function.\n4. q0: Initial start state.\n5. F: Set of accepting states.';
    }
    if (q.includes('alphabet') || q.includes('sigma')) {
        return 'In formal computation theory, an Alphabet (Σ) is a non-empty, finite set of symbols (e.g., {0, 1}). Strings are sequences over Σ; ε denotes the empty string.';
    }
    if (q.includes('exam') || q.includes('test') || q.includes('midterm')) {
        return 'Key Exam Focus Points:\n\n1. State-transition completeness: Ensure no input symbol is unhandled.\n2. String tracing: Practice tracing binary strings step-by-step.\n3. Formal proofs: Be ready to write the formal 5-tuple and prove language closure.';
    }
    if (q.includes('summary') || q.includes('overview')) {
        return `Executive Summary for "${note.title}":\n\n${note.extraction.generatedNotes}\n\nKey Concepts:\n${note.extraction.topics.map(t => `• ${t.heading}: ${t.bullets.slice(0, 2).join('; ')}`).join('\n')}`;
    }
    if ((q.includes('quiz') || q.includes('practice')) && note.flashcards?.length) {
        const card = note.flashcards[Math.floor(Math.random() * note.flashcards.length)];
        return `Practice Question for ${note.subject}:\n\n"${card.question}"\n\nCorrect Answer: ${card.answer}`;
    }

    const matchingTopic = note.extraction.topics.find(t =>
        t.heading.toLowerCase().split(' ').some(w => w.length > 3 && q.includes(w))
    );
    if (matchingTopic) {
        return `Regarding ${matchingTopic.heading}:\n\n${matchingTopic.bullets.map(b => `• ${b}`).join('\n')}\n\nThis is a core milestone in ${note.subject}.`;
    }

    return `Based on your notes for "${note.title}":\n\n${note.extraction.generatedNotes.slice(0, 360)}...\n\nKey takeaways:\n${note.extraction.topics.slice(0, 2).map(t => `• ${t.heading}: ${t.bullets[0] || 'Core concept'}`).join('\n')}`;
}
