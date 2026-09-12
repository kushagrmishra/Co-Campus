import React, { useState, useEffect } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    Alert,
    ScrollView,
    Modal,
    TextInput,
    StatusBar,
    Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { extractStudyMaterial, generateFlashcards } from '../services/llm';
import { fetchVideosForTopics } from '../services/youtube';
import { saveNoteToFirestore, fetchSubjectFolders, createSubjectFolder } from '../services/storage';
import { SavedNote, SubjectFolder } from '../types';

interface CapturedImage {
    id: string;
    uri: string;
    base64: string;
}

interface CaptureScreenProps {
    targetFolder?: SubjectFolder | null;
    appendNote?: SavedNote | null;
    onCancel: () => void;
    onComplete: (note: SavedNote) => void;
}

type Stage = 'idle' | 'vision' | 'flashcards' | 'videos' | 'saving';
type ScannerMode = 'whiteboard' | 'handwritten' | 'syllabus' | 'book';

export const CaptureScreen: React.FC<CaptureScreenProps> = ({
    targetFolder,
    appendNote,
    onCancel,
    onComplete,
}) => {
    const insets = useSafeAreaInsets();
    const topPadding = Platform.OS === 'android' ? Math.max(insets.top, StatusBar.currentHeight || 0, 16) : Math.max(insets.top, 10);

    const [images, setImages] = useState<CapturedImage[]>([]);
    const [activePreviewIndex, setActivePreviewIndex] = useState<number>(0);
    const [stage, setStage] = useState<Stage>('idle');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Scanner HUD controls
    const [flashOn, setFlashOn] = useState<boolean>(false);
    const [showGrid, setShowGrid] = useState<boolean>(true);
    const [scannerMode, setScannerMode] = useState<ScannerMode>('whiteboard');

    // Folder destination state
    const [selectedFolder, setSelectedFolder] = useState<SubjectFolder | null>(targetFolder || null);
    const [availableFolders, setAvailableFolders] = useState<SubjectFolder[]>([]);
    const [showFolderModal, setShowFolderModal] = useState<boolean>(false);
    const [newFolderName, setNewFolderName] = useState<string>('');

    useEffect(() => {
        fetchSubjectFolders().then(setAvailableFolders).catch(console.error);
    }, []);

    useEffect(() => {
        if (targetFolder) {
            setSelectedFolder(targetFolder);
        } else if (appendNote) {
            setSelectedFolder({
                id: appendNote.subjectSlug,
                name: appendNote.subject,
                noteCount: 1,
                updatedAt: Date.now(),
            });
        }
    }, [targetFolder, appendNote]);

    const pickFromCamera = async () => {
        try {
            const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
            if (!permissionResult.granted) {
                Alert.alert('Permission Denied', 'Camera permission is required to capture documents.');
                return;
            }

            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.8,
                base64: true,
            });

            if (!result.canceled && result.assets?.[0]?.base64) {
                const newImg: CapturedImage = {
                    id: `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                    uri: result.assets[0].uri,
                    base64: result.assets[0].base64,
                };
                setImages((prev) => {
                    const updated = [...prev, newImg];
                    setActivePreviewIndex(updated.length - 1);
                    return updated;
                });
                setErrorMsg(null);
            }
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to capture photo');
        }
    };

    const pickFromGallery = async () => {
        try {
            const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permissionResult.granted) {
                Alert.alert('Permission Denied', 'Gallery permission is required to select photos.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsMultipleSelection: true,
                quality: 0.8,
                base64: true,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const newImgs: CapturedImage[] = result.assets
                    .filter((a) => a.base64)
                    .map((a, idx) => ({
                        id: `${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
                        uri: a.uri,
                        base64: a.base64!,
                    }));

                setImages((prev) => {
                    const updated = [...prev, ...newImgs];
                    setActivePreviewIndex(updated.length - 1);
                    return updated;
                });
                setErrorMsg(null);
            }
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to pick photos');
        }
    };

    const removeImage = (id: string) => {
        setImages((prev) => {
            const updated = prev.filter((img) => img.id !== id);
            if (activePreviewIndex >= updated.length) {
                setActivePreviewIndex(Math.max(0, updated.length - 1));
            }
            return updated;
        });
    };

    const handleCreateFolder = async () => {
        const trimmed = newFolderName.trim();
        if (!trimmed) return;
        try {
            const created = await createSubjectFolder(trimmed);
            setSelectedFolder(created);
            setAvailableFolders((prev) => [created, ...prev.filter((f) => f.id !== created.id)]);
            setNewFolderName('');
            setShowFolderModal(false);
        } catch (e: any) {
            Alert.alert('Error', e.message || 'Could not create folder');
        }
    };

    const processImages = async () => {
        if (images.length === 0) return;

        try {
            setErrorMsg(null);

            // Stage 1: Vision extraction with all images
            setStage('vision');
            const base64List = images.map((img) => img.base64);
            const targetSubject = selectedFolder ? selectedFolder.name : undefined;

            const extraction = await extractStudyMaterial(
                base64List,
                targetSubject,
                appendNote ? appendNote.extraction : undefined
            );

            // Stage 2: Flashcards
            setStage('flashcards');
            const newFlashcards = await generateFlashcards(extraction);
            const combinedFlashcards = appendNote
                ? [...appendNote.flashcards, ...newFlashcards]
                : newFlashcards;

            // Stage 3: Videos
            setStage('videos');
            const newTopicVideos = await fetchVideosForTopics(extraction.topics, extraction.subject);
            const combinedVideos = appendNote
                ? [...appendNote.topicVideos, ...newTopicVideos]
                : newTopicVideos;

            // Stage 4: Save
            setStage('saving');
            const imageUris = images.map((img) => img.uri);
            const savedNote = await saveNoteToFirestore(
                extraction,
                combinedFlashcards,
                combinedVideos,
                appendNote?.id,
                imageUris,
                selectedFolder?.id
            );

            onComplete(savedNote);
        } catch (err: any) {
            console.error('Pipeline processing error:', err);
            setErrorMsg(err.message || 'An error occurred while processing your images.');
            setStage('idle');
        }
    };

    const renderStatus = () => {
        if (stage === 'idle') return null;

        let text = '';
        if (stage === 'vision') text = `Analyzing ${images.length} note photo${images.length > 1 ? 's' : ''}...`;
        if (stage === 'flashcards') text = 'Synthesizing flashcards & formulas...';
        if (stage === 'videos') text = 'Curating relevant lecture videos...';
        if (stage === 'saving') text = selectedFolder ? `Filing into ${selectedFolder.name}...` : 'Saving note to library...';

        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4b6456" />
                <Text style={styles.loadingText}>{text}</Text>
            </View>
        );
    };

    const activeImage = images[activePreviewIndex] || images[0];

    return (
        <View style={[styles.container, { paddingTop: topPadding }]}>
            <StatusBar barStyle="dark-content" backgroundColor="#faf9f6" />

            {/* Top Navigation Bar */}
            <View style={styles.topHeader}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={onCancel} style={styles.backBtn} disabled={stage !== 'idle'}>
                        <Ionicons name="arrow-back" size={18} color="#182232" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Scan Document</Text>
                </View>
                <View style={styles.avatarCircle}>
                    <Text style={styles.avatarInitial}>K</Text>
                </View>
            </View>

            {/* Intelligent Target Destination Bar */}
            <View style={styles.destinationBarWrap}>
                <View style={styles.destinationBar}>
                    <View style={styles.destLeft}>
                        <View style={styles.autoRoutingIcon}>
                            <Ionicons name="sparkles" size={14} color="#1b4d3e" />
                        </View>
                        <View style={styles.destTextWrap}>
                            <Text style={styles.destLabel}>AUTO-ROUTING ACTIVE</Text>
                            <Text style={styles.destTarget} numberOfLines={1}>
                                {selectedFolder ? selectedFolder.name : 'Auto-Detect Subject (Tap Change)'}
                            </Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        style={styles.changeBtn}
                        onPress={() => setShowFolderModal(true)}
                        disabled={stage !== 'idle'}
                    >
                        <Text style={styles.changeBtnText}>Change</Text>
                        <Ionicons name="chevron-down" size={12} color="#182232" style={{ marginLeft: 3 }} />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Camera Viewport Container */}
                <View style={styles.viewportWrap}>
                    <View style={styles.viewport}>
                        {activeImage ? (
                            <Image source={{ uri: activeImage.uri }} style={styles.viewportImage} />
                        ) : (
                            <View style={styles.viewportSimulation}>
                                <Ionicons name="camera-outline" size={36} color="#75777d" />
                                <Text style={styles.viewportSimText}>Live Viewfinder</Text>
                            </View>
                        )}

                        {/* Dark Ambient Vignette Scrim */}
                        <View style={styles.vignetteOverlay} />

                        {/* Top Camera Controls HUD */}
                        <View style={styles.cameraHudTop}>
                            <View style={styles.hudLeftButtons}>
                                <TouchableOpacity
                                    style={[styles.hudCircleBtn, flashOn && styles.hudCircleBtnActive]}
                                    onPress={() => setFlashOn(!flashOn)}
                                >
                                    <Ionicons
                                        name={flashOn ? 'flash' : 'flash-off-outline'}
                                        size={16}
                                        color={flashOn ? '#ffe600' : '#ffffff'}
                                    />
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.hudCircleBtn, showGrid && styles.hudCircleBtnActive]}
                                    onPress={() => setShowGrid(!showGrid)}
                                >
                                    <Ionicons name="grid-outline" size={16} color="#ffffff" />
                                </TouchableOpacity>
                            </View>

                            {/* Glare Filter & Optimization Status */}
                            <View style={styles.glareStatusBadge}>
                                <View style={styles.glareDot} />
                                <Text style={styles.glareText}>Glare Neutralized</Text>
                            </View>

                            <TouchableOpacity
                                style={styles.hudCircleBtn}
                                onPress={onCancel}
                            >
                                <Ionicons name="close" size={18} color="#ffffff" />
                            </TouchableOpacity>
                        </View>

                        {/* Interactive Grid Guidelines */}
                        {showGrid && (
                            <View style={styles.gridOverlay}>
                                <View style={styles.gridRow}>
                                    <View style={styles.gridCell} /><View style={styles.gridCell} /><View style={styles.gridCell} />
                                </View>
                                <View style={styles.gridRow}>
                                    <View style={styles.gridCell} /><View style={styles.gridCell} /><View style={styles.gridCell} />
                                </View>
                                <View style={styles.gridRow}>
                                    <View style={styles.gridCell} /><View style={styles.gridCell} /><View style={styles.gridCell} />
                                </View>
                            </View>
                        )}

                        {/* Illuminated Dynamic Tracking Brackets Over Whiteboard */}
                        <View style={styles.trackingBracketsBox}>
                            <View style={styles.bracketTopRow}>
                                <Text style={styles.bracketCorner}>┏</Text>
                                <Text style={styles.bracketCorner}>┓</Text>
                            </View>

                            {/* Dynamic Floating AI Surface Identification Badge */}
                            <View style={styles.aiSurfaceBadge}>
                                <Ionicons name="scan-outline" size={13} color="#ffffff" style={{ marginRight: 4 }} />
                                <Text style={styles.aiSurfaceText}>
                                    {scannerMode === 'whiteboard'
                                        ? 'Whiteboard Mode Active'
                                        : scannerMode === 'handwritten'
                                        ? 'Handwritten Notes Mode'
                                        : scannerMode === 'syllabus'
                                        ? 'Syllabus & Schedule Mode'
                                        : 'Textbook / Print Mode'}
                                </Text>
                            </View>

                            <View style={styles.bracketBottomRow}>
                                <Text style={styles.bracketCorner}>┗</Text>
                                <Text style={styles.bracketCorner}>┛</Text>
                            </View>
                        </View>

                        {/* Page Counter badge if multiple images */}
                        {images.length > 0 && (
                            <View style={styles.pagePill}>
                                <Text style={styles.pagePillText}>
                                    Page {activePreviewIndex + 1} of {images.length}
                                </Text>
                            </View>
                        )}

                        {images.length > 0 && stage === 'idle' && (
                            <TouchableOpacity
                                style={styles.deletePhotoBtn}
                                onPress={() => removeImage(activeImage.id)}
                            >
                                <Ionicons name="close" size={14} color="#ffffff" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Scanner Mode Selector Carousel */}
                <View style={styles.modeSelectorWrap}>
                    <View style={styles.modeSelector}>
                        {(['whiteboard', 'handwritten', 'syllabus', 'book'] as ScannerMode[]).map((mode) => {
                            const labels: Record<ScannerMode, string> = {
                                whiteboard: 'Whiteboard',
                                handwritten: 'Handwritten',
                                syllabus: 'Syllabus',
                                book: 'Book Page',
                            };
                            const isActive = scannerMode === mode;
                            return (
                                <TouchableOpacity
                                    key={mode}
                                    style={[styles.modeTab, isActive && styles.modeTabActive]}
                                    onPress={() => setScannerMode(mode)}
                                >
                                    <Text style={[styles.modeTabText, isActive && styles.modeTabTextActive]}>
                                        {labels[mode]}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                {/* Captured Photos Reel (when photos exist) */}
                {images.length > 0 && (
                    <View style={styles.capturedReelWrap}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reelScroll}>
                            {images.map((img, idx) => (
                                <TouchableOpacity
                                    key={img.id}
                                    style={[
                                        styles.thumbCard,
                                        activePreviewIndex === idx && styles.thumbCardActive,
                                    ]}
                                    onPress={() => setActivePreviewIndex(idx)}
                                >
                                    <Image source={{ uri: img.uri }} style={styles.thumbImage} />
                                    <View style={styles.thumbBadge}>
                                        <Text style={styles.thumbBadgeText}>{idx + 1}</Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* Ergonomic Shutter & Processing Controls */}
                <View style={styles.controlsRow}>
                    {/* Gallery Photo Import Button */}
                    <TouchableOpacity
                        style={styles.importBtn}
                        onPress={pickFromGallery}
                        disabled={stage !== 'idle'}
                    >
                        <View style={styles.importIconWrap}>
                            <Ionicons name="images-outline" size={20} color="#182232" />
                        </View>
                        <Text style={styles.controlLabel}>Import</Text>
                    </TouchableOpacity>

                    {/* Prominent Tactile Dual-Ring Shutter Button */}
                    <TouchableOpacity
                        style={styles.shutterOuter}
                        onPress={pickFromCamera}
                        disabled={stage !== 'idle'}
                        activeOpacity={0.85}
                    >
                        <View style={styles.shutterMiddle}>
                            <View style={styles.shutterInner}>
                                <Ionicons name="camera" size={24} color="#ffffff" />
                            </View>
                        </View>
                    </TouchableOpacity>

                    {/* Live AI OCR Recognition Badge */}
                    <View style={styles.autoOcrWrap}>
                        <View style={styles.autoOcrCircle}>
                            <Ionicons name="scan-outline" size={20} color="#182232" />
                            <View style={styles.autoOcrPill} />
                        </View>
                        <Text style={styles.controlLabel}>Auto OCR</Text>
                    </View>
                </View>

                {/* Reassurance Delight Tip Card */}
                <View style={styles.reassuranceCard}>
                    <View style={styles.lightningCircle}>
                        <Ionicons name="flash-outline" size={16} color="#182232" />
                    </View>
                    <Text style={styles.reassuranceText}>
                        <Text style={styles.reassuranceBold}>Hold steady for 1 second.</Text> Cocampus auto-enhances contrast, parses key formulas, and synthesizes flashcards directly into your deck.
                    </Text>
                </View>

                {errorMsg && (
                    <View style={styles.errorBox}>
                        <Text style={styles.errorText}>{errorMsg}</Text>
                    </View>
                )}

                {renderStatus()}

                {/* Process Button */}
                {images.length > 0 && stage === 'idle' && (
                    <TouchableOpacity style={styles.processBtn} onPress={processImages}>
                        <Text style={styles.processBtnText}>
                            {appendNote
                                ? `Add ${images.length} Page${images.length > 1 ? 's' : ''} to Note`
                                : `Analyze & Synthesize ${images.length} Note Photo${images.length > 1 ? 's' : ''}`}
                        </Text>
                    </TouchableOpacity>
                )}
            </ScrollView>

            {/* Folder Destination Modal */}
            <Modal visible={showFolderModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalBox}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Select Destination Folder</Text>
                            <TouchableOpacity onPress={() => setShowFolderModal(false)}>
                                <Text style={styles.modalCloseText}>Done</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.createFolderRow}>
                            <TextInput
                                style={styles.folderInput}
                                placeholder="New folder name..."
                                placeholderTextColor="#75777d"
                                value={newFolderName}
                                onChangeText={setNewFolderName}
                            />
                            <TouchableOpacity style={styles.createFolderBtn} onPress={handleCreateFolder}>
                                <Text style={styles.createFolderBtnText}>+ Create</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.folderList}>
                            <TouchableOpacity
                                style={[
                                    styles.folderListItem,
                                    selectedFolder === null && styles.folderListItemActive,
                                ]}
                                onPress={() => {
                                    setSelectedFolder(null);
                                    setShowFolderModal(false);
                                }}
                            >
                                <Ionicons name="sparkles" size={18} color="#4b6456" style={{ marginRight: 10 }} />
                                <View style={styles.folderItemTextWrap}>
                                    <Text style={styles.folderItemName}>Auto-detect with AI</Text>
                                    <Text style={styles.folderItemSub}>AI will deduce the subject from your notes</Text>
                                </View>
                                {selectedFolder === null && <Ionicons name="checkmark" size={18} color="#4b6456" />}
                            </TouchableOpacity>

                            {availableFolders.map((f) => {
                                const isSelected = selectedFolder?.id === f.id;
                                return (
                                    <TouchableOpacity
                                        key={f.id}
                                        style={[styles.folderListItem, isSelected && styles.folderListItemActive]}
                                        onPress={() => {
                                            setSelectedFolder(f);
                                            setShowFolderModal(false);
                                        }}
                                    >
                                        <Ionicons name="folder-outline" size={18} color="#4b6456" style={{ marginRight: 10 }} />
                                        <View style={styles.folderItemTextWrap}>
                                            <Text style={styles.folderItemName}>{f.name}</Text>
                                            <Text style={styles.folderItemSub}>{f.noteCount} notes</Text>
                                        </View>
                                        {isSelected && <Ionicons name="checkmark" size={18} color="#4b6456" />}
                                    </TouchableOpacity>
                                );
                            })}
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
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 10,
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
        gap: 10,
    },
    backBtn: {
        paddingVertical: 4,
    },
    backArrow: {
        fontSize: 18,
        color: '#182232',
        fontWeight: '700',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#182232',
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
    destinationBarWrap: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#faf9f6',
        maxWidth: 880,
        width: '100%',
        alignSelf: 'center',
    },
    destinationBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#f4f3f0',
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: '#e9e8e5',
    },
    destLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
    },
    autoRoutingIcon: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: '#cde9d8',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sparkleEmoji: {
        fontSize: 12,
    },
    destTextWrap: {
        flex: 1,
    },
    destLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: '#4b6456',
        letterSpacing: 0.8,
    },
    destTarget: {
        fontSize: 13,
        fontWeight: '700',
        color: '#182232',
        marginTop: 1,
    },
    changeBtn: {
        backgroundColor: '#efeeeb',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        marginLeft: 8,
    },
    changeBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#182232',
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
    viewportWrap: {
        marginBottom: 12,
    },
    viewport: {
        width: '100%',
        aspectRatio: 4 / 5,
        borderRadius: 18,
        backgroundColor: '#182232',
        overflow: 'hidden',
        position: 'relative',
        shadowColor: '#182232',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 4,
    },
    viewportImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    viewportSimulation: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#2d3748',
    },
    viewportSimEmoji: {
        fontSize: 48,
        marginBottom: 8,
    },
    viewportSimText: {
        color: '#c5c6cd',
        fontSize: 15,
        fontWeight: '600',
    },
    vignetteOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(24, 34, 50, 0.35)',
    },
    cameraHudTop: {
        position: 'absolute',
        top: 12,
        left: 12,
        right: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 20,
    },
    hudLeftButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    hudCircleBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(24, 34, 50, 0.65)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    hudCircleBtnActive: {
        backgroundColor: '#cde9d8',
    },
    hudBtnText: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '700',
    },
    glareStatusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(205, 233, 216, 0.9)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 5,
    },
    glareDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#4b6456',
    },
    glareText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#082015',
    },
    gridOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'space-between',
        zIndex: 10,
        pointerEvents: 'none',
    },
    gridRow: {
        flex: 1,
        flexDirection: 'row',
        borderBottomWidth: 0.5,
        borderBottomColor: 'rgba(255, 255, 255, 0.15)',
    },
    gridCell: {
        flex: 1,
        borderRightWidth: 0.5,
        borderRightColor: 'rgba(255, 255, 255, 0.15)',
    },
    trackingBracketsBox: {
        position: 'absolute',
        top: 60,
        bottom: 60,
        left: 24,
        right: 24,
        justifyContent: 'space-between',
        zIndex: 15,
        pointerEvents: 'none',
    },
    bracketTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    bracketBottomRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    bracketCorner: {
        color: '#cde9d8',
        fontSize: 28,
        fontWeight: '900',
        lineHeight: 28,
    },
    aiSurfaceBadge: {
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(24, 34, 50, 0.8)',
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 14,
        gap: 6,
    },
    aiSurfaceIcon: {
        fontSize: 12,
    },
    aiSurfaceText: {
        color: '#ffffff',
        fontSize: 11,
        fontWeight: '600',
    },
    formulaFloatingPin: {
        position: 'absolute',
        top: 85,
        right: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.92)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        zIndex: 20,
    },
    formulaPinIcon: {
        fontSize: 12,
        color: '#3b1601',
        fontWeight: '700',
    },
    formulaPinText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#1a1c1a',
    },
    pagePill: {
        position: 'absolute',
        bottom: 12,
        left: 12,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        zIndex: 20,
    },
    pagePillText: {
        color: '#ffffff',
        fontSize: 11,
        fontWeight: '600',
    },
    deletePhotoBtn: {
        position: 'absolute',
        bottom: 12,
        right: 12,
        backgroundColor: '#ba1a1a',
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 20,
    },
    deletePhotoText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '800',
    },
    modeSelectorWrap: {
        marginBottom: 14,
    },
    modeSelector: {
        flexDirection: 'row',
        backgroundColor: '#e9e8e5',
        borderRadius: 24,
        padding: 3,
    },
    modeTab: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 20,
    },
    modeTabActive: {
        backgroundColor: '#ffffff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
    },
    modeTabText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#75777d',
    },
    modeTabTextActive: {
        color: '#182232',
        fontWeight: '700',
    },
    capturedReelWrap: {
        marginBottom: 14,
        height: 75,
    },
    reelScroll: {
        gap: 8,
        alignItems: 'center',
    },
    thumbCard: {
        width: 60,
        height: 70,
        borderRadius: 8,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: '#e9e8e5',
        position: 'relative',
    },
    thumbCardActive: {
        borderColor: '#4b6456',
    },
    thumbImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    thumbBadge: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        borderRadius: 4,
        paddingHorizontal: 4,
    },
    thumbBadgeText: {
        color: '#ffffff',
        fontSize: 10,
        fontWeight: '700',
    },
    controlsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        marginVertical: 10,
    },
    importBtn: {
        alignItems: 'center',
        gap: 4,
    },
    importIconWrap: {
        width: 52,
        height: 52,
        borderRadius: 14,
        backgroundColor: '#efeeeb',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#e9e8e5',
    },
    importEmoji: {
        fontSize: 22,
    },
    controlLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#45474c',
    },
    shutterOuter: {
        width: 76,
        height: 76,
        borderRadius: 38,
        backgroundColor: '#efeeeb',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#182232',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
    },
    shutterMiddle: {
        width: 66,
        height: 66,
        borderRadius: 33,
        backgroundColor: '#e3e2df',
        alignItems: 'center',
        justifyContent: 'center',
    },
    shutterInner: {
        width: 54,
        height: 54,
        borderRadius: 27,
        backgroundColor: '#182232',
        alignItems: 'center',
        justifyContent: 'center',
    },
    shutterCameraIcon: {
        fontSize: 22,
    },
    autoOcrWrap: {
        alignItems: 'center',
        gap: 4,
    },
    autoOcrCircle: {
        width: 52,
        height: 52,
        borderRadius: 14,
        backgroundColor: '#efeeeb',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#e9e8e5',
        position: 'relative',
    },
    autoOcrEmoji: {
        fontSize: 20,
    },
    autoOcrPill: {
        width: 8,
        height: 2.5,
        backgroundColor: '#4b6456',
        borderRadius: 2,
        marginTop: 2,
    },
    reassuranceCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f4f3f0',
        borderRadius: 14,
        padding: 12,
        gap: 10,
        marginTop: 8,
    },
    lightningCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#ffdbca',
        alignItems: 'center',
        justifyContent: 'center',
    },
    lightningIcon: {
        fontSize: 13,
    },
    reassuranceText: {
        flex: 1,
        fontSize: 12,
        color: '#1a1c1a',
        lineHeight: 16,
    },
    reassuranceBold: {
        fontWeight: '700',
    },
    loadingContainer: {
        alignItems: 'center',
        marginVertical: 14,
    },
    loadingText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#4b6456',
        marginTop: 8,
    },
    errorBox: {
        backgroundColor: '#ffdad6',
        padding: 12,
        borderRadius: 10,
        marginVertical: 10,
    },
    errorText: {
        color: '#ba1a1a',
        fontSize: 12,
        textAlign: 'center',
    },
    processBtn: {
        backgroundColor: '#182232',
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: 14,
        shadowColor: '#182232',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 3,
    },
    processBtnText: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '700',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(24, 34, 50, 0.5)',
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
        marginBottom: 14,
    },
    modalTitle: {
        color: '#182232',
        fontSize: 18,
        fontWeight: '700',
    },
    modalCloseText: {
        color: '#4b6456',
        fontSize: 15,
        fontWeight: '700',
    },
    createFolderRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 14,
    },
    folderInput: {
        flex: 1,
        backgroundColor: '#f4f3f0',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        color: '#1a1c1a',
        fontSize: 14,
        borderWidth: 1,
        borderColor: '#e9e8e5',
    },
    createFolderBtn: {
        backgroundColor: '#182232',
        paddingHorizontal: 14,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    createFolderBtnText: {
        color: '#ffffff',
        fontWeight: '700',
        fontSize: 13,
    },
    folderList: {
        maxHeight: 280,
    },
    folderListItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 14,
        backgroundColor: '#f4f3f0',
        borderRadius: 10,
        marginBottom: 8,
    },
    folderListItemActive: {
        borderColor: '#4b6456',
        borderWidth: 1.5,
        backgroundColor: '#cde9d8',
    },
    folderItemIcon: {
        fontSize: 18,
        marginRight: 10,
    },
    folderItemTextWrap: {
        flex: 1,
    },
    folderItemName: {
        color: '#182232',
        fontSize: 14,
        fontWeight: '700',
    },
    folderItemSub: {
        color: '#75777d',
        fontSize: 11,
        marginTop: 2,
    },
    checkmark: {
        color: '#4b6456',
        fontSize: 16,
        fontWeight: '800',
        marginLeft: 8,
    },
});