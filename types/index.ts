export interface Topic {
    heading: string;
    bullets: string[];
}

export interface Task {
    title: string;
    dueDate: string | null;
    notes: string | null;
}

export interface ExtractionData {
    subject: string;
    title: string;
    topics: Topic[];
    tasks: Task[];
    rawText: string;
    generatedNotes: string;
}

export interface Flashcard {
    question: string;
    answer: string;
}

export interface FlashcardResponse {
    flashcards: Flashcard[];
}

export interface YouTubeVideo {
    id: string;
    title: string;
    thumbnail: string;
    channelTitle: string;
}

export interface TopicVideoGroup {
    heading: string;
    videos: YouTubeVideo[];
}

export interface SavedNote {
    id: string;
    createdAt: number;
    subject: string;
    subjectSlug: string;
    title: string;
    extraction: ExtractionData;
    flashcards: Flashcard[];
    topicVideos: TopicVideoGroup[];
}

export interface SubjectFolder {
    id: string;
    name: string;
    noteCount: number;
    updatedAt: number;
}