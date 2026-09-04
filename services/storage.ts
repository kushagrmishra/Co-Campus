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
import { db, ensureAnonymousAuth } from './firebase';
import { SavedNote, SubjectFolder, ExtractionData, Flashcard, TopicVideoGroup } from '../types';

export function slugify(text: string): string {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

export async function saveNoteToFirestore(
    extraction: ExtractionData,
    flashcards: Flashcard[],
    topicVideos: TopicVideoGroup[],
    existingNoteId?: string
): Promise<SavedNote> {
    const user = await ensureAnonymousAuth();
    const userId = user.uid;

    const subjectSlug = slugify(extraction.subject);
    const subjectDocRef = doc(db, `users/${userId}/subjects/${subjectSlug}`);
    const notesCollectionRef = collection(db, `users/${userId}/subjects/${subjectSlug}/notes`);

    const noteDocRef = existingNoteId ? doc(notesCollectionRef, existingNoteId) : doc(notesCollectionRef);
    const now = Date.now();

    const noteData: SavedNote = {
        id: noteDocRef.id,
        createdAt: now,
        subject: extraction.subject,
        subjectSlug,
        title: extraction.title,
        extraction,
        flashcards,
        topicVideos,
    };

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

    return noteData;
}

export async function fetchSubjectFolders(): Promise<SubjectFolder[]> {
    const user = await ensureAnonymousAuth();
    const userId = user.uid;

    const subjectsRef = collection(db, `users/${userId}/subjects`);
    const q = query(subjectsRef, orderBy('updatedAt', 'desc'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((d) => d.data() as SubjectFolder);
}

export async function fetchNotesBySubject(subjectSlug: string): Promise<SavedNote[]> {
    const user = await ensureAnonymousAuth();
    const userId = user.uid;

    const notesRef = collection(db, `users/${userId}/subjects/${subjectSlug}/notes`);
    const q = query(notesRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((d) => d.data() as SavedNote);
}