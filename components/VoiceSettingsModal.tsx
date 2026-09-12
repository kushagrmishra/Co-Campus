import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ScrollView,
    Platform,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
    VOICE_PERSONAS,
    VoicePersona,
    VoiceSettings,
    DEFAULT_VOICE_SETTINGS,
    getVoiceSettings,
    saveVoiceSettings,
    previewVoicePersona,
    stopVoicePlayback,
} from '../services/voice';

interface VoiceSettingsModalProps {
    visible: boolean;
    onClose: () => void;
    onVoiceChanged?: (newSettings: VoiceSettings) => void;
}

const SPEED_OPTIONS = [
    { label: '0.8x', value: 0.8, sublabel: 'Slow' },
    { label: '1.0x', value: 1.0, sublabel: 'Normal' },
    { label: '1.2x', value: 1.2, sublabel: 'Brisk' },
    { label: '1.4x', value: 1.4, sublabel: 'Fast' },
];

const PITCH_OPTIONS = [
    { label: 'Deeper', value: -0.15, icon: 'arrow-down-outline' },
    { label: 'Natural', value: 0.0, icon: 'radio-button-on-outline' },
    { label: 'Higher', value: 0.15, icon: 'arrow-up-outline' },
];

export const VoiceSettingsModal: React.FC<VoiceSettingsModalProps> = ({
    visible,
    onClose,
    onVoiceChanged,
}) => {
    const [settings, setSettings] = useState<VoiceSettings>(DEFAULT_VOICE_SETTINGS);
    const [previewingPersonaId, setPreviewingPersonaId] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(true);

    // Load persisted settings on open
    useEffect(() => {
        if (visible) {
            getVoiceSettings().then((s) => {
                setSettings(s);
                setLoading(false);
            });
        } else {
            stopVoicePlayback();
            setPreviewingPersonaId(null);
        }
    }, [visible]);

    const handleSelectPersona = async (persona: VoicePersona) => {
        const updated: VoiceSettings = {
            ...settings,
            personaId: persona.id,
        };
        setSettings(updated);
        await saveVoiceSettings(updated);
        onVoiceChanged?.(updated);

        // Auto preview sample on select
        handlePlayPreview(persona.id, updated.speedMultiplier, updated.pitchShift);
    };

    const handleSelectSpeed = async (multiplier: number) => {
        const updated: VoiceSettings = {
            ...settings,
            speedMultiplier: multiplier,
        };
        setSettings(updated);
        await saveVoiceSettings(updated);
        onVoiceChanged?.(updated);

        if (previewingPersonaId) {
            handlePlayPreview(previewingPersonaId, multiplier, settings.pitchShift);
        }
    };

    const handleSelectPitch = async (pitchShift: number) => {
        const updated: VoiceSettings = {
            ...settings,
            pitchShift: pitchShift,
        };
        setSettings(updated);
        await saveVoiceSettings(updated);
        onVoiceChanged?.(updated);

        if (previewingPersonaId) {
            handlePlayPreview(previewingPersonaId, settings.speedMultiplier, pitchShift);
        }
    };

    const handlePlayPreview = useCallback(
        async (personaId: string, speed = settings.speedMultiplier, pitch = settings.pitchShift) => {
            if (previewingPersonaId === personaId) {
                // If already playing this one, stop it
                await stopVoicePlayback();
                setPreviewingPersonaId(null);
                return;
            }

            setPreviewingPersonaId(personaId);
            previewVoicePersona(personaId, speed, pitch, {
                onDone: () => setPreviewingPersonaId(null),
                onError: () => setPreviewingPersonaId(null),
            });
        },
        [previewingPersonaId, settings]
    );

    const handleClose = async () => {
        await stopVoicePlayback();
        setPreviewingPersonaId(null);
        onClose();
    };

    const activePersona =
        VOICE_PERSONAS.find((p) => p.id === settings.personaId) || VOICE_PERSONAS[0];

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={handleClose}
        >
            <View style={styles.modalOverlay}>
                <TouchableOpacity
                    style={styles.backdropTouch}
                    activeOpacity={1}
                    onPress={handleClose}
                />

                <View style={styles.modalContent}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.headerLeft}>
                            <View style={styles.headerBadge}>
                                <Ionicons name="sparkles" size={13} color="#1b4d3e" />
                                <Text style={styles.headerBadgeText}>AI Audio</Text>
                            </View>
                            <Text style={styles.title}>AI Voice Persona</Text>
                            <Text style={styles.subtitle}>
                                Customize how your AI study partner sounds
                            </Text>
                        </View>
                        <TouchableOpacity
                            style={styles.closeBtn}
                            onPress={handleClose}
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        >
                            <Ionicons name="close" size={20} color="#555" />
                        </TouchableOpacity>
                    </View>

                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="small" color="#1b4d3e" />
                        </View>
                    ) : (
                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={styles.scrollBody}
                        >
                            {/* Active Persona Spotlight Banner */}
                            <View style={[styles.spotlightCard, { borderColor: activePersona.accentColor }]}>
                                <View style={styles.spotlightLeft}>
                                    <View
                                        style={[
                                            styles.spotlightAvatar,
                                            { backgroundColor: activePersona.badgeBg },
                                        ]}
                                    >
                                        <Ionicons
                                            name="volume-high"
                                            size={22}
                                            color={activePersona.accentColor}
                                        />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <View style={styles.spotlightNameRow}>
                                            <Text style={styles.spotlightName}>{activePersona.name}</Text>
                                            <View
                                                style={[
                                                    styles.tonePill,
                                                    { backgroundColor: activePersona.badgeBg },
                                                ]}
                                            >
                                                <Text
                                                    style={[
                                                        styles.tonePillText,
                                                        { color: activePersona.accentColor },
                                                    ]}
                                                >
                                                    {activePersona.tagline}
                                                </Text>
                                            </View>
                                        </View>
                                        <Text style={styles.spotlightDesc} numberOfLines={2}>
                                            {activePersona.description}
                                        </Text>
                                    </View>
                                </View>
                                <TouchableOpacity
                                    style={[
                                        styles.samplePlayBtn,
                                        previewingPersonaId === activePersona.id && styles.samplePlayBtnActive,
                                    ]}
                                    onPress={() => handlePlayPreview(activePersona.id)}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons
                                        name={
                                            previewingPersonaId === activePersona.id
                                                ? 'stop'
                                                : 'play'
                                        }
                                        size={14}
                                        color={
                                            previewingPersonaId === activePersona.id
                                                ? '#fff'
                                                : activePersona.accentColor
                                        }
                                    />
                                    <Text
                                        style={[
                                            styles.samplePlayText,
                                            previewingPersonaId === activePersona.id &&
                                                styles.samplePlayTextActive,
                                        ]}
                                    >
                                        {previewingPersonaId === activePersona.id ? 'Stop' : 'Sample'}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {/* Voice Persona List */}
                            <Text style={styles.sectionLabel}>Select Voice</Text>
                            <View style={styles.personaList}>
                                {VOICE_PERSONAS.map((persona) => {
                                    const isSelected = persona.id === settings.personaId;
                                    const isPlaying = previewingPersonaId === persona.id;

                                    return (
                                        <TouchableOpacity
                                            key={persona.id}
                                            style={[
                                                styles.personaItem,
                                                isSelected && styles.personaItemSelected,
                                            ]}
                                            onPress={() => handleSelectPersona(persona)}
                                            activeOpacity={0.85}
                                        >
                                            <View
                                                style={[
                                                    styles.personaAvatar,
                                                    { backgroundColor: persona.badgeBg },
                                                ]}
                                            >
                                                <Text
                                                    style={[
                                                        styles.personaInitial,
                                                        { color: persona.accentColor },
                                                    ]}
                                                >
                                                    {persona.name.charAt(0)}
                                                </Text>
                                            </View>

                                            <View style={styles.personaInfo}>
                                                <View style={styles.personaTitleRow}>
                                                    <Text style={styles.personaName}>{persona.name}</Text>
                                                    <Text style={styles.personaTagline}>• {persona.tagline}</Text>
                                                </View>
                                                <Text style={styles.personaDesc} numberOfLines={2}>
                                                    {persona.description}
                                                </Text>
                                            </View>

                                            <View style={styles.personaActions}>
                                                <TouchableOpacity
                                                    style={[
                                                        styles.playSampleIconBtn,
                                                        isPlaying && styles.playSampleIconBtnActive,
                                                    ]}
                                                    onPress={(e) => {
                                                        e.stopPropagation();
                                                        handlePlayPreview(persona.id);
                                                    }}
                                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                                >
                                                    <Ionicons
                                                        name={isPlaying ? 'stop' : 'volume-medium'}
                                                        size={16}
                                                        color={isPlaying ? '#fff' : '#1b4d3e'}
                                                    />
                                                </TouchableOpacity>

                                                <View
                                                    style={[
                                                        styles.radioCircle,
                                                        isSelected && styles.radioCircleSelected,
                                                    ]}
                                                >
                                                    {isSelected && (
                                                        <Ionicons name="checkmark" size={13} color="#fff" />
                                                    )}
                                                </View>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {/* Speaking Speed Controls */}
                            <Text style={styles.sectionLabel}>Speaking Speed</Text>
                            <View style={styles.speedRow}>
                                {SPEED_OPTIONS.map((opt) => {
                                    const isSpeedSelected =
                                        Math.abs(settings.speedMultiplier - opt.value) < 0.05;
                                    return (
                                        <TouchableOpacity
                                            key={opt.value}
                                            style={[
                                                styles.speedPill,
                                                isSpeedSelected && styles.speedPillSelected,
                                            ]}
                                            onPress={() => handleSelectSpeed(opt.value)}
                                            activeOpacity={0.8}
                                        >
                                            <Text
                                                style={[
                                                    styles.speedPillValue,
                                                    isSpeedSelected && styles.speedPillValueSelected,
                                                ]}
                                            >
                                                {opt.label}
                                            </Text>
                                            <Text
                                                style={[
                                                    styles.speedPillSub,
                                                    isSpeedSelected && styles.speedPillSubSelected,
                                                ]}
                                            >
                                                {opt.sublabel}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {/* Pitch & Tone Controls */}
                            <Text style={styles.sectionLabel}>Voice Pitch</Text>
                            <View style={styles.pitchRow}>
                                {PITCH_OPTIONS.map((opt) => {
                                    const isPitchSelected =
                                        Math.abs(settings.pitchShift - opt.value) < 0.05;
                                    return (
                                        <TouchableOpacity
                                            key={opt.value}
                                            style={[
                                                styles.pitchPill,
                                                isPitchSelected && styles.pitchPillSelected,
                                            ]}
                                            onPress={() => handleSelectPitch(opt.value)}
                                            activeOpacity={0.8}
                                        >
                                            <Ionicons
                                                name={opt.icon as any}
                                                size={14}
                                                color={isPitchSelected ? '#fff' : '#45474c'}
                                                style={{ marginRight: 6 }}
                                            />
                                            <Text
                                                style={[
                                                    styles.pitchPillText,
                                                    isPitchSelected && styles.pitchPillTextSelected,
                                                ]}
                                            >
                                                {opt.label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </ScrollView>
                    )}

                    {/* Footer Done Action */}
                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={styles.testBtn}
                            onPress={() => handlePlayPreview(settings.personaId)}
                            activeOpacity={0.85}
                        >
                            <Ionicons
                                name={previewingPersonaId ? 'stop-circle' : 'play-circle'}
                                size={18}
                                color="#1b4d3e"
                                style={{ marginRight: 6 }}
                            />
                            <Text style={styles.testBtnText}>
                                {previewingPersonaId ? 'Stop Preview' : 'Test Active Voice'}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.doneBtn}
                            onPress={handleClose}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.doneBtnText}>Done</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        justifyContent: 'flex-end',
    },
    backdropTouch: {
        flex: 1,
    },
    modalContent: {
        backgroundColor: '#ffffff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '88%',
        paddingBottom: Platform.OS === 'ios' ? 34 : 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingHorizontal: 20,
        paddingTop: 18,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f3f1',
    },
    headerLeft: {
        flex: 1,
    },
    headerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: '#e8f5ed',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
        marginBottom: 6,
    },
    headerBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#1b4d3e',
        marginLeft: 4,
        letterSpacing: 0.2,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1a1c1a',
        letterSpacing: -0.3,
    },
    subtitle: {
        fontSize: 13,
        color: '#75777d',
        marginTop: 2,
    },
    closeBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#f4f4f4',
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingContainer: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    scrollBody: {
        paddingHorizontal: 20,
        paddingTop: 14,
        paddingBottom: 16,
    },
    spotlightCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#fbfdfb',
        borderWidth: 1.5,
        borderRadius: 16,
        padding: 12,
        marginBottom: 16,
    },
    spotlightLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 8,
    },
    spotlightAvatar: {
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    spotlightNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
    },
    spotlightName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1a1c1a',
        marginRight: 6,
    },
    spotlightDesc: {
        fontSize: 12,
        color: '#555',
        marginTop: 2,
    },
    tonePill: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
    },
    tonePillText: {
        fontSize: 10,
        fontWeight: '600',
    },
    samplePlayBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#edf4f0',
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: 20,
    },
    samplePlayBtnActive: {
        backgroundColor: '#1b4d3e',
    },
    samplePlayText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#1b4d3e',
        marginLeft: 4,
    },
    samplePlayTextActive: {
        color: '#ffffff',
    },
    sectionLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: '#303833',
        letterSpacing: 0.2,
        textTransform: 'uppercase',
        marginBottom: 10,
        marginTop: 4,
    },
    personaList: {
        marginBottom: 18,
    },
    personaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fafbf9',
        borderWidth: 1,
        borderColor: '#e9ede9',
        borderRadius: 14,
        padding: 12,
        marginBottom: 8,
    },
    personaItemSelected: {
        backgroundColor: '#f2f8f4',
        borderColor: '#1b4d3e',
        borderWidth: 1.5,
    },
    personaAvatar: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    personaInitial: {
        fontSize: 16,
        fontWeight: '700',
    },
    personaInfo: {
        flex: 1,
        marginRight: 8,
    },
    personaTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    personaName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1a1c1a',
    },
    personaTagline: {
        fontSize: 12,
        color: '#75777d',
        marginLeft: 4,
    },
    personaDesc: {
        fontSize: 12,
        color: '#555855',
        marginTop: 2,
        lineHeight: 16,
    },
    personaActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    playSampleIconBtn: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#eaf2ec',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
    },
    playSampleIconBtnActive: {
        backgroundColor: '#1b4d3e',
    },
    radioCircle: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 1.5,
        borderColor: '#bcc5bf',
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioCircleSelected: {
        backgroundColor: '#1b4d3e',
        borderColor: '#1b4d3e',
    },
    speedRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 18,
    },
    speedPill: {
        flex: 1,
        backgroundColor: '#f5f7f5',
        borderWidth: 1,
        borderColor: '#e4e8e5',
        borderRadius: 12,
        paddingVertical: 9,
        alignItems: 'center',
        marginHorizontal: 3,
    },
    speedPillSelected: {
        backgroundColor: '#1b4d3e',
        borderColor: '#1b4d3e',
    },
    speedPillValue: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1a1c1a',
    },
    speedPillValueSelected: {
        color: '#ffffff',
    },
    speedPillSub: {
        fontSize: 10,
        color: '#75777d',
        marginTop: 1,
    },
    speedPillSubSelected: {
        color: '#cde9d8',
    },
    pitchRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    pitchPill: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f5f7f5',
        borderWidth: 1,
        borderColor: '#e4e8e5',
        borderRadius: 12,
        paddingVertical: 10,
        marginHorizontal: 3,
    },
    pitchPillSelected: {
        backgroundColor: '#1b4d3e',
        borderColor: '#1b4d3e',
    },
    pitchPillText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#303833',
    },
    pitchPillTextSelected: {
        color: '#ffffff',
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#f0f3f1',
    },
    testBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#e8f5ed',
        paddingVertical: 11,
        paddingHorizontal: 14,
        borderRadius: 12,
    },
    testBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#1b4d3e',
    },
    doneBtn: {
        backgroundColor: '#1b4d3e',
        paddingVertical: 11,
        paddingHorizontal: 26,
        borderRadius: 12,
    },
    doneBtnText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#ffffff',
    },
});
