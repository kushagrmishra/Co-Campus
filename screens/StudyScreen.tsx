import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    TouchableOpacity,
    StatusBar,
    ActivityIndicator,
    Modal,
    TextInput,
    Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { SavedNote, SubjectFolder } from '../types';
import { generateMCQs, MCQQuestion } from '../services/llm';

interface StudyScreenProps {
    notes?: SavedNote[];
    folders?: SubjectFolder[];
    onStartReview?: () => void;
    onSelectNote?: (note: SavedNote) => void;
    initialSubject?: string;
}

type FlashcardLevel = 'All' | 'Foundations' | 'Core Concepts' | 'Exam Mastery';
type QuizLevel = 'Foundations' | 'Standard' | 'Hard';

interface DisplayFlashcard {
    id: string;
    subject: string;
    question: string;
    answer: string;
    hint: string;
    noteTitle: string;
    level: 'Foundations' | 'Core Concepts' | 'Exam Mastery';
}

// Master academic flashcard bank ensuring at least 10 cards per subject
const CURATED_SUBJECT_FLASHCARDS: DisplayFlashcard[] = [
    // --- Automata Theory (10 Cards) ---
    {
        id: 'at_card_1',
        subject: 'Automata Theory',
        level: 'Foundations',
        question: 'What is the formal definition of a DFA transition function?',
        answer: 'delta: Q x Sigma -> Q, mapping a current state and input symbol to a unique next state.',
        hint: 'From: Deterministic Finite Automata & Pumping Lemma',
        noteTitle: 'Deterministic Finite Automata & Pumping Lemma',
    },
    {
        id: 'at_card_2',
        subject: 'Automata Theory',
        level: 'Foundations',
        question: 'How many start states can a standard Deterministic Finite Automaton (DFA) possess?',
        answer: 'Exactly one unique designated start state q0 in Q.',
        hint: 'From: Deterministic Finite Automata & Pumping Lemma',
        noteTitle: 'Deterministic Finite Automata & Pumping Lemma',
    },
    {
        id: 'at_card_3',
        subject: 'Automata Theory',
        level: 'Foundations',
        question: 'What is an epsilon-transition in an NFA?',
        answer: 'A state transition that occurs instantaneously without consuming any input symbol.',
        hint: 'From: Non-deterministic Finite Automata',
        noteTitle: 'Non-deterministic Finite Automata',
    },
    {
        id: 'at_card_4',
        subject: 'Automata Theory',
        level: 'Core Concepts',
        question: 'What are the 3 constraints in the Pumping Lemma for regular languages?',
        answer: '1. |y| > 0 (non-empty pumped substring), 2. |xy| <= p (prefix bound), 3. xy^i z in L for all i >= 0.',
        hint: 'From: Deterministic Finite Automata & Pumping Lemma',
        noteTitle: 'Deterministic Finite Automata & Pumping Lemma',
    },
    {
        id: 'at_card_5',
        subject: 'Automata Theory',
        level: 'Core Concepts',
        question: 'Can every NFA be converted into an equivalent DFA?',
        answer: 'Yes, via the Powerset Construction (subset construction algorithm) with at most 2^|Q| states.',
        hint: 'From: NFA to DFA Equivalence',
        noteTitle: 'NFA to DFA Equivalence',
    },
    {
        id: 'at_card_6',
        subject: 'Automata Theory',
        level: 'Core Concepts',
        question: 'What class of languages is recognized by a Pushdown Automaton (PDA)?',
        answer: 'Context-Free Languages (CFLs), using an auxiliary LIFO stack.',
        hint: 'From: Pushdown Automata & Context-Free Grammars',
        noteTitle: 'Pushdown Automata & Context-Free Grammars',
    },
    {
        id: 'at_card_7',
        subject: 'Automata Theory',
        level: 'Core Concepts',
        question: 'What does Kleene Theorem state regarding formal language theory?',
        answer: 'A language is regular if and only if it is recognized by a finite automaton or defined by a regular expression.',
        hint: 'From: Kleene Theorem & Regular Expressions',
        noteTitle: 'Kleene Theorem & Regular Expressions',
    },
    {
        id: 'at_card_8',
        subject: 'Automata Theory',
        level: 'Exam Mastery',
        question: 'How do you prove L = {0^n 1^n | n >= 0} is non-regular using the Pumping Lemma?',
        answer: 'Choose s = 0^p 1^p. Since |xy| <= p, y consists entirely of 0s. Pumping y disrupts the equal ratio of 0s and 1s, proving non-regularity.',
        hint: 'From: Advanced Non-regularity Proofs',
        noteTitle: 'Advanced Non-regularity Proofs',
    },
    {
        id: 'at_card_9',
        subject: 'Automata Theory',
        level: 'Exam Mastery',
        question: 'What is the relationship between tape alphabet Gamma and input alphabet Sigma in a Turing Machine?',
        answer: 'The input alphabet Sigma is a strict subset of the tape alphabet Gamma, with the blank symbol square included only in Gamma.',
        hint: 'From: Turing Machines & Computability',
        noteTitle: 'Turing Machines & Computability',
    },
    {
        id: 'at_card_10',
        subject: 'Automata Theory',
        level: 'Exam Mastery',
        question: 'What is the Halting Problem and what did Alan Turing prove regarding its decidability?',
        answer: 'The problem of deciding whether an arbitrary program halts on a given input; Turing proved by diagonalization that it is undecidable.',
        hint: 'From: Turing Machines & Computability',
        noteTitle: 'Turing Machines & Computability',
    },

    // --- Discrete Mathematics (10 Cards) ---
    {
        id: 'dm_card_1',
        subject: 'Discrete Mathematics',
        level: 'Foundations',
        question: 'State the Handshaking Lemma for an undirected graph G = (V, E).',
        answer: 'The sum of all vertex degrees equals twice the number of edges: sum deg(v) = 2|E|.',
        hint: 'From: Graph Theory & Relations',
        noteTitle: 'Graph Theory & Relations',
    },
    {
        id: 'dm_card_2',
        subject: 'Discrete Mathematics',
        level: 'Foundations',
        question: 'What is the cardinality of the power set P(S) of a set with n elements?',
        answer: '2^n distinct subsets, as each element has 2 independent inclusion choices.',
        hint: 'From: Set Theory & Combinatorics',
        noteTitle: 'Set Theory & Combinatorics',
    },
    {
        id: 'dm_card_3',
        subject: 'Discrete Mathematics',
        level: 'Foundations',
        question: 'What is the Pigeonhole Principle?',
        answer: 'If n items are placed into m containers where n > m, then at least one container must hold more than one item.',
        hint: 'From: Combinatorial Proofs',
        noteTitle: 'Combinatorial Proofs',
    },
    {
        id: 'dm_card_4',
        subject: 'Discrete Mathematics',
        level: 'Core Concepts',
        question: 'What 3 mathematical properties characterize an Equivalence Relation?',
        answer: 'Reflexive (a R a), Symmetric (a R b implies b R a), and Transitive (a R b and b R c implies a R c).',
        hint: 'From: Graph Theory & Relations',
        noteTitle: 'Graph Theory & Relations',
    },
    {
        id: 'dm_card_5',
        subject: 'Discrete Mathematics',
        level: 'Core Concepts',
        question: 'What is the necessary and sufficient condition for a connected graph to contain an Euler circuit?',
        answer: 'Every single vertex must have an even degree (0 odd-degree vertices).',
        hint: 'From: Graph Theory & Relations',
        noteTitle: 'Graph Theory & Relations',
    },
    {
        id: 'dm_card_6',
        subject: 'Discrete Mathematics',
        level: 'Core Concepts',
        question: 'What condition determines whether an undirected graph is bipartite?',
        answer: 'A graph is bipartite if and only if it contains no cycles of odd length (König theorem).',
        hint: 'From: Graph Colorability & Trees',
        noteTitle: 'Graph Colorability & Trees',
    },
    {
        id: 'dm_card_7',
        subject: 'Discrete Mathematics',
        level: 'Core Concepts',
        question: 'What are the two fundamental components of a proof by Mathematical Induction?',
        answer: 'The Base Case (verifying base statement P(b) holds) and the Inductive Step (proving P(k) implies P(k+1)).',
        hint: 'From: Proof Techniques & Induction',
        noteTitle: 'Proof Techniques & Induction',
    },
    {
        id: 'dm_card_8',
        subject: 'Discrete Mathematics',
        level: 'Exam Mastery',
        question: 'Under what condition does an integer a have a multiplicative inverse modulo m?',
        answer: 'If and only if gcd(a, m) = 1 (a and m are coprime), derived from Bézout identity ax + my = 1.',
        hint: 'From: Modular Arithmetic & Cryptography',
        noteTitle: 'Modular Arithmetic & Cryptography',
    },
    {
        id: 'dm_card_9',
        subject: 'Discrete Mathematics',
        level: 'Exam Mastery',
        question: 'What is Euler Totient function phi(p) for any prime number p?',
        answer: 'phi(p) = p - 1, since all positive integers from 1 to p-1 are coprime to p.',
        hint: 'From: Number Theory & Modular Arithmetic',
        noteTitle: 'Number Theory & Modular Arithmetic',
    },
    {
        id: 'dm_card_10',
        subject: 'Discrete Mathematics',
        level: 'Exam Mastery',
        question: 'State Euler planar graph formula and the edge bound for simple planar graphs.',
        answer: 'Formula: V - E + F = 2. Edge bound for V >= 3: E <= 3V - 6.',
        hint: 'From: Planar Graphs & Topologies',
        noteTitle: 'Planar Graphs & Topologies',
    },

    // --- Biology 101 (10 Cards) ---
    {
        id: 'bio_card_1',
        subject: 'Biology 101: Cell Energetics',
        level: 'Foundations',
        question: 'What is the primary electron acceptor in glycolysis?',
        answer: 'NAD+ (Nicotinamide Adenine Dinucleotide), which reduces to NADH.',
        hint: 'From: Cellular Respiration: Glycolysis & Krebs Cycle',
        noteTitle: 'Cellular Respiration: Glycolysis & Krebs Cycle',
    },
    {
        id: 'bio_card_2',
        subject: 'Biology 101: Cell Energetics',
        level: 'Foundations',
        question: 'Where does the citric acid cycle take place within eukaryotic cells?',
        answer: 'In the mitochondrial matrix.',
        hint: 'From: Cellular Respiration: Glycolysis & Krebs Cycle',
        noteTitle: 'Cellular Respiration: Glycolysis & Krebs Cycle',
    },
    {
        id: 'bio_card_3',
        subject: 'Biology 101: Cell Energetics',
        level: 'Foundations',
        question: 'What is the theoretical net ATP yield per glucose molecule under aerobic respiration?',
        answer: 'Approximately 30 to 32 ATP molecules.',
        hint: 'From: Cellular Respiration: Glycolysis & Krebs Cycle',
        noteTitle: 'Cellular Respiration: Glycolysis & Krebs Cycle',
    },
    {
        id: 'bio_card_4',
        subject: 'Biology 101: Cell Energetics',
        level: 'Core Concepts',
        question: 'What is the committed, major rate-limiting enzyme in glycolysis?',
        answer: 'Phosphofructokinase-1 (PFK-1), allosterically inhibited by high ATP and citrate.',
        hint: 'From: Cellular Respiration: Glycolysis & Krebs Cycle',
        noteTitle: 'Cellular Respiration: Glycolysis & Krebs Cycle',
    },
    {
        id: 'bio_card_5',
        subject: 'Biology 101: Cell Energetics',
        level: 'Core Concepts',
        question: 'Which enzyme catalyzes the condensation of oxaloacetate and acetyl-CoA into citrate?',
        answer: 'Citrate Synthase.',
        hint: 'From: Cellular Respiration: Glycolysis & Krebs Cycle',
        noteTitle: 'Cellular Respiration: Glycolysis & Krebs Cycle',
    },
    {
        id: 'bio_card_6',
        subject: 'Biology 101: Cell Energetics',
        level: 'Core Concepts',
        question: 'What is the net ATP yield from one cycle of the Krebs cycle per turn?',
        answer: '1 GTP (or ATP) per acetyl-CoA, meaning 2 ATP equivalents per original glucose.',
        hint: 'From: Cellular Respiration: Glycolysis & Krebs Cycle',
        noteTitle: 'Cellular Respiration: Glycolysis & Krebs Cycle',
    },
    {
        id: 'bio_card_7',
        subject: 'Biology 101: Cell Energetics',
        level: 'Core Concepts',
        question: 'Which molecule acts as the terminal electron acceptor in the electron transport chain?',
        answer: 'Molecular Oxygen (O2), which is reduced to water (H2O).',
        hint: 'From: Cellular Respiration: Glycolysis & Krebs Cycle',
        noteTitle: 'Cellular Respiration: Glycolysis & Krebs Cycle',
    },
    {
        id: 'bio_card_8',
        subject: 'Biology 101: Cell Energetics',
        level: 'Exam Mastery',
        question: 'What is chemiosmosis in cellular respiration?',
        answer: 'The movement of protons (H+) down their electrochemical gradient across the inner mitochondrial membrane through ATP synthase to produce ATP.',
        hint: 'From: Cellular Respiration: Glycolysis & Krebs Cycle',
        noteTitle: 'Cellular Respiration: Glycolysis & Krebs Cycle',
    },
    {
        id: 'bio_card_9',
        subject: 'Biology 101: Cell Energetics',
        level: 'Exam Mastery',
        question: 'What happens to pyruvate in the absence of oxygen in human muscle cells?',
        answer: 'It undergoes lactic acid fermentation, reducing pyruvate to lactate while regenerating NAD+ for continued glycolysis.',
        hint: 'From: Cellular Respiration: Glycolysis & Krebs Cycle',
        noteTitle: 'Cellular Respiration: Glycolysis & Krebs Cycle',
    },
    {
        id: 'bio_card_10',
        subject: 'Biology 101: Cell Energetics',
        level: 'Exam Mastery',
        question: 'Why does FADH2 yield less ATP than NADH in oxidative phosphorylation?',
        answer: 'FADH2 donates electrons to Complex II (Succinate Dehydrogenase) instead of Complex I, bypassing the first proton-pumping complex.',
        hint: 'From: Cellular Respiration: Glycolysis & Krebs Cycle',
        noteTitle: 'Cellular Respiration: Glycolysis & Krebs Cycle',
    },
];

export const StudyScreen: React.FC<StudyScreenProps> = ({
    notes = [],
    folders = [],
    onStartReview,
    onSelectNote,
    initialSubject,
}) => {
    const insets = useSafeAreaInsets();
    const topPadding = Platform.OS === 'android' ? Math.max(insets.top, StatusBar.currentHeight || 0, 16) : Math.max(insets.top, 10);
    // Mode Switcher: Flashcards vs Interactive Quiz & MCQ Maker
    const [viewMode, setViewMode] = useState<'flashcards' | 'quiz'>('flashcards');

    // Subject selection
    const [selectedSubject, setSelectedSubject] = useState<string>(initialSubject || 'All');

    // Flashcard State
    const [cardIndex, setCardIndex] = useState<number>(0);
    const [isFlipped, setIsFlipped] = useState<boolean>(false);
    const [reviewedCount, setReviewedCount] = useState<number>(0);
    const [flashcardLevel, setFlashcardLevel] = useState<FlashcardLevel>('All');
    const [showFcLevelModal, setShowFcLevelModal] = useState<boolean>(false);
    const [activeStudyMode, setActiveStudyMode] = useState<'spaced' | 'cram' | 'audio' | 'practice'>('spaced');
    const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

    // Quiz & MCQ Maker State
    const [quizLevel, setQuizLevel] = useState<QuizLevel>('Foundations');
    const [showQuizLevelModal, setShowQuizLevelModal] = useState<boolean>(false);
    const [mcqQuestions, setMcqQuestions] = useState<MCQQuestion[]>([]);
    const [mcqIndex, setMcqIndex] = useState<number>(0);
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [quizScore, setQuizScore] = useState<number>(0);
    const [quizFinished, setQuizFinished] = useState<boolean>(false);
    const [isGeneratingMCQs, setIsGeneratingMCQs] = useState<boolean>(false);
    const [showCustomMcqModal, setShowCustomMcqModal] = useState<boolean>(false);

    // Custom MCQ Maker Form State
    const [customQuestion, setCustomQuestion] = useState<string>('');
    const [customOptions, setCustomOptions] = useState<string[]>(['', '', '', '']);
    const [customCorrectIndex, setCustomCorrectIndex] = useState<number>(0);
    const [customExplanation, setCustomExplanation] = useState<string>('');

    // Stop speech synthesis if unmounting
    useEffect(() => {
        return () => {
            Speech.stop();
        };
    }, []);

    // Distinct subjects from real folders and notes
    const availableSubjects = useMemo(() => {
        const set = new Set<string>();
        folders.forEach((f) => set.add(f.name));
        notes.forEach((n) => set.add(n.subject));
        const list = Array.from(set);
        return ['All', ...list];
    }, [folders, notes]);

    // Extract all real flashcards with guaranteed minimum 10 cards per subject
    const allFlashcards = useMemo<DisplayFlashcard[]>(() => {
        const filteredNotes =
            selectedSubject === 'All'
                ? notes
                : notes.filter(
                      (n) =>
                          n.subject.toLowerCase().includes(selectedSubject.toLowerCase()) ||
                          selectedSubject.toLowerCase().includes(n.subject.toLowerCase()) ||
                          n.subjectSlug.toLowerCase() === selectedSubject.toLowerCase()
                  );

        const extracted: DisplayFlashcard[] = [];
        let globalIdx = 0;
        filteredNotes.forEach((n) => {
            (n.flashcards || []).forEach((fc) => {
                const levelTiers: ('Foundations' | 'Core Concepts' | 'Exam Mastery')[] = [
                    'Foundations',
                    'Core Concepts',
                    'Exam Mastery',
                ];
                const cardLevel = levelTiers[globalIdx % 3];
                extracted.push({
                    id: `fc_${n.id}_${globalIdx}`,
                    subject: n.subject,
                    question: fc.question,
                    answer: fc.answer,
                    hint: `From: ${n.title}`,
                    noteTitle: n.title,
                    level: cardLevel,
                });
                globalIdx++;
            });
        });

        // Ensure at least 10 cards are available by merging from curated bank
        const curatedMatches = CURATED_SUBJECT_FLASHCARDS.filter(
            (c) =>
                selectedSubject === 'All' ||
                c.subject.toLowerCase().includes(selectedSubject.toLowerCase()) ||
                selectedSubject.toLowerCase().includes(c.subject.toLowerCase())
        );

        // If extracted has fewer than 10 cards, supplement from curated bank
        if (extracted.length < 10) {
            const existingQuestions = new Set(extracted.map((c) => c.question.toLowerCase().trim()));
            for (const c of curatedMatches) {
                if (!existingQuestions.has(c.question.toLowerCase().trim())) {
                    extracted.push(c);
                    existingQuestions.add(c.question.toLowerCase().trim());
                }
                if (extracted.length >= 10 && selectedSubject !== 'All') {
                    break;
                }
            }
        }

        // Final fallback if still empty
        if (extracted.length === 0) {
            return CURATED_SUBJECT_FLASHCARDS;
        }

        return extracted;
    }, [notes, selectedSubject]);

    // Filter flashcards by selected level
    const cardsForSubject = useMemo<DisplayFlashcard[]>(() => {
        if (flashcardLevel === 'All') return allFlashcards;
        return allFlashcards.filter((c) => c.level === flashcardLevel);
    }, [allFlashcards, flashcardLevel]);

    // Safe index for flashcard
    const safeCardIndex = cardsForSubject.length > 0 ? cardIndex % cardsForSubject.length : 0;
    const currentCard = cardsForSubject[safeCardIndex];

    // Load or generate MCQs on subject or quiz level change
    const loadQuizQuestions = useCallback(async () => {
        setIsGeneratingMCQs(true);
        try {
            const contextText = notes
                .filter(
                    (n) =>
                        selectedSubject === 'All' ||
                        n.subject.toLowerCase() === selectedSubject.toLowerCase()
                )
                .map((n) => `${n.title}\n${n.extraction.generatedNotes}`)
                .join('\n\n');

            const qs = await generateMCQs(
                selectedSubject === 'All' ? 'Automata Theory' : selectedSubject,
                quizLevel,
                contextText
            );
            setMcqQuestions(qs);
            setMcqIndex(0);
            setSelectedOption(null);
            setQuizScore(0);
            setQuizFinished(false);
        } catch (e) {
            console.warn('Failed loading MCQs:', e);
        } finally {
            setIsGeneratingMCQs(false);
        }
    }, [selectedSubject, quizLevel, notes]);

    useEffect(() => {
        loadQuizQuestions();
    }, [loadQuizQuestions]);

    // Flashcard Flip & Navigation
    const handleFlip = () => {
        setIsFlipped(!isFlipped);
    };

    const handleNextCard = () => {
        setIsFlipped(false);
        Speech.stop();
        setIsSpeaking(false);
        if (cardsForSubject.length > 0) {
            setCardIndex((prev) => (prev + 1) % cardsForSubject.length);
        }
    };

    const handlePrevCard = () => {
        setIsFlipped(false);
        Speech.stop();
        setIsSpeaking(false);
        if (cardsForSubject.length > 0) {
            setCardIndex((prev) => (prev - 1 + cardsForSubject.length) % cardsForSubject.length);
        }
    };

    const handleRating = (_rating: string) => {
        setReviewedCount((c) => c + 1);
        handleNextCard();
    };

    const handleReadAudio = async (text: string) => {
        if (isSpeaking) {
            await Speech.stop();
            setIsSpeaking(false);
        } else {
            setIsSpeaking(true);
            Speech.speak(text, {
                rate: 0.95,
                pitch: 1.0,
                onDone: () => setIsSpeaking(false),
                onStopped: () => setIsSpeaking(false),
                onError: () => setIsSpeaking(false),
            });
        }
    };

    // Quiz Interactions
    const currentMCQ = mcqQuestions[mcqIndex];

    const handleSelectMCQOption = (index: number) => {
        if (selectedOption !== null || !currentMCQ) return; // Locked once answered
        setSelectedOption(index);
        if (index === currentMCQ.correctIndex) {
            setQuizScore((s) => s + 1);
        }
    };

    const handleNextMCQ = () => {
        if (mcqIndex + 1 < mcqQuestions.length) {
            setMcqIndex((i) => i + 1);
            setSelectedOption(null);
        } else {
            setQuizFinished(true);
        }
    };

    const handleRestartQuiz = () => {
        setMcqIndex(0);
        setSelectedOption(null);
        setQuizScore(0);
        setQuizFinished(false);
    };

    const handleSaveCustomMCQ = () => {
        if (!customQuestion.trim() || customOptions.some((o) => !o.trim())) {
            return;
        }
        const newMCQ: MCQQuestion = {
            id: `custom_mcq_${Date.now()}`,
            question: customQuestion.trim(),
            options: customOptions.map((o) => o.trim()),
            correctIndex: customCorrectIndex,
            explanation: customExplanation.trim() || 'Custom student authored question.',
            level: quizLevel,
            subject: selectedSubject === 'All' ? 'Custom Course' : selectedSubject,
        };
        setMcqQuestions((prev) => [newMCQ, ...prev]);
        setShowCustomMcqModal(false);
        setCustomQuestion('');
        setCustomOptions(['', '', '', '']);
        setCustomExplanation('');
        setMcqIndex(0);
        setSelectedOption(null);
        setQuizFinished(false);
    };

    const totalDue = cardsForSubject.length;
    const subjectSubtitle =
        selectedSubject === 'All'
            ? `${folders.map((f) => f.name).join(' • ') || 'Connected Subjects'}`
            : `${selectedSubject} Deck`;

    return (
        <View style={[styles.container, { paddingTop: topPadding }]}>
            <StatusBar barStyle="dark-content" backgroundColor="#faf9f6" />

            {/* Top Brand Header */}
            <View style={styles.topHeader}>
                <View style={styles.headerCentered}>
                    <View style={styles.headerLeft}>
                        <Text style={styles.brandTitle}>cocampus</Text>
                        <View style={styles.termPill}>
                            <Text style={styles.termPillText}>Fall 2025</Text>
                            <Ionicons name="chevron-down" size={12} color="#1a1c1a" style={{ marginLeft: 4 }} />
                        </View>
                    </View>
                    <View style={styles.headerRight}>
                        <View style={styles.avatarCircle}>
                            <Text style={styles.avatarInitial}>K</Text>
                        </View>
                    </View>
                </View>
            </View>

            <ScrollView
                style={styles.scrollArea}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.responsiveWrapper}>
                    {/* View Mode Segmented Bar: Flashcards vs Quiz & MCQ Maker */}
                    <View style={styles.segmentedControl}>
                        <TouchableOpacity
                            style={[
                                styles.segmentedBtn,
                                viewMode === 'flashcards' && styles.segmentedBtnActive,
                            ]}
                            onPress={() => setViewMode('flashcards')}
                            activeOpacity={0.8}
                        >
                            <Ionicons
                                name="card-outline"
                                size={15}
                                color={viewMode === 'flashcards' ? '#ffffff' : '#45474c'}
                                style={{ marginRight: 6 }}
                            />
                            <Text
                                style={[
                                    styles.segmentedBtnText,
                                    viewMode === 'flashcards' && styles.segmentedBtnTextActive,
                                ]}
                            >
                                Flashcard Decks ({allFlashcards.length})
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.segmentedBtn,
                                viewMode === 'quiz' && styles.segmentedBtnActive,
                            ]}
                            onPress={() => setViewMode('quiz')}
                            activeOpacity={0.8}
                        >
                            <Ionicons
                                name="help-circle-outline"
                                size={16}
                                color={viewMode === 'quiz' ? '#ffffff' : '#45474c'}
                                style={{ marginRight: 6 }}
                            />
                            <Text
                                style={[
                                    styles.segmentedBtnText,
                                    viewMode === 'quiz' && styles.segmentedBtnTextActive,
                                ]}
                            >
                                Quiz & MCQ Maker
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Subject Filter Bar */}
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.subjectFilterScroll}
                    >
                        {availableSubjects.map((subjectName) => {
                            const isSelected = selectedSubject === subjectName;
                            return (
                                <TouchableOpacity
                                    key={subjectName}
                                    style={[styles.subjectFilterChip, isSelected && styles.subjectFilterChipActive]}
                                    onPress={() => {
                                        setSelectedSubject(subjectName);
                                        setCardIndex(0);
                                        setIsFlipped(false);
                                        Speech.stop();
                                        setIsSpeaking(false);
                                    }}
                                    activeOpacity={0.8}
                                >
                                    <Text
                                        style={[
                                            styles.subjectFilterChipText,
                                            isSelected && styles.subjectFilterChipTextActive,
                                        ]}
                                    >
                                        {subjectName}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>

                    {/* ================= FLASHCARD MODE ================= */}
                    {viewMode === 'flashcards' && (
                        <>
                            {/* Top Status & Motivation Banner */}
                            <View style={styles.sanctuaryCard}>
                                <View style={styles.sanctuaryTopRow}>
                                    <View>
                                        <Text style={styles.sanctuarySubtitle}>SANCTUARY RECALL</Text>
                                        <Text style={styles.sanctuaryTitle}>Active Recall & Cards</Text>
                                    </View>
                                    <View style={styles.fireBadge}>
                                        <Ionicons name="flame" size={15} color="#8a5300" />
                                        <Text style={styles.fireText}>5 Days Active</Text>
                                    </View>
                                </View>

                                <View style={styles.dueProgressBanner}>
                                    <View style={styles.ringGraphic}>
                                        <View style={styles.ringOuter}>
                                            <View style={styles.ringInner}>
                                                <Text style={styles.ringNumber}>{totalDue}</Text>
                                                <Text style={styles.ringLabel}>DUE</Text>
                                            </View>
                                        </View>
                                    </View>

                                    <View style={styles.dueTextWrap}>
                                        <Text style={styles.dueTitle}>{totalDue} Cards in Active Deck</Text>
                                        <Text style={styles.dueSubtitle} numberOfLines={1}>
                                            {subjectSubtitle}
                                        </Text>
                                        <View style={styles.dueMetaRow}>
                                            <Ionicons name="time-outline" size={13} color="#555d50" />
                                            <Text style={styles.dueMeta}>~{Math.ceil(totalDue * 0.75)} mins focused review</Text>
                                        </View>
                                    </View>
                                </View>

                                <TouchableOpacity
                                    style={styles.startReviewBtn}
                                    onPress={() => {
                                        if (onStartReview) {
                                            onStartReview();
                                        } else {
                                            handleFlip();
                                        }
                                    }}
                                    activeOpacity={0.9}
                                >
                                    <Ionicons name="play" size={14} color="#ffffff" style={{ marginRight: 6 }} />
                                    <Text style={styles.startReviewBtnText}>Start Daily Focused Review ({totalDue} Cards)</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Flashcard Header with Level Setter Dropdown */}
                            <View style={styles.sectionHeaderRow}>
                                <View style={styles.sectionHeaderTitleRow}>
                                    <Ionicons name="layers-outline" size={18} color="#182232" style={{ marginRight: 6 }} />
                                    <Text style={styles.sectionTitle}>
                                        Interactive Flashcards ({cardsForSubject.length} Available)
                                    </Text>
                                </View>

                                {/* Flashcard Level Setter Dropdown Trigger */}
                                <TouchableOpacity
                                    style={styles.levelDropdownTrigger}
                                    onPress={() => setShowFcLevelModal(true)}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="funnel-outline" size={12} color="#182232" style={{ marginRight: 4 }} />
                                    <Text style={styles.levelDropdownText}>
                                        {flashcardLevel === 'All' ? 'All Levels' : flashcardLevel}
                                    </Text>
                                    <Ionicons name="chevron-down" size={13} color="#182232" style={{ marginLeft: 4 }} />
                                </TouchableOpacity>
                            </View>

                            {/* Flashcard Hint Banner */}
                            <View style={styles.tapPromptRow}>
                                <Ionicons name="finger-print-outline" size={13} color="#75777d" style={{ marginRight: 5 }} />
                                <Text style={styles.tapPromptText}>Tap anywhere on card to flip between prompt and answer</Text>
                            </View>

                            {/* Main Interactive Flashcard (Tap to Flip) */}
                            {currentCard ? (
                                <TouchableOpacity
                                    style={[styles.flashcardCard, isFlipped && styles.flashcardCardFlipped]}
                                    activeOpacity={0.93}
                                    onPress={handleFlip}
                                >
                                    <View style={styles.flashcardTop}>
                                        <View style={styles.cardHeaderBadges}>
                                            <View style={styles.cardSubjectBadge}>
                                                <Text style={styles.cardSubjectText}>{currentCard.subject.toUpperCase()}</Text>
                                            </View>
                                            <View style={styles.cardLevelBadge}>
                                                <Text style={styles.cardLevelBadgeText}>{currentCard.level}</Text>
                                            </View>
                                        </View>

                                        <View style={styles.topActionsRow}>
                                            <TouchableOpacity
                                                style={[styles.audioPillBtn, isSpeaking && styles.audioPillBtnActive]}
                                                onPress={() =>
                                                    handleReadAudio(
                                                        isFlipped
                                                            ? `Target Answer: ${currentCard.answer}`
                                                            : `Recall Question: ${currentCard.question}`
                                                    )
                                                }
                                            >
                                                <Ionicons
                                                    name={isSpeaking ? 'volume-high' : 'volume-medium-outline'}
                                                    size={13}
                                                    color={isSpeaking ? '#ffffff' : '#4b6456'}
                                                />
                                                <Text style={[styles.audioPillText, isSpeaking && styles.audioPillTextActive]}>
                                                    {isSpeaking ? 'Reading' : 'Listen'}
                                                </Text>
                                            </TouchableOpacity>

                                            <View style={styles.flipPill}>
                                                <Ionicons name="swap-horizontal-outline" size={12} color="#45474c" />
                                                <Text style={styles.flipIndicator}>{isFlipped ? 'Answer' : 'Question'}</Text>
                                            </View>
                                        </View>
                                    </View>

                                    {!isFlipped ? (
                                        <View style={styles.cardBody}>
                                            <Text style={styles.cardPromptLabel}>RECALL QUESTION</Text>
                                            <Text style={styles.cardQuestionText}>{currentCard.question}</Text>
                                            <View style={styles.cardFooterRow}>
                                                <Ionicons name="information-circle-outline" size={13} color="#75777d" />
                                                <Text style={styles.cardFooterHint}>
                                                    Card {safeCardIndex + 1} of {cardsForSubject.length}
                                                </Text>
                                            </View>
                                        </View>
                                    ) : (
                                        <View style={styles.cardBody}>
                                            <Text style={styles.cardAnswerLabel}>TARGET ANSWER</Text>
                                            <Text style={styles.cardAnswerText}>{currentCard.answer}</Text>
                                            <Text style={styles.cardAnswerSub}>{currentCard.hint}</Text>
                                        </View>
                                    )}

                                    {/* Rating Bar (Appears when flipped) */}
                                    {isFlipped && (
                                        <View style={styles.ratingBar}>
                                            <TouchableOpacity
                                                style={styles.ratingBtn}
                                                onPress={() => handleRating('again')}
                                            >
                                                <Text style={styles.ratingBtnTitle}>Again</Text>
                                                <Text style={styles.ratingBtnSub}>&lt;1m</Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                style={styles.ratingBtn}
                                                onPress={() => handleRating('hard')}
                                            >
                                                <Text style={styles.ratingBtnTitle}>Hard</Text>
                                                <Text style={styles.ratingBtnSub}>12h</Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                style={[styles.ratingBtn, styles.ratingBtnGood]}
                                                onPress={() => handleRating('good')}
                                            >
                                                <Text style={[styles.ratingBtnTitle, styles.ratingBtnGoodText]}>Good</Text>
                                                <Text style={[styles.ratingBtnSub, styles.ratingBtnGoodText]}>1d</Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                style={styles.ratingBtn}
                                                onPress={() => handleRating('easy')}
                                            >
                                                <Text style={styles.ratingBtnTitle}>Easy</Text>
                                                <Text style={styles.ratingBtnSub}>4d</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            ) : (
                                <View style={styles.emptyCardBox}>
                                    <Ionicons name="file-tray-outline" size={32} color="#75777d" />
                                    <Text style={styles.emptyCardTitle}>No cards in this level</Text>
                                    <Text style={styles.emptyCardSub}>
                                        Select another difficulty level or show all cards.
                                    </Text>
                                    <TouchableOpacity
                                        style={styles.resetLevelBtn}
                                        onPress={() => setFlashcardLevel('All')}
                                    >
                                        <Text style={styles.resetLevelBtnText}>Show All Levels</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {/* Card Navigation Controls with explicit Next & Previous Buttons */}
                            {cardsForSubject.length > 0 && (
                                <View style={styles.navigationControlsRow}>
                                    <TouchableOpacity
                                        style={styles.navBtnPrev}
                                        onPress={handlePrevCard}
                                        activeOpacity={0.8}
                                    >
                                        <Ionicons name="chevron-back" size={16} color="#182232" />
                                        <Text style={styles.navBtnTextPrev}>Previous</Text>
                                    </TouchableOpacity>

                                    <View style={styles.cardCounterPill}>
                                        <Text style={styles.cardCounterText}>
                                            Card {safeCardIndex + 1} of {cardsForSubject.length}
                                        </Text>
                                    </View>

                                    <TouchableOpacity
                                        style={styles.navBtnNext}
                                        onPress={handleNextCard}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={styles.navBtnTextNext}>Next Card</Text>
                                        <Ionicons name="chevron-forward" size={16} color="#ffffff" style={{ marginLeft: 4 }} />
                                    </TouchableOpacity>
                                </View>
                            )}

                            {/* Study Modes Switcher */}
                            <View style={[styles.sectionHeaderRow, { marginTop: 26, marginBottom: 10 }]}>
                                <Text style={styles.sectionTitle}>Study Experience</Text>
                            </View>
                            <View style={styles.modeGrid}>
                                <TouchableOpacity
                                    style={[styles.modeCard, activeStudyMode === 'spaced' && styles.modeCardActive]}
                                    onPress={() => setActiveStudyMode('spaced')}
                                    activeOpacity={0.8}
                                >
                                    <View style={[styles.modeIconBox, activeStudyMode === 'spaced' && styles.modeIconBoxActive]}>
                                        <Ionicons
                                            name="git-network-outline"
                                            size={18}
                                            color={activeStudyMode === 'spaced' ? '#ffffff' : '#4b6456'}
                                        />
                                    </View>
                                    <View style={styles.modeTextWrap}>
                                        <Text style={styles.modeTitle}>Spaced Repetition</Text>
                                        <Text style={styles.modeSubtitle}>Optimal retention</Text>
                                    </View>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.modeCard, activeStudyMode === 'cram' && styles.modeCardActive]}
                                    onPress={() => setActiveStudyMode('cram')}
                                    activeOpacity={0.8}
                                >
                                    <View style={[styles.modeIconBox, activeStudyMode === 'cram' && styles.modeIconBoxActive]}>
                                        <Ionicons
                                            name="flash-outline"
                                            size={18}
                                            color={activeStudyMode === 'cram' ? '#ffffff' : '#8a5300'}
                                        />
                                    </View>
                                    <View style={styles.modeTextWrap}>
                                        <Text style={styles.modeTitle}>Cram Mode</Text>
                                        <Text style={styles.modeSubtitle}>Rapid cycle all</Text>
                                    </View>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.modeCard, activeStudyMode === 'audio' && styles.modeCardActive]}
                                    onPress={() => {
                                        setActiveStudyMode('audio');
                                        if (currentCard) {
                                            handleReadAudio(`Question: ${currentCard.question}. Answer: ${currentCard.answer}`);
                                        }
                                    }}
                                    activeOpacity={0.8}
                                >
                                    <View style={[styles.modeIconBox, activeStudyMode === 'audio' && styles.modeIconBoxActive]}>
                                        <Ionicons
                                            name="headset-outline"
                                            size={18}
                                            color={activeStudyMode === 'audio' ? '#ffffff' : '#1b4d3e'}
                                        />
                                    </View>
                                    <View style={styles.modeTextWrap}>
                                        <Text style={styles.modeTitle}>Audio Recall</Text>
                                        <Text style={styles.modeSubtitle}>Hands-free commute</Text>
                                    </View>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.modeCard, activeStudyMode === 'practice' && styles.modeCardActive]}
                                    onPress={() => setViewMode('quiz')}
                                    activeOpacity={0.8}
                                >
                                    <View style={[styles.modeIconBox, activeStudyMode === 'practice' && styles.modeIconBoxActive]}>
                                        <Ionicons
                                            name="document-text-outline"
                                            size={18}
                                            color={activeStudyMode === 'practice' ? '#ffffff' : '#334155'}
                                        />
                                    </View>
                                    <View style={styles.modeTextWrap}>
                                        <Text style={styles.modeTitle}>Practice Exam</Text>
                                        <Text style={styles.modeSubtitle}>Switch to Quiz Area</Text>
                                    </View>
                                </TouchableOpacity>
                            </View>

                            {/* Active Decks from Home */}
                            <View style={[styles.sectionHeaderRow, { marginTop: 24, marginBottom: 12 }]}>
                                <Text style={styles.sectionTitle}>Active Decks from Home</Text>
                                <Text style={styles.manageLink}>{folders.length} Subjects</Text>
                            </View>

                            <View style={styles.deckList}>
                                {folders.map((folder, idx) => {
                                    const folderNotes = notes.filter(
                                        (n) =>
                                            n.subjectSlug.toLowerCase() === folder.id.toLowerCase() ||
                                            n.subject.toLowerCase() === folder.name.toLowerCase()
                                    );
                                    const cardCount = Math.max(
                                        10,
                                        folderNotes.reduce((sum, n) => sum + (n.flashcards?.length || 0), 0)
                                    );
                                    const isCurrent = selectedSubject === folder.name;
                                    const dotColors = ['#4b6456', '#d0916f', '#3b82f6', '#8b5cf6'];
                                    const dotColor = dotColors[idx % dotColors.length];

                                    return (
                                        <TouchableOpacity
                                            key={folder.id}
                                            style={[styles.deckCard, isCurrent && styles.deckCardCurrent]}
                                            onPress={() => {
                                                setSelectedSubject(folder.name);
                                                setCardIndex(0);
                                                setIsFlipped(false);
                                            }}
                                            activeOpacity={0.85}
                                        >
                                            <View style={styles.deckHeader}>
                                                <View style={styles.deckTitleRow}>
                                                    <View style={[styles.deckDot, { backgroundColor: dotColor }]} />
                                                    <Text style={styles.deckTitle}>{folder.name}</Text>
                                                </View>
                                                <View style={[styles.deckBadge, isCurrent && styles.deckBadgeCurrent]}>
                                                    <Text
                                                        style={[
                                                            styles.deckBadgeText,
                                                            isCurrent && styles.deckBadgeTextCurrent,
                                                        ]}
                                                    >
                                                        {folder.examTag || (isCurrent ? 'Active Deck' : `${cardCount} Cards`)}
                                                    </Text>
                                                </View>
                                            </View>
                                            <Text style={styles.deckMeta}>
                                                {folder.name} • {cardCount} cards • {folderNotes.length || 1} note linked
                                            </Text>
                                            <View style={styles.progressBarBg}>
                                                <View
                                                    style={[
                                                        styles.progressBarFill,
                                                        {
                                                            width: `${Math.min(100, 40 + idx * 25)}%`,
                                                            backgroundColor: dotColor,
                                                        },
                                                    ]}
                                                />
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </>
                    )}

                    {/* ================= QUIZ & MCQ MAKER MODE ================= */}
                    {viewMode === 'quiz' && (
                        <View style={styles.quizAreaContainer}>
                            {/* Quiz Controls Header */}
                            <View style={styles.quizHeaderCard}>
                                <View style={styles.quizHeaderTop}>
                                    <View>
                                        <Text style={styles.quizHeaderSubtitle}>ASSESSMENT & DRILL</Text>
                                        <Text style={styles.quizHeaderTitle}>Interactive Quiz Area</Text>
                                    </View>

                                    {/* MCQ Level Setter Dropdown */}
                                    <TouchableOpacity
                                        style={styles.levelDropdownTrigger}
                                        onPress={() => setShowQuizLevelModal(true)}
                                        activeOpacity={0.8}
                                    >
                                        <Ionicons name="options-outline" size={12} color="#182232" style={{ marginRight: 4 }} />
                                        <Text style={styles.levelDropdownText}>{quizLevel}</Text>
                                        <Ionicons name="chevron-down" size={13} color="#182232" style={{ marginLeft: 4 }} />
                                    </TouchableOpacity>
                                </View>

                                <Text style={styles.quizHeaderDesc}>
                                    Reinforce exam topics with multiple choice questions calibrated to your chosen mastery tier.
                                </Text>

                                {/* MCQ Maker Actions */}
                                <View style={styles.mcqMakerBar}>
                                    <TouchableOpacity
                                        style={styles.generateMcqBtn}
                                        onPress={loadQuizQuestions}
                                        disabled={isGeneratingMCQs}
                                        activeOpacity={0.8}
                                    >
                                        {isGeneratingMCQs ? (
                                            <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 6 }} />
                                        ) : (
                                            <Ionicons name="sparkles-outline" size={14} color="#ffffff" style={{ marginRight: 6 }} />
                                        )}
                                        <Text style={styles.generateMcqBtnText}>
                                            {isGeneratingMCQs ? 'Generating MCQs...' : 'Generate New MCQ Set'}
                                        </Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.customMcqBtn}
                                        onPress={() => setShowCustomMcqModal(true)}
                                        activeOpacity={0.8}
                                    >
                                        <Ionicons name="add-circle-outline" size={14} color="#182232" style={{ marginRight: 4 }} />
                                        <Text style={styles.customMcqBtnText}>MCQ Maker</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Quiz Interactive Board */}
                            {isGeneratingMCQs ? (
                                <View style={styles.quizLoadingCard}>
                                    <ActivityIndicator size="large" color="#182232" />
                                    <Text style={styles.quizLoadingTitle}>Generating MCQs for {selectedSubject}...</Text>
                                    <Text style={styles.quizLoadingSub}>
                                        Synthesizing questions at {quizLevel} level from your notes.
                                    </Text>
                                </View>
                            ) : quizFinished ? (
                                /* Quiz Completion Screen */
                                <View style={styles.quizFinishedCard}>
                                    <View style={styles.trophyIconBox}>
                                        <Ionicons name="ribbon-outline" size={36} color="#4b6456" />
                                    </View>
                                    <Text style={styles.quizFinishedTitle}>Quiz Completed!</Text>
                                    <Text style={styles.quizFinishedScore}>
                                        Score: {quizScore} / {mcqQuestions.length} ({Math.round((quizScore / (mcqQuestions.length || 1)) * 100)}%)
                                    </Text>
                                    <Text style={styles.quizFinishedSub}>
                                        {quizScore === mcqQuestions.length
                                            ? 'Exceptional mastery across all assessed concepts!'
                                            : quizScore >= (mcqQuestions.length / 2)
                                            ? 'Solid performance. Review the explanations to lock in full retention.'
                                            : 'Recommended to review flashcards before reattempting.'}
                                    </Text>

                                    <View style={styles.quizFinishedActionsRow}>
                                        <TouchableOpacity
                                            style={styles.restartQuizBtn}
                                            onPress={handleRestartQuiz}
                                            activeOpacity={0.8}
                                        >
                                            <Ionicons name="refresh" size={14} color="#ffffff" style={{ marginRight: 6 }} />
                                            <Text style={styles.restartQuizBtnText}>Retake Quiz</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={styles.changeLevelBtn}
                                            onPress={() => setShowQuizLevelModal(true)}
                                            activeOpacity={0.8}
                                        >
                                            <Text style={styles.changeLevelBtnText}>Change Level</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ) : currentMCQ ? (
                                /* Active Question Card */
                                <View style={styles.mcqCard}>
                                    {/* Question Meta Header */}
                                    <View style={styles.mcqMetaRow}>
                                        <View style={styles.mcqIndexPill}>
                                            <Text style={styles.mcqIndexPillText}>
                                                Question {mcqIndex + 1} of {mcqQuestions.length}
                                            </Text>
                                        </View>
                                        <View style={styles.mcqLevelPill}>
                                            <Text style={styles.mcqLevelPillText}>{currentMCQ.level}</Text>
                                        </View>
                                        <View style={styles.mcqScorePill}>
                                            <Text style={styles.mcqScorePillText}>
                                                Score: {quizScore}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Question Text */}
                                    <Text style={styles.mcqQuestionText}>{currentMCQ.question}</Text>

                                    {/* 4 Options */}
                                    <View style={styles.mcqOptionsList}>
                                        {currentMCQ.options.map((optionText, optIdx) => {
                                            const isSelected = selectedOption === optIdx;
                                            const isAnswered = selectedOption !== null;
                                            const isCorrectChoice = optIdx === currentMCQ.correctIndex;

                                            const letters = ['A', 'B', 'C', 'D'];

                                            return (
                                                <TouchableOpacity
                                                    key={optIdx}
                                                    style={[
                                                        styles.optionBtn,
                                                        isSelected && !isAnswered && styles.optionBtnSelected,
                                                        isAnswered && isCorrectChoice && styles.optionBtnCorrect,
                                                        isAnswered && isSelected && !isCorrectChoice && styles.optionBtnIncorrect,
                                                    ]}
                                                    onPress={() => handleSelectMCQOption(optIdx)}
                                                    disabled={isAnswered}
                                                    activeOpacity={0.8}
                                                >
                                                    <View
                                                        style={[
                                                            styles.optionLetter,
                                                            isAnswered && isCorrectChoice && styles.optionLetterCorrect,
                                                            isAnswered && isSelected && !isCorrectChoice && styles.optionLetterIncorrect,
                                                        ]}
                                                    >
                                                        <Text
                                                            style={[
                                                                styles.optionLetterChar,
                                                                isAnswered && (isCorrectChoice || (isSelected && !isCorrectChoice)) && styles.optionLetterCharActive,
                                                            ]}
                                                        >
                                                            {letters[optIdx]}
                                                        </Text>
                                                    </View>
                                                    <Text
                                                        style={[
                                                            styles.optionText,
                                                            isAnswered && isCorrectChoice && styles.optionTextCorrect,
                                                            isAnswered && isSelected && !isCorrectChoice && styles.optionTextIncorrect,
                                                        ]}
                                                    >
                                                        {optionText}
                                                    </Text>
                                                    {isAnswered && isCorrectChoice && (
                                                        <Ionicons
                                                            name="checkmark-circle"
                                                            size={18}
                                                            color="#1b4d3e"
                                                            style={{ marginLeft: 'auto' }}
                                                        />
                                                    )}
                                                    {isAnswered && isSelected && !isCorrectChoice && (
                                                        <Ionicons
                                                            name="close-circle"
                                                            size={18}
                                                            color="#b91c1c"
                                                            style={{ marginLeft: 'auto' }}
                                                        />
                                                    )}
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>

                                    {/* Explanation Box (Visible after answering) */}
                                    {selectedOption !== null && (
                                        <View style={styles.explanationBox}>
                                            <View style={styles.explanationHeaderRow}>
                                                <Ionicons name="bulb-outline" size={14} color="#182232" style={{ marginRight: 4 }} />
                                                <Text style={styles.explanationTitle}>
                                                    {selectedOption === currentMCQ.correctIndex ? 'Correct!' : 'Incorrect'}
                                                </Text>
                                            </View>
                                            <Text style={styles.explanationBody}>{currentMCQ.explanation}</Text>
                                        </View>
                                    )}

                                    {/* Next Question Navigation */}
                                    {selectedOption !== null && (
                                        <TouchableOpacity
                                            style={styles.nextMcqBtn}
                                            onPress={handleNextMCQ}
                                            activeOpacity={0.8}
                                        >
                                            <Text style={styles.nextMcqBtnText}>
                                                {mcqIndex + 1 < mcqQuestions.length ? 'Next Question' : 'Complete Quiz & View Score'}
                                            </Text>
                                            <Ionicons name="chevron-forward" size={16} color="#ffffff" style={{ marginLeft: 6 }} />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            ) : (
                                <View style={styles.emptyCardBox}>
                                    <Ionicons name="help-circle-outline" size={32} color="#75777d" />
                                    <Text style={styles.emptyCardTitle}>No MCQs available</Text>
                                    <Text style={styles.emptyCardSub}>
                                        Tap below to generate a new quiz set for {selectedSubject}.
                                    </Text>
                                    <TouchableOpacity style={styles.resetLevelBtn} onPress={loadQuizQuestions}>
                                        <Text style={styles.resetLevelBtnText}>Generate Questions</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    )}

                    {/* Calm Editorial Thought */}
                    <View style={styles.calmQuoteCard}>
                        <Ionicons name="leaf-outline" size={18} color="#4b6456" style={{ marginRight: 10 }} />
                        <Text style={styles.calmQuoteText}>
                            Consistent daily active recall yields 3x stronger long-term exam retention than passive re-reading.
                        </Text>
                    </View>
                </View>
            </ScrollView>

            {/* ================= MODAL: FLASHCARD LEVEL SETTER ================= */}
            <Modal
                visible={showFcLevelModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowFcLevelModal(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowFcLevelModal(false)}
                >
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Select Flashcard Level</Text>
                            <TouchableOpacity onPress={() => setShowFcLevelModal(false)}>
                                <Ionicons name="close" size={20} color="#182232" />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.modalSub}>
                            Filter study deck cards by conceptual difficulty:
                        </Text>

                        {(['All', 'Foundations', 'Core Concepts', 'Exam Mastery'] as FlashcardLevel[]).map((lvl) => {
                            const isSelected = flashcardLevel === lvl;
                            return (
                                <TouchableOpacity
                                    key={lvl}
                                    style={[styles.levelOptionItem, isSelected && styles.levelOptionItemSelected]}
                                    onPress={() => {
                                        setFlashcardLevel(lvl);
                                        setCardIndex(0);
                                        setIsFlipped(false);
                                        setShowFcLevelModal(false);
                                    }}
                                >
                                    <View>
                                        <Text
                                            style={[
                                                styles.levelOptionItemTitle,
                                                isSelected && styles.levelOptionItemTitleSelected,
                                            ]}
                                        >
                                            {lvl === 'All' ? 'All Difficulty Levels' : lvl}
                                        </Text>
                                        <Text style={styles.levelOptionItemSub}>
                                            {lvl === 'All'
                                                ? 'Review all cards across complete course scope'
                                                : lvl === 'Foundations'
                                                ? 'Basic definitions, terminology, and key statements'
                                                : lvl === 'Core Concepts'
                                                ? 'Standard theorems, mechanics, and relationships'
                                                : 'Advanced proofs, edge cases, and exam questions'}
                                        </Text>
                                    </View>
                                    {isSelected && <Ionicons name="checkmark" size={18} color="#182232" />}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* ================= MODAL: QUIZ LEVEL SETTER ================= */}
            <Modal
                visible={showQuizLevelModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowQuizLevelModal(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowQuizLevelModal(false)}
                >
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Select Quiz Difficulty</Text>
                            <TouchableOpacity onPress={() => setShowQuizLevelModal(false)}>
                                <Ionicons name="close" size={20} color="#182232" />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.modalSub}>
                            Set the complexity level for Multiple Choice Questions:
                        </Text>

                        {(['Foundations', 'Standard', 'Hard'] as QuizLevel[]).map((lvl) => {
                            const isSelected = quizLevel === lvl;
                            return (
                                <TouchableOpacity
                                    key={lvl}
                                    style={[styles.levelOptionItem, isSelected && styles.levelOptionItemSelected]}
                                    onPress={() => {
                                        setQuizLevel(lvl);
                                        setShowQuizLevelModal(false);
                                    }}
                                >
                                    <View>
                                        <Text
                                            style={[
                                                styles.levelOptionItemTitle,
                                                isSelected && styles.levelOptionItemTitleSelected,
                                            ]}
                                        >
                                            {lvl}
                                        </Text>
                                        <Text style={styles.levelOptionItemSub}>
                                            {lvl === 'Foundations'
                                                ? 'Fundamental definitions and core theorem recognition'
                                                : lvl === 'Standard'
                                                ? 'Application of concepts, typical midterm problems'
                                                : 'Complex deductions, proofs, and tricky exam traps'}
                                        </Text>
                                    </View>
                                    {isSelected && <Ionicons name="checkmark" size={18} color="#182232" />}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* ================= MODAL: MCQ MAKER (CUSTOM QUESTION) ================= */}
            <Modal
                visible={showCustomMcqModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowCustomMcqModal(false)}
            >
                <View style={[styles.modalFullscreen, { paddingTop: Math.max(insets.top, 12), paddingBottom: Math.max(insets.bottom, 16) }]}>
                    <View style={styles.customModalInner}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>MCQ Maker</Text>
                                <Text style={styles.modalSub}>Author a practice question for {selectedSubject}</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowCustomMcqModal(false)}>
                                <Ionicons name="close" size={22} color="#182232" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                            <Text style={styles.inputLabel}>QUESTION PROMPT</Text>
                            <TextInput
                                style={styles.textInputArea}
                                placeholder="Enter question or problem statement..."
                                placeholderTextColor="#94a3b8"
                                multiline
                                numberOfLines={3}
                                value={customQuestion}
                                onChangeText={setCustomQuestion}
                            />

                            <Text style={styles.inputLabel}>FOUR CHOICES (SELECT CORRECT ONE)</Text>
                            {customOptions.map((opt, idx) => {
                                const letters = ['A', 'B', 'C', 'D'];
                                const isCorrect = customCorrectIndex === idx;
                                return (
                                    <View key={idx} style={styles.customOptionRow}>
                                        <TouchableOpacity
                                            style={[
                                                styles.customCorrectToggle,
                                                isCorrect && styles.customCorrectToggleActive,
                                            ]}
                                            onPress={() => setCustomCorrectIndex(idx)}
                                        >
                                            <Text
                                                style={[
                                                    styles.customCorrectToggleText,
                                                    isCorrect && styles.customCorrectToggleTextActive,
                                                ]}
                                            >
                                                {letters[idx]}
                                            </Text>
                                        </TouchableOpacity>
                                        <TextInput
                                            style={[
                                                styles.textInputField,
                                                isCorrect && styles.textInputFieldCorrect,
                                            ]}
                                            placeholder={`Choice ${letters[idx]}...`}
                                            placeholderTextColor="#94a3b8"
                                            value={opt}
                                            onChangeText={(txt) => {
                                                const updated = [...customOptions];
                                                updated[idx] = txt;
                                                setCustomOptions(updated);
                                            }}
                                        />
                                    </View>
                                );
                            })}

                            <Text style={styles.inputLabel}>ACADEMIC EXPLANATION (OPTIONAL)</Text>
                            <TextInput
                                style={styles.textInputArea}
                                placeholder="Explain why the marked answer is correct..."
                                placeholderTextColor="#94a3b8"
                                multiline
                                numberOfLines={2}
                                value={customExplanation}
                                onChangeText={setCustomExplanation}
                            />

                            <TouchableOpacity
                                style={styles.saveMcqBtn}
                                onPress={handleSaveCustomMCQ}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="checkmark-circle-outline" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                                <Text style={styles.saveMcqBtnText}>Save and Add to Active Quiz</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#faf9f6',
    },
    topHeader: {
        backgroundColor: '#faf9f6',
        borderBottomWidth: 1,
        borderBottomColor: '#efeeeb',
        paddingVertical: 10,
        paddingHorizontal: 20,
    },
    headerCentered: {
        width: '100%',
        maxWidth: 880,
        alignSelf: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    brandTitle: {
        fontSize: 19,
        fontWeight: '800',
        color: '#182232',
        letterSpacing: -0.5,
    },
    termPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f4f3f0',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 14,
    },
    termPillText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#1a1c1a',
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatarCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#cde9d8',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarInitial: {
        color: '#082015',
        fontWeight: '700',
        fontSize: 14,
    },
    scrollArea: {
        flex: 1,
    },
    scrollContent: {
        paddingVertical: 16,
        paddingHorizontal: 16,
        paddingBottom: 130,
    },
    responsiveWrapper: {
        width: '100%',
        maxWidth: 880,
        alignSelf: 'center',
    },

    // Segmented Mode Switcher
    segmentedControl: {
        flexDirection: 'row',
        backgroundColor: '#eeece7',
        borderRadius: 12,
        padding: 3,
        marginBottom: 14,
    },
    segmentedBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 9,
        borderRadius: 10,
    },
    segmentedBtnActive: {
        backgroundColor: '#182232',
        shadowColor: '#182232',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 1,
    },
    segmentedBtnText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#45474c',
    },
    segmentedBtnTextActive: {
        color: '#ffffff',
    },

    // Subject Filter Scroll
    subjectFilterScroll: {
        flexDirection: 'row',
        gap: 8,
        paddingBottom: 14,
    },
    subjectFilterChip: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 18,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e0dc',
    },
    subjectFilterChipActive: {
        backgroundColor: '#182232',
        borderColor: '#182232',
    },
    subjectFilterChipText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#45474c',
    },
    subjectFilterChipTextActive: {
        color: '#ffffff',
    },

    // Motivation Card
    sanctuaryCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 18,
        shadowColor: '#182232',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#e8e6e1',
    },
    sanctuaryTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 14,
    },
    sanctuarySubtitle: {
        fontSize: 11,
        fontWeight: '700',
        color: '#4b6456',
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    sanctuaryTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#182232',
        marginTop: 2,
    },
    fireBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffdbca',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 16,
        gap: 4,
    },
    fireText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#331100',
    },
    dueProgressBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f7f6f2',
        borderRadius: 14,
        padding: 14,
        marginBottom: 16,
        gap: 14,
    },
    ringGraphic: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    ringOuter: {
        width: 58,
        height: 58,
        borderRadius: 29,
        borderWidth: 4,
        borderColor: '#4b6456',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ffffff',
    },
    ringInner: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    ringNumber: {
        fontSize: 18,
        fontWeight: '800',
        color: '#182232',
        lineHeight: 20,
    },
    ringLabel: {
        fontSize: 9,
        fontWeight: '700',
        color: '#75777d',
        letterSpacing: 0.5,
    },
    dueTextWrap: {
        flex: 1,
    },
    dueTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#182232',
    },
    dueSubtitle: {
        fontSize: 13,
        fontWeight: '500',
        color: '#45474c',
        marginTop: 2,
    },
    dueMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 4,
    },
    dueMeta: {
        fontSize: 12,
        color: '#75777d',
    },
    startReviewBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#182232',
        paddingVertical: 12,
        borderRadius: 12,
    },
    startReviewBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#ffffff',
    },

    // Section Header & Dropdown
    sectionHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    sectionHeaderTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#182232',
    },
    levelDropdownTrigger: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#d6d3cb',
    },
    levelDropdownText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#182232',
    },
    tapPromptRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    tapPromptText: {
        fontSize: 12,
        color: '#75777d',
        fontWeight: '500',
    },

    // Flashcard Card
    flashcardCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 18,
        shadowColor: '#182232',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
        marginBottom: 12,
        borderWidth: 1.5,
        borderColor: '#e8e6e1',
        minHeight: 200,
    },
    flashcardCardFlipped: {
        borderColor: '#4b6456',
        backgroundColor: '#fbfdfb',
    },
    flashcardTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    cardHeaderBadges: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    cardSubjectBadge: {
        backgroundColor: '#e6ede8',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    cardSubjectText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#1b4d3e',
        letterSpacing: 0.5,
    },
    cardLevelBadge: {
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    cardLevelBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#475569',
    },
    topActionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    audioPillBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f1f5f2',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    audioPillBtnActive: {
        backgroundColor: '#4b6456',
    },
    audioPillText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#4b6456',
    },
    audioPillTextActive: {
        color: '#ffffff',
    },
    flipPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f4f3f0',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    flipIndicator: {
        fontSize: 11,
        fontWeight: '600',
        color: '#45474c',
    },
    cardBody: {
        minHeight: 110,
        justifyContent: 'center',
    },
    cardPromptLabel: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1.2,
        color: '#75777d',
        textTransform: 'uppercase',
        marginBottom: 8,
    },
    cardQuestionText: {
        fontSize: 17,
        fontWeight: '700',
        color: '#182232',
        lineHeight: 25,
    },
    cardFooterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 14,
        gap: 4,
    },
    cardFooterHint: {
        fontSize: 12,
        color: '#75777d',
    },
    cardAnswerLabel: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1.2,
        color: '#4b6456',
        textTransform: 'uppercase',
        marginBottom: 8,
    },
    cardAnswerText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1b4d3e',
        lineHeight: 24,
    },
    cardAnswerSub: {
        fontSize: 12,
        color: '#75777d',
        marginTop: 8,
        fontStyle: 'italic',
    },
    ratingBar: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 16,
        paddingTop: 14,
        borderTopWidth: 1,
        borderTopColor: '#f0eeea',
    },
    ratingBtn: {
        flex: 1,
        backgroundColor: '#f7f6f2',
        paddingVertical: 8,
        borderRadius: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e4e2de',
    },
    ratingBtnGood: {
        backgroundColor: '#e6ede8',
        borderColor: '#b2cdbc',
    },
    ratingBtnTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: '#182232',
    },
    ratingBtnGoodText: {
        color: '#082015',
    },
    ratingBtnSub: {
        fontSize: 10,
        color: '#75777d',
        marginTop: 2,
    },

    // Navigation Controls Bar
    navigationControlsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#ffffff',
        borderRadius: 14,
        padding: 10,
        borderWidth: 1,
        borderColor: '#e8e6e1',
        marginBottom: 16,
    },
    navBtnPrev: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f4f3f0',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 10,
    },
    navBtnTextPrev: {
        fontSize: 13,
        fontWeight: '600',
        color: '#182232',
        marginLeft: 2,
    },
    cardCounterPill: {
        paddingHorizontal: 12,
        paddingVertical: 5,
        backgroundColor: '#faf9f6',
        borderRadius: 8,
    },
    cardCounterText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#45474c',
    },
    navBtnNext: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#182232',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 10,
    },
    navBtnTextNext: {
        fontSize: 13,
        fontWeight: '700',
        color: '#ffffff',
    },

    // Empty Box
    emptyCardBox: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#e8e6e1',
        marginBottom: 14,
    },
    emptyCardTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#182232',
        marginTop: 8,
    },
    emptyCardSub: {
        fontSize: 13,
        color: '#75777d',
        textAlign: 'center',
        marginTop: 4,
        marginBottom: 14,
        lineHeight: 18,
    },
    resetLevelBtn: {
        backgroundColor: '#182232',
        paddingHorizontal: 16,
        paddingVertical: 9,
        borderRadius: 10,
    },
    resetLevelBtnText: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: '700',
    },

    // Mode Grid
    modeGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 10,
    },
    modeCard: {
        width: '48.5%',
        backgroundColor: '#ffffff',
        borderRadius: 14,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e8e6e1',
        gap: 10,
    },
    modeCardActive: {
        borderColor: '#182232',
        backgroundColor: '#fdfdfb',
    },
    modeIconBox: {
        width: 34,
        height: 34,
        borderRadius: 10,
        backgroundColor: '#f4f3f0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modeIconBoxActive: {
        backgroundColor: '#182232',
    },
    modeTextWrap: {
        flex: 1,
    },
    modeTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#182232',
    },
    modeSubtitle: {
        fontSize: 11,
        color: '#75777d',
        marginTop: 1,
    },

    // Decks List
    deckList: {
        gap: 10,
        marginBottom: 16,
    },
    deckCard: {
        backgroundColor: '#ffffff',
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: '#e8e6e1',
    },
    deckCardCurrent: {
        borderColor: '#4b6456',
        backgroundColor: '#fcfdfc',
    },
    deckHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    deckTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    deckDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    deckTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#182232',
    },
    deckBadge: {
        backgroundColor: '#f4f3f0',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
    },
    deckBadgeCurrent: {
        backgroundColor: '#e6ede8',
    },
    deckBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#45474c',
    },
    deckBadgeTextCurrent: {
        color: '#1b4d3e',
    },
    deckMeta: {
        fontSize: 12,
        color: '#75777d',
        marginBottom: 8,
    },
    progressBarBg: {
        height: 4,
        backgroundColor: '#f0eeea',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 2,
    },
    manageLink: {
        fontSize: 13,
        fontWeight: '600',
        color: '#4b6456',
    },

    // ================= QUIZ & MCQ MAKER STYLES =================
    quizAreaContainer: {
        marginBottom: 10,
    },
    quizHeaderCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 18,
        borderWidth: 1,
        borderColor: '#e8e6e1',
        marginBottom: 14,
        shadowColor: '#182232',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 1,
    },
    quizHeaderTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 6,
    },
    quizHeaderSubtitle: {
        fontSize: 11,
        fontWeight: '700',
        color: '#4b6456',
        letterSpacing: 1,
    },
    quizHeaderTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#182232',
        marginTop: 2,
    },
    quizHeaderDesc: {
        fontSize: 13,
        color: '#64748b',
        lineHeight: 18,
        marginBottom: 14,
    },
    mcqMakerBar: {
        flexDirection: 'row',
        gap: 10,
    },
    generateMcqBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#182232',
        paddingVertical: 10,
        borderRadius: 10,
    },
    generateMcqBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#ffffff',
    },
    customMcqBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f4f3f0',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#e2e0dc',
    },
    customMcqBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#182232',
    },
    quizLoadingCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 36,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#e8e6e1',
        marginBottom: 14,
    },
    quizLoadingTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#182232',
        marginTop: 14,
    },
    quizLoadingSub: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 4,
    },

    // Active MCQ Question Card
    mcqCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 18,
        borderWidth: 1,
        borderColor: '#e8e6e1',
        shadowColor: '#182232',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
        marginBottom: 14,
    },
    mcqMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    mcqIndexPill: {
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    mcqIndexPillText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#1e293b',
    },
    mcqLevelPill: {
        backgroundColor: '#fef3c7',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    mcqLevelPillText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#92400e',
    },
    mcqScorePill: {
        marginLeft: 'auto',
        backgroundColor: '#e6ede8',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    mcqScorePillText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#1b4d3e',
    },
    mcqQuestionText: {
        fontSize: 17,
        fontWeight: '700',
        color: '#182232',
        lineHeight: 24,
        marginBottom: 16,
    },
    mcqOptionsList: {
        gap: 9,
    },
    optionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
    },
    optionBtnSelected: {
        borderColor: '#182232',
        backgroundColor: '#f8fafc',
    },
    optionBtnCorrect: {
        borderColor: '#10b981',
        backgroundColor: '#ecfdf5',
    },
    optionBtnIncorrect: {
        borderColor: '#ef4444',
        backgroundColor: '#fef2f2',
    },
    optionLetter: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    optionLetterCorrect: {
        backgroundColor: '#10b981',
    },
    optionLetterIncorrect: {
        backgroundColor: '#ef4444',
    },
    optionLetterChar: {
        fontSize: 12,
        fontWeight: '700',
        color: '#1e293b',
    },
    optionLetterCharActive: {
        color: '#ffffff',
    },
    optionText: {
        fontSize: 14,
        color: '#334155',
        fontWeight: '500',
        flex: 1,
        lineHeight: 20,
    },
    optionTextCorrect: {
        color: '#065f46',
        fontWeight: '700',
    },
    optionTextIncorrect: {
        color: '#991b1b',
        fontWeight: '600',
    },
    explanationBox: {
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        padding: 14,
        marginTop: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    explanationHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    explanationTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: '#182232',
    },
    explanationBody: {
        fontSize: 13,
        color: '#475569',
        lineHeight: 19,
    },
    nextMcqBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#182232',
        paddingVertical: 12,
        borderRadius: 12,
        marginTop: 14,
    },
    nextMcqBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#ffffff',
    },

    // Quiz Finished Card
    quizFinishedCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 28,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#e8e6e1',
        marginBottom: 14,
    },
    trophyIconBox: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#e6ede8',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    quizFinishedTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#182232',
    },
    quizFinishedScore: {
        fontSize: 17,
        fontWeight: '700',
        color: '#4b6456',
        marginTop: 4,
    },
    quizFinishedSub: {
        fontSize: 13,
        color: '#64748b',
        textAlign: 'center',
        marginTop: 6,
        marginBottom: 20,
        lineHeight: 18,
    },
    quizFinishedActionsRow: {
        flexDirection: 'row',
        gap: 10,
    },
    restartQuizBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#182232',
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 10,
    },
    restartQuizBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#ffffff',
    },
    changeLevelBtn: {
        backgroundColor: '#f4f3f0',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#e2e0dc',
    },
    changeLevelBtnText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#182232',
    },

    // Calm Thought Banner
    calmQuoteCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f2f6f3',
        borderRadius: 14,
        padding: 14,
        marginTop: 8,
        borderWidth: 1,
        borderColor: '#dbe8df',
    },
    calmQuoteText: {
        flex: 1,
        fontSize: 12,
        color: '#2a4436',
        lineHeight: 18,
        fontWeight: '500',
    },

    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalCard: {
        width: '100%',
        maxWidth: 440,
        maxHeight: '85%',
        backgroundColor: '#ffffff',
        borderRadius: 18,
        padding: 20,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 6,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    modalTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#182232',
    },
    modalSub: {
        fontSize: 13,
        color: '#64748b',
        marginBottom: 14,
    },
    levelOptionItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 10,
        marginBottom: 6,
        backgroundColor: '#f8fafc',
    },
    levelOptionItemSelected: {
        backgroundColor: '#e6ede8',
    },
    levelOptionItemTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#182232',
    },
    levelOptionItemTitleSelected: {
        color: '#1b4d3e',
    },
    levelOptionItemSub: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 2,
        maxWidth: 320,
    },

    // Custom MCQ Modal Fullscreen
    modalFullscreen: {
        flex: 1,
        backgroundColor: '#faf9f6',
    },
    customModalInner: {
        flex: 1,
        padding: 20,
        maxWidth: 680,
        width: '100%',
        alignSelf: 'center',
    },
    inputLabel: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 1,
        color: '#64748b',
        marginTop: 14,
        marginBottom: 6,
    },
    textInputArea: {
        backgroundColor: '#ffffff',
        borderRadius: 10,
        padding: 12,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        fontSize: 14,
        color: '#1e293b',
        textAlignVertical: 'top',
    },
    textInputField: {
        flex: 1,
        backgroundColor: '#ffffff',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        fontSize: 14,
        color: '#1e293b',
    },
    textInputFieldCorrect: {
        borderColor: '#10b981',
        backgroundColor: '#f0fdf4',
    },
    customOptionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 8,
    },
    customCorrectToggle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#e2e8f0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    customCorrectToggleActive: {
        backgroundColor: '#10b981',
    },
    customCorrectToggleText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#475569',
    },
    customCorrectToggleTextActive: {
        color: '#ffffff',
    },
    saveMcqBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#182232',
        paddingVertical: 14,
        borderRadius: 12,
        marginTop: 20,
        marginBottom: 30,
    },
    saveMcqBtnText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#ffffff',
    },
});
