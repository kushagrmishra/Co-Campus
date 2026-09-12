import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export interface VoicePersona {
    id: string;
    name: string;
    tagline: string;
    description: string;
    gender: 'female' | 'male' | 'neutral';
    accentColor: string;
    badgeBg: string;
    pitch: number;
    rate: number;
    previewText: string;
    preferredVoiceKeywords: string[];
}

export interface VoiceSettings {
    personaId: string;
    speedMultiplier: number; // 0.8 to 1.5
    pitchShift: number; // -0.2 to +0.2
    customVoiceIdentifier?: string; // Optional manual system voice override
}

export const VOICE_PERSONAS: VoicePersona[] = [
    {
        id: 'breeze',
        name: 'Breeze',
        tagline: 'Warm & Conversational',
        description: 'Friendly, natural, and expressive. Great for comfortable, everyday study sessions.',
        gender: 'female',
        accentColor: '#1b4d3e',
        badgeBg: '#e8f5ed',
        pitch: 1.05,
        rate: 1.0,
        previewText: "Hi, I'm Breeze! I'm here to help you break down complex lecture concepts step-by-step.",
        preferredVoiceKeywords: ['Samantha', 'Victoria', 'Karen', 'Moira', 'Zira', 'en-US-Standard-C', 'en_US', 'female'],
    },
    {
        id: 'cove',
        name: 'Cove',
        tagline: 'Calm & Thoughtful',
        description: 'Composed, measured, and easy to follow. Perfect for deep concentration and complex proofs.',
        gender: 'male',
        accentColor: '#2b5876',
        badgeBg: '#eaf1f7',
        pitch: 0.90,
        rate: 0.95,
        previewText: "Hello, I'm Cove. Let's take our time and walk through each key idea carefully.",
        preferredVoiceKeywords: ['Daniel', 'Oliver', 'Arthur', 'David', 'en-US-Standard-D', 'male'],
    },
    {
        id: 'ember',
        name: 'Ember',
        tagline: 'Confident & Expressive',
        description: 'Vibrant, engaging, and clear. Keeps your energy and motivation high.',
        gender: 'female',
        accentColor: '#c25e1a',
        badgeBg: '#fdf1e8',
        pitch: 1.02,
        rate: 1.05,
        previewText: "Hey there, I'm Ember! Let's conquer these practice problems and master the syllabus.",
        preferredVoiceKeywords: ['Ava', 'Nicky', 'Susan', 'Zira', 'en-US-Standard-E', 'female'],
    },
    {
        id: 'jupiter',
        name: 'Jupiter',
        tagline: 'Authoritative & Collegiate',
        description: 'Resonant, grounded, and clear. A classic academic lecture style.',
        gender: 'male',
        accentColor: '#4a3b68',
        badgeBg: '#f2eef8',
        pitch: 0.85,
        rate: 0.94,
        previewText: "Greetings, I am Jupiter. I'll guide you through the theoretical foundations of your coursework.",
        preferredVoiceKeywords: ['Alex', 'Fred', 'George', 'Tom', 'en-US-Standard-B', 'male'],
    },
    {
        id: 'sol',
        name: 'Sol',
        tagline: 'Inquisitive & Upbeat',
        description: 'Bright, lively, and curious. Exceptional for rapid flashcards and active recall testing.',
        gender: 'neutral',
        accentColor: '#a17006',
        badgeBg: '#fef7e7',
        pitch: 1.15,
        rate: 1.04,
        previewText: "Hey! I'm Sol. Let's test your memory and make these definitions stick fast.",
        preferredVoiceKeywords: ['Samantha', 'Tessa', 'Allison', 'en-US-Standard-A'],
    },
    {
        id: 'vale',
        name: 'Vale',
        tagline: 'Gentle & Serene',
        description: 'Soft, encouraging, and soothing. Minimizes study fatigue during late-night exam prep.',
        gender: 'neutral',
        accentColor: '#3d6053',
        badgeBg: '#eef5f2',
        pitch: 0.96,
        rate: 0.90,
        previewText: "Hi, I'm Vale. Take a deep breath — we will review these notes calmly together.",
        preferredVoiceKeywords: ['Serena', 'Fiona', 'Kate', 'en-US-Standard-F'],
    },
];

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
    personaId: 'breeze',
    speedMultiplier: 1.0,
    pitchShift: 0.0,
};

const STORAGE_KEY_VOICE_SETTINGS = '@cocampus_ai_voice_settings';

// In-memory cache of settings & system voices
let cachedSettings: VoiceSettings = { ...DEFAULT_VOICE_SETTINGS };
let cachedSystemVoices: Speech.Voice[] | null = null;
let isInitialized = false;

/**
 * Initialize and load voice settings from AsyncStorage
 */
export async function getVoiceSettings(): Promise<VoiceSettings> {
    if (!isInitialized) {
        try {
            const raw = await AsyncStorage.getItem(STORAGE_KEY_VOICE_SETTINGS);
            if (raw) {
                const parsed = JSON.parse(raw);
                cachedSettings = {
                    ...DEFAULT_VOICE_SETTINGS,
                    ...parsed,
                };
            }
        } catch (e) {
            console.warn('[VoiceService] Failed to load stored voice settings:', e);
        }
        isInitialized = true;
    }
    return { ...cachedSettings };
}

/**
 * Save updated voice settings to AsyncStorage & memory
 */
export async function saveVoiceSettings(newSettings: Partial<VoiceSettings>): Promise<VoiceSettings> {
    cachedSettings = {
        ...cachedSettings,
        ...newSettings,
    };
    try {
        await AsyncStorage.setItem(STORAGE_KEY_VOICE_SETTINGS, JSON.stringify(cachedSettings));
    } catch (e) {
        console.warn('[VoiceService] Failed to save voice settings:', e);
    }
    return { ...cachedSettings };
}

/**
 * Fetch available device/browser voices
 */
export async function getAvailableSystemVoices(): Promise<Speech.Voice[]> {
    if (cachedSystemVoices && cachedSystemVoices.length > 0) {
        return cachedSystemVoices;
    }
    try {
        const voices = await Speech.getAvailableVoicesAsync();
        if (voices && voices.length > 0) {
            cachedSystemVoices = voices;
            return voices;
        }
    } catch (e) {
        console.warn('[VoiceService] Failed to get system voices:', e);
    }
    return [];
}

/**
 * Find the best matching OS voice for a persona
 */
export function resolveBestVoiceIdentifier(
    persona: VoicePersona,
    systemVoices: Speech.Voice[],
    customVoiceId?: string
): string | undefined {
    if (customVoiceId) {
        const exact = systemVoices.find((v) => v.identifier === customVoiceId);
        if (exact) return exact.identifier;
    }

    if (!systemVoices || systemVoices.length === 0) return undefined;

    // Filter to English voices first
    const englishVoices = systemVoices.filter((v) =>
        v.language && v.language.toLowerCase().startsWith('en')
    );
    const pool = englishVoices.length > 0 ? englishVoices : systemVoices;

    // Match by keywords in order of preference
    for (const keyword of persona.preferredVoiceKeywords) {
        const lowerKey = keyword.toLowerCase();
        const match = pool.find(
            (v) =>
                v.name.toLowerCase().includes(lowerKey) ||
                v.identifier.toLowerCase().includes(lowerKey)
        );
        if (match) {
            return match.identifier;
        }
    }

    // Fallback: pick the first high quality English voice, or first voice
    return pool[0]?.identifier;
}

export interface SpeakOptions {
    rateMultiplier?: number;
    pitchOffset?: number;
    onStart?: () => void;
    onDone?: () => void;
    onStopped?: () => void;
    onError?: (error: any) => void;
}

/**
 * Speak text using the currently selected AI Voice Persona and adjustments
 */
export async function speakWithVoice(text: string, options?: SpeakOptions): Promise<void> {
    try {
        // Ensure stopped first
        await Speech.stop();

        const settings = await getVoiceSettings();
        const persona =
            VOICE_PERSONAS.find((p) => p.id === settings.personaId) || VOICE_PERSONAS[0];

        const systemVoices = await getAvailableSystemVoices();
        const voiceId = resolveBestVoiceIdentifier(
            persona,
            systemVoices,
            settings.customVoiceIdentifier
        );

        const effectiveRate = Math.min(
            2.0,
            Math.max(
                0.5,
                persona.rate * (options?.rateMultiplier ?? settings.speedMultiplier)
            )
        );

        const effectivePitch = Math.min(
            2.0,
            Math.max(
                0.5,
                persona.pitch + (options?.pitchOffset ?? settings.pitchShift)
            )
        );

        Speech.speak(text, {
            voice: voiceId,
            rate: effectiveRate,
            pitch: effectivePitch,
            language: 'en-US',
            onStart: options?.onStart,
            onDone: options?.onDone,
            onStopped: options?.onStopped,
            onError: options?.onError,
        });
    } catch (err) {
        console.warn('[VoiceService] Speech error:', err);
        options?.onError?.(err);
    }
}

/**
 * Stop any ongoing speech playback
 */
export async function stopVoicePlayback(): Promise<void> {
    try {
        await Speech.stop();
    } catch (e) {
        // ignore
    }
}

/**
 * Quick preview of a persona
 */
export async function previewVoicePersona(
    personaId: string,
    speedMultiplier: number = 1.0,
    pitchShift: number = 0.0,
    callbacks?: {
        onStart?: () => void;
        onDone?: () => void;
        onError?: () => void;
    }
): Promise<void> {
    const persona =
        VOICE_PERSONAS.find((p) => p.id === personaId) || VOICE_PERSONAS[0];
    const systemVoices = await getAvailableSystemVoices();
    const voiceId = resolveBestVoiceIdentifier(persona, systemVoices);

    await Speech.stop();

    const effectiveRate = Math.min(2.0, Math.max(0.5, persona.rate * speedMultiplier));
    const effectivePitch = Math.min(2.0, Math.max(0.5, persona.pitch + pitchShift));

    Speech.speak(persona.previewText, {
        voice: voiceId,
        rate: effectiveRate,
        pitch: effectivePitch,
        language: 'en-US',
        onStart: callbacks?.onStart,
        onDone: callbacks?.onDone,
        onStopped: callbacks?.onDone,
        onError: callbacks?.onError,
    });
}
