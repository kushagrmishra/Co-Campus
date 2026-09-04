import React, { useState, useEffect, useCallback } from 'react';
import {
    StyleSheet,
    Text,
    View,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    SafeAreaView,
    StatusBar,
} from 'react-native';
import { SubjectFolder, SavedNote } from '../types';
import { fetchSubjectFolders, fetchNotesBySubject } from '../services/storage';

interface HomeScreenProps {
    onScanPress: () => void;
    onSelectNote: (note: SavedNote) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onScanPress, onSelectNote }) => {
    const [folders, setFolders] = useState<SubjectFolder[]>([]);
    const [selectedFolder, setSelectedFolder] = useState<SubjectFolder | null>(null);
    const [notes, setNotes] = useState<SavedNote[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);

    const loadData = useCallback(async () => {
        try {
            if (selectedFolder) {
                const fetchedNotes = await fetchNotesBySubject(selectedFolder.id);
                setNotes(fetchedNotes);
            } else {
                const fetchedFolders = await fetchSubjectFolders();
                setFolders(fetchedFolders);
            }
        } catch (err) {
            console.error('Error fetching data:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [selectedFolder]);

    useEffect(() => {
        setLoading(true);
        loadData();
    }, [loadData]);

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    const handleFolderTap = (folder: SubjectFolder) => {
        setSelectedFolder(folder);
    };

    const handleBackToFolders = () => {
        setSelectedFolder(null);
        setNotes([]);
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#121212" />
            <View style={styles.header}>
                {selectedFolder ? (
                    <TouchableOpacity onPress={handleBackToFolders} style={styles.backButton}>
                        <Text style={styles.backButtonText}>← Subjects</Text>
                    </TouchableOpacity>
                ) : (
                    <Text style={styles.logo}>Campus Copilot</Text>
                )}
                <Text style={styles.headerTitle}>
                    {selectedFolder ? selectedFolder.name : 'Study Library'}
                </Text>
            </View>

            {loading && !refreshing ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color="#6366f1" />
                </View>
            ) : selectedFolder ? (
                <FlatList
                    data={notes}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No notes saved in this folder yet.</Text>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <TouchableOpacity style={styles.card} onPress={() => onSelectNote(item)}>
                            <Text style={styles.cardTitle}>{item.title}</Text>
                            <Text style={styles.cardSubtitle} numberOfLines={2}>
                                {item.extraction.generatedNotes}
                            </Text>
                            <Text style={styles.cardMeta}>
                                {new Date(item.createdAt).toLocaleDateString()} • {item.flashcards.length} Flashcards
                            </Text>
                        </TouchableOpacity>
                    )}
                />
            ) : (
                <FlatList
                    data={folders}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyTitle}>No Study Notes Yet</Text>
                            <Text style={styles.emptyText}>
                                Tap "+ Scan Notes" to take a photo of your whiteboard, lecture slide, or notebook.
                            </Text>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <TouchableOpacity style={styles.folderCard} onPress={() => handleFolderTap(item)}>
                            <View style={styles.folderHeader}>
                                <Text style={styles.folderIcon}>📁</Text>
                                <Text style={styles.folderName}>{item.name}</Text>
                            </View>
                            <Text style={styles.folderBadge}>{item.noteCount} notes</Text>
                        </TouchableOpacity>
                    )}
                />
            )}

            <TouchableOpacity style={styles.fab} onPress={onScanPress} activeOpacity={0.8}>
                <Text style={styles.fabText}>+ Scan Notes</Text>
            </TouchableOpacity>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
    },
    header: {
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#27272a',
    },
    logo: {
        fontSize: 12,
        fontWeight: '700',
        color: '#818cf8',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 4,
    },
    headerTitle: {
        fontSize: 26,
        fontWeight: '800',
        color: '#f4f4f5',
    },
    backButton: {
        marginBottom: 4,
    },
    backButtonText: {
        color: '#818cf8',
        fontSize: 14,
        fontWeight: '600',
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        padding: 16,
        paddingBottom: 90,
    },
    folderCard: {
        backgroundColor: '#1e1e24',
        borderRadius: 12,
        padding: 18,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: '#2e2e38',
    },
    folderHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    folderIcon: {
        fontSize: 22,
        marginRight: 12,
    },
    folderName: {
        fontSize: 18,
        fontWeight: '600',
        color: '#f4f4f5',
        flex: 1,
    },
    folderBadge: {
        backgroundColor: '#2d2d3a',
        color: '#a5b4fc',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        fontSize: 12,
        fontWeight: '600',
    },
    card: {
        backgroundColor: '#1e1e24',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#2e2e38',
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#f4f4f5',
        marginBottom: 6,
    },
    cardSubtitle: {
        fontSize: 14,
        color: '#a1a1aa',
        marginBottom: 10,
        lineHeight: 20,
    },
    cardMeta: {
        fontSize: 12,
        color: '#6366f1',
        fontWeight: '500',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        paddingHorizontal: 24,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#e4e4e7',
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 14,
        color: '#71717a',
        textAlign: 'center',
        lineHeight: 20,
    },
    fab: {
        position: 'absolute',
        bottom: 24,
        right: 20,
        backgroundColor: '#6366f1',
        paddingVertical: 14,
        paddingHorizontal: 22,
        borderRadius: 30,
        elevation: 5,
        shadowColor: '#6366f1',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 6,
    },
    fabText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '700',
    },
});