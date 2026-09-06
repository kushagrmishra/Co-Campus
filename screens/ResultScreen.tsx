import React, { useState, useEffect, useMemo } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { SavedNote, YouTubeVideo } from '../types';
import { getCuratedClipsForSubject } from '../services/youtube';

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

    // Stop speech on unmount
    useEffect(() => {
        return () => {
            Speech.stop();
        };
    }, []);

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

    const handleToggleAudio = async () => {
        if (isPlayingAudio) {
            await Speech.stop();
            setIsPlayingAudio(false);
        } else {
            setIsPlayingAudio(true);
            const textToSpeak = `${note.title}. Summary: ${note.extraction.generatedNotes}. Key Topics: ${note.extraction.topics
                .map((t) => t.heading)
                .join('. ')}`;
            Speech.speak(textToSpeak, {
                rate: 0.95,
                pitch: 1.0,
                onDone: () => setIsPlayingAudio(false),
                onStopped: () => setIsPlayingAudio(false),
                onError: () => setIsPlayingAudio(false),
            });
        }
    };

    const handleBack = async () => {
        if (isPlayingAudio) {
            await Speech.stop();
            setIsPlayingAudio(false);
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
                style={styles.scrollArea}
                contentContainerStyle={styles.scrollContent}
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

                    {/* Quick Media / Audio Pills */}
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
                    </View>
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
});