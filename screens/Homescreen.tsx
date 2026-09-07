import React, { useState, useEffect, useCallback } from 'react';
import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    StatusBar,
    Modal,
    TextInput,
    Alert,
    Image,
    Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SubjectFolder, SavedNote } from '../types';
import {
    fetchSubjectFolders,
    fetchNotesBySubject,
    createSubjectFolder,
    updateFolderExam,
    forceRefreshStorage,
    SAMPLE_NOTE,
    AUTOMATA_NOTE,
    DISCRETE_NOTE,
} from '../services/storage';
import { extractExamFromSyllabus, ExtractedExamInfo } from '../services/llm';
import { FolderDetailScreen } from './FolderDetailScreen';

interface HomeScreenProps {
    onScanPress: (targetFolder?: SubjectFolder | null) => void;
    onSelectNote: (note: SavedNote) => void;
    onQuickReviewPress?: () => void;
    initialFolder?: SubjectFolder | null;
    initialSection?: 'folders' | 'notes';
}

const DEFAULT_SUBJECTS: Array<{
    code: string;
    name: string;
    examTag?: string;
    noteCount: number;
    cardCount: number;
    color: string;
    bg: string;
}> = [
    {
        code: 'AUTOMATA',
        name: 'Automata Theory',
        examTag: 'Exam in 4 days',
        noteCount: 1,
        cardCount: 10,
        color: '#082015',
        bg: '#cde9d8',
    },
    {
        code: 'GRAPH-TH',
        name: 'Graph Theory & Discrete Math',
        examTag: 'Exam in 12 days',
        noteCount: 1,
        cardCount: 10,
        color: '#331100',
        bg: '#ffdbca',
    },
    {
        code: 'BIO 101',
        name: 'Biology 101: Cell Energetics',
        examTag: 'Exam in 18 days',
        noteCount: 1,
        cardCount: 10,
        color: '#0e381b',
        bg: '#d2ebd9',
    },
];

const AVAILABLE_TERMS = [
    'Fall 2025',
    'Spring 2026',
    'Summer 2026',
    'Fall 2026',
    'Academic Year 2025-26',
];

export const HomeScreen: React.FC<HomeScreenProps> = ({
    onScanPress,
    onSelectNote,
    onQuickReviewPress,
    initialFolder,
    initialSection,
}) => {
    const insets = useSafeAreaInsets();
    const topPadding = Platform.OS === 'android' ? Math.max(insets.top, StatusBar.currentHeight || 0, 16) : Math.max(insets.top, 10);
    const [folders, setFolders] = useState<SubjectFolder[]>([]);
    const [selectedFolder, setSelectedFolder] = useState<SubjectFolder | null>(initialFolder || null);
    const [notes, setNotes] = useState<SavedNote[]>([]);
    const [allRecentNotes, setAllRecentNotes] = useState<SavedNote[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);

    // Current Term / Year
    const [currentTerm, setCurrentTerm] = useState<string>('Fall 2025');
    const [showTermModal, setShowTermModal] = useState<boolean>(false);
    const [customTermInput, setCustomTermInput] = useState<string>('');

    // Username greeting
    const [username, setUsername] = useState<string>('Kushagr');

    // Filters and search
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [activeFilterChip, setActiveFilterChip] = useState<string>('All');
    const [activeCaptureTab, setActiveCaptureTab] = useState<string>('All Captures');

    // Create folder modal
    const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
    const [newFolderName, setNewFolderName] = useState<string>('');

    // Exam Syllabus Scanning States
    const [showExamUploadModal, setShowExamUploadModal] = useState<boolean>(false);
    const [isAnalyzingExam, setIsAnalyzingExam] = useState<boolean>(false);
    const [extractedExam, setExtractedExam] = useState<ExtractedExamInfo | null>(null);
    const [selectedFolderForExam, setSelectedFolderForExam] = useState<string>('');
    const [showExamConfirmModal, setShowExamConfirmModal] = useState<boolean>(false);

    const loadData = useCallback(async () => {
        try {
            // Load current term and username from storage
            const savedTerm = await AsyncStorage.getItem('@cocampus_current_term');
            if (savedTerm) setCurrentTerm(savedTerm);

            const savedUser = await AsyncStorage.getItem('@cocampus_auth_user');
            if (savedUser) {
                setUsername(savedUser.charAt(0).toUpperCase() + savedUser.slice(1));
            }

            if (selectedFolder) {
                const fetchedNotes = await fetchNotesBySubject(selectedFolder.id);
                setNotes(fetchedNotes);
            } else {
                const fetchedFolders = await fetchSubjectFolders();
                setFolders(fetchedFolders);

                // Collect recent notes from all folders
                const recentCollector: SavedNote[] = [];
                for (const f of fetchedFolders.slice(0, 5)) {
                    const subNotes = await fetchNotesBySubject(f.id);
                    recentCollector.push(...subNotes);
                }
                recentCollector.sort((a, b) => b.createdAt - a.createdAt);
                setAllRecentNotes(recentCollector);
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

    const onRefresh = async () => {
        setRefreshing(true);
        try {
            await forceRefreshStorage();
        } catch (e) {
            console.warn('Storage refresh error:', e);
        }
        await loadData();
    };

    const handleFolderTap = (folder: SubjectFolder) => {
        setSelectedFolder(folder);
    };

    const handleBackToFolders = () => {
        setSelectedFolder(null);
        setNotes([]);
    };

    const handleCreateFolder = async () => {
        const trimmed = newFolderName.trim();
        if (!trimmed) return;
        try {
            const folder = await createSubjectFolder(trimmed);
            setNewFolderName('');
            setShowCreateModal(false);
            setFolders((prev) => [folder, ...prev.filter((f) => f.id !== folder.id)]);
            setSelectedFolder(folder);
        } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to create folder');
        }
    };

    const handleSelectTerm = async (term: string) => {
        const clean = term.trim();
        if (!clean) return;
        setCurrentTerm(clean);
        setShowTermModal(false);
        setCustomTermInput('');
        await AsyncStorage.setItem('@cocampus_current_term', clean);
    };

    // Syllabus & Exam document parsing handlers
    const processExamImage = async (base64Data: string) => {
        setIsAnalyzingExam(true);
        setShowExamUploadModal(false);
        try {
            const result = await extractExamFromSyllabus(base64Data);
            setExtractedExam(result);
            // Default target folder selection
            const match = folders.find(
                (f) =>
                    f.name.toLowerCase().includes(result.subject.toLowerCase()) ||
                    result.subject.toLowerCase().includes(f.name.toLowerCase())
            );
            setSelectedFolderForExam(match ? match.id : folders[0]?.id || 'automata-theory');
            setShowExamConfirmModal(true);
        } catch (err: any) {
            Alert.alert('Analysis Notice', err.message || 'Could not parse exam schedule from file.');
        } finally {
            setIsAnalyzingExam(false);
        }
    };

    const handlePickExamCamera = async () => {
        try {
            const permission = await ImagePicker.requestCameraPermissionsAsync();
            if (!permission.granted) {
                Alert.alert('Permission Needed', 'Camera access is required to photograph your syllabus.');
                return;
            }
            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                base64: true,
                quality: 0.8,
            });
            if (!result.canceled && result.assets[0]?.base64) {
                await processExamImage(result.assets[0].base64);
            }
        } catch (e) {
            console.error('Camera syllabus picker error:', e);
        }
    };

    const handlePickExamGallery = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                base64: true,
                quality: 0.8,
            });
            if (!result.canceled && result.assets[0]?.base64) {
                await processExamImage(result.assets[0].base64);
            }
        } catch (e) {
            console.error('Gallery syllabus picker error:', e);
        }
    };

    const handlePickExamDocument = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['image/*', 'application/pdf'],
                copyToCacheDirectory: true,
            });
            if (!result.canceled && result.assets && result.assets.length > 0) {
                const asset = result.assets[0];
                const base64 = await FileSystem.readAsStringAsync(asset.uri, {
                    encoding: FileSystem.EncodingType.Base64,
                });
                await processExamImage(base64);
            }
        } catch (e) {
            console.error('Document picker error:', e);
        }
    };

    const handleConfirmExamTag = async () => {
        if (!extractedExam) return;
        const targetSlug = selectedFolderForExam || folders[0]?.id || 'automata-theory';
        await updateFolderExam(targetSlug, extractedExam.examTag, extractedExam.examDate);
        setShowExamConfirmModal(false);
        setExtractedExam(null);
        await loadData();
        Alert.alert('Exam Scheduled', `Updated ${extractedExam.examTag} for ${extractedExam.subject}!`);
    };

    const todayDateFormatted = new Date()
        .toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
        })
        .toUpperCase();

    // Render folder detail view if one is opened
    if (selectedFolder) {
        return (
            <FolderDetailScreen
                folder={selectedFolder}
                notes={notes}
                onBack={handleBackToFolders}
                onScanNote={(f) => onScanPress(f)}
                onOpenNote={(n) => onSelectNote(n)}
                onPracticeCards={(n) => onSelectNote(n)}
            />
        );
    }

    return (
        <View style={[styles.container, { paddingTop: topPadding }]}>
            <StatusBar barStyle="dark-content" backgroundColor="#faf9f6" />

            {/* Top Brand & Navigation Header */}
            <View style={styles.topHeader}>
                <View style={styles.headerLeft}>
                    <Text style={styles.brandTitle}>cocampus</Text>
                    <TouchableOpacity
                        style={styles.termPill}
                        onPress={() => setShowTermModal(true)}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.termPillText}>{currentTerm}</Text>
                        <Ionicons name="chevron-down" size={12} color="#1a1c1a" style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                </View>
                <View style={styles.headerRight}>
                    <TouchableOpacity
                        style={styles.iconCircleBtn}
                        onPress={() => setShowCreateModal(true)}
                    >
                        <Ionicons name="folder-outline" size={16} color="#182232" />
                    </TouchableOpacity>
                    <View style={styles.avatarCircle}>
                        <Text style={styles.avatarInitial}>{username.charAt(0) || 'K'}</Text>
                    </View>
                </View>
            </View>

            <ScrollView
                style={styles.scrollArea}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4b6456" />
                }
            >
                {/* Friendly Academic Greeting & Search */}
                <View style={styles.greetingSection}>
                    <View style={styles.greetingTopRow}>
                        <View>
                            <Text style={styles.dateLabel}>{todayDateFormatted}</Text>
                            <Text style={styles.greetingHeading}>Good morning, {username}.</Text>
                        </View>
                        <View style={styles.balancedMindBadge}>
                            <Ionicons name="leaf-outline" size={14} color="#4b6456" style={{ marginRight: 4 }} />
                            <Text style={styles.balancedMindText}>Balanced Mind</Text>
                        </View>
                    </View>

                    {/* Search Input Field */}
                    <View style={styles.searchBar}>
                        <Ionicons name="search-outline" size={18} color="#75777d" style={styles.searchIcon} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search notes, lectures, formulas..."
                            placeholderTextColor="#75777d"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        <Ionicons name="options-outline" size={18} color="#75777d" />
                    </View>

                    {/* Filter Chips Carousel (Removed 'Shared with Me' per request) */}
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.filterChipsRow}
                    >
                        {['All', currentTerm, '• Midterms Soon'].map((chip) => {
                            const isActive = activeFilterChip === chip;
                            return (
                                <TouchableOpacity
                                    key={chip}
                                    style={[styles.filterChip, isActive && styles.filterChipActive]}
                                    onPress={() => setActiveFilterChip(chip)}
                                >
                                    <Text
                                        style={[
                                            styles.filterChipText,
                                            isActive && styles.filterChipTextActive,
                                        ]}
                                    >
                                        {chip}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>

                {/* Exam Syllabus Scanner Action Banner */}
                <TouchableOpacity
                    style={styles.examBanner}
                    onPress={() => setShowExamUploadModal(true)}
                    activeOpacity={0.88}
                >
                    <View style={styles.examBannerLeft}>
                        <View style={styles.examBannerIconCircle}>
                            <Ionicons name="calendar-outline" size={20} color="#182232" />
                        </View>
                        <View style={styles.examBannerTextWrap}>
                            <Text style={styles.examBannerTitle}>Set Exam from Syllabus / File</Text>
                            <Text style={styles.examBannerSub}>
                                Upload schedule or document photo — AI automatically sets countdown & tags
                            </Text>
                        </View>
                    </View>
                    <View style={styles.examBannerBtn}>
                        <Ionicons name="cloud-upload-outline" size={14} color="#ffffff" style={{ marginRight: 4 }} />
                        <Text style={styles.examBannerBtnText}>Scan</Text>
                    </View>
                </TouchableOpacity>

                {/* Calm Study Metric & Streak Banner */}
                <View style={styles.calmStreakCard}>
                    <View style={styles.streakLeft}>
                        <View style={styles.streakIconCircle}>
                            <Ionicons name="sparkles" size={18} color="#4b6456" />
                        </View>
                        <View style={styles.streakTextWrap}>
                            <View style={styles.streakTitleRow}>
                                <Text style={styles.streakTitle}>5-Day Calm Streak</Text>
                                <Text style={styles.retentionText}>• 84% Memory Retention</Text>
                            </View>
                            <Text style={styles.streakDesc}>
                                Review 10 flashcards today to solidify Automata and Discrete concepts gently.
                            </Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        style={styles.quickReviewBtn}
                        onPress={onQuickReviewPress || (() => onScanPress(null))}
                    >
                        <Text style={styles.quickReviewText}>Quick Review</Text>
                    </TouchableOpacity>
                </View>

                {/* Subject Folders */}
                <View style={styles.sectionHeaderRow}>
                    <View style={styles.sectionHeaderLeft}>
                        <Ionicons name="folder-outline" size={18} color="#182232" style={{ marginRight: 6 }} />
                        <Text style={styles.sectionTitle}>Subject Folders</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <TouchableOpacity
                            onPress={async () => {
                                setRefreshing(true);
                                try {
                                    await forceRefreshStorage();
                                } catch (e) {
                                    console.warn('Storage refresh error:', e);
                                }
                                await loadData();
                            }}
                            style={{ flexDirection: 'row', alignItems: 'center' }}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="refresh" size={13} color="#4b6456" style={{ marginRight: 3 }} />
                            <Text style={styles.manageText}>Refresh</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setShowCreateModal(true)}>
                            <Text style={styles.manageText}>+ New ({folders.length})</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.foldersGrid}>
                    {folders.length > 0
                        ? folders.map((folder, index) => {
                              const fallbackPreset = DEFAULT_SUBJECTS[index % DEFAULT_SUBJECTS.length];
                              return (
                                  <TouchableOpacity
                                      key={folder.id}
                                      style={styles.folderCard}
                                      onPress={() => handleFolderTap(folder)}
                                      activeOpacity={0.9}
                                  >
                                      <View style={styles.folderCardTop}>
                                          <View style={styles.folderLeftContent}>
                                              <View
                                                  style={[
                                                      styles.folderIconBox,
                                                      { backgroundColor: fallbackPreset.bg },
                                                  ]}
                                              >
                                                  <Ionicons
                                                      name="school-outline"
                                                      size={20}
                                                      color={fallbackPreset.color}
                                                  />
                                              </View>
                                              <View style={styles.folderTitleWrap}>
                                                  <View style={styles.courseTagRow}>
                                                      <Text style={styles.courseCode}>
                                                          {folder.id.substring(0, 8).toUpperCase()}
                                                      </Text>
                                                      {folder.examTag && (
                                                          <View style={styles.examTagPill}>
                                                              <Text style={styles.examTagText}>
                                                                  {folder.examTag}
                                                              </Text>
                                                          </View>
                                                      )}
                                                  </View>
                                                  <Text style={styles.folderTitleText}>{folder.name}</Text>
                                              </View>
                                          </View>
                                          <Ionicons name="ellipsis-vertical" size={16} color="#75777d" />
                                      </View>

                                      <View style={styles.folderCardBottom}>
                                          <View style={styles.folderStatsRow}>
                                              <View style={styles.statItemRow}>
                                                  <Ionicons name="document-text-outline" size={13} color="#75777d" />
                                                  <Text style={styles.folderStatItem}>
                                                      {folder.noteCount} notes
                                                  </Text>
                                              </View>
                                              <View style={styles.statItemRow}>
                                                  <Ionicons name="card-outline" size={13} color="#75777d" />
                                                  <Text style={styles.folderStatItem}>
                                                      {(folder.noteCount || 1) * 8} cards
                                                  </Text>
                                              </View>
                                          </View>
                                          <Ionicons name="arrow-forward" size={15} color="#4b6456" />
                                      </View>
                                  </TouchableOpacity>
                              );
                          })
                        : DEFAULT_SUBJECTS.map((preset) => (
                              <TouchableOpacity
                                  key={preset.code}
                                  style={styles.folderCard}
                                  onPress={async () => {
                                      const created = await createSubjectFolder(preset.name);
                                      handleFolderTap(created);
                                  }}
                                  activeOpacity={0.9}
                              >
                                  <View style={styles.folderCardTop}>
                                      <View style={styles.folderLeftContent}>
                                          <View style={[styles.folderIconBox, { backgroundColor: preset.bg }]}>
                                              <Ionicons
                                                  name="school-outline"
                                                  size={20}
                                                  color={preset.color}
                                              />
                                          </View>
                                          <View style={styles.folderTitleWrap}>
                                              <View style={styles.courseTagRow}>
                                                  <Text style={styles.courseCode}>{preset.code}</Text>
                                                  {preset.examTag && (
                                                      <View style={styles.examTagPill}>
                                                          <Text style={styles.examTagText}>{preset.examTag}</Text>
                                                      </View>
                                                  )}
                                              </View>
                                              <Text style={styles.folderTitleText}>{preset.name}</Text>
                                          </View>
                                      </View>
                                      <Ionicons name="ellipsis-vertical" size={16} color="#75777d" />
                                  </View>

                                  <View style={styles.folderCardBottom}>
                                      <View style={styles.folderStatsRow}>
                                          <View style={styles.statItemRow}>
                                              <Ionicons name="document-text-outline" size={13} color="#75777d" />
                                              <Text style={styles.folderStatItem}>{preset.noteCount} notes</Text>
                                          </View>
                                          <View style={styles.statItemRow}>
                                              <Ionicons name="card-outline" size={13} color="#75777d" />
                                              <Text style={styles.folderStatItem}>{preset.cardCount} cards</Text>
                                          </View>
                                      </View>
                                      <Ionicons name="arrow-forward" size={15} color="#4b6456" />
                                  </View>
                              </TouchableOpacity>
                          ))}

                    {/* Create Subject Folder Button */}
                    <TouchableOpacity
                        style={styles.createFolderDashedCard}
                        onPress={() => setShowCreateModal(true)}
                    >
                        <Ionicons name="add-circle-outline" size={20} color="#4b6456" />
                        <Text style={styles.createFolderDashedText}>Create Subject Folder</Text>
                    </TouchableOpacity>
                </View>

                {/* Recent Notes & AI Captures */}
                <View style={[styles.sectionHeaderRow, { marginTop: 26 }]}>
                    <View style={styles.sectionHeaderLeft}>
                        <Ionicons name="sparkles" size={17} color="#4b6456" style={{ marginRight: 6 }} />
                        <Text style={styles.sectionTitle}>Recent Notes & Captures</Text>
                    </View>
                    <Text style={styles.manageText}>View Feed</Text>
                </View>

                {/* Segmented Filter Pills */}
                <View style={styles.segmentedFilterContainer}>
                    {['All Captures', 'Whiteboards', 'Handwritten', 'Decks'].map((tab) => {
                        const isTabActive = activeCaptureTab === tab;
                        return (
                            <TouchableOpacity
                                key={tab}
                                style={[styles.segmentedTab, isTabActive && styles.segmentedTabActive]}
                                onPress={() => setActiveCaptureTab(tab)}
                            >
                                <Text
                                    style={[
                                        styles.segmentedTabText,
                                        isTabActive && styles.segmentedTabTextActive,
                                    ]}
                                >
                                    {tab}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Feed Items */}
                <View style={styles.capturesFeed}>
                    {allRecentNotes.length > 0 ? (
                        allRecentNotes.slice(0, 5).map((item) => (
                            <TouchableOpacity
                                key={item.id}
                                style={styles.captureFeedItem}
                                onPress={() => onSelectNote(item)}
                                activeOpacity={0.9}
                            >
                                <View style={styles.captureThumbWrap}>
                                    {item.imageUris?.[0] ? (
                                        <Image
                                            source={{ uri: item.imageUris[0] }}
                                            style={styles.captureThumbImage}
                                        />
                                    ) : (
                                        <View style={styles.captureThumbFallback}>
                                            <Ionicons name="document-text" size={20} color="#4b6456" />
                                        </View>
                                    )}
                                    <View style={styles.captureTypeBadge}>
                                        <Text style={styles.captureTypeBadgeText}>AI</Text>
                                    </View>
                                </View>
                                <View style={styles.captureFeedDetails}>
                                    <View style={styles.captureFeedStatusRow}>
                                        <View style={styles.feedStatusBadge}>
                                            <Text style={styles.feedStatusText}>Transcribed & Quiz Ready</Text>
                                        </View>
                                        <Text style={styles.feedTimestamp}>
                                            {new Date(item.createdAt).toLocaleDateString()}
                                        </Text>
                                    </View>
                                    <Text style={styles.captureFeedTitle} numberOfLines={1}>
                                        {item.title}
                                    </Text>
                                    <View style={styles.captureFeedMeta}>
                                        <View style={styles.metaRowInner}>
                                            <Ionicons name="card-outline" size={12} color="#75777d" />
                                            <Text style={styles.captureFeedCards}>
                                                {item.flashcards.length} flashcards linked
                                            </Text>
                                        </View>
                                        <Text style={styles.captureFeedDot}>•</Text>
                                        <Text style={styles.captureFeedSubject}>{item.subject}</Text>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        ))
                    ) : (
                        <TouchableOpacity
                            style={styles.captureFeedItem}
                            onPress={() => onSelectNote(AUTOMATA_NOTE)}
                            activeOpacity={0.9}
                        >
                            <View style={styles.captureThumbWrap}>
                                <View style={[styles.captureThumbFallback, { backgroundColor: '#e9e8e5' }]}>
                                    <Ionicons name="document-text" size={20} color="#182232" />
                                </View>
                                <View style={styles.captureTypeBadge}>
                                    <Text style={styles.captureTypeBadgeText}>AI</Text>
                                </View>
                            </View>
                            <View style={styles.captureFeedDetails}>
                                <View style={styles.captureFeedStatusRow}>
                                    <View style={styles.feedStatusBadge}>
                                        <Text style={styles.feedStatusText}>Transcribed & Quiz Ready</Text>
                                    </View>
                                    <Text style={styles.feedTimestamp}>Today</Text>
                                </View>
                                <Text style={styles.captureFeedTitle} numberOfLines={1}>
                                    Deterministic Finite Automata & Pumping Lemma
                                </Text>
                                <View style={styles.captureFeedMeta}>
                                    <View style={styles.metaRowInner}>
                                        <Ionicons name="card-outline" size={12} color="#75777d" />
                                        <Text style={styles.captureFeedCards}>8 flashcards linked</Text>
                                    </View>
                                    <Text style={styles.captureFeedDot}>•</Text>
                                    <Text style={styles.captureFeedSubject}>Automata Theory</Text>
                                </View>
                            </View>
                        </TouchableOpacity>
                    )}
                </View>
            </ScrollView>

            {/* Term / Year Selector Modal */}
            <Modal visible={showTermModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalBox}>
                        <View style={styles.modalHeaderRow}>
                            <Text style={styles.modalHeading}>Select Academic Term</Text>
                            <TouchableOpacity onPress={() => setShowTermModal(false)}>
                                <Ionicons name="close" size={22} color="#182232" />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.modalSubheading}>
                            Choose your current semester or enter a custom academic period.
                        </Text>

                        <View style={styles.termsList}>
                            {AVAILABLE_TERMS.map((t) => (
                                <TouchableOpacity
                                    key={t}
                                    style={[styles.termOptionItem, currentTerm === t && styles.termOptionItemActive]}
                                    onPress={() => handleSelectTerm(t)}
                                >
                                    <Text
                                        style={[
                                            styles.termOptionText,
                                            currentTerm === t && styles.termOptionTextActive,
                                        ]}
                                    >
                                        {t}
                                    </Text>
                                    {currentTerm === t && (
                                        <Ionicons name="checkmark" size={18} color="#4b6456" />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View style={styles.customTermInputWrap}>
                            <TextInput
                                style={styles.customTermInput}
                                placeholder="Or type custom term (e.g. Winter 2026)"
                                placeholderTextColor="#75777d"
                                value={customTermInput}
                                onChangeText={setCustomTermInput}
                            />
                            <TouchableOpacity
                                style={styles.customTermBtn}
                                onPress={() => handleSelectTerm(customTermInput)}
                            >
                                <Text style={styles.customTermBtnText}>Set</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Create Folder Modal */}
            <Modal visible={showCreateModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalBox}>
                        <View style={styles.modalHeaderRow}>
                            <Text style={styles.modalHeading}>New Subject Folder</Text>
                            <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                                <Ionicons name="close" size={22} color="#182232" />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.modalSubheading}>
                            Group your lecture photos, AI notes, and active recall decks.
                        </Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="e.g. Automata Theory, Linear Algebra..."
                            placeholderTextColor="#75777d"
                            value={newFolderName}
                            onChangeText={setNewFolderName}
                            autoFocus
                        />
                        <View style={styles.modalButtonsRow}>
                            <TouchableOpacity
                                style={styles.modalCancelBtn}
                                onPress={() => setShowCreateModal(false)}
                            >
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleCreateFolder}>
                                <Text style={styles.modalConfirmText}>Create Folder</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Exam Syllabus Upload Option Modal */}
            <Modal visible={showExamUploadModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalBox}>
                        <View style={styles.modalHeaderRow}>
                            <Text style={styles.modalHeading}>Set Exam from Syllabus</Text>
                            <TouchableOpacity onPress={() => setShowExamUploadModal(false)}>
                                <Ionicons name="close" size={22} color="#182232" />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.modalSubheading}>
                            Upload a photo, screenshot, or document of your course schedule. Gemini Vision will
                            detect exam dates and tag your subject folders.
                        </Text>

                        <View style={styles.examActionsList}>
                            <TouchableOpacity
                                style={styles.examActionCard}
                                onPress={handlePickExamCamera}
                                activeOpacity={0.85}
                            >
                                <View style={styles.examActionIconBox}>
                                    <Ionicons name="camera-outline" size={22} color="#182232" />
                                </View>
                                <View style={styles.examActionTextWrap}>
                                    <Text style={styles.examActionTitle}>Take Photo of Syllabus</Text>
                                    <Text style={styles.examActionDesc}>Snap the schedule section from a handout</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={16} color="#75777d" />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.examActionCard}
                                onPress={handlePickExamGallery}
                                activeOpacity={0.85}
                            >
                                <View style={styles.examActionIconBox}>
                                    <Ionicons name="images-outline" size={22} color="#182232" />
                                </View>
                                <View style={styles.examActionTextWrap}>
                                    <Text style={styles.examActionTitle}>Choose from Photo Gallery</Text>
                                    <Text style={styles.examActionDesc}>Select screenshot of syllabus or LMS</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={16} color="#75777d" />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.examActionCard}
                                onPress={handlePickExamDocument}
                                activeOpacity={0.85}
                            >
                                <View style={styles.examActionIconBox}>
                                    <Ionicons name="document-attach-outline" size={22} color="#182232" />
                                </View>
                                <View style={styles.examActionTextWrap}>
                                    <Text style={styles.examActionTitle}>Upload File or PDF</Text>
                                    <Text style={styles.examActionDesc}>Browse device files and downloads</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={16} color="#75777d" />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Loading Indicator Modal for Exam Parsing */}
            <Modal visible={isAnalyzingExam} transparent animationType="fade">
                <View style={styles.loadingModalOverlay}>
                    <View style={styles.loadingCard}>
                        <ActivityIndicator size="large" color="#4b6456" />
                        <Text style={styles.loadingTitle}>Reading Exam Schedule...</Text>
                        <Text style={styles.loadingSubtitle}>
                            Gemini Vision is analyzing syllabus details and exam dates.
                        </Text>
                    </View>
                </View>
            </Modal>

            {/* Extracted Exam Confirmation Modal */}
            {extractedExam && (
                <Modal visible={showExamConfirmModal} transparent animationType="slide">
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalBox}>
                            <View style={styles.modalHeaderRow}>
                                <Text style={styles.modalHeading}>Exam Detected</Text>
                                <TouchableOpacity onPress={() => setShowExamConfirmModal(false)}>
                                    <Ionicons name="close" size={22} color="#182232" />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.extractedExamInfoBox}>
                                <View style={styles.examInfoItem}>
                                    <Text style={styles.examInfoLabel}>Subject / Course:</Text>
                                    <Text style={styles.examInfoValue}>{extractedExam.subject}</Text>
                                </View>
                                <View style={styles.examInfoItem}>
                                    <Text style={styles.examInfoLabel}>Exam Title:</Text>
                                    <Text style={styles.examInfoValue}>{extractedExam.examTitle}</Text>
                                </View>
                                <View style={styles.examInfoItem}>
                                    <Text style={styles.examInfoLabel}>Date & Countdown Tag:</Text>
                                    <View style={styles.examPillPreview}>
                                        <Text style={styles.examPillPreviewText}>{extractedExam.examTag}</Text>
                                    </View>
                                </View>
                            </View>

                            <Text style={styles.folderPickerLabel}>Attach to Subject Folder:</Text>
                            <ScrollView style={{ maxHeight: 130 }} showsVerticalScrollIndicator={false}>
                                {folders.map((f) => (
                                    <TouchableOpacity
                                        key={f.id}
                                        style={[
                                            styles.folderSelectOption,
                                            selectedFolderForExam === f.id && styles.folderSelectOptionActive,
                                        ]}
                                        onPress={() => setSelectedFolderForExam(f.id)}
                                    >
                                        <Text
                                            style={[
                                                styles.folderSelectOptionText,
                                                selectedFolderForExam === f.id && styles.folderSelectOptionTextActive,
                                            ]}
                                        >
                                            {f.name}
                                        </Text>
                                        {selectedFolderForExam === f.id && (
                                            <Ionicons name="checkmark" size={16} color="#4b6456" />
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            <View style={[styles.modalButtonsRow, { marginTop: 16 }]}>
                                <TouchableOpacity
                                    style={styles.modalCancelBtn}
                                    onPress={() => setShowExamConfirmModal(false)}
                                >
                                    <Text style={styles.modalCancelText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.modalConfirmBtn}
                                    onPress={handleConfirmExamTag}
                                >
                                    <Text style={styles.modalConfirmText}>Save Exam Tag</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#faf9f6',
    },
    topHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 12,
        backgroundColor: '#faf9f6',
        borderBottomWidth: 1,
        borderBottomColor: '#efeeeb',
        maxWidth: 880,
        width: '100%',
        alignSelf: 'center',
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
        borderWidth: 1,
        borderColor: '#e2e0dc',
    },
    termPillText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#1a1c1a',
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    iconCircleBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#f4f3f0',
        alignItems: 'center',
        justifyContent: 'center',
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
        padding: 16,
        paddingBottom: 130,
        maxWidth: 880,
        width: '100%',
        alignSelf: 'center',
    },
    greetingSection: {
        marginBottom: 16,
    },
    greetingTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    dateLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#75777d',
        letterSpacing: 0.8,
    },
    greetingHeading: {
        fontSize: 22,
        fontWeight: '800',
        color: '#182232',
        letterSpacing: -0.4,
        marginTop: 2,
    },
    balancedMindBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#e6ede8',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 14,
    },
    balancedMindText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#1b4d3e',
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: '#e8e6e1',
        marginBottom: 12,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: '#182232',
    },
    filterChipsRow: {
        flexDirection: 'row',
        gap: 8,
    },
    filterChip: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 16,
        backgroundColor: '#f4f3f0',
        borderWidth: 1,
        borderColor: '#e9e8e5',
    },
    filterChipActive: {
        backgroundColor: '#182232',
        borderColor: '#182232',
    },
    filterChipText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#45474c',
    },
    filterChipTextActive: {
        color: '#ffffff',
    },
    examBanner: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#dce6df',
        shadowColor: '#182232',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 1,
    },
    examBannerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
        marginRight: 10,
    },
    examBannerIconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#f0f5f1',
        alignItems: 'center',
        justifyContent: 'center',
    },
    examBannerTextWrap: {
        flex: 1,
    },
    examBannerTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#182232',
    },
    examBannerSub: {
        fontSize: 11,
        color: '#65676d',
        marginTop: 2,
        lineHeight: 15,
    },
    examBannerBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#182232',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 10,
    },
    examBannerBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#ffffff',
    },
    calmStreakCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        shadowColor: '#182232',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 1,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#e8e6e1',
    },
    streakLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 10,
    },
    streakIconCircle: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#e6ede8',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    streakTextWrap: {
        flex: 1,
    },
    streakTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 4,
    },
    streakTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#182232',
    },
    retentionText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#4b6456',
    },
    streakDesc: {
        fontSize: 11,
        color: '#75777d',
        marginTop: 2,
    },
    quickReviewBtn: {
        backgroundColor: '#182232',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
    },
    quickReviewText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#ffffff',
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    sectionHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    sectionTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#182232',
    },
    manageText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#4b6456',
    },
    foldersGrid: {
        gap: 12,
        marginBottom: 12,
    },
    folderCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#e8e6e1',
        shadowColor: '#182232',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 1,
    },
    folderCardTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 14,
    },
    folderLeftContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 8,
    },
    folderIconBox: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    folderTitleWrap: {
        flex: 1,
    },
    courseTagRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 2,
    },
    courseCode: {
        fontSize: 11,
        fontWeight: '700',
        color: '#75777d',
        letterSpacing: 0.5,
    },
    examTagPill: {
        backgroundColor: '#ffdad6',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    examTagText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#ba1a1a',
    },
    folderTitleText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#182232',
    },
    folderCardBottom: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#f4f3f0',
    },
    folderStatsRow: {
        flexDirection: 'row',
        gap: 14,
    },
    statItemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    folderStatItem: {
        fontSize: 12,
        color: '#75777d',
        fontWeight: '500',
    },
    createFolderDashedCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f7f6f2',
        borderRadius: 14,
        paddingVertical: 14,
        borderWidth: 1.5,
        borderColor: '#d9d6ce',
        borderStyle: 'dashed',
        gap: 8,
        marginTop: 4,
    },
    createFolderDashedText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#182232',
    },
    segmentedFilterContainer: {
        flexDirection: 'row',
        backgroundColor: '#f0eeea',
        padding: 3,
        borderRadius: 12,
        marginBottom: 14,
    },
    segmentedTab: {
        flex: 1,
        paddingVertical: 7,
        alignItems: 'center',
        borderRadius: 9,
    },
    segmentedTabActive: {
        backgroundColor: '#ffffff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    segmentedTabText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#75777d',
    },
    segmentedTabTextActive: {
        color: '#182232',
    },
    capturesFeed: {
        gap: 12,
    },
    captureFeedItem: {
        backgroundColor: '#ffffff',
        borderRadius: 14,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderWidth: 1,
        borderColor: '#e8e6e1',
    },
    captureThumbWrap: {
        width: 52,
        height: 52,
        borderRadius: 10,
        overflow: 'hidden',
        position: 'relative',
    },
    captureThumbImage: {
        width: '100%',
        height: '100%',
    },
    captureThumbFallback: {
        width: '100%',
        height: '100%',
        backgroundColor: '#e6ede8',
        alignItems: 'center',
        justifyContent: 'center',
    },
    captureTypeBadge: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        backgroundColor: '#182232',
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 4,
    },
    captureTypeBadgeText: {
        color: '#ffffff',
        fontSize: 8,
        fontWeight: '800',
    },
    captureFeedDetails: {
        flex: 1,
    },
    captureFeedStatusRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 2,
    },
    feedStatusBadge: {
        backgroundColor: '#e6ede8',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    feedStatusText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#1b4d3e',
    },
    feedTimestamp: {
        fontSize: 11,
        color: '#75777d',
    },
    captureFeedTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#182232',
        marginTop: 2,
    },
    captureFeedMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 4,
    },
    metaRowInner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
    },
    captureFeedCards: {
        fontSize: 11,
        color: '#75777d',
    },
    captureFeedDot: {
        color: '#c5c6cd',
        fontSize: 10,
    },
    captureFeedSubject: {
        fontSize: 11,
        color: '#4b6456',
        fontWeight: '600',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalBox: {
        width: '94%',
        maxWidth: 480,
        maxHeight: '85%',
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 22,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 6,
    },
    modalHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    modalHeading: {
        fontSize: 18,
        fontWeight: '700',
        color: '#182232',
    },
    modalSubheading: {
        fontSize: 13,
        color: '#75777d',
        marginBottom: 16,
        lineHeight: 18,
    },
    modalInput: {
        backgroundColor: '#f7f6f2',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        color: '#182232',
        borderWidth: 1,
        borderColor: '#e4e2de',
        marginBottom: 18,
    },
    modalButtonsRow: {
        flexDirection: 'row',
        gap: 12,
    },
    modalCancelBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
        backgroundColor: '#f4f3f0',
    },
    modalCancelText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#45474c',
    },
    modalConfirmBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
        backgroundColor: '#182232',
    },
    modalConfirmText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#ffffff',
    },
    termsList: {
        gap: 8,
        marginBottom: 14,
    },
    termOptionItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 11,
        paddingHorizontal: 14,
        borderRadius: 10,
        backgroundColor: '#f7f6f2',
        borderWidth: 1,
        borderColor: '#efeeeb',
    },
    termOptionItemActive: {
        backgroundColor: '#e6ede8',
        borderColor: '#b2cdbc',
    },
    termOptionText: {
        fontSize: 14,
        color: '#182232',
        fontWeight: '500',
    },
    termOptionTextActive: {
        fontWeight: '700',
        color: '#082015',
    },
    customTermInputWrap: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 4,
    },
    customTermInput: {
        flex: 1,
        backgroundColor: '#f7f6f2',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 9,
        fontSize: 13,
        borderWidth: 1,
        borderColor: '#e2e0dc',
    },
    customTermBtn: {
        backgroundColor: '#182232',
        paddingHorizontal: 16,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    customTermBtnText: {
        color: '#ffffff',
        fontWeight: '700',
        fontSize: 13,
    },
    examActionsList: {
        gap: 10,
    },
    examActionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f7f6f2',
        borderRadius: 14,
        padding: 14,
        gap: 12,
        borderWidth: 1,
        borderColor: '#e9e8e5',
    },
    examActionIconBox: {
        width: 42,
        height: 42,
        borderRadius: 12,
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    examActionTextWrap: {
        flex: 1,
    },
    examActionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#182232',
    },
    examActionDesc: {
        fontSize: 11,
        color: '#75777d',
        marginTop: 2,
    },
    loadingModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    loadingCard: {
        backgroundColor: '#ffffff',
        borderRadius: 18,
        padding: 24,
        alignItems: 'center',
        width: '100%',
        maxWidth: 320,
    },
    loadingTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#182232',
        marginTop: 14,
    },
    loadingSubtitle: {
        fontSize: 12,
        color: '#75777d',
        textAlign: 'center',
        marginTop: 6,
        lineHeight: 17,
    },
    extractedExamInfoBox: {
        backgroundColor: '#f7f6f2',
        borderRadius: 12,
        padding: 14,
        marginBottom: 14,
        gap: 8,
    },
    examInfoItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    examInfoLabel: {
        fontSize: 12,
        color: '#75777d',
        fontWeight: '500',
    },
    examInfoValue: {
        fontSize: 13,
        fontWeight: '700',
        color: '#182232',
    },
    examPillPreview: {
        backgroundColor: '#ffdad6',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    examPillPreviewText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#ba1a1a',
    },
    folderPickerLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#45474c',
        marginBottom: 6,
    },
    folderSelectOption: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 8,
        backgroundColor: '#f7f6f2',
        marginBottom: 6,
    },
    folderSelectOptionActive: {
        backgroundColor: '#e6ede8',
    },
    folderSelectOptionText: {
        fontSize: 13,
        color: '#182232',
        fontWeight: '500',
    },
    folderSelectOptionTextActive: {
        color: '#082015',
        fontWeight: '700',
    },
});