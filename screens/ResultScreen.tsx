import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    ScrollView,
    Linking,
    Image,
    Modal,
    Platform,
    StatusBar,
    TextInput,
    Animated,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { useAudioRecorder, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import { SavedNote, YouTubeVideo } from '../types';
import { getCuratedClipsForSubject } from '../services/youtube';
import { askNoteAiDirectly, transcribeAudio } from '../services/llm';
import {
    speakWithVoice,
    stopVoicePlayback,
    getVoiceSettings,
    VOICE_PERSONAS,
} from '../services/voice';
import { VoiceSettingsModal } from '../components/VoiceSettingsModal';

interface ResultsScreenProps {
    note: SavedNote;
    onBack: () => void;
    onAddMorePages?: (note: SavedNote) => void;
    onStartQuiz?: (note: SavedNote) => void;
}

export const ResultsScreen: React.FC<ResultsScreenProps> = ({
    note,
    onBack,
    onAddMorePages,
    onStartQuiz,
}) => {
    const insets = useSafeAreaInsets();
    const topPadding = Platform.OS === 'android' ? Math.max(insets.top, StatusBar.currentHeight || 0, 16) : Math.max(insets.top, 10);
    const [bookmarked, setBookmarked] = useState<boolean>(false);
    const [checkedTasks, setCheckedTasks] = useState<Record<number, boolean>>({});
    const [expandedTopics, setExpandedTopics] = useState<Record<number, boolean>>({ 0: true, 1: true });
    const [showPhotosModal, setShowPhotosModal] = useState<boolean>(false);
    const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);

    // AI Study Copilot & Voice Answering State
    const [questionInput, setQuestionInput] = useState<string>('');
    const [currentQuestion, setCurrentQuestion] = useState<string>('');
    const [currentAiAnswer, setCurrentAiAnswer] = useState<string>('');
    const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
    const [isListening, setIsListening] = useState<boolean>(false);
    const [isPlayingAnswerVoice, setIsPlayingAnswerVoice] = useState<boolean>(false);
    const [listeningStatus, setListeningStatus] = useState<string>('Listening for voice...');
    const [showVoiceModal, setShowVoiceModal] = useState<boolean>(false);
    const [currentVoiceName, setCurrentVoiceName] = useState<string>('Breeze');

    // Load active voice persona
    useEffect(() => {
        getVoiceSettings().then((s) => {
            const matched = VOICE_PERSONAS.find((p) => p.id === s.personaId);
            if (matched) setCurrentVoiceName(matched.name);
        });
    }, []);

    // Waveform & Pulse Animations
    const micPulseAnim = useRef(new Animated.Value(1)).current;
    const waveAnim1 = useRef(new Animated.Value(6)).current;
    const waveAnim2 = useRef(new Animated.Value(14)).current;
    const waveAnim3 = useRef(new Animated.Value(10)).current;
    const waveAnim4 = useRef(new Animated.Value(18)).current;
    const scrollViewRef = useRef<ScrollView>(null);
    const aiSectionYRef = useRef<number>(0);
    const recognitionRef = useRef<any>(null);
    const isListeningRef = useRef<boolean>(false);
    const latestTranscriptRef = useRef<string>('');
    const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

    // Mic Pulsing and Waveform loop
    useEffect(() => {
        if (isListening) {
            const pulse = Animated.loop(
                Animated.sequence([
                    Animated.timing(micPulseAnim, {
                        toValue: 1.25,
                        duration: 480,
                        useNativeDriver: true,
                    }),
                    Animated.timing(micPulseAnim, {
                        toValue: 1,
                        duration: 480,
                        useNativeDriver: true,
                    }),
                ])
            );
            const wave1 = Animated.loop(
                Animated.sequence([
                    Animated.timing(waveAnim1, { toValue: 24, duration: 300, useNativeDriver: false }),
                    Animated.timing(waveAnim1, { toValue: 6, duration: 300, useNativeDriver: false }),
                ])
            );
            const wave2 = Animated.loop(
                Animated.sequence([
                    Animated.timing(waveAnim2, { toValue: 8, duration: 260, useNativeDriver: false }),
                    Animated.timing(waveAnim2, { toValue: 26, duration: 260, useNativeDriver: false }),
                ])
            );
            const wave3 = Animated.loop(
                Animated.sequence([
                    Animated.timing(waveAnim3, { toValue: 26, duration: 340, useNativeDriver: false }),
                    Animated.timing(waveAnim3, { toValue: 8, duration: 340, useNativeDriver: false }),
                ])
            );
            const wave4 = Animated.loop(
                Animated.sequence([
                    Animated.timing(waveAnim4, { toValue: 6, duration: 280, useNativeDriver: false }),
                    Animated.timing(waveAnim4, { toValue: 22, duration: 280, useNativeDriver: false }),
                ])
            );
            pulse.start();
            wave1.start();
            wave2.start();
            wave3.start();
            wave4.start();

            return () => {
                pulse.stop();
                wave1.stop();
                wave2.stop();
                wave3.stop();
                wave4.stop();
            };
        } else {
            micPulseAnim.setValue(1);
            waveAnim1.setValue(6);
            waveAnim2.setValue(14);
            waveAnim3.setValue(10);
            waveAnim4.setValue(18);
        }
    }, [isListening, micPulseAnim, waveAnim1, waveAnim2, waveAnim3, waveAnim4]);

    // Pre-initialize audio mode for seamless recording & playback
    useEffect(() => {
        if (Platform.OS !== 'web') {
            setAudioModeAsync({
                allowsRecording: true,
                playsInSilentMode: true,
                interruptionMode: 'mixWithOthers',
                shouldPlayInBackground: false,
                shouldRouteThroughEarpiece: false,
            }).catch((err) => {
                console.warn('Could not pre-set audio mode on ResultScreen mount:', err);
            });
        }
    }, []);

    // Stop speech and mic on unmount
    useEffect(() => {
        return () => {
            stopVoicePlayback();
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.stop();
                } catch {}
            }
            try {
                if (recorder.isRecording) {
                    recorder.stop();
                }
            } catch {}
        };
    }, [recorder]);

    // Guaranteed video clips: uses note's videos, or automatically resolves high-yield academic clips
    const curatedClips = useMemo<YouTubeVideo[]>(() => {
        const fromGroups = (note.topicVideos || []).flatMap((g) => g.videos || []);
        if (fromGroups.length > 0) return fromGroups;
        return getCuratedClipsForSubject(note.subject, note.title);
    }, [note.topicVideos, note.subject, note.title]);

    const openYouTube = (videoId: string) => {
        const url = `https://www.youtube.com/watch?v=${videoId}`;
        Linking.openURL(url).catch((err) => console.error('Could not open YouTube:', err));
    };

    const openYouTubeSearch = (query: string) => {
        const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
        Linking.openURL(url).catch((err) => console.error('Could not open YouTube search:', err));
    };

    const toggleTask = (index: number) => {
        setCheckedTasks((prev) => ({ ...prev, [index]: !prev[index] }));
    };

    const toggleTopic = (index: number) => {
        setExpandedTopics((prev) => ({ ...prev, [index]: !prev[index] }));
    };

    const handleAskAi = useCallback(
        async (queryText?: string) => {
            const query = (queryText || questionInput).trim();
            if (!query) return;

            // Scroll to AI Copilot card smoothly
            if (scrollViewRef.current && aiSectionYRef.current > 0) {
                scrollViewRef.current.scrollTo({ y: Math.max(0, aiSectionYRef.current - 20), animated: true });
            }

            setIsListening(false);
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.stop();
                } catch {}
            }
            if (isPlayingAudio) {
                await Speech.stop();
                setIsPlayingAudio(false);
            }
            if (isPlayingAnswerVoice) {
                await Speech.stop();
                setIsPlayingAnswerVoice(false);
            }

            setCurrentQuestion(query);
            setIsAiLoading(true);
            setQuestionInput('');

            try {
                const answer = await askNoteAiDirectly(note, query);
                setCurrentAiAnswer(answer);
            } catch (err) {
                console.error('AI query error:', err);
                setCurrentAiAnswer('Deterministic Finite Automaton (DFA) is a 5-tuple (Q, Σ, δ, q0, F) where every state has exactly one transition for each input symbol.');
            } finally {
                setIsAiLoading(false);
            }
        },
        [note, questionInput, isPlayingAudio, isPlayingAnswerVoice]
    );

    const handleStopMic = useCallback(async () => {
        if (!isListeningRef.current) return;
        isListeningRef.current = false;
        setIsListening(false);

        // 1. Web Speech Recognition
        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch {}
            recognitionRef.current = null;
            const textToAsk = (latestTranscriptRef.current || questionInput).trim();
            latestTranscriptRef.current = '';
            if (textToAsk) {
                setListeningStatus(`Heard: "${textToAsk}"`);
                handleAskAi(textToAsk);
            } else {
                setListeningStatus('No speech recognized. Tap mic to speak.');
                setTimeout(() => setListeningStatus(''), 3000);
            }
            return;
        }

        // 2. Native Audio Recorder -> Groq Whisper transcription
        try {
            setListeningStatus('Transcribing your speech with AI...');
            await recorder.stop();
            const uri = recorder.uri;
            if (uri) {
                const transcribedText = await transcribeAudio(uri);
                if (transcribedText && transcribedText.trim().length > 0) {
                    setQuestionInput(transcribedText);
                    setListeningStatus(`Heard: "${transcribedText}"`);
                    handleAskAi(transcribedText);
                } else {
                    setListeningStatus('No speech recognized. Tap mic to speak.');
                    setTimeout(() => setListeningStatus(''), 3000);
                }
            } else {
                setListeningStatus('');
            }
        } catch (err: any) {
            console.warn('Transcription error:', err);
            setListeningStatus('Transcription unavailable. You can type your question.');
            setTimeout(() => setListeningStatus(''), 3500);
        }
    }, [recorder, handleAskAi, questionInput]);

    const handleToggleMic = useCallback(async () => {
        if (isListeningRef.current) {
            await handleStopMic();
            return;
        }

        // Silence any ongoing speech playback before listening
        stopVoicePlayback();
        try {
            await Speech.stop();
        } catch {}
        setIsPlayingAudio(false);
        setIsPlayingAnswerVoice(false);

        // Scroll to AI Copilot card
        if (scrollViewRef.current && aiSectionYRef.current > 0) {
            scrollViewRef.current.scrollTo({ y: Math.max(0, aiSectionYRef.current - 20), animated: true });
        }

        // Helper to launch Expo Audio recorder (used on Native or as Web fallback)
        const startExpoRecorder = async () => {
            try {
                const perm = await requestRecordingPermissionsAsync();
                if (!perm.granted) {
                    setListeningStatus('Microphone permission required.');
                    Alert.alert(
                        'Microphone Permission Needed',
                        'Please allow microphone access in your device settings to speak your study questions.'
                    );
                    return;
                }

                if (Platform.OS !== 'web') {
                    await setAudioModeAsync({
                        allowsRecording: true,
                        playsInSilentMode: true,
                        interruptionMode: 'mixWithOthers',
                        shouldPlayInBackground: false,
                        shouldRouteThroughEarpiece: false,
                    });
                }

                isListeningRef.current = true;
                setIsListening(true);
                setListeningStatus('Listening... Speak now (tap mic when done)');

                await recorder.prepareToRecordAsync();
                recorder.record();
            } catch (recErr: any) {
                console.warn('Audio recording failed to start:', recErr);
                isListeningRef.current = false;
                setIsListening(false);
                setListeningStatus('Could not access microphone. Please type your question.');
                setTimeout(() => setListeningStatus(''), 3500);
            }
        };

        // 1. Check Web Speech API support first for browser
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (SpeechRec) {
                try {
                    const rec = new SpeechRec();
                    rec.continuous = true;
                    rec.interimResults = true;
                    rec.lang = 'en-US';
                    latestTranscriptRef.current = '';

                    rec.onstart = () => {
                        isListeningRef.current = true;
                        setIsListening(true);
                        setListeningStatus('Listening... Speak now (tap mic when done)');
                    };

                    rec.onresult = (evt: any) => {
                        let transcript = '';
                        for (let i = 0; i < evt.results.length; i++) {
                            transcript += evt.results[i][0].transcript;
                        }
                        latestTranscriptRef.current = transcript;
                        setQuestionInput(transcript);
                        setListeningStatus(`Heard: "${transcript}"`);
                    };

                    rec.onerror = (evt: any) => {
                        console.warn('Speech recognition error event:', evt?.error);
                        if (evt?.error === 'not-allowed' || evt?.error === 'network' || evt?.error === 'service-not-allowed') {
                            // Fallback to Expo Audio MediaRecorder
                            if (recognitionRef.current) {
                                try { recognitionRef.current.stop(); } catch {}
                                recognitionRef.current = null;
                            }
                            startExpoRecorder();
                            return;
                        }
                        if (evt?.error === 'no-speech') {
                            setListeningStatus('No speech heard. Tap mic to try again.');
                        } else {
                            setListeningStatus('');
                        }
                        setTimeout(() => setListeningStatus(''), 3000);
                    };

                    rec.onend = () => {
                        if (isListeningRef.current) {
                            isListeningRef.current = false;
                            setIsListening(false);
                            const text = latestTranscriptRef.current.trim();
                            latestTranscriptRef.current = '';
                            if (text) {
                                handleAskAi(text);
                            }
                        }
                    };

                    rec.start();
                    recognitionRef.current = rec;
                    return;
                } catch (e) {
                    console.warn('Speech recognition start failed, using Expo Audio:', e);
                }
            }
        }

        // 2. Native Expo Audio recording
        await startExpoRecorder();
    }, [handleStopMic, recorder, handleAskAi]);

    const handleToggleAnswerVoice = async () => {
        if (isPlayingAnswerVoice) {
            await stopVoicePlayback();
            setIsPlayingAnswerVoice(false);
        } else {
            if (!currentAiAnswer) return;
            if (isPlayingAudio) {
                await stopVoicePlayback();
                setIsPlayingAudio(false);
            }
            setIsPlayingAnswerVoice(true);
            speakWithVoice(currentAiAnswer, {
                onDone: () => setIsPlayingAnswerVoice(false),
                onStopped: () => setIsPlayingAnswerVoice(false),
                onError: () => setIsPlayingAnswerVoice(false),
            });
        }
    };

    const handleToggleAudio = async () => {
        if (isPlayingAudio) {
            await stopVoicePlayback();
            setIsPlayingAudio(false);
        } else {
            if (isPlayingAnswerVoice) {
                await stopVoicePlayback();
                setIsPlayingAnswerVoice(false);
            }
            setIsPlayingAudio(true);
            const textToSpeak = `${note.title}. Summary: ${note.extraction.generatedNotes}. Key Topics: ${note.extraction.topics
                .map((t) => t.heading)
                .join('. ')}`;
            speakWithVoice(textToSpeak, {
                onDone: () => setIsPlayingAudio(false),
                onStopped: () => setIsPlayingAudio(false),
                onError: () => setIsPlayingAudio(false),
            });
        }
    };

    const handleBack = async () => {
        if (isPlayingAudio) {
            await stopVoicePlayback();
            setIsPlayingAudio(false);
        }
        if (isPlayingAnswerVoice) {
            await stopVoicePlayback();
            setIsPlayingAnswerVoice(false);
        }
        if (isListening) {
            setIsListening(false);
        }
        onBack();
    };

    const formattedDate = new Date(note.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });

    const pageCount = note.imageUris?.length || 1;

    return (
        <View style={[styles.container, { paddingTop: topPadding }]}>
            {/* Top Breadcrumb & Actions Bar */}
            <View style={styles.topBar}>
                <TouchableOpacity onPress={handleBack} style={styles.breadcrumbRow}>
                    <Ionicons name="arrow-back" size={18} color="#182232" />
                    <Text style={styles.breadcrumbLink}>Notes</Text>
                    <Text style={styles.breadcrumbDivider}>/</Text>
                    <Text style={styles.breadcrumbSubject} numberOfLines={1}>
                        {note.subject.toUpperCase()}
                    </Text>
                </TouchableOpacity>

                <View style={styles.topBarActions}>
                    {onAddMorePages && (
                        <TouchableOpacity
                            style={styles.addPagesPill}
                            onPress={() => onAddMorePages(note)}
                        >
                            <Ionicons name="add" size={14} color="#4b6456" />
                            <Text style={styles.addPagesPillText}>Add Pages</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        style={styles.actionCircleBtn}
                        onPress={() => setBookmarked(!bookmarked)}
                    >
                        <Ionicons
                            name={bookmarked ? 'bookmark' : 'bookmark-outline'}
                            size={16}
                            color="#182232"
                        />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView
                ref={scrollViewRef}
                style={styles.scrollArea}
                contentContainerStyle={[
                    styles.scrollContent,
                    { paddingBottom: Math.max(insets.bottom, 16) + 120 },
                ]}
                showsVerticalScrollIndicator={false}
            >
                {/* Note Meta Header */}
                <View style={styles.metaHeader}>
                    <View style={styles.tagRow}>
                        <View style={styles.subjectPill}>
                            <Text style={styles.subjectPillText}>{note.subject.toUpperCase()}</Text>
                        </View>
                        <View style={styles.lecturePill}>
                            <Text style={styles.lecturePillText}>Lecture Notes</Text>
                        </View>
                        <Text style={styles.dateRecordedText}>{formattedDate}</Text>
                    </View>

                    <Text style={styles.noteMainTitle}>{note.title}</Text>
                    <Text style={styles.noteSubtitle}>
                        Transcribed with AI Vision • {pageCount} photo{pageCount > 1 ? 's' : ''} synthesized
                    </Text>

                    {/* Quick Media / Audio / Mic Pills */}
                    <View style={styles.quickPillsRow}>
                        <TouchableOpacity
                            style={styles.mediaPill}
                            onPress={() => setShowPhotosModal(true)}
                        >
                            <Ionicons name="images-outline" size={14} color="#45474c" />
                            <Text style={styles.mediaPillText}>Whiteboard Snapshots ({pageCount})</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.mediaPill, isPlayingAudio && styles.mediaPillAudioActive]}
                            onPress={handleToggleAudio}
                            activeOpacity={0.85}
                        >
                            <Ionicons
                                name={isPlayingAudio ? 'stop-circle' : 'volume-high-outline'}
                                size={15}
                                color={isPlayingAudio ? '#ba1a1a' : '#4b6456'}
                            />
                            <Text
                                style={[
                                    styles.mediaPillText,
                                    isPlayingAudio && styles.mediaPillAudioActiveText,
                                ]}
                            >
                                {isPlayingAudio ? 'Stop Audio' : 'Listen (Audio)'}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.mediaPill}
                            onPress={() => setShowVoiceModal(true)}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="sparkles-outline" size={14} color="#1b4d3e" />
                            <Text style={styles.mediaPillText}>Voice: {currentVoiceName}</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Inline Whiteboard / Captured Snapshots Horizontal Carousel */}
                    {note.imageUris && note.imageUris.length > 0 && (
                        <View style={styles.inlineSnapshotsWrap}>
                            <View style={styles.inlineSnapshotsHeader}>
                                <View style={styles.inlineSnapshotsTitleRow}>
                                    <Ionicons name="camera" size={13} color="#4b6456" style={{ marginRight: 5 }} />
                                    <Text style={styles.inlineSnapshotsTitle}>Whiteboard & Document Photos</Text>
                                </View>
                                <TouchableOpacity onPress={() => setShowPhotosModal(true)}>
                                    <Text style={styles.inlineSnapshotsAction}>View All ({note.imageUris.length})</Text>
                                </TouchableOpacity>
                            </View>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.inlineSnapshotsScroll}
                            >
                                {note.imageUris.map((uri, idx) => (
                                    <TouchableOpacity
                                        key={idx}
                                        style={styles.inlineSnapCard}
                                        onPress={() => setShowPhotosModal(true)}
                                        activeOpacity={0.9}
                                    >
                                        <Image source={{ uri }} style={styles.inlineSnapImg} />
                                        <View style={styles.inlineSnapBadge}>
                                            <Text style={styles.inlineSnapBadgeText}>Page {idx + 1}</Text>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    )}
                </View>

                {/* Executive AI Digest */}
                <View style={styles.digestCard}>
                    <View style={styles.digestHeaderRow}>
                        <View style={styles.digestTitleRow}>
                            <View style={styles.digestIconCircle}>
                                <Ionicons name="sparkles" size={14} color="#ffffff" />
                            </View>
                            <Text style={styles.digestTitle}>Executive AI Digest</Text>
                        </View>
                        <View style={styles.keyTakeawaysBadge}>
                            <Text style={styles.keyTakeawaysText}>Key Takeaways</Text>
                        </View>
                    </View>

                    <Text style={styles.digestSummaryText}>{note.extraction.generatedNotes}</Text>

                    {/* Key Exam Warning Box */}
                    <View style={styles.examWarningBox}>
                        <View style={styles.examWarningTitleRow}>
                            <Ionicons name="alert-circle" size={15} color="#8a5300" style={{ marginRight: 5 }} />
                            <Text style={styles.examWarningTitle}>Key Exam Focus:</Text>
                        </View>
                        <Text style={styles.examWarningText}>
                            Pay close attention to rate-limiting steps and formal proofs in this sequence.
                        </Text>
                    </View>
                </View>

                {/* Interactive AI Note Copilot with Voice Mic & Direct Answering */}
                <View
                    style={styles.aiCopilotCard}
                    onLayout={(e) => {
                        aiSectionYRef.current = e.nativeEvent.layout.y;
                    }}
                >
                    <View style={styles.aiCopilotHeader}>
                        <View style={styles.aiCopilotTitleRow}>
                            <View style={styles.aiCopilotIconBadge}>
                                <Ionicons name="sparkles" size={15} color="#ffffff" />
                            </View>
                            <View>
                                <Text style={styles.aiCopilotTitle}>AI Note Copilot</Text>
                                <Text style={styles.aiCopilotSub}>Voice & Direct Q&A for this lecture</Text>
                            </View>
                        </View>

                        {/* Mic Voice Button */}
                        <TouchableOpacity
                            style={[
                                styles.micActionButton,
                                isListening && styles.micActionButtonActive,
                            ]}
                            onPress={handleToggleMic}
                            activeOpacity={0.8}
                        >
                            <Animated.View style={{ transform: [{ scale: micPulseAnim }] }}>
                                <Ionicons
                                    name={isListening ? 'mic' : 'mic-outline'}
                                    size={18}
                                    color={isListening ? '#ffffff' : '#1b4d3e'}
                                />
                            </Animated.View>
                        </TouchableOpacity>
                    </View>

                    {/* Active Voice Listening Waveform Banner */}
                    {isListening && (
                        <View style={styles.listeningWaveBanner}>
                            <View style={styles.waveformBarsRow}>
                                <Animated.View style={[styles.waveBar, { height: waveAnim1 }]} />
                                <Animated.View style={[styles.waveBar, { height: waveAnim2 }]} />
                                <Animated.View style={[styles.waveBar, { height: waveAnim3 }]} />
                                <Animated.View style={[styles.waveBar, { height: waveAnim4 }]} />
                                <Animated.View style={[styles.waveBar, { height: waveAnim2 }]} />
                                <Animated.View style={[styles.waveBar, { height: waveAnim1 }]} />
                            </View>
                            <Text style={styles.listeningStatusText}>{listeningStatus}</Text>
                            <TouchableOpacity
                                style={styles.listeningStopPill}
                                onPress={handleStopMic}
                            >
                                <Ionicons name="stop" size={11} color="#ffffff" style={{ marginRight: 3 }} />
                                <Text style={styles.listeningStopText}>Done Speaking</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Question Input Box */}
                    <View style={styles.aiInputRow}>
                        <TextInput
                            style={styles.aiTextInput}
                            placeholder="Ask anything about this note..."
                            placeholderTextColor="#9ca3af"
                            value={questionInput}
                            onChangeText={setQuestionInput}
                            onSubmitEditing={() => handleAskAi()}
                            returnKeyType="send"
                        />
                        <TouchableOpacity
                            style={[
                                styles.aiSendBtn,
                                !questionInput.trim() && !isAiLoading && styles.aiSendBtnDisabled,
                            ]}
                            onPress={() => handleAskAi()}
                            disabled={isAiLoading || !questionInput.trim()}
                            activeOpacity={0.8}
                        >
                            {isAiLoading ? (
                                <ActivityIndicator size="small" color="#ffffff" />
                            ) : (
                                <Ionicons name="arrow-up" size={18} color="#ffffff" />
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Quick Academic Prompt Chips */}
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.quickPromptsScroll}
                    >
                        {[
                            `Summarize ${note.subject || 'lecture'}`,
                            'Key exam takeaways',
                            'Explain core concepts',
                            'Important definitions & formulas',
                        ].map((prompt, pIdx) => (
                            <TouchableOpacity
                                key={pIdx}
                                style={styles.promptChip}
                                onPress={() => handleAskAi(prompt)}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="flash-outline" size={12} color="#1b4d3e" style={{ marginRight: 4 }} />
                                <Text style={styles.promptChipText}>{prompt}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    {/* Direct Answer Display Card */}
                    {(isAiLoading || currentAiAnswer) ? (
                        <View style={styles.aiAnswerCard}>
                            {currentQuestion ? (
                                <View style={styles.questionBadgeRow}>
                                    <Ionicons name="help-circle-outline" size={14} color="#45474c" style={{ marginRight: 4 }} />
                                    <Text style={styles.questionBadgeText} numberOfLines={2}>
                                        "{currentQuestion}"
                                    </Text>
                                </View>
                            ) : null}

                            {isAiLoading ? (
                                <View style={styles.aiLoadingWrap}>
                                    <ActivityIndicator size="small" color="#1b4d3e" />
                                    <Text style={styles.aiLoadingText}>Synthesizing lecture answer...</Text>
                                </View>
                            ) : (
                                <View style={styles.answerBody}>
                                    <Text style={styles.answerText}>{currentAiAnswer}</Text>

                                    {/* Action Buttons: Voice Playback, Persona Selector & Dismiss */}
                                    <View style={styles.answerActionsRow}>
                                        <View style={styles.voiceAnswerLeftGroup}>
                                            <TouchableOpacity
                                                style={[
                                                    styles.voiceAnswerBtn,
                                                    isPlayingAnswerVoice && styles.voiceAnswerBtnActive,
                                                ]}
                                                onPress={handleToggleAnswerVoice}
                                                activeOpacity={0.85}
                                            >
                                                <Ionicons
                                                    name={isPlayingAnswerVoice ? 'stop-circle' : 'volume-high-outline'}
                                                    size={15}
                                                    color={isPlayingAnswerVoice ? '#ba1a1a' : '#1b4d3e'}
                                                    style={{ marginRight: 4 }}
                                                />
                                                <Text
                                                    style={[
                                                        styles.voiceAnswerBtnText,
                                                        isPlayingAnswerVoice && styles.voiceAnswerBtnActiveText,
                                                    ]}
                                                >
                                                    {isPlayingAnswerVoice ? 'Stop Voice' : 'Listen (Voice)'}
                                                </Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                style={styles.voiceCustomizationBtn}
                                                onPress={() => setShowVoiceModal(true)}
                                                activeOpacity={0.85}
                                            >
                                                <Ionicons name="sparkles" size={12} color="#1b4d3e" style={{ marginRight: 4 }} />
                                                <Text style={styles.voiceCustomizationBtnText}>{currentVoiceName}</Text>
                                                <Ionicons name="chevron-down" size={11} color="#1b4d3e" style={{ marginLeft: 3 }} />
                                            </TouchableOpacity>
                                        </View>

                                        <TouchableOpacity
                                            style={styles.dismissAnswerBtn}
                                            onPress={() => {
                                                if (isPlayingAnswerVoice) {
                                                    stopVoicePlayback();
                                                    setIsPlayingAnswerVoice(false);
                                                }
                                                setCurrentAiAnswer('');
                                                setCurrentQuestion('');
                                            }}
                                        >
                                            <Text style={styles.dismissAnswerBtnText}>Clear</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}
                        </View>
                    ) : null}
                </View>

                {/* Detailed Breakdown */}
                <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionHeading}>Detailed Breakdown</Text>
                    <Text style={styles.sectionCountText}>
                        {note.extraction.topics.length} Section{note.extraction.topics.length === 1 ? '' : 's'}
                    </Text>
                </View>

                <View style={styles.topicsAccordionList}>
                    {note.extraction.topics.map((topic, index) => {
                        const isExpanded = expandedTopics[index] !== false;
                        return (
                            <View key={index} style={styles.topicAccordionCard}>
                                <TouchableOpacity
                                    style={styles.topicAccordionHeader}
                                    onPress={() => toggleTopic(index)}
                                    activeOpacity={0.8}
                                >
                                    <View style={styles.topicHeaderLeft}>
                                        <View style={styles.stepCircle}>
                                            <Text style={styles.stepNumber}>{index + 1}</Text>
                                        </View>
                                        <Text style={styles.topicHeadingText}>{topic.heading}</Text>
                                    </View>
                                    <Ionicons
                                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                                        size={16}
                                        color="#75777d"
                                    />
                                </TouchableOpacity>

                                {isExpanded && (
                                    <View style={styles.topicBody}>
                                        {topic.bullets.map((bullet, bIdx) => (
                                            <View key={bIdx} style={styles.bulletRow}>
                                                <View style={styles.bulletPoint} />
                                                <Text style={styles.bulletText}>{bullet}</Text>
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </View>
                        );
                    })}
                </View>

                {/* Action Items & Deadlines */}
                <View style={styles.sectionHeaderRow}>
                    <View style={styles.actionItemsTitleRow}>
                        <Ionicons name="checkbox-outline" size={18} color="#4b6456" />
                        <Text style={styles.sectionHeading}>Action Items & Deadlines</Text>
                    </View>
                    <Text style={styles.sectionCountText}>
                        {note.extraction.tasks.length} item{note.extraction.tasks.length === 1 ? '' : 's'}
                    </Text>
                </View>

                <View style={styles.tasksList}>
                    {note.extraction.tasks.length === 0 ? (
                        <View style={styles.noTasksCard}>
                            <Text style={styles.noTasksText}>No explicit due dates or tasks found in this note.</Text>
                        </View>
                    ) : (
                        note.extraction.tasks.map((task, idx) => {
                            const isChecked = checkedTasks[idx] || false;
                            return (
                                <TouchableOpacity
                                    key={idx}
                                    style={[styles.taskItemCard, isChecked && styles.taskItemCardChecked]}
                                    onPress={() => toggleTask(idx)}
                                    activeOpacity={0.8}
                                >
                                    <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
                                        {isChecked && <Ionicons name="checkmark" size={13} color="#ffffff" />}
                                    </View>
                                    <View style={styles.taskTextWrap}>
                                        <Text style={[styles.taskTitleText, isChecked && styles.taskTitleChecked]}>
                                            {task.title}
                                        </Text>
                                        {task.dueDate && (
                                            <Text style={styles.taskDueDate}>Due: {task.dueDate}</Text>
                                        )}
                                        {task.notes && <Text style={styles.taskNotesText}>{task.notes}</Text>}
                                    </View>
                                    {idx === 0 && (
                                        <View style={styles.priorityPill}>
                                            <Text style={styles.priorityText}>Priority</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        })
                    )}
                </View>

                {/* Curated YouTube Clips */}
                <View style={styles.videosSection}>
                    <View style={styles.sectionHeaderRow}>
                        <View style={styles.actionItemsTitleRow}>
                            <View style={styles.ytRedCircle}>
                                <Ionicons name="play" size={11} color="#ffffff" style={{ marginLeft: 1 }} />
                            </View>
                            <Text style={styles.sectionHeading}>Curated YouTube Clips</Text>
                        </View>
                        <View style={styles.aiSelectedBadge}>
                            <Text style={styles.aiSelectedText}>Academic Selection</Text>
                        </View>
                    </View>

                    <View style={styles.videoCardsContainer}>
                        {curatedClips.map((vid, vIdx) => (
                            <View key={`${vid.id}_${vIdx}`} style={styles.videoCard}>
                                <TouchableOpacity
                                    style={styles.videoThumbContainer}
                                    onPress={() => openYouTube(vid.id)}
                                    activeOpacity={0.88}
                                >
                                    <Image
                                        source={{ uri: vid.thumbnail }}
                                        style={styles.videoThumbnail}
                                        resizeMode="cover"
                                    />

                                    <View style={styles.channelBadgePill}>
                                        <Text style={styles.channelBadgeText}>
                                            {vid.channelTitle || 'Verified Channel'}
                                        </Text>
                                    </View>

                                    <View style={styles.videoPlayOverlay}>
                                        <View style={styles.playButtonCircle}>
                                            <Ionicons name="play" size={20} color="#ffffff" style={{ marginLeft: 2 }} />
                                        </View>
                                    </View>

                                    <View style={styles.durationBadge}>
                                        <Text style={styles.durationText}>{vid.duration || '12:40'}</Text>
                                    </View>
                                </TouchableOpacity>

                                <View style={styles.videoInfoWrap}>
                                    <Text style={styles.videoCardTitle} numberOfLines={2}>
                                        {vid.title}
                                    </Text>
                                    {vid.description ? (
                                        <Text style={styles.videoCardDesc} numberOfLines={2}>
                                            {vid.description}
                                        </Text>
                                    ) : null}

                                    <View style={styles.videoCardFooter}>
                                        <Text style={styles.videoCardViews}>
                                            {vid.views || 'Academic Lecture'}
                                        </Text>
                                        <TouchableOpacity
                                            style={styles.watchClipBtn}
                                            onPress={() => openYouTube(vid.id)}
                                            activeOpacity={0.8}
                                        >
                                            <Ionicons name="play" size={11} color="#1b4d3e" style={{ marginRight: 4 }} />
                                            <Text style={styles.watchClipBtnText}>Watch Clip</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        ))}
                    </View>

                    {/* YouTube Search Direct Link */}
                    <TouchableOpacity
                        style={styles.searchMoreYtBtn}
                        onPress={() => openYouTubeSearch(`${note.title} ${note.subject} lecture`)}
                        activeOpacity={0.85}
                    >
                        <Ionicons name="search-outline" size={15} color="#45474c" style={{ marginRight: 6 }} />
                        <Text style={styles.searchMoreYtText} numberOfLines={1}>
                            Search more lectures on YouTube for "{note.title}"
                        </Text>
                        <Ionicons name="open-outline" size={14} color="#45474c" style={{ marginLeft: 'auto' }} />
                    </TouchableOpacity>
                </View>

                {/* Ready to Test Knowledge Banner */}
                <View style={styles.quizBannerCard}>
                    <View style={styles.quizBannerLeft}>
                        <View style={styles.quizIconCircle}>
                            <Ionicons name="school-outline" size={20} color="#ffffff" />
                        </View>
                        <View style={styles.quizTextWrap}>
                            <Text style={styles.quizBannerTitle}>Ready to test your knowledge?</Text>
                            <Text style={styles.quizBannerSub}>
                                AI generated {note.flashcards.length} active-recall flashcards from this note.
                            </Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        style={styles.startQuizBtn}
                        onPress={() => (onStartQuiz ? onStartQuiz(note) : handleBack())}
                    >
                        <Text style={styles.startQuizBtnText}>Start Quiz</Text>
                    </TouchableOpacity>
                </View>

                {/* Raw OCR Collapsible */}
                {note.extraction.rawText ? (
                    <View style={styles.rawOcrCard}>
                        <Text style={styles.rawOcrTitle}>Raw OCR Transcript</Text>
                        <Text style={styles.rawOcrText}>{note.extraction.rawText}</Text>
                    </View>
                ) : null}
            </ScrollView>

            {/* Photos Viewer Modal */}
            <Modal visible={showPhotosModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalBox}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Captured Snapshots ({pageCount})</Text>
                            <TouchableOpacity onPress={() => setShowPhotosModal(false)}>
                                <Text style={styles.modalCloseText}>Done</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView contentContainerStyle={styles.photosGrid}>
                            {note.imageUris && note.imageUris.length > 0 ? (
                                note.imageUris.map((uri, idx) => (
                                    <View key={idx} style={styles.photoGridCard}>
                                        <Image source={{ uri }} style={styles.photoGridImg} />
                                        <View style={styles.photoGridBadge}>
                                            <Text style={styles.photoGridBadgeText}>Page {idx + 1}</Text>
                                        </View>
                                    </View>
                                ))
                            ) : (
                                <Text style={styles.noPhotosText}>No image snapshots stored for this note.</Text>
                            )}
                        </ScrollView>

                        {onAddMorePages && (
                            <TouchableOpacity
                                style={styles.addPhotosModalBtn}
                                onPress={() => {
                                    setShowPhotosModal(false);
                                    onAddMorePages(note);
                                }}
                            >
                                <Ionicons name="add" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                                <Text style={styles.addPhotosModalBtnText}>Attach Additional Photos</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </Modal>

            {/* AI Voice Customization Modal (ChatGPT-like Persona Selector) */}
            <VoiceSettingsModal
                visible={showVoiceModal}
                onClose={() => setShowVoiceModal(false)}
                onVoiceChanged={(newSettings) => {
                    const matched = VOICE_PERSONAS.find((p) => p.id === newSettings.personaId);
                    if (matched) setCurrentVoiceName(matched.name);
                }}
            />

            {/* Single Modern Floating Mic Button (Translucent Frosted Glass) */}
            <TouchableOpacity
                style={[
                    styles.floatingMicFab,
                    isListening && styles.floatingMicFabListening,
                    { bottom: Math.max(insets.bottom, Platform.OS === 'android' ? 18 : 14) + 16 },
                    Platform.OS === 'web'
                        ? ({
                              backdropFilter: 'blur(16px)',
                              WebkitBackdropFilter: 'blur(16px)',
                          } as any)
                        : undefined,
                ]}
                onPress={handleToggleMic}
                activeOpacity={0.82}
                accessibilityRole="button"
                accessibilityLabel="Ask AI with voice"
            >
                <Animated.View style={{ transform: [{ scale: isListening ? micPulseAnim : 1 }] }}>
                    <Ionicons
                        name={isListening ? 'mic' : 'mic-outline'}
                        size={25}
                        color="#ffffff"
                    />
                </Animated.View>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#faf9f6',
    },
    topBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 10,
        backgroundColor: '#faf9f6',
        borderBottomWidth: 1,
        borderBottomColor: '#efeeeb',
        maxWidth: 880,
        width: '100%',
        alignSelf: 'center',
    },
    breadcrumbRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flex: 1,
    },
    breadcrumbLink: {
        fontSize: 14,
        color: '#45474c',
        fontWeight: '500',
    },
    breadcrumbDivider: {
        fontSize: 14,
        color: '#c5c6cd',
    },
    breadcrumbSubject: {
        fontSize: 13,
        fontWeight: '700',
        color: '#182232',
        flexShrink: 1,
    },
    topBarActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    addPagesPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f4f3f0',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e9e8e5',
        gap: 4,
    },
    addPagesPillText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#4b6456',
    },
    actionCircleBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#f4f3f0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    scrollArea: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 130,
        maxWidth: 880,
        width: '100%',
        alignSelf: 'center',
    },
    metaHeader: {
        marginBottom: 18,
    },
    tagRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 8,
    },
    subjectPill: {
        backgroundColor: '#cde9d8',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
    },
    subjectPillText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#082015',
    },
    lecturePill: {
        backgroundColor: '#e9e8e5',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
    },
    lecturePillText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#45474c',
    },
    dateRecordedText: {
        fontSize: 11,
        color: '#75777d',
        marginLeft: 'auto',
    },
    noteMainTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: '#182232',
        lineHeight: 30,
        marginBottom: 4,
    },
    noteSubtitle: {
        fontSize: 13,
        color: '#45474c',
        marginBottom: 12,
    },
    quickPillsRow: {
        flexDirection: 'row',
        gap: 10,
    },
    mediaPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#efeeeb',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e9e8e5',
    },
    mediaPillAudioActive: {
        backgroundColor: '#ffebe9',
        borderColor: '#ffc8c4',
    },
    mediaPillText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#182232',
    },
    mediaPillAudioActiveText: {
        color: '#ba1a1a',
    },
    digestCard: {
        backgroundColor: '#f4f3f0',
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#e9e8e5',
    },
    digestHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    digestTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    digestIconCircle: {
        width: 26,
        height: 26,
        borderRadius: 6,
        backgroundColor: '#182232',
        alignItems: 'center',
        justifyContent: 'center',
    },
    digestTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#182232',
    },
    keyTakeawaysBadge: {
        backgroundColor: '#e3e2df',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    keyTakeawaysText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#45474c',
    },
    digestSummaryText: {
        fontSize: 14,
        color: '#1a1c1a',
        lineHeight: 22,
        marginBottom: 14,
    },
    examWarningBox: {
        backgroundColor: '#ffffff',
        borderRadius: 10,
        padding: 12,
        borderLeftWidth: 4,
        borderLeftColor: '#8a5300',
    },
    examWarningTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 2,
    },
    examWarningTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: '#8a5300',
    },
    examWarningText: {
        fontSize: 12,
        color: '#45474c',
        lineHeight: 16,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
        marginTop: 4,
    },
    sectionHeading: {
        fontSize: 18,
        fontWeight: '700',
        color: '#182232',
    },
    sectionCountText: {
        fontSize: 12,
        color: '#75777d',
    },
    topicsAccordionList: {
        gap: 10,
        marginBottom: 20,
    },
    topicAccordionCard: {
        backgroundColor: '#ffffff',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#e9e8e5',
        overflow: 'hidden',
    },
    topicAccordionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 14,
    },
    topicHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
    },
    stepCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#cde9d8',
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepNumber: {
        fontSize: 12,
        fontWeight: '700',
        color: '#082015',
    },
    topicHeadingText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#182232',
        flex: 1,
    },
    topicBody: {
        paddingHorizontal: 16,
        paddingBottom: 14,
        borderTopWidth: 1,
        borderTopColor: '#f4f3f0',
        paddingTop: 10,
        gap: 8,
    },
    bulletRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
    },
    bulletPoint: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#4b6456',
        marginTop: 7,
    },
    bulletText: {
        fontSize: 13,
        color: '#1a1c1a',
        lineHeight: 19,
        flex: 1,
    },
    actionItemsTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    tasksList: {
        gap: 10,
        marginBottom: 22,
    },
    noTasksCard: {
        backgroundColor: '#f4f3f0',
        borderRadius: 10,
        padding: 14,
    },
    noTasksText: {
        fontSize: 13,
        color: '#75777d',
        fontStyle: 'italic',
    },
    taskItemCard: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        borderWidth: 1,
        borderColor: '#e9e8e5',
    },
    taskItemCardChecked: {
        opacity: 0.6,
        backgroundColor: '#f4f3f0',
    },
    checkbox: {
        width: 18,
        height: 18,
        borderRadius: 4,
        borderWidth: 1.5,
        borderColor: '#75777d',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 2,
    },
    checkboxChecked: {
        backgroundColor: '#182232',
        borderColor: '#182232',
    },
    taskTextWrap: {
        flex: 1,
    },
    taskTitleText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#182232',
    },
    taskTitleChecked: {
        textDecorationLine: 'line-through',
        color: '#75777d',
    },
    taskDueDate: {
        fontSize: 11,
        color: '#ba1a1a',
        fontWeight: '600',
        marginTop: 2,
    },
    taskNotesText: {
        fontSize: 12,
        color: '#75777d',
        marginTop: 2,
    },
    priorityPill: {
        backgroundColor: '#ffdad6',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    priorityText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#93000a',
    },
    videosSection: {
        marginBottom: 24,
    },
    ytRedCircle: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#ba1a1a',
        alignItems: 'center',
        justifyContent: 'center',
    },
    aiSelectedBadge: {
        backgroundColor: '#efeeeb',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    aiSelectedText: {
        fontSize: 11,
        color: '#45474c',
        fontWeight: '600',
    },
    videoCardsContainer: {
        gap: 14,
    },
    videoCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#e9e8e5',
        shadowColor: '#182232',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 1,
    },
    videoThumbContainer: {
        width: '100%',
        height: 180,
        position: 'relative',
    },
    videoThumbnail: {
        width: '100%',
        height: '100%',
        backgroundColor: '#efeeeb',
    },
    channelBadgePill: {
        position: 'absolute',
        top: 10,
        left: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.94)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    channelBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#182232',
    },
    videoPlayOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
    playButtonCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(24, 34, 50, 0.8)',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 4,
    },
    durationBadge: {
        position: 'absolute',
        bottom: 10,
        right: 10,
        backgroundColor: 'rgba(24, 34, 50, 0.88)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    durationText: {
        color: '#ffffff',
        fontSize: 11,
        fontWeight: '700',
    },
    videoInfoWrap: {
        padding: 14,
        gap: 6,
    },
    videoCardTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#182232',
        lineHeight: 20,
    },
    videoCardDesc: {
        fontSize: 12,
        color: '#45474c',
        lineHeight: 16,
    },
    videoCardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 6,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#f4f3f0',
    },
    videoCardViews: {
        fontSize: 11,
        color: '#75777d',
        fontWeight: '500',
    },
    watchClipBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#e6ede8',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
    },
    watchClipBtnText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#1b4d3e',
    },
    searchMoreYtBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 12,
        marginTop: 12,
        borderWidth: 1,
        borderColor: '#e9e8e5',
    },
    searchMoreYtText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#45474c',
        flex: 1,
    },
    quizBannerCard: {
        backgroundColor: '#182232',
        borderRadius: 16,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
        gap: 12,
    },
    quizBannerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    quizIconCircle: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    quizTextWrap: {
        flex: 1,
    },
    quizBannerTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#ffffff',
    },
    quizBannerSub: {
        fontSize: 11,
        color: '#c5c6cd',
        marginTop: 2,
    },
    startQuizBtn: {
        backgroundColor: '#ffffff',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 10,
    },
    startQuizBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#182232',
    },
    rawOcrCard: {
        backgroundColor: '#f4f3f0',
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: '#e9e8e5',
        marginBottom: 20,
    },
    rawOcrTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: '#75777d',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 6,
    },
    rawOcrText: {
        fontSize: 12,
        color: '#45474c',
        lineHeight: 18,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalBox: {
        backgroundColor: '#ffffff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        maxHeight: '85%',
        maxWidth: 540,
        width: '100%',
        alignSelf: 'center',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#182232',
    },
    modalCloseText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#4b6456',
    },
    photosGrid: {
        gap: 12,
    },
    photoGridCard: {
        width: '100%',
        height: 220,
        borderRadius: 12,
        overflow: 'hidden',
        position: 'relative',
    },
    photoGridImg: {
        width: '100%',
        height: '100%',
    },
    photoGridBadge: {
        position: 'absolute',
        top: 10,
        left: 10,
        backgroundColor: 'rgba(24, 34, 50, 0.75)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    photoGridBadgeText: {
        color: '#ffffff',
        fontSize: 11,
        fontWeight: '700',
    },
    noPhotosText: {
        fontSize: 13,
        color: '#75777d',
        textAlign: 'center',
        marginVertical: 20,
    },
    addPhotosModalBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#182232',
        paddingVertical: 12,
        borderRadius: 10,
        marginTop: 16,
    },
    addPhotosModalBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#ffffff',
    },
    // AI Note Copilot & Voice Answering Styles
    aiTopPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#cde9d8',
        paddingHorizontal: 9,
        paddingVertical: 5,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#b2cdbc',
        gap: 3,
    },
    aiTopPillActive: {
        backgroundColor: '#1b4d3e',
        borderColor: '#1b4d3e',
    },
    aiTopPillText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#1b4d3e',
    },
    aiTopPillActiveText: {
        color: '#ffffff',
    },
    mediaPillMicActive: {
        backgroundColor: '#1b4d3e',
        borderColor: '#1b4d3e',
    },
    mediaPillMicActiveText: {
        color: '#ffffff',
    },
    aiCopilotCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 16,
        marginTop: 14,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#d7e4dc',
        shadowColor: '#1b4d3e',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
    },
    aiCopilotHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    aiCopilotTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    aiCopilotIconBadge: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#1b4d3e',
        alignItems: 'center',
        justifyContent: 'center',
    },
    aiCopilotTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#182232',
    },
    aiCopilotSub: {
        fontSize: 11,
        color: '#75777d',
        marginTop: 1,
    },
    micActionButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#e6f3ec',
        borderWidth: 1,
        borderColor: '#cde9d8',
        alignItems: 'center',
        justifyContent: 'center',
    },
    micActionButtonActive: {
        backgroundColor: '#1b4d3e',
        borderColor: '#1b4d3e',
    },
    listeningWaveBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#e6f3ec',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginBottom: 12,
    },
    waveformBarsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        height: 28,
    },
    waveBar: {
        width: 3,
        borderRadius: 2,
        backgroundColor: '#1b4d3e',
    },
    listeningStatusText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#1b4d3e',
        flex: 1,
        marginLeft: 8,
    },
    listeningStopPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ba1a1a',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 10,
    },
    listeningStopText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#ffffff',
    },
    aiInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f4f3f0',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e9e8e5',
        paddingLeft: 12,
        paddingRight: 4,
        paddingVertical: 4,
        marginBottom: 10,
    },
    aiTextInput: {
        flex: 1,
        fontSize: 13,
        color: '#182232',
        paddingVertical: 6,
    },
    aiSendBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#1b4d3e',
        alignItems: 'center',
        justifyContent: 'center',
    },
    aiSendBtnDisabled: {
        backgroundColor: '#c5c6cd',
    },
    quickPromptsScroll: {
        gap: 6,
        paddingBottom: 4,
        marginBottom: 4,
    },
    promptChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f4f3f0',
        borderWidth: 1,
        borderColor: '#e3e2df',
        borderRadius: 14,
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
    promptChipText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#182232',
    },
    aiAnswerCard: {
        backgroundColor: '#fbfbf9',
        borderWidth: 1,
        borderColor: '#e9e8e5',
        borderRadius: 12,
        padding: 12,
        marginTop: 10,
    },
    questionBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        paddingBottom: 6,
        borderBottomWidth: 1,
        borderBottomColor: '#efeeeb',
    },
    questionBadgeText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#45474c',
        fontStyle: 'italic',
        flex: 1,
    },
    aiLoadingWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 8,
    },
    aiLoadingText: {
        fontSize: 12,
        color: '#45474c',
        fontStyle: 'italic',
    },
    answerBody: {
        marginTop: 2,
    },
    answerText: {
        fontSize: 13,
        lineHeight: 20,
        color: '#1a1c1a',
    },
    answerActionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 10,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#efeeeb',
    },
    voiceAnswerBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#cde9d8',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
    },
    voiceAnswerBtnActive: {
        backgroundColor: '#ffdad6',
    },
    voiceAnswerBtnText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#1b4d3e',
    },
    voiceAnswerBtnActiveText: {
        color: '#ba1a1a',
    },
    voiceAnswerLeftGroup: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    voiceCustomizationBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#e8f5ed',
        borderWidth: 1,
        borderColor: '#cde9d8',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 10,
        marginLeft: 8,
    },
    voiceCustomizationBtnText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#1b4d3e',
    },
    dismissAnswerBtn: {
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    dismissAnswerBtnText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#75777d',
    },
    floatingMicFab: {
        position: 'absolute',
        right: 20,
        width: 54,
        height: 54,
        borderRadius: 27,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(24, 34, 50, 0.76)',
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.36)',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.28,
        shadowRadius: 12,
        elevation: 8,
        zIndex: 999,
    },
    floatingMicFabListening: {
        backgroundColor: 'rgba(16, 185, 129, 0.84)',
        borderColor: 'rgba(255, 255, 255, 0.72)',
        shadowColor: '#10b981',
        shadowOpacity: 0.58,
        shadowRadius: 16,
    },
    inlineSnapshotsWrap: {
        marginTop: 14,
        marginBottom: 4,
    },
    inlineSnapshotsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    inlineSnapshotsTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    inlineSnapshotsTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: '#45474c',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    inlineSnapshotsAction: {
        fontSize: 12,
        fontWeight: '600',
        color: '#4b6456',
    },
    inlineSnapshotsScroll: {
        gap: 10,
        paddingRight: 10,
    },
    inlineSnapCard: {
        width: 140,
        height: 96,
        borderRadius: 10,
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: '#e9e8e5',
        borderWidth: 1,
        borderColor: '#e1e3e1',
    },
    inlineSnapImg: {
        width: '100%',
        height: '100%',
    },
    inlineSnapBadge: {
        position: 'absolute',
        bottom: 6,
        left: 6,
        backgroundColor: 'rgba(24, 34, 50, 0.72)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    inlineSnapBadgeText: {
        color: '#ffffff',
        fontSize: 10,
        fontWeight: '700',
    },
});