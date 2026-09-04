import React, { useState, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { HomeScreen } from './screens/Homescreen';
import { CaptureScreen } from './screens/CaptureScreen';
import { ResultsScreen } from './screens/ResultScreen';
import { SavedNote } from './types';

type Screen = 'home' | 'capture' | 'result';

export default function App() {
    const [screen, setScreen] = useState<Screen>('home');
    const [selectedNote, setSelectedNote] = useState<SavedNote | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    const handleScanPress = useCallback(() => {
        setScreen('capture');
    }, []);

    const handleCaptureComplete = useCallback((note: SavedNote) => {
        setSelectedNote(note);
        setScreen('result');
        setRefreshKey((k) => k + 1);
    }, []);

    const handleCaptureCancel = useCallback(() => {
        setScreen('home');
    }, []);

    const handleSelectNote = useCallback((note: SavedNote) => {
        setSelectedNote(note);
        setScreen('result');
    }, []);

    const handleBackFromResult = useCallback(() => {
        setSelectedNote(null);
        setScreen('home');
    }, []);

    return (
        <>
            <StatusBar style="light" backgroundColor="#121212" />
            {screen === 'home' && (
                <HomeScreen
                    key={refreshKey}
                    onScanPress={handleScanPress}
                    onSelectNote={handleSelectNote}
                />
            )}
            {screen === 'capture' && (
                <CaptureScreen
                    onCancel={handleCaptureCancel}
                    onComplete={handleCaptureComplete}
                />
            )}
            {screen === 'result' && selectedNote && (
                <ResultsScreen
                    note={selectedNote}
                    onBack={handleBackFromResult}
                />
            )}
        </>
    );
}
