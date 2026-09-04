import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    ScrollView,
    SafeAreaView,
    Linking,
    Image,
} from 'react-native';
import { SavedNote } from '../types';

interface ResultsScreenProps {
    note: SavedNote;
    onBack: () => void;
}

type TabType = 'Notes' | 'Topics' | 'Tasks' | 'Flashcards' | 'Videos';

export const ResultsScreen: React.FC<ResultsScreenProps> = ({ note, onBack }) => {
    const [activeTab, setActiveTab] = useState<TabType>('Notes');
    const [flippedCardIndex, setFlippedCardIndex] = useState<number | null>(null);

    const tabs: TabType[] = ['Notes', 'Topics', 'Tasks', 'Flashcards', 'Videos'];

    const openYouTube = (videoId: string) => {
        const url = `https://www.youtube.com/watch?v=${videoId}`;
        Linking.openURL(url).catch((err) => console.error('Could not open YouTube:', err));
    };

    const renderTabContent = () => {
        switch (activeTab) {
            case 'Notes':
                return (
                    <ScrollView style={styles.tabContent}>
                        <View style={styles.sectionCard}>
                            <Text style={styles.sectionHeader}>Study Summary</Text>
                            <Text style={styles.bodyText}>{note.extraction.generatedNotes}</Text>
                        </View>

                        <View style={styles.sectionCard}>
                            <Text style={styles.sectionHeader}>Raw OCR Transcript</Text>
                            <Text style={styles.rawText}>{note.extraction.rawText || 'No transcript detected.'}</Text>
                        </View>
                    </ScrollView>
                );

            case 'Topics':
                return (
                    <ScrollView style={styles.tabContent}>
                        {note.extraction.topics.map((topic, index) => (
                            <View key={index} style={styles.sectionCard}>
                                <Text style={styles.topicHeading}>{topic.heading}</Text>
                                {topic.bullets.map((bullet, bIdx) => (
                                    <View key={bIdx} style={styles.bulletRow}>
                                        <Text style={styles.bulletDot}>•</Text>
                                        <Text style={styles.bulletText}>{bullet}</Text>
                                    </View>
                                ))}
                            </View>
                        ))}
                    </ScrollView>
                );

            case 'Tasks':
                return (
                    <ScrollView style={styles.tabContent}>
                        {note.extraction.tasks.length === 0 ? (
                            <Text style={styles.emptyText}>No explicit action items or tasks found.</Text>
                        ) : (
                            note.extraction.tasks.map((task, idx) => (
                                <View key={idx} style={styles.taskCard}>
                                    <View style={styles.taskHeader}>
                                        <Text style={styles.taskTitle}>{task.title}</Text>
                                        {task.dueDate && <Text style={styles.taskDueDate}>Due: {task.dueDate}</Text>}
                                    </View>
                                    {task.notes && <Text style={styles.taskNotes}>{task.notes}</Text>}
                                </View>
                            ))
                        )}
                    </ScrollView>
                );

            case 'Flashcards':
                return (
                    <ScrollView style={styles.tabContent}>
                        {note.flashcards.length === 0 ? (
                            <Text style={styles.emptyText}>No flashcards available for this note.</Text>
                        ) : (
                            note.flashcards.map((card, idx) => {
                                const isFlipped = flippedCardIndex === idx;
                                return (
                                    <TouchableOpacity
                                        key={idx}
                                        style={styles.flashcard}
                                        activeOpacity={0.9}
                                        onPress={() => setFlippedCardIndex(isFlipped ? null : idx)}
                                    >
                                        <Text style={styles.flashcardBadge}>{isFlipped ? 'ANSWER' : 'QUESTION'}</Text>
                                        <Text style={styles.flashcardText}>
                                            {isFlipped ? card.answer : card.question}
                                        </Text>
                                        <Text style={styles.flashcardHint}>Tap to flip</Text>
                                    </TouchableOpacity>
                                );
                            })
                        )}
                    </ScrollView>
                );

            case 'Videos':
                return (
                    <ScrollView style={styles.tabContent}>
                        {note.topicVideos.map((group, idx) => (
                            <View key={idx} style={styles.videoGroup}>
                                <Text style={styles.topicHeading}>{group.heading}</Text>
                                {group.videos.length === 0 ? (
                                    <Text style={styles.noVideosText}>No video recommendations found.</Text>
                                ) : (
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.videoRow}>
                                        {group.videos.map((vid) => (
                                            <TouchableOpacity
                                                key={vid.id}
                                                style={styles.videoCard}
                                                onPress={() => openYouTube(vid.id)}
                                            >
                                                <Image source={{ uri: vid.thumbnail }} style={styles.videoThumbnail} />
                                                <Text style={styles.videoTitle} numberOfLines={2}>
                                                    {vid.title}
                                                </Text>
                                                <Text style={styles.videoChannel} numberOfLines={1}>
                                                    {vid.channelTitle}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                )}
                            </View>
                        ))}
                    </ScrollView>
                );
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack}>
                    <Text style={styles.backBtn}>← Done</Text>
                </TouchableOpacity>
                <View style={styles.titleContainer}>
                    <Text style={styles.subjectBadge}>{note.subject}</Text>
                    <Text style={styles.title} numberOfLines={1}>
                        {note.title}
                    </Text>
                </View>
            </View>

            <View style={styles.tabBar}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {tabs.map((tab) => (
                        <TouchableOpacity
                            key={tab}
                            style={[styles.tabItem, activeTab === tab && styles.activeTabItem]}
                            onPress={() => setActiveTab(tab)}
                        >
                            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {renderTabContent()}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
    },
    header: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#27272a',
        flexDirection: 'row',
        alignItems: 'center',
    },
    backBtn: {
        color: '#818cf8',
        fontSize: 16,
        fontWeight: '600',
        marginRight: 16,
    },
    titleContainer: {
        flex: 1,
    },
    subjectBadge: {
        color: '#818cf8',
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    title: {
        color: '#f4f4f5',
        fontSize: 18,
        fontWeight: '700',
    },
    tabBar: {
        borderBottomWidth: 1,
        borderBottomColor: '#27272a',
        backgroundColor: '#18181b',
    },
    tabItem: {
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    activeTabItem: {
        borderBottomWidth: 2,
        borderBottomColor: '#6366f1',
    },
    tabText: {
        color: '#71717a',
        fontSize: 14,
        fontWeight: '600',
    },
    activeTabText: {
        color: '#818cf8',
    },
    tabContent: {
        flex: 1,
        padding: 16,
    },
    sectionCard: {
        backgroundColor: '#1e1e24',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#2e2e38',
    },
    sectionHeader: {
        fontSize: 16,
        fontWeight: '700',
        color: '#818cf8',
        marginBottom: 8,
    },
    bodyText: {
        fontSize: 15,
        color: '#e4e4e7',
        lineHeight: 22,
    },
    rawText: {
        fontSize: 13,
        color: '#a1a1aa',
        fontFamily: 'monospace',
        lineHeight: 18,
    },
    topicHeading: {
        fontSize: 17,
        fontWeight: '700',
        color: '#f4f4f5',
        marginBottom: 10,
    },
    bulletRow: {
        flexDirection: 'row',
        marginBottom: 6,
        paddingRight: 12,
    },
    bulletDot: {
        color: '#6366f1',
        fontSize: 16,
        marginRight: 8,
    },
    bulletText: {
        color: '#d4d4d8',
        fontSize: 14,
        lineHeight: 20,
        flex: 1,
    },
    taskCard: {
        backgroundColor: '#1e1e24',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#2e2e38',
    },
    taskHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    taskTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#f4f4f5',
        flex: 1,
    },
    taskDueDate: {
        fontSize: 12,
        color: '#f87171',
        fontWeight: '600',
        backgroundColor: '#3f1d1d',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    taskNotes: {
        fontSize: 13,
        color: '#a1a1aa',
    },
    flashcard: {
        backgroundColor: '#1e1e24',
        borderRadius: 14,
        padding: 20,
        marginBottom: 14,
        minHeight: 140,
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: '#3f3f46',
    },
    flashcardBadge: {
        fontSize: 10,
        fontWeight: '800',
        color: '#818cf8',
        letterSpacing: 1,
    },
    flashcardText: {
        fontSize: 16,
        color: '#f4f4f5',
        fontWeight: '600',
        textAlign: 'center',
        marginVertical: 12,
    },
    flashcardHint: {
        fontSize: 11,
        color: '#71717a',
        textAlign: 'right',
    },
    videoGroup: {
        marginBottom: 24,
    },
    videoRow: {
        flexDirection: 'row',
    },
    videoCard: {
        width: 200,
        backgroundColor: '#1e1e24',
        borderRadius: 10,
        marginRight: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#2e2e38',
    },
    videoThumbnail: {
        width: '100%',
        height: 110,
        backgroundColor: '#27272a',
    },
    videoTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#f4f4f5',
        paddingHorizontal: 8,
        paddingTop: 8,
        lineHeight: 18,
    },
    videoChannel: {
        fontSize: 11,
        color: '#71717a',
        paddingHorizontal: 8,
        paddingBottom: 8,
        marginTop: 4,
    },
    noVideosText: {
        color: '#71717a',
        fontSize: 13,
        fontStyle: 'italic',
    },
    emptyText: {
        color: '#71717a',
        fontSize: 14,
        textAlign: 'center',
        marginTop: 40,
    },
});