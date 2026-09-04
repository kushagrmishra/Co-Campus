import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    SafeAreaView,
    Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { extractStudyMaterial, generateFlashcards } from '../services/llm';
import { fetchVideosForTopics } from '../services/youtube';
import { saveNoteToFirestore } from '../services/storage';
import { SavedNote } from '../types';

interface CaptureScreenProps {
    onCancel: () => void;
    onComplete: (note: SavedNote) => void;
}

type Stage = 'idle' | 'vision' | 'flashcards' | 'videos' | 'saving';

export const CaptureScreen: React.FC<CaptureScreenProps> = ({ onCancel, onComplete }) => {
    const [imageUri, setImageUri] = useState<string | null>(null);
    const [base64, setBase64] = useState<string | null>(null);
    const [stage, setStage] = useState<Stage>('idle');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const pickImage = async (useCamera: boolean) => {
        try {
            const permissionResult = useCamera
                ? await ImagePicker.requestCameraPermissionsAsync()
                : await ImagePicker.requestMediaLibraryPermissionsAsync();

            if (!permissionResult.granted) {
                Alert.alert('Permission Denied', 'Permission to access camera or gallery is required.');
                return;
            }

            const result = useCamera
                ? await ImagePicker.launchCameraAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                    quality: 0.8,
                    base64: true,
                })
                : await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                    quality: 0.8,
                    base64: true,
                });

            if (!result.canceled && result.assets[0]) {
                setImageUri(result.assets[0].uri);
                setBase64(result.assets[0].base64 || null);
                setErrorMsg(null);
            }
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to select image');
        }
    };

    const processImage = async () => {
        if (!base64) return;

        try {
            setErrorMsg(null);

            // Stage 1: Vision extraction
            setStage('vision');
            const extraction = await extractStudyMaterial(base64);

            // Stage 2: Generate flashcards
            setStage('flashcards');
            const flashcards = await generateFlashcards(extraction);

            // Stage 3: Fetch YouTube videos
            setStage('videos');
            const topicVideos = await fetchVideosForTopics(extraction.topics);

            // Stage 4: Save note to Firestore
            setStage('saving');
            const savedNote = await saveNoteToFirestore(extraction, flashcards, topicVideos);

            onComplete(savedNote);
        } catch (err: any) {
            console.error('Pipeline processing error:', err);
            setErrorMsg(err.message || 'An error occurred while processing your image.');
            setStage('idle');
        }
    };

    const renderStatus = () => {
        if (stage === 'idle') return null;

        let text = '';
        if (stage === 'vision') text = 'Reading your notes...';
        if (stage === 'flashcards') text = 'Generating flashcards...';
        if (stage === 'videos') text = 'Finding relevant videos...';
        if (stage === 'saving') text = 'Filing note in subject folder...';

        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#6366f1" />
                <Text style={styles.loadingText}>{text}</Text>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onCancel} disabled={stage !== 'idle'}>
                    <Text style={[styles.cancelText, stage !== 'idle' && { opacity: 0.5 }]}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Scan Notes</Text>
                <View style={{ width: 50 }} />
            </View>

            <View style={styles.content}>
                {imageUri ? (
                    <View style={styles.previewContainer}>
                        <Image source={{ uri: imageUri }} style={styles.previewImage} />
                        {stage === 'idle' && (
                            <TouchableOpacity style={styles.changeButton} onPress={() => setImageUri(null)}>
                                <Text style={styles.changeButtonText}>Retake / Pick Another</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                ) : (
                    <View style={styles.pickerBox}>
                        <Text style={styles.pickerTitle}>Upload Study Material</Text>
                        <Text style={styles.pickerSub}>Capture a whiteboard, lecture slide, or textbook page.</Text>
                        <View style={styles.buttonRow}>
                            <TouchableOpacity style={styles.actionBtn} onPress={() => pickImage(true)}>
                                <Text style={styles.actionBtnText}>📷 Camera</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.actionBtn} onPress={() => pickImage(false)}>
                                <Text style={styles.actionBtnText}>🖼️ Gallery</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {errorMsg && (
                    <View style={styles.errorBox}>
                        <Text style={styles.errorText}>{errorMsg}</Text>
                    </View>
                )}

                {renderStatus()}

                {imageUri && stage === 'idle' && (
                    <TouchableOpacity style={styles.processBtn} onPress={processImage}>
                        <Text style={styles.processBtnText}>Analyze & Process Notes</Text>
                    </TouchableOpacity>
                )}
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#27272a',
    },
    cancelText: {
        color: '#818cf8',
        fontSize: 16,
        fontWeight: '600',
    },
    title: {
        color: '#f4f4f5',
        fontSize: 18,
        fontWeight: '700',
    },
    content: {
        flex: 1,
        padding: 20,
        justifyContent: 'center',
    },
    previewContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    previewImage: {
        width: '100%',
        height: '70%',
        borderRadius: 12,
        resizeMode: 'contain',
        backgroundColor: '#1e1e24',
    },
    changeButton: {
        marginTop: 12,
        padding: 10,
    },
    changeButtonText: {
        color: '#818cf8',
        fontSize: 14,
        fontWeight: '600',
    },
    pickerBox: {
        backgroundColor: '#1e1e24',
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#2e2e38',
    },
    pickerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#f4f4f5',
        marginBottom: 8,
    },
    pickerSub: {
        fontSize: 14,
        color: '#a1a1aa',
        textAlign: 'center',
        marginBottom: 24,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 12,
    },
    actionBtn: {
        backgroundColor: '#2d2d3a',
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 10,
        minWidth: 120,
        alignItems: 'center',
    },
    actionBtnText: {
        color: '#f4f4f5',
        fontWeight: '600',
        fontSize: 15,
    },
    loadingContainer: {
        marginVertical: 20,
        alignItems: 'center',
    },
    loadingText: {
        color: '#a5b4fc',
        marginTop: 12,
        fontSize: 16,
        fontWeight: '600',
    },
    errorBox: {
        backgroundColor: '#3f1d1d',
        borderColor: '#7f1d1d',
        borderWidth: 1,
        padding: 14,
        borderRadius: 8,
        marginTop: 16,
    },
    errorText: {
        color: '#fca5a5',
        fontSize: 14,
        textAlign: 'center',
    },
    processBtn: {
        backgroundColor: '#6366f1',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 16,
    },
    processBtnText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '700',
    },
});