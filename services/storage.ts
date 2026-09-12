import {
    collection,
    doc,
    getDocs,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    increment,
    query,
    orderBy,
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { db, ensureAnonymousAuth } from './firebase';
import { SavedNote, SubjectFolder, ExtractionData, Flashcard, TopicVideoGroup } from '../types';

const STORAGE_KEY_NOTES = '@cocampus_saved_notes';
const STORAGE_KEY_FOLDERS = '@cocampus_subject_folders';
const FOLDER_NOTES_PREFIX = '@cocampus_folder_notes_';

// Filesystem directories for high-capacity unlimited storage on native devices
const FS_BASE_DIR = FileSystem.documentDirectory ? `${FileSystem.documentDirectory}cocampus_storage/` : null;
const FS_NOTES_DIR = FS_BASE_DIR ? `${FS_BASE_DIR}notes/` : null;
const FS_FOLDERS_DIR = FS_BASE_DIR ? `${FS_BASE_DIR}folders/` : null;

async function ensureFsDirectories(): Promise<boolean> {
    if (!FS_NOTES_DIR || !FS_FOLDERS_DIR) return false;
    try {
        const nInfo = await FileSystem.getInfoAsync(FS_NOTES_DIR);
        if (!nInfo.exists) {
            await FileSystem.makeDirectoryAsync(FS_NOTES_DIR, { intermediates: true });
        }
        const fInfo = await FileSystem.getInfoAsync(FS_FOLDERS_DIR);
        if (!fInfo.exists) {
            await FileSystem.makeDirectoryAsync(FS_FOLDERS_DIR, { intermediates: true });
        }
        return true;
    } catch {
        return false;
    }
}

export function slugify(text: string): string {
    const cleaned = text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
    if (cleaned) return cleaned;

    // Unicode / International name / Emoji hash fallback
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        hash = (hash << 5) - hash + text.charCodeAt(i);
        hash |= 0;
    }
    return `folder_${Math.abs(hash).toString(36)}`;
}

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
    imageUris: [
        'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=1000&q=80',
        'https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&w=1000&q=80',
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
    imageUris: [
        'https://images.unsplash.com/photo-1509869175650-a1c97972541a?auto=format&fit=crop&w=1000&q=80',
        'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1000&q=80',
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
];

export const INITIAL_SEED_NOTES: SavedNote[] = [AUTOMATA_NOTE, DISCRETE_NOTE];

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

        const deletedFoldersJson = await AsyncStorage.getItem('@cocampus_deleted_folder_ids');
        const deletedFolderIds: string[] = deletedFoldersJson ? JSON.parse(deletedFoldersJson) : [];
        const deletedIdsSet = new Set(deletedFolderIds.map((s) => s.toLowerCase()));

        let changed = false;
        // Purge deleted sample note if it exists in local storage
        if (currentNotes.some((n) => n.id === 'sample_note_cellular_respiration')) {
            currentNotes = currentNotes.filter((n) => n.id !== 'sample_note_cellular_respiration');
            changed = true;
        }

        const existingIds = new Set(currentNotes.map((n) => n.id));

        // Guarantee all seed notes (Automata, Graph Theory) are preserved unless their folder was deleted
        for (const seed of INITIAL_SEED_NOTES) {
            const isFolderDeleted =
                deletedIdsSet.has(seed.subjectSlug.toLowerCase()) ||
                deletedIdsSet.has(slugify(seed.subject).toLowerCase()) ||
                deletedIdsSet.has(seed.subject.toLowerCase());

            if (isFolderDeleted) {
                if (existingIds.has(seed.id)) {
                    currentNotes = currentNotes.filter((n) => n.id !== seed.id);
                    existingIds.delete(seed.id);
                    changed = true;
                }
                continue;
            }

            if (!existingIds.has(seed.id)) {
                currentNotes.push(seed);
                existingIds.add(seed.id);
                changed = true;
            } else {
                const idx = currentNotes.findIndex((n) => n.id === seed.id);
                if (idx !== -1) {
                    const existing = currentNotes[idx];
                    const needsUpdate =
                        !existing.flashcards ||
                        existing.flashcards.length < 10 ||
                        existing.subject !== seed.subject ||
                        !existing.topicVideos ||
                        existing.topicVideos.length === 0 ||
                        !existing.imageUris ||
                        existing.imageUris.length === 0;

                    if (needsUpdate) {
                        currentNotes[idx] = {
                            ...existing,
                            subject: seed.subject,
                            subjectSlug: seed.subjectSlug,
                            title: seed.title,
                            flashcards: seed.flashcards,
                            topicVideos: seed.topicVideos || existing.topicVideos,
                            imageUris:
                                existing.imageUris && existing.imageUris.length > 0
                                    ? existing.imageUris
                                    : seed.imageUris,
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
        // 1. Filesystem persistent write (unlimited capacity)
        if (FS_NOTES_DIR) {
            try {
                await ensureFsDirectories();
                await FileSystem.writeAsStringAsync(
                    `${FS_NOTES_DIR}${noteData.id}.json`,
                    JSON.stringify(noteData),
                    { encoding: FileSystem.EncodingType.UTF8 }
                );
            } catch (fsErr) {
                console.warn('Filesystem note save fallback:', fsErr);
            }
        }

        // 2. Folder-partitioned storage key (scalable to unlimited folders)
        const partitionKey = `${FOLDER_NOTES_PREFIX}${noteData.subjectSlug}`;
        try {
            const partJson = await AsyncStorage.getItem(partitionKey);
            let partNotes: SavedNote[] = partJson ? JSON.parse(partJson) : [];
            partNotes = partNotes.filter((n) => n.id !== noteData.id);
            partNotes.unshift(noteData);
            await AsyncStorage.setItem(partitionKey, JSON.stringify(partNotes));
        } catch (partErr) {
            console.warn('Partitioned note save error:', partErr);
        }

        // 3. Keep master cache in sync
        const notes = await getLocalNotes();
        const filtered = notes.filter((n) => n.id !== noteData.id);
        filtered.unshift(noteData);
        await AsyncStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(filtered));

        // 4. Update local folder index & count
        const folders = await getLocalFolders();
        let targetFolder = folders.find(
            (f) =>
                f.id === noteData.subjectSlug ||
                subjectsMatch(f.id, noteData.subjectSlug) ||
                subjectsMatch(f.name, noteData.subject)
        );

        // Count notes for this folder
        const folderNotesCount = filtered.filter(
            (n) =>
                n.subjectSlug === noteData.subjectSlug ||
                subjectsMatch(n.subjectSlug, noteData.subjectSlug) ||
                subjectsMatch(n.subject, noteData.subject)
        ).length;

        if (targetFolder) {
            targetFolder.noteCount = folderNotesCount;
            targetFolder.updatedAt = noteData.createdAt;
        } else {
            targetFolder = {
                id: noteData.subjectSlug,
                name: noteData.subject,
                noteCount: folderNotesCount,
                updatedAt: noteData.createdAt,
            };
            folders.unshift(targetFolder);
        }
        await AsyncStorage.setItem(STORAGE_KEY_FOLDERS, JSON.stringify(folders));

        if (FS_FOLDERS_DIR) {
            try {
                await ensureFsDirectories();
                await FileSystem.writeAsStringAsync(
                    `${FS_FOLDERS_DIR}${targetFolder.id}.json`,
                    JSON.stringify(targetFolder),
                    { encoding: FileSystem.EncodingType.UTF8 }
                );
            } catch {
                // ignore
            }
        }

        // 5. Record study activity for real-time streaks & stats
        await recordStudyActivity('note_created', {
            noteId: noteData.id,
            subject: noteData.subject,
        });
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

        const deletedFoldersJson = await AsyncStorage.getItem('@cocampus_deleted_folder_ids');
        const deletedFolderIds: string[] = deletedFoldersJson ? JSON.parse(deletedFoldersJson) : [];
        const deletedIdsSet = new Set(deletedFolderIds);

        let changed = false;

        // If AsyncStorage had no folders, restore from filesystem if available
        if (currentFolders.length === 0 && FS_FOLDERS_DIR) {
            try {
                await ensureFsDirectories();
                const files = await FileSystem.readDirectoryAsync(FS_FOLDERS_DIR);
                for (const file of files) {
                    if (file.endsWith('.json')) {
                        const content = await FileSystem.readAsStringAsync(`${FS_FOLDERS_DIR}${file}`, {
                            encoding: FileSystem.EncodingType.UTF8,
                        });
                        const parsedFolder = JSON.parse(content) as SubjectFolder;
                        if (parsedFolder && parsedFolder.id && !deletedIdsSet.has(parsedFolder.id)) {
                            currentFolders.push(parsedFolder);
                            changed = true;
                        }
                    }
                }
            } catch {
                // continue
            }
        }

        // Purge deleted sample biology folder and any user-deleted folders
        if (currentFolders.some((f) => f.id === 'bio-101' || deletedIdsSet.has(f.id))) {
            currentFolders = currentFolders.filter((f) => f.id !== 'bio-101' && !deletedIdsSet.has(f.id));
            changed = true;
        }

        const existingIds = new Set(currentFolders.map((f) => f.id));

        // Guarantee all default folders (Automata, Graph Theory) exist unless deleted by user
        for (const defaultFolder of DEFAULT_FOLDERS) {
            if (!existingIds.has(defaultFolder.id) && !deletedIdsSet.has(defaultFolder.id)) {
                currentFolders.push(defaultFolder);
                existingIds.add(defaultFolder.id);
                changed = true;
            } else if (!deletedIdsSet.has(defaultFolder.id)) {
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
    const trimmed = name.trim();
    if (!trimmed) {
        throw new Error('Folder name cannot be empty');
    }

    const baseSlug = slugify(trimmed);
    const now = Date.now();

    const folders = await getLocalFolders();

    // Check if folder with exact name already exists
    const existing = folders.find(
        (f) => f.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (existing) {
        return existing;
    }

    // Determine unique collision-free slug
    let uniqueSlug = baseSlug;
    let counter = 2;
    while (folders.some((f) => f.id.toLowerCase() === uniqueSlug.toLowerCase())) {
        uniqueSlug = `${baseSlug}-${counter++}`;
    }

    const folder: SubjectFolder = {
        id: uniqueSlug,
        name: trimmed,
        noteCount: 0,
        updatedAt: now,
    };

    // Unmark from deleted folders list if user deliberately creates/recreates it
    try {
        const deletedFoldersJson = await AsyncStorage.getItem('@cocampus_deleted_folder_ids');
        if (deletedFoldersJson) {
            const deletedFolderIds: string[] = JSON.parse(deletedFoldersJson);
            const filtered = deletedFolderIds.filter(
                (id) =>
                    id.toLowerCase() !== uniqueSlug.toLowerCase() &&
                    id.toLowerCase() !== trimmed.toLowerCase() &&
                    id.toLowerCase() !== baseSlug.toLowerCase()
            );
            await AsyncStorage.setItem('@cocampus_deleted_folder_ids', JSON.stringify(filtered));
        }
    } catch (e) {
        console.warn('Failed to unmark deleted folder on create:', e);
    }

    folders.unshift(folder);
    await AsyncStorage.setItem(STORAGE_KEY_FOLDERS, JSON.stringify(folders));

    if (FS_FOLDERS_DIR) {
        try {
            await ensureFsDirectories();
            await FileSystem.writeAsStringAsync(
                `${FS_FOLDERS_DIR}${uniqueSlug}.json`,
                JSON.stringify(folder),
                { encoding: FileSystem.EncodingType.UTF8 }
            );
        } catch (fsErr) {
            console.warn('Filesystem folder write fallback:', fsErr);
        }
    }

    try {
        const user = await ensureAnonymousAuth();
        if (user && db) {
            const userId = user.uid;
            const subjectDocRef = doc(db, `users/${userId}/subjects/${uniqueSlug}`);
            await setDoc(subjectDocRef, folder, { merge: true });
        }
    } catch (e) {
        console.warn('Failed to sync folder to Firebase:', e);
    }

    return folder;
}

export async function deleteSubjectFolder(folderIdOrSlug: string): Promise<boolean> {
    try {
        const folders = await getLocalFolders();
        const target = folders.find(
            (f) =>
                f.id.toLowerCase() === folderIdOrSlug.toLowerCase() ||
                slugify(f.name).toLowerCase() === slugify(folderIdOrSlug).toLowerCase() ||
                f.name.toLowerCase() === folderIdOrSlug.toLowerCase()
        );
        const idToRemove = target ? target.id : folderIdOrSlug;
        const nameToRemove = target ? target.name : folderIdOrSlug;

        // 1. Mark as deleted so getLocalFolders & getLocalNotes don't resurrect default folders or seed notes
        const deletedFoldersJson = await AsyncStorage.getItem('@cocampus_deleted_folder_ids');
        const deletedFolderIds: string[] = deletedFoldersJson ? JSON.parse(deletedFoldersJson) : [];
        const identifiers = [
            idToRemove,
            folderIdOrSlug,
            slugify(idToRemove),
            slugify(folderIdOrSlug),
            nameToRemove,
            slugify(nameToRemove),
            nameToRemove.toLowerCase(),
        ];
        for (const id of identifiers) {
            if (id && !deletedFolderIds.includes(id)) {
                deletedFolderIds.push(id);
            }
        }
        await AsyncStorage.setItem('@cocampus_deleted_folder_ids', JSON.stringify(deletedFolderIds));

        // 2. Remove folder from local storage
        const updatedFolders = folders.filter(
            (f) =>
                f.id.toLowerCase() !== idToRemove.toLowerCase() &&
                f.id.toLowerCase() !== folderIdOrSlug.toLowerCase() &&
                slugify(f.name).toLowerCase() !== slugify(nameToRemove).toLowerCase()
        );
        await AsyncStorage.setItem(STORAGE_KEY_FOLDERS, JSON.stringify(updatedFolders));

        // 3. Remove partitioned key and filesystem folder
        await AsyncStorage.removeItem(`${FOLDER_NOTES_PREFIX}${idToRemove}`).catch(() => {});
        if (folderIdOrSlug !== idToRemove) {
            await AsyncStorage.removeItem(`${FOLDER_NOTES_PREFIX}${folderIdOrSlug}`).catch(() => {});
        }
        if (FS_FOLDERS_DIR) {
            try {
                await FileSystem.deleteAsync(`${FS_FOLDERS_DIR}${idToRemove}.json`, { idempotent: true });
            } catch {
                // ignore
            }
        }

        // 4. Remove all notes belonging to this folder from local storage
        const allNotes = await getLocalNotes();
        const remainingNotes = allNotes.filter(
            (n) =>
                n.subjectSlug.toLowerCase() !== idToRemove.toLowerCase() &&
                n.subjectSlug.toLowerCase() !== folderIdOrSlug.toLowerCase() &&
                !subjectsMatch(n.subjectSlug, idToRemove) &&
                !subjectsMatch(n.subjectSlug, folderIdOrSlug) &&
                !subjectsMatch(n.subject, nameToRemove) &&
                !subjectsMatch(n.subject, folderIdOrSlug)
        );
        await AsyncStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(remainingNotes));

        // 5. Delete folder from Firebase if available
        try {
            const user = await ensureAnonymousAuth();
            if (user && db) {
                const userId = user.uid;
                await deleteDoc(doc(db, `users/${userId}/subjects/${idToRemove}`));
                if (folderIdOrSlug !== idToRemove) {
                    await deleteDoc(doc(db, `users/${userId}/subjects/${folderIdOrSlug}`));
                }
            }
        } catch (fbErr) {
            console.warn('Firebase folder delete skipped:', fbErr);
        }

        return true;
    } catch (e) {
        console.error('Failed to delete subject folder:', e);
        return false;
    }
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
        const deletedFoldersJson = await AsyncStorage.getItem('@cocampus_deleted_folder_ids');
        const deletedFolderIds: string[] = deletedFoldersJson ? JSON.parse(deletedFoldersJson) : [];
        const deletedIdsSet = new Set(deletedFolderIds.map((s) => s.toLowerCase()));

        const user = await ensureAnonymousAuth();
        if (user && db) {
            const userId = user.uid;
            const subjectsRef = collection(db, `users/${userId}/subjects`);
            const q = query(subjectsRef, orderBy('updatedAt', 'desc'));
            const snapshot = await getDocs(q);

            if (!snapshot.empty) {
                const remoteFolders = snapshot.docs
                    .map((d) => d.data() as SubjectFolder)
                    .filter(
                        (f) =>
                            !deletedIdsSet.has(f.id.toLowerCase()) &&
                            !deletedIdsSet.has(slugify(f.name).toLowerCase()) &&
                            !deletedIdsSet.has(f.name.toLowerCase())
                    );

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
    const partitionKey = `${FOLDER_NOTES_PREFIX}${subjectSlug}`;
    let localSubjectNotes: SavedNote[] = [];

    // 1. Check partitioned storage key first for instant O(1) folder load
    try {
        const partJson = await AsyncStorage.getItem(partitionKey);
        if (partJson) {
            const parsed = JSON.parse(partJson);
            if (Array.isArray(parsed) && parsed.length > 0) {
                localSubjectNotes = parsed;
            }
        }
    } catch {
        // continue to master list fallback
    }

    // 2. Fallback to all local notes if partition not yet initialized
    if (localSubjectNotes.length === 0) {
        const allLocalNotes = await getLocalNotes();
        localSubjectNotes = allLocalNotes.filter(
            (n) =>
                n.subjectSlug === subjectSlug ||
                subjectsMatch(n.subjectSlug, subjectSlug) ||
                subjectsMatch(n.subject, subjectSlug)
        );
        // Backfill partition key
        if (localSubjectNotes.length > 0) {
            AsyncStorage.setItem(partitionKey, JSON.stringify(localSubjectNotes)).catch(() => {});
        }
    }

    // 3. Remote Firebase sync for this folder
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
                for (const n of remoteNotes) {
                    const local = map.get(n.id);
                    map.set(n.id, {
                        ...local,
                        ...n,
                        imageUris:
                            n.imageUris && n.imageUris.length > 0
                                ? n.imageUris
                                : local?.imageUris || undefined,
                    });
                }
                const merged = Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt);
                AsyncStorage.setItem(partitionKey, JSON.stringify(merged)).catch(() => {});
                return merged;
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

// ── Real-Time Study Activity & Statistics Tracker ────────────────────────────
const STORAGE_KEY_STUDY_ACTIVITY = '@cocampus_study_activity';

export interface StudyActivityRecord {
    activeDates: string[];
    totalReviews: number;
    goodOrEasyCount: number;
    totalQuizQuestions: number;
    totalQuizCorrect: number;
}

export interface StudyStats {
    streakDays: number;
    retentionPct: number;
    totalReviewed: number;
    hasRealActivity: boolean;
}

function getTodayDateString(): string {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export async function recordStudyActivity(
    type: 'note_created' | 'card_rated' | 'quiz_completed',
    payload?: {
        rating?: string;
        score?: number;
        total?: number;
        noteId?: string;
        cardId?: string;
        subject?: string;
    }
): Promise<void> {
    try {
        const json = await AsyncStorage.getItem(STORAGE_KEY_STUDY_ACTIVITY);
        let record: StudyActivityRecord = json
            ? JSON.parse(json)
            : {
                  activeDates: [],
                  totalReviews: 0,
                  goodOrEasyCount: 0,
                  totalQuizQuestions: 0,
                  totalQuizCorrect: 0,
              };

        const today = getTodayDateString();
        if (!record.activeDates.includes(today)) {
            record.activeDates.push(today);
            record.activeDates.sort();
        }

        if (type === 'card_rated') {
            record.totalReviews += 1;
            if (payload?.rating === 'good' || payload?.rating === 'easy') {
                record.goodOrEasyCount += 1;
            }
        } else if (type === 'quiz_completed') {
            record.totalQuizQuestions += payload?.total || 0;
            record.totalQuizCorrect += payload?.score || 0;
        }

        await AsyncStorage.setItem(STORAGE_KEY_STUDY_ACTIVITY, JSON.stringify(record));
    } catch (e) {
        console.warn('Failed to record study activity:', e);
    }
}

export async function getStudyStats(): Promise<{
    streakDays: number;
    retentionPct: number;
    totalReviewed: number;
    hasRealActivity: boolean;
}> {
    try {
        const json = await AsyncStorage.getItem(STORAGE_KEY_STUDY_ACTIVITY);
        const record: StudyActivityRecord = json
            ? JSON.parse(json)
            : {
                  activeDates: [],
                  totalReviews: 0,
                  goodOrEasyCount: 0,
                  totalQuizQuestions: 0,
                  totalQuizCorrect: 0,
              };

        const activeDatesSet = new Set(record.activeDates);

        // Calculate consecutive streak backwards from today or yesterday
        let streak = 0;
        let checkDate = new Date();
        const checkStr = getTodayDateString();

        if (activeDatesSet.has(checkStr)) {
            streak++;
            while (true) {
                checkDate.setDate(checkDate.getDate() - 1);
                const prevStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
                if (activeDatesSet.has(prevStr)) {
                    streak++;
                } else {
                    break;
                }
            }
        } else {
            // Check if yesterday was active (streak still alive)
            checkDate.setDate(checkDate.getDate() - 1);
            const yesterdayStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
            if (activeDatesSet.has(yesterdayStr)) {
                streak++;
                while (true) {
                    checkDate.setDate(checkDate.getDate() - 1);
                    const prevStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
                    if (activeDatesSet.has(prevStr)) {
                        streak++;
                    } else {
                        break;
                    }
                }
            }
        }

        // If user has local notes, minimum real streak is at least 1 day
        const localNotes = await getLocalNotes();
        if (localNotes.length > 0 && streak === 0) {
            streak = 1;
        }

        // Retention calculation
        const totalAnswers = record.totalReviews + record.totalQuizQuestions;
        const totalCorrect = record.goodOrEasyCount + record.totalQuizCorrect;
        let retentionPct = 0;
        if (totalAnswers > 0) {
            retentionPct = Math.round((totalCorrect / totalAnswers) * 100);
        } else {
            retentionPct = 0;
        }

        return {
            streakDays: streak,
            retentionPct,
            totalReviewed: totalAnswers,
            hasRealActivity: totalAnswers > 0 || record.activeDates.length > 0,
        };
    } catch {
        return {
            streakDays: 1,
            retentionPct: 0,
            totalReviewed: 0,
            hasRealActivity: false,
        };
    }
}
