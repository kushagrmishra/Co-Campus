import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    TouchableOpacity,
    StatusBar,
    Image,
    Platform,
    Modal,
    Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { SubjectFolder, SavedNote } from '../types';
import { SAMPLE_NOTE } from '../services/storage';

interface FolderDetailScreenProps {
    folder: SubjectFolder;
    notes: SavedNote[];
    onBack: () => void;
    onScanNote: (folder: SubjectFolder) => void;
    onOpenNote: (note: SavedNote) => void;
    onPracticeCards: (note: SavedNote) => void;
}

export const FolderDetailScreen: React.FC<FolderDetailScreenProps> = ({
    folder,
    notes,
    onBack,
    onScanNote,
    onOpenNote,
    onPracticeCards,
}) => {
    const insets = useSafeAreaInsets();
    const topPadding = Platform.OS === 'android' ? Math.max(insets.top, StatusBar.currentHeight || 0, 16) : Math.max(insets.top, 12);
    const bottomPadding = Math.max(insets.bottom, Platform.OS === 'android' ? 16 : 12);
    const [activeTab, setActiveTab] = useState<'all' | 'lectures' | 'decks' | 'assignments'>('all');
    const [showMenu, setShowMenu] = useState<boolean>(false);

    const courseCode = (folder.id || 'SUBJ').substring(0, 8).toUpperCase();

    return (
        <View style={[styles.container, { paddingTop: topPadding }]}>
            <StatusBar barStyle="dark-content" backgroundColor="#faf9f6" />

            {/* Top Navigation & Breadcrumbs */}
            <View style={styles.topNav}>
                <TouchableOpacity onPress={onBack} style={styles.iconButton}>
                    <Ionicons name="arrow-back" size={20} color="#182232" />
                </TouchableOpacity>

                <View style={styles.topNavRight}>
                    <TouchableOpacity style={styles.iconButton}>
                        <Ionicons name="filter-outline" size={18} color="#45474c" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.iconButton}
                        onPress={() => setShowMenu(true)}
                    >
                        <Ionicons name="ellipsis-vertical" size={18} color="#45474c" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Overflow Menu Popover with Outside Tap Collapse */}
            <Modal
                transparent
                visible={showMenu}
                animationType="fade"
                onRequestClose={() => setShowMenu(false)}
            >
                <TouchableOpacity
                    style={styles.menuBackdrop}
                    activeOpacity={1}
                    onPress={() => setShowMenu(false)}
                >
                    <View
                        style={[
                            styles.menuPopover,
                            {
                                top: topPadding + 46,
                                right: 16,
                            },
                        ]}
                        onStartShouldSetResponder={() => true}
                    >
                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => {
                                setShowMenu(false);
                                Alert.alert('Rename Folder', 'Folder renaming enabled.');
                            }}
                        >
                            <Ionicons name="pencil-outline" size={16} color="#45474c" />
                            <Text style={styles.menuItemText}>Rename Folder</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => {
                                setShowMenu(false);
                                Alert.alert('Share Notebook', 'Collaborative academic link copied to clipboard.');
                            }}
                        >
                            <Ionicons name="share-outline" size={16} color="#45474c" />
                            <Text style={styles.menuItemText}>Share Notebook</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => {
                                setShowMenu(false);
                                Alert.alert('Export PDF Binder', 'Exporting consolidated course notebook binder...');
                            }}
                        >
                            <Ionicons name="download-outline" size={16} color="#45474c" />
                            <Text style={styles.menuItemText}>Export PDF Binder</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            <ScrollView
                style={styles.scrollArea}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Folder Header */}
                <View style={styles.folderHeader}>
                    <View style={styles.badgeRow}>
                        <View style={styles.courseBadge}>
                            <Text style={styles.courseBadgeText}>{courseCode}</Text>
                        </View>
                        <View style={styles.termBadge}>
                            <Text style={styles.termBadgeText}>Fall 2025</Text>
                        </View>
                        <View style={styles.syncedBadge}>
                            <Ionicons name="cloud-done-outline" size={12} color="#1b4d3e" style={{ marginRight: 3 }} />
                            <Text style={styles.syncedText}>Synced</Text>
                        </View>
                    </View>
                    <Text style={styles.folderTitle}>{folder.name}</Text>
                </View>

                {/* Summary Metrics Deck */}
                <View style={styles.metricsDeck}>
                    <View style={styles.metricsDeckTop}>
                        <View style={styles.metricsLeft}>
                            <View style={styles.metricsIconCircle}>
                                <Ionicons name="book-outline" size={18} color="#4b6456" />
                            </View>
                            <View>
                                <Text style={styles.metricsDeckSubtitle}>CURRICULUM PROGRESS</Text>
                                <Text style={styles.metricsDeckHeading}>92% Covered</Text>
                            </View>
                        </View>

                        <View style={styles.progressMiniWidget}>
                            <View style={styles.progressBarTrack}>
                                <View style={[styles.progressBarFill, { width: '92%' }]} />
                            </View>
                            <Text style={styles.examCountdownText}>
                                {folder.examTag || 'Exam in 12 days'}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.metricsDeckBottom}>
                        <View style={styles.metricItem}>
                            <Ionicons name="document-text-outline" size={13} color="#75777d" style={{ marginRight: 4 }} />
                            <Text style={styles.metricItemText}>{notes.length || 1} Lectures</Text>
                        </View>
                        <Text style={styles.metricItemDot}>•</Text>
                        <View style={styles.metricItem}>
                            <Ionicons name="card-outline" size={13} color="#75777d" style={{ marginRight: 4 }} />
                            <Text style={styles.metricItemText}>{(notes.length || 1) * 8} Cards</Text>
                        </View>
                        <Text style={styles.metricItemDot}>•</Text>
                        <View style={styles.metricItem}>
                            <Ionicons name="create-outline" size={13} color="#75777d" style={{ marginRight: 4 }} />
                            <Text style={styles.metricItemText}>Active Deck</Text>
                        </View>
                    </View>
                </View>

                {/* Filter Tabs Strip */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterTabsStrip}>
                    <TouchableOpacity
                        style={[styles.tabBtn, activeTab === 'all' && styles.tabBtnActive]}
                        onPress={() => setActiveTab('all')}
                    >
                        <Text style={[styles.tabBtnText, activeTab === 'all' && styles.tabBtnTextActive]}>
                            All ({notes.length || 1})
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.tabBtn, activeTab === 'lectures' && styles.tabBtnActive]}
                        onPress={() => setActiveTab('lectures')}
                    >
                        <Text style={[styles.tabBtnText, activeTab === 'lectures' && styles.tabBtnTextActive]}>
                            Lectures ({notes.length || 1})
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.tabBtn, activeTab === 'decks' && styles.tabBtnActive]}
                        onPress={() => setActiveTab('decks')}
                    >
                        <Text style={[styles.tabBtnText, activeTab === 'decks' && styles.tabBtnTextActive]}>
                            Flashcard Decks
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.tabBtn, activeTab === 'assignments' && styles.tabBtnActive]}
                        onPress={() => setActiveTab('assignments')}
                    >
                        <Text style={[styles.tabBtnText, activeTab === 'assignments' && styles.tabBtnTextActive]}>
                            Exam Problem Sets
                        </Text>
                    </TouchableOpacity>
                </ScrollView>

                {/* Subject Lectures & AI Artifacts Stream */}
                <View style={styles.streamSection}>
                    <View style={styles.streamHeaderRow}>
                        <Text style={styles.streamHeading}>Curriculum Timeline</Text>
                        <View style={styles.sortRow}>
                            <Ionicons name="swap-vertical-outline" size={13} color="#4b6456" style={{ marginRight: 2 }} />
                            <Text style={styles.sortText}>Newest</Text>
                        </View>
                    </View>

                    {/* Dynamically List Real Notes */}
                    {notes.map((note, index) => {
                        const firstImage = note.imageUris?.[0];
                        const flashcardsCount = note.flashcards?.length || 0;
                        const clipsCount = note.topicVideos?.length || 2;

                        return (
                            <View key={note.id} style={styles.articleCard}>
                                <View style={styles.articleHeader}>
                                    <View style={styles.articleHeaderLeft}>
                                        <Text style={styles.articleWeekText}>
                                            Week {Math.max(1, 4 - index)} • {new Date(note.createdAt).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                                        </Text>
                                        <Text style={styles.articleTitle}>{note.title}</Text>
                                    </View>
                                    <View style={styles.quizReadyBadge}>
                                        <Text style={styles.quizReadyBadgeText}>Quiz Ready</Text>
                                    </View>
                                </View>

                                {/* Snapshot Card */}
                                {firstImage ? (
                                    <View style={styles.snapshotCard}>
                                        <Image source={{ uri: firstImage }} style={styles.snapshotImage} />
                                        <View style={styles.snapshotOverlay}>
                                            <Ionicons name="images-outline" size={13} color="#ffffff" style={{ marginRight: 4 }} />
                                            <Text style={styles.snapshotOverlayText}>
                                                Whiteboard Scan • Board 1 of {note.imageUris!.length}
                                            </Text>
                                        </View>
                                    </View>
                                ) : (
                                    <View style={[styles.snapshotCard, styles.snapshotCardFallback]}>
                                        <Ionicons name="document-text-outline" size={32} color="#182232" />
                                        <View style={styles.snapshotOverlay}>
                                            <Ionicons name="sparkles" size={13} color="#ffffff" style={{ marginRight: 4 }} />
                                            <Text style={styles.snapshotOverlayText}>
                                                Lecture Notes Transcribed with AI Vision
                                            </Text>
                                        </View>
                                    </View>
                                )}

                                {/* Key Conceptual Milestones */}
                                <View style={styles.milestonesBox}>
                                    <Text style={styles.milestonesLabel}>Key Conceptual Milestones:</Text>
                                    {note.extraction.topics.slice(0, 3).map((topic, tIdx) => (
                                        <View key={tIdx} style={styles.milestoneRow}>
                                            <View style={styles.milestoneDot} />
                                            <Text style={styles.milestoneText} numberOfLines={2}>
                                                {topic.heading}: {topic.bullets[0] || 'Key principle covered in lecture.'}
                                            </Text>
                                        </View>
                                    ))}
                                </View>

                                {/* Study Meta Badges */}
                                <View style={styles.metaBadgesRow}>
                                    <View style={styles.metaPill}>
                                        <Ionicons name="card-outline" size={12} color="#75777d" style={{ marginRight: 4 }} />
                                        <Text style={styles.metaPillText}>{flashcardsCount} Flashcards</Text>
                                    </View>
                                    <View style={styles.metaPill}>
                                        <Ionicons name="play" size={11} color="#75777d" style={{ marginRight: 4 }} />
                                        <Text style={styles.metaPillText}>{clipsCount} Clips (14m)</Text>
                                    </View>
                                    <View style={styles.metaPill}>
                                        <Ionicons name="time-outline" size={12} color="#75777d" style={{ marginRight: 4 }} />
                                        <Text style={styles.metaPillText}>48m Audio</Text>
                                    </View>
                                </View>

                                {/* Action Buttons */}
                                <View style={styles.actionButtonsGrid}>
                                    <TouchableOpacity
                                        style={styles.openNoteBtn}
                                        onPress={() => onOpenNote(note)}
                                    >
                                        <Ionicons name="eye-outline" size={14} color="#182232" style={{ marginRight: 4 }} />
                                        <Text style={styles.openNoteText}>Open Note</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.practiceCardsBtn}
                                        onPress={() => onPracticeCards(note)}
                                    >
                                        <Ionicons name="play" size={12} color="#ffffff" style={{ marginRight: 4 }} />
                                        <Text style={styles.practiceCardsText}>Practice Cards</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        );
                    })}
                </View>
            </ScrollView>

            {/* Floating Sticky Action Button (Scan Note Directly Into Subject) */}
            <View style={[styles.floatingScanContainer, { bottom: bottomPadding + 10 }]}>
                <TouchableOpacity
                    style={styles.floatingScanBtn}
                    onPress={() => onScanNote(folder)}
                    activeOpacity={0.88}
                >
                    <Ionicons name="camera" size={18} color="#ffffff" style={{ marginRight: 6 }} />
                    <Text style={styles.floatingScanText}>Scan Note to {courseCode}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#faf9f6',
    },
    topNav: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 10,
        backgroundColor: '#faf9f6',
        maxWidth: 880,
        width: '100%',
        alignSelf: 'center',
    },
    topNavRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    iconButton: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
    },
    menuBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.05)',
    },
    menuPopover: {
        position: 'absolute',
        top: 55,
        right: 16,
        backgroundColor: '#ffffff',
        borderRadius: 14,
        paddingVertical: 6,
        shadowColor: '#2d3748',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 18,
        elevation: 8,
        zIndex: 50,
        width: 190,
        borderWidth: 1,
        borderColor: '#efeeeb',
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    menuItemText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#182232',
    },
    scrollArea: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingBottom: 130,
        maxWidth: 880,
        width: '100%',
        alignSelf: 'center',
    },
    folderHeader: {
        marginTop: 4,
        marginBottom: 14,
    },
    badgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8,
    },
    courseBadge: {
        backgroundColor: '#cde9d8',
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 12,
    },
    courseBadgeText: {
        color: '#082015',
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    termBadge: {
        backgroundColor: '#f4f3f0',
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 12,
    },
    termBadgeText: {
        color: '#45474c',
        fontSize: 11,
        fontWeight: '600',
    },
    syncedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#e6ede8',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
        marginLeft: 'auto',
    },
    syncedText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#1b4d3e',
    },
    folderTitle: {
        fontSize: 26,
        fontWeight: '800',
        color: '#182232',
        letterSpacing: -0.5,
    },
    metricsDeck: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#efeeeb',
        shadowColor: '#182232',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 1,
    },
    metricsDeckTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    metricsLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    metricsIconCircle: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#f0f5f1',
        alignItems: 'center',
        justifyContent: 'center',
    },
    metricsDeckSubtitle: {
        fontSize: 10,
        fontWeight: '700',
        color: '#75777d',
        letterSpacing: 0.8,
    },
    metricsDeckHeading: {
        fontSize: 18,
        fontWeight: '800',
        color: '#182232',
        marginTop: 2,
    },
    progressMiniWidget: {
        alignItems: 'flex-end',
        gap: 4,
    },
    progressBarTrack: {
        width: 80,
        height: 5,
        backgroundColor: '#efeeeb',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#4b6456',
        borderRadius: 3,
    },
    examCountdownText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#ba1a1a',
    },
    metricsDeckBottom: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#f7f6f2',
        gap: 8,
    },
    metricItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    metricItemText: {
        fontSize: 12,
        color: '#45474c',
        fontWeight: '500',
    },
    metricItemDot: {
        color: '#c5c6cd',
        fontSize: 10,
    },
    filterTabsStrip: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
    },
    tabBtn: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 16,
        backgroundColor: '#f4f3f0',
        borderWidth: 1,
        borderColor: '#e9e8e5',
    },
    tabBtnActive: {
        backgroundColor: '#182232',
        borderColor: '#182232',
    },
    tabBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#45474c',
    },
    tabBtnTextActive: {
        color: '#ffffff',
    },
    streamSection: {
        marginBottom: 16,
    },
    streamHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    streamHeading: {
        fontSize: 16,
        fontWeight: '700',
        color: '#182232',
    },
    sortRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    sortText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#4b6456',
    },
    articleCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#efeeeb',
        shadowColor: '#182232',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 1,
    },
    articleHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    articleHeaderLeft: {
        flex: 1,
        marginRight: 8,
    },
    articleWeekText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#75777d',
        marginBottom: 2,
    },
    articleTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#182232',
        lineHeight: 21,
    },
    quizReadyBadge: {
        backgroundColor: '#cde9d8',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    quizReadyBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#082015',
    },
    snapshotCard: {
        width: '100%',
        height: 140,
        borderRadius: 12,
        overflow: 'hidden',
        position: 'relative',
        marginBottom: 12,
    },
    snapshotCardFallback: {
        backgroundColor: '#f7f6f2',
        alignItems: 'center',
        justifyContent: 'center',
    },
    snapshotImage: {
        width: '100%',
        height: '100%',
    },
    snapshotOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(24, 34, 50, 0.75)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        flexDirection: 'row',
        alignItems: 'center',
    },
    snapshotOverlayText: {
        color: '#ffffff',
        fontSize: 11,
        fontWeight: '600',
    },
    milestonesBox: {
        backgroundColor: '#f7f6f2',
        borderRadius: 10,
        padding: 12,
        marginBottom: 12,
        gap: 6,
    },
    milestonesLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#4b6456',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    milestoneRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 6,
    },
    milestoneDot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: '#4b6456',
        marginTop: 6,
    },
    milestoneText: {
        fontSize: 12,
        color: '#1a1c1a',
        lineHeight: 17,
        flex: 1,
    },
    metaBadgesRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 14,
    },
    metaPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f4f3f0',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    metaPillText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#45474c',
    },
    actionButtonsGrid: {
        flexDirection: 'row',
        gap: 10,
    },
    openNoteBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f4f3f0',
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#e9e8e5',
    },
    openNoteText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#182232',
    },
    practiceCardsBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#182232',
        paddingVertical: 10,
        borderRadius: 10,
    },
    practiceCardsText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#ffffff',
    },
    floatingScanContainer: {
        position: 'absolute',
        bottom: 24,
        left: 0,
        right: 0,
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    floatingScanBtn: {
        backgroundColor: '#182232',
        borderRadius: 26,
        paddingVertical: 14,
        paddingHorizontal: 24,
        maxWidth: 520,
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#182232',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 6,
    },
    floatingScanText: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '700',
    },
});
