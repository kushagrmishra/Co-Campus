import {
    collection,
    doc,
    getDocs,
    getDoc,
    setDoc,
    updateDoc,
    increment,
    query,
    orderBy,
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db, ensureAnonymousAuth } from './firebase';
import { SavedNote, SubjectFolder, ExtractionData, Flashcard, TopicVideoGroup } from '../types';

const STORAGE_KEY_NOTES = '@cocampus_saved_notes';
const STORAGE_KEY_FOLDERS = '@cocampus_subject_folders';

export function slugify(text: string): string {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

export const SAMPLE_NOTE: SavedNote = {
    id: 'sample_note_cellular_respiration',
    createdAt: Date.now() - 1000 * 60 * 60 * 3, // 3 hours ago
    subject: 'Biology 101: Cell Energetics',
    subjectSlug: 'bio-101',
    title: 'Cellular Respiration: Glycolysis & Krebs Cycle',
    extraction: {
        subject: 'Biology 101: Cell Energetics',
        title: 'Cellular Respiration: Glycolysis & Krebs Cycle',
        generatedNotes:
            'Glycolysis occurs in the cytoplasm, is anaerobic, and converts 1 Glucose into 2 Pyruvate yielding net 2 ATP & 2 NADH. Pyruvate dehydrogenase complex then bridges glycolysis to the mitochondrial matrix, forming Acetyl-CoA. The Krebs (Citric Acid) Cycle processes Acetyl-CoA through an 8-step catalytic cycle producing 3 NADH, 1 FADH₂, 1 GTP/ATP, and 2 CO₂ per turn (doubled per glucose).',
        rawText:
            'BIO 101 Lecture 8 - Cellular Respiration\nPFK-1 allosteric regulation\nComplex IV reduces O2 to H2O\nNet ATP: ~30-32',
        topics: [
            {
                heading: 'Glycolysis Pathway (Cytosol)',
                bullets: [
                    'Energy investment phase consumes 2 ATP (Hexokinase & PFK-1 checkpoints).',
                    'Payoff phase produces 4 ATP and 2 NADH through substrate-level phosphorylation.',
                    'Net yield: +2 ATP, +2 NADH, +2 Pyruvate per oxidized glucose monomer.',
                ],
            },
            {
                heading: 'The Krebs (Citric Acid) Cycle',
                bullets: [
                    'Oxaloacetate (4C) binds Acetyl-CoA (2C) via Citrate Synthase to form Citrate (6C).',
                    'Rate-limiting enzyme: Isocitrate Dehydrogenase (inhibited by high ATP and NADH).',
                    'Succinate Dehydrogenase (Complex II) embeds directly in the inner mitochondrial membrane.',
                    'Malate dehydrogenase regenerates oxaloacetate to complete the catalytic cycle.',
                ],
            },
            {
                heading: 'Oxidative Phosphorylation Bridge',
                bullets: [
                    'Electrons from NADH & FADH₂ pass through Complexes I-IV, creating a proton gradient.',
                    'Complex IV reduces terminal electron acceptor O₂ to H₂O.',
                    'Chemiosmosis powers ATP Synthase rotation to yield ~30-32 ATP per glucose.',
                ],
            },
        ],
        tasks: [
            {
                title: 'Complete WileyPLUS Biology Quiz #4',
                dueDate: 'Friday, Oct 27 at 11:59 PM',
                notes: '15 questions covering glycolysis and citric acid cycle enzymes',
            },
            {
                title: 'Memorize 8 Intermediates Mnemonic',
                dueDate: null,
                notes: '"Can I Keep Selling Substances For Money, Officer?"',
            },
            {
                title: 'Review lecture slides 14-29',
                dueDate: null,
                notes: 'Focus on complex IV oxygen reduction and proton pumping',
            },
        ],
    },
    flashcards: [
        {
            question: 'What is the primary electron acceptor in glycolysis?',
            answer: 'NAD+ (Nicotinamide Adenine Dinucleotide), which reduces to NADH.',
        },
        {
            question: 'What is the committed, major rate-limiting enzyme in glycolysis?',
            answer: 'Phosphofructokinase-1 (PFK-1), allosterically inhibited by high ATP and citrate.',
        },
        {
            question: 'Where does the citric acid cycle take place within eukaryotic cells?',
            answer: 'In the mitochondrial matrix.',
        },
        {
            question: 'What is the theoretical net ATP yield per glucose molecule under aerobic respiration?',
            answer: 'Approximately 30 to 32 ATP molecules.',
        },
        {
            question: 'Which enzyme catalyzes the condensation of oxaloacetate and acetyl-CoA into citrate?',
            answer: 'Citrate Synthase.',
        },
        {
            question: 'What is the net ATP yield from one cycle of the Krebs cycle per turn?',
            answer: '1 GTP (or ATP) per acetyl-CoA, meaning 2 ATP equivalents per original glucose.',
        },
        {
            question: 'Which molecule acts as the terminal electron acceptor in the electron transport chain?',
            answer: 'Molecular Oxygen (O2), which is reduced to water (H2O).',
        },
        {
            question: 'What is chemiosmosis in cellular respiration?',
            answer: 'The movement of protons (H+) down their electrochemical gradient across the inner mitochondrial membrane through ATP synthase to produce ATP.',
        },
        {
            question: 'What happens to pyruvate in the absence of oxygen in human muscle cells?',
            answer: 'It undergoes lactic acid fermentation, reducing pyruvate to lactate while regenerating NAD+ for continued glycolysis.',
        },
        {
            question: 'Why does FADH2 yield less ATP than NADH in oxidative phosphorylation?',
            answer: 'FADH2 donates electrons to Complex II (Succinate Dehydrogenase) instead of Complex I, bypassing the first proton-pumping complex.',
        },
    ],
    topicVideos: [
        {
            heading: 'Cellular Respiration & Krebs Cycle',
            videos: [
                {
                    id: 'juM2ROSLWfw',
                    title: 'Krebs / Citric Acid Cycle Step-by-Step',
                    channelTitle: 'Khan Academy',
                    thumbnail: 'https://i.ytimg.com/vi/juM2ROSLWfw/hqdefault.jpg',
                    duration: '14:22',
                    views: '4.2M views',
                    description: 'Clear breakdown of NADH and FADH2 production per acetyl-CoA molecule.',
                },
                {
                    id: '00jbG_cfGuQ',
                    title: 'ATP & Respiration: Crash Course Biology #7',
                    channelTitle: 'CrashCourse',
                    thumbnail: 'https://i.ytimg.com/vi/00jbG_cfGuQ/hqdefault.jpg',
                    duration: '11:45',
                    views: '6.8M views',
                    description: 'Hank Green covers the big picture of how ATP synthase powers cellular energy.',
                },
                {
                    id: 'TnQGcKpahfM',
                    title: 'Glycolysis Made Easy!',
                    channelTitle: 'Dr Matt & Dr Mike',
                    thumbnail: 'https://i.ytimg.com/vi/TnQGcKpahfM/hqdefault.jpg',
                    duration: '13:30',
                    views: '1.1M views',
                    description: 'In this video, Dr Mike breaks down glycolysis clearly step by step.',
                },
            ],
        },
    ],
    imageUris: [
        'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=800&q=80',
    ],
};

export const AUTOMATA_NOTE: SavedNote = {
    id: 'note_automata_theory_dfa',
    createdAt: Date.now() - 1000 * 60 * 60 * 2, // 2 hours ago
    subject: 'Automata Theory',
    subjectSlug: 'automata-theory',
    title: 'Deterministic Finite Automata & Pumping Lemma',
    extraction: {
        subject: 'Automata Theory',
        title: 'Deterministic Finite Automata & Pumping Lemma',
        generatedNotes:
            'A Deterministic Finite Automaton (DFA) consists of a 5-tuple (Q, Sigma, delta, q0, F). The transition function maps a state and an input symbol to exactly one subsequent state. The Pumping Lemma proves non-regularity by demonstrating that any sufficiently long string in a regular language contains a substring that can be pumped without leaving the language.',
        rawText: 'Automata Theory Lecture 4: DFAs, NFAs, and Regular Languages. Pumping lemma conditions.',
        topics: [
            {
                heading: 'DFA Formal 5-Tuple Definition',
                bullets: [
                    'Q is the finite set of internal states.',
                    'Sigma is the finite input alphabet.',
                    'delta: Q x Sigma -> Q is the deterministic transition function.',
                    'q0 in Q is the initial start state; F subset of Q is the set of accepting/final states.',
                ],
            },
            {
                heading: 'Pumping Lemma for Regular Languages',
                bullets: [
                    'If language L is regular, there exists pumping length p >= 1.',
                    'Any string s in L with |s| >= p can be decomposed into s = xyz.',
                    'Conditions: |y| > 0, |xy| <= p, and for all i >= 0, xy^i z is in L.',
                ],
            },
        ],
        tasks: [
            {
                title: 'Automata Problem Set #2: Pumping Lemma Proofs',
                dueDate: 'Thursday at 11:59 PM',
                notes: 'Prove L = {0^n 1^n | n >= 0} is not regular',
            },
        ],
    },
    flashcards: [
        {
            question: 'What is the formal definition of a DFA transition function?',
            answer: 'delta: Q x Sigma -> Q, mapping a current state and input symbol to a unique next state.',
        },
        {
            question: 'What are the 3 constraints in the Pumping Lemma for regular languages?',
            answer: '1. |y| > 0 (non-empty pumped substring), 2. |xy| <= p (prefix bound), 3. xy^i z in L for all i >= 0.',
        },
        {
            question: 'Can every NFA be converted into an equivalent DFA?',
            answer: 'Yes, via the Powerset Construction (subset construction algorithm).',
        },
        {
            question: 'What class of languages is recognized by a Pushdown Automaton (PDA)?',
            answer: 'Context-Free Languages (CFLs).',
        },
        {
            question: 'What is an epsilon-transition in a non-deterministic finite automaton (NFA)?',
            answer: 'A state transition that is taken without reading or consuming any input symbol.',
        },
        {
            question: 'What does Kleene Theorem state regarding formal language theory?',
            answer: 'A formal language is regular if and only if it is recognized by a finite state automaton or described by a regular expression.',
        },
        {
            question: 'Is the family of regular languages closed under complement and intersection?',
            answer: 'Yes, regular languages are closed under union, intersection, complement, concatenation, and Kleene star.',
        },
        {
            question: 'How does the Chomsky hierarchy rank languages from Type 3 to Type 0?',
            answer: 'Regular (Type 3) subset of Context-Free (Type 2) subset of Context-Sensitive (Type 1) subset of Recursively Enumerable (Type 0).',
        },
        {
            question: 'What is the relationship between tape alphabet Gamma and input alphabet Sigma in a Turing Machine?',
            answer: 'The input alphabet Sigma is a strict subset of the tape alphabet Gamma, with the blank symbol square included only in Gamma.',
        },
        {
            question: 'What is the Halting Problem and what did Turing prove regarding its computability?',
            answer: 'The problem of deciding whether an arbitrary program halts on input w; Turing proved it is undecidable (unsolvable by any algorithm).',
        },
    ],
    topicVideos: [
        {
            heading: 'Automata Theory & Theory of Computation',
            videos: [
                {
                    id: 'yE9v9tefGss',
                    title: 'Finite State Machines & Computation Theory',
                    channelTitle: 'Fireship',
                    thumbnail: 'https://i.ytimg.com/vi/yE9v9tefGss/hqdefault.jpg',
                    duration: '11:20',
                    views: '1.4M views',
                    description: 'State machine fundamentals, DFA diagrams, and transition tables.',
                },
                {
                    id: 'zOjov-2OZ0E',
                    title: 'How Logic Gates & Automata Work',
                    channelTitle: 'Code.org',
                    thumbnail: 'https://i.ytimg.com/vi/zOjov-2OZ0E/hqdefault.jpg',
                    duration: '07:30',
                    views: '2.1M views',
                    description: 'Boolean algebra, states, and sequential computation circuits.',
                },
            ],
        },
    ],
};

export const DISCRETE_NOTE: SavedNote = {
    id: 'note_discrete_math_graphs',
    createdAt: Date.now() - 1000 * 60 * 60 * 5, // 5 hours ago
    subject: 'Graph Theory & Discrete Math',
    subjectSlug: 'discrete-mathematics',
    title: 'Graph Theory & Combinatorial Proofs',
    extraction: {
        subject: 'Graph Theory & Discrete Math',
        title: 'Graph Theory & Combinatorial Proofs',
        generatedNotes:
            'A graph G = (V, E) consists of vertices and edges. The Handshaking Lemma states that the sum of degrees of all vertices equals twice the number of edges. An Eulerian circuit exists in a connected graph if and only if every vertex has an even degree.',
        rawText: 'Discrete Math Lecture 7: Graphs, Handshaking theorem, Euler paths, trees.',
        topics: [
            {
                heading: 'Handshaking Lemma & Degree Sequences',
                bullets: [
                    'Sum of deg(v) for all v in V equals 2|E|.',
                    'The number of vertices with odd degree in any graph is always even.',
                ],
            },
            {
                heading: 'Eulerian Paths and Circuits',
                bullets: [
                    'An Euler path visits every edge exactly once.',
                    'A graph has an Euler circuit iff it is connected and all vertex degrees are even.',
                    'A graph has an Euler path iff it is connected and exactly zero or two vertices have odd degree.',
                ],
            },
        ],
        tasks: [
            {
                title: 'Discrete Math Homework 5: Graph Induction',
                dueDate: 'Sunday at 5:00 PM',
                notes: 'Problems 4.1 through 4.8 in textbook',
            },
        ],
    },
    flashcards: [
        {
            question: "State the Handshaking Lemma for an undirected graph G = (V, E).",
            answer: "The sum of degrees of all vertices equals 2 * |E| (twice the number of edges).",
        },
        {
            question: "What is the necessary and sufficient condition for a connected graph to contain an Euler circuit?",
            answer: "Every single vertex must have an even degree.",
        },
        {
            question: "What is the Pigeonhole Principle?",
            answer: "If n items are put into m containers where n > m, then at least one container must hold more than one item.",
        },
        {
            question: "What 3 mathematical properties define an Equivalence Relation?",
            answer: "Reflexive (a R a), Symmetric (a R b implies b R a), and Transitive (a R b and b R c implies a R c).",
        },
        {
            question: "What is the cardinality of the power set P(S) of an n-element set?",
            answer: "2^n distinct subsets.",
        },
        {
            question: "What condition determines whether an undirected graph is bipartite?",
            answer: "A graph is bipartite if and only if it contains no cycles of odd length (König theorem).",
        },
        {
            question: "Under what condition does an integer a have a multiplicative modular inverse modulo m?",
            answer: "If and only if gcd(a, m) = 1 (a and m are coprime, derived from Bézout identity).",
        },
        {
            question: "What is Euler Totient function phi(p) for any prime number p?",
            answer: "phi(p) = p - 1, since all positive integers less than p are coprime to p.",
        },
        {
            question: "What is Euler Formula for any connected planar graph?",
            answer: "V - E + F = 2, where V is vertices, E is edges, and F is bounded plus unbounded faces.",
        },
        {
            question: "What are the two fundamental components of a proof by Mathematical Induction?",
            answer: "The Base Case (verifying the base statement P(b) holds) and the Inductive Step (proving P(k) implies P(k+1)).",
        },
    ],
    topicVideos: [
        {
            heading: 'Discrete Mathematics & Graph Theory',
            videos: [
                {
                    id: 'WUvTyaaNkzM',
                    title: 'Graph Theory Visualized: Nodes, Edges, and Proofs',
                    channelTitle: '3Blue1Brown',
                    thumbnail: 'https://i.ytimg.com/vi/WUvTyaaNkzM/hqdefault.jpg',
                    duration: '15:40',
                    views: '3.1M views',
                    description: 'Eulerian trails, topological sorts, and graph isomorphisms.',
                },
            ],
        },
    ],
};

export const DEFAULT_FOLDERS: SubjectFolder[] = [
    {
        id: 'automata-theory',
        name: 'Automata Theory',
        noteCount: 1,
        examTag: 'Exam in 4 days',
        updatedAt: Date.now() - 1000 * 60 * 60 * 2,
    },
    {
        id: 'discrete-mathematics',
        name: 'Graph Theory & Discrete Math',
        noteCount: 1,
        examTag: 'Exam in 12 days',
        updatedAt: Date.now() - 1000 * 60 * 60 * 5,
    },
    {
        id: 'bio-101',
        name: 'Biology 101: Cell Energetics',
        noteCount: 1,
        examTag: 'Exam in 18 days',
        updatedAt: Date.now() - 1000 * 60 * 60 * 24,
    },
];

export const INITIAL_SEED_NOTES: SavedNote[] = [AUTOMATA_NOTE, DISCRETE_NOTE, SAMPLE_NOTE];

export function subjectsMatch(a?: string | null, b?: string | null): boolean {
    if (!a || !b) return false;
    if (a === 'All' || b === 'All') return true;
    const lowerA = a.toLowerCase().trim();
    const lowerB = b.toLowerCase().trim();
    if (lowerA === lowerB) return true;
    if (lowerA.includes(lowerB) || lowerB.includes(lowerA)) return true;

    // Biology matchers
    const isBioA = lowerA.includes('bio') || lowerA.includes('cellular') || lowerA.includes('respiration');
    const isBioB = lowerB.includes('bio') || lowerB.includes('cellular') || lowerB.includes('respiration');
    if (isBioA && isBioB) return true;

    // Graph Theory / Discrete Math matchers
    const isGraphA = lowerA.includes('graph') || lowerA.includes('discrete');
    const isGraphB = lowerB.includes('graph') || lowerB.includes('discrete');
    if (isGraphA && isGraphB) return true;

    // Automata Theory matchers
    const isAutoA = lowerA.includes('auto') || lowerA.includes('dfa') || lowerA.includes('pumping');
    const isAutoB = lowerB.includes('auto') || lowerB.includes('dfa') || lowerB.includes('pumping');
    if (isAutoA && isAutoB) return true;

    return false;
}

async function getLocalNotes(): Promise<SavedNote[]> {
    try {
        const json = await AsyncStorage.getItem(STORAGE_KEY_NOTES);
        let currentNotes: SavedNote[] = [];
        if (json) {
            try {
                const parsed = JSON.parse(json);
                if (Array.isArray(parsed)) {
                    currentNotes = parsed;
                }
            } catch {
                currentNotes = [];
            }
        }

        const existingIds = new Set(currentNotes.map((n) => n.id));
        let changed = false;

        // Guarantee all seed notes (Automata, Graph Theory, Biology) are preserved and up to date
        for (const seed of INITIAL_SEED_NOTES) {
            if (!existingIds.has(seed.id)) {
                currentNotes.push(seed);
                existingIds.add(seed.id);
                changed = true;
            } else {
                const idx = currentNotes.findIndex((n) => n.id === seed.id);
                if (idx !== -1) {
                    const existing = currentNotes[idx];
                    if (
                        !existing.flashcards ||
                        existing.flashcards.length < 10 ||
                        existing.subject !== seed.subject ||
                        !existing.topicVideos ||
                        existing.topicVideos.length === 0
                    ) {
                        currentNotes[idx] = {
                            ...existing,
                            subject: seed.subject,
                            subjectSlug: seed.subjectSlug,
                            title: seed.title,
                            flashcards: seed.flashcards,
                            topicVideos: seed.topicVideos || existing.topicVideos,
                            extraction: {
                                ...existing.extraction,
                                subject: seed.subject,
                            },
                        };
                        changed = true;
                    }
                }
            }
        }

        if (changed || !json) {
            await AsyncStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(currentNotes));
        }
        return currentNotes;
    } catch {
        return INITIAL_SEED_NOTES;
    }
}

export async function fetchAllLocalNotes(): Promise<SavedNote[]> {
    return getLocalNotes();
}

export async function updateFolderExam(
    folderIdOrSlug: string,
    examTag: string,
    examDate?: string
): Promise<SubjectFolder | null> {
    try {
        const folders = await getLocalFolders();
        const slug = slugify(folderIdOrSlug);
        let target = folders.find(
            (f) =>
                f.id === folderIdOrSlug ||
                f.id === slug ||
                f.name.toLowerCase().includes(folderIdOrSlug.toLowerCase()) ||
                folderIdOrSlug.toLowerCase().includes(f.name.toLowerCase())
        );

        if (!target) {
            target = {
                id: slug,
                name: folderIdOrSlug,
                noteCount: 0,
                updatedAt: Date.now(),
                examTag,
                examDate,
            };
            folders.unshift(target);
        } else {
            target.examTag = examTag;
            if (examDate) target.examDate = examDate;
            target.updatedAt = Date.now();
        }

        await AsyncStorage.setItem(STORAGE_KEY_FOLDERS, JSON.stringify(folders));
        return target;
    } catch (e) {
        console.error('Failed to update folder exam:', e);
        return null;
    }
}

async function saveNoteLocally(noteData: SavedNote): Promise<void> {
    try {
        const notes = await getLocalNotes();
        const filtered = notes.filter((n) => n.id !== noteData.id);
        filtered.unshift(noteData);
        await AsyncStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(filtered));

        // Update local folder index
        const folders = await getLocalFolders();
        const existingFolder = folders.find((f) => f.id === noteData.subjectSlug);
        const folderNotes = filtered.filter((n) => n.subjectSlug === noteData.subjectSlug);

        if (existingFolder) {
            existingFolder.noteCount = folderNotes.length;
            existingFolder.updatedAt = noteData.createdAt;
        } else {
            folders.unshift({
                id: noteData.subjectSlug,
                name: noteData.subject,
                noteCount: folderNotes.length,
                updatedAt: noteData.createdAt,
            });
        }
        await AsyncStorage.setItem(STORAGE_KEY_FOLDERS, JSON.stringify(folders));
    } catch (e) {
        console.error('Failed to save note locally:', e);
    }
}

async function getLocalFolders(): Promise<SubjectFolder[]> {
    try {
        const json = await AsyncStorage.getItem(STORAGE_KEY_FOLDERS);
        let currentFolders: SubjectFolder[] = [];
        if (json) {
            try {
                const parsed = JSON.parse(json);
                if (Array.isArray(parsed)) {
                    currentFolders = parsed;
                }
            } catch {
                currentFolders = [];
            }
        }

        const existingIds = new Set(currentFolders.map((f) => f.id));
        let changed = false;

        // Guarantee all default folders (Automata, Graph Theory, Biology) exist
        for (const defaultFolder of DEFAULT_FOLDERS) {
            if (!existingIds.has(defaultFolder.id)) {
                currentFolders.push(defaultFolder);
                existingIds.add(defaultFolder.id);
                changed = true;
            } else {
                const idx = currentFolders.findIndex((f) => f.id === defaultFolder.id);
                if (idx !== -1) {
                    const cur = currentFolders[idx];
                    if (cur.name !== defaultFolder.name || !cur.examTag) {
                        currentFolders[idx] = {
                            ...cur,
                            name: defaultFolder.name,
                            examTag: cur.examTag || defaultFolder.examTag,
                        };
                        changed = true;
                    }
                }
            }
        }

        // Recompute note counts dynamically based on local notes
        const notes = await getLocalNotes();
        for (const f of currentFolders) {
            const count = notes.filter(
                (n) => subjectsMatch(n.subjectSlug, f.id) || subjectsMatch(n.subject, f.name)
            ).length;
            if (f.noteCount !== count) {
                f.noteCount = count;
                changed = true;
            }
        }

        if (changed || !json) {
            await AsyncStorage.setItem(STORAGE_KEY_FOLDERS, JSON.stringify(currentFolders));
        }
        return currentFolders;
    } catch {
        return DEFAULT_FOLDERS;
    }
}

export async function createSubjectFolder(name: string): Promise<SubjectFolder> {
    const slug = slugify(name);
    const now = Date.now();
    const folder: SubjectFolder = {
        id: slug,
        name: name.trim(),
        noteCount: 0,
        updatedAt: now,
    };

    const folders = await getLocalFolders();
    const existing = folders.find((f) => f.id === slug);
    if (existing) {
        return existing;
    }
    folders.unshift(folder);
    await AsyncStorage.setItem(STORAGE_KEY_FOLDERS, JSON.stringify(folders));

    try {
        const user = await ensureAnonymousAuth();
        if (user && db) {
            const userId = user.uid;
            const subjectDocRef = doc(db, `users/${userId}/subjects/${slug}`);
            await setDoc(subjectDocRef, folder, { merge: true });
        }
    } catch (e) {
        console.warn('Failed to sync folder to Firebase:', e);
    }

    return folder;
}

export async function saveNoteToFirestore(
    extraction: ExtractionData,
    flashcards: Flashcard[],
    topicVideos: TopicVideoGroup[],
    existingNoteId?: string,
    imageUris?: string[],
    targetSubjectSlug?: string
): Promise<SavedNote> {
    const subjectSlug = targetSubjectSlug || slugify(extraction.subject);
    const now = Date.now();
    const noteId = existingNoteId || `note_${now}_${Math.random().toString(36).substring(2, 7)}`;

    // If updating existing note, preserve original creation time and merge images
    const localNotes = await getLocalNotes();
    const existingLocalNote = existingNoteId ? localNotes.find((n) => n.id === existingNoteId) : null;

    const mergedImageUris = Array.from(
        new Set([...(existingLocalNote?.imageUris || []), ...(imageUris || [])])
    );

    const noteData: SavedNote = {
        id: noteId,
        createdAt: existingLocalNote ? existingLocalNote.createdAt : now,
        subject: extraction.subject,
        subjectSlug,
        title: extraction.title,
        extraction,
        flashcards,
        topicVideos,
        imageUris: mergedImageUris.length > 0 ? mergedImageUris : undefined,
    };

    // Always persist to local device storage immediately
    await saveNoteLocally(noteData);

    // Attempt Firebase sync in background / gracefully
    try {
        const user = await ensureAnonymousAuth();
        if (user && db) {
            const userId = user.uid;
            const subjectDocRef = doc(db, `users/${userId}/subjects/${subjectSlug}`);
            const notesCollectionRef = collection(db, `users/${userId}/subjects/${subjectSlug}/notes`);
            const noteDocRef = doc(notesCollectionRef, noteId);

            await setDoc(noteDocRef, noteData);

            const subjectDocSnap = await getDoc(subjectDocRef);
            if (!subjectDocSnap.exists()) {
                await setDoc(subjectDocRef, {
                    id: subjectSlug,
                    name: extraction.subject,
                    noteCount: 1,
                    updatedAt: now,
                });
            } else if (!existingNoteId) {
                await updateDoc(subjectDocRef, {
                    noteCount: increment(1),
                    updatedAt: now,
                });
            }
        }
    } catch (firebaseErr) {
        console.warn('Firebase sync skipped, note saved locally:', firebaseErr);
    }

    return noteData;
}

export async function fetchSubjectFolders(): Promise<SubjectFolder[]> {
    const localFolders = await getLocalFolders();
    try {
        const user = await ensureAnonymousAuth();
        if (user && db) {
            const userId = user.uid;
            const subjectsRef = collection(db, `users/${userId}/subjects`);
            const q = query(subjectsRef, orderBy('updatedAt', 'desc'));
            const snapshot = await getDocs(q);

            if (!snapshot.empty) {
                const remoteFolders = snapshot.docs.map((d) => d.data() as SubjectFolder);
                const map = new Map<string, SubjectFolder>();
                for (const f of localFolders) map.set(f.id, f);
                for (const f of remoteFolders) {
                    const local = map.get(f.id);
                    map.set(f.id, {
                        ...f,
                        noteCount: Math.max(f.noteCount || 0, local?.noteCount || 0),
                        updatedAt: Math.max(f.updatedAt || 0, local?.updatedAt || 0),
                    });
                }
                const merged = Array.from(map.values()).sort((a, b) => b.updatedAt - a.updatedAt);
                await AsyncStorage.setItem(STORAGE_KEY_FOLDERS, JSON.stringify(merged));
                return merged;
            }
        }
    } catch (err) {
        console.warn('Fetching from Firebase failed, loading local folders:', err);
    }

    return localFolders;
}

export async function fetchNotesBySubject(subjectSlug: string): Promise<SavedNote[]> {
    const allLocalNotes = await getLocalNotes();
    const localSubjectNotes = allLocalNotes.filter(
        (n) =>
            n.subjectSlug === subjectSlug ||
            subjectsMatch(n.subjectSlug, subjectSlug) ||
            subjectsMatch(n.subject, subjectSlug)
    );

    try {
        const user = await ensureAnonymousAuth();
        if (user && db) {
            const userId = user.uid;
            const notesRef = collection(db, `users/${userId}/subjects/${subjectSlug}/notes`);
            const q = query(notesRef, orderBy('createdAt', 'desc'));
            const snapshot = await getDocs(q);

            if (!snapshot.empty) {
                const remoteNotes = snapshot.docs.map((d) => d.data() as SavedNote);
                const map = new Map<string, SavedNote>();
                for (const n of localSubjectNotes) map.set(n.id, n);
                for (const n of remoteNotes) map.set(n.id, { ...map.get(n.id), ...n });
                return Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt);
            }
        }
    } catch (err) {
        console.warn('Fetching from Firebase failed, loading local notes:', err);
    }

    return localSubjectNotes;
}

export async function forceRefreshStorage(): Promise<{ notes: SavedNote[]; folders: SubjectFolder[] }> {
    try {
        // Ensure local items are thoroughly reconciled
        const localNotes = await getLocalNotes();
        const localFolders = await getLocalFolders();

        // Push all seed notes and folders to Firebase if available
        try {
            const user = await ensureAnonymousAuth();
            if (user && db) {
                const userId = user.uid;
                for (const folder of localFolders) {
                    const subjectDocRef = doc(db, `users/${userId}/subjects/${folder.id}`);
                    await setDoc(subjectDocRef, folder, { merge: true });
                }
                for (const note of localNotes) {
                    const noteDocRef = doc(db, `users/${userId}/subjects/${note.subjectSlug}/notes/${note.id}`);
                    await setDoc(noteDocRef, note, { merge: true });
                }
            }
        } catch (firebaseErr) {
            console.warn('Firebase sync during force refresh skipped:', firebaseErr);
        }

        await AsyncStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(localNotes));
        await AsyncStorage.setItem(STORAGE_KEY_FOLDERS, JSON.stringify(localFolders));

        return { notes: localNotes, folders: localFolders };
    } catch (e) {
        console.error('Failed to force refresh storage:', e);
        return { notes: INITIAL_SEED_NOTES, folders: DEFAULT_FOLDERS };
    }
}
