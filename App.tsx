import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    StatusBar,
    ActivityIndicator,
    Platform,
    PanResponder,
    Animated,
    Dimensions,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HomeScreen } from './screens/Homescreen';
import { CaptureScreen } from './screens/CaptureScreen';
import { ResultsScreen } from './screens/ResultScreen';
import { StudyScreen } from './screens/StudyScreen';
import { LoginScreen, AUTH_STORAGE_KEY } from './screens/LoginScreen';
import { AppSkeleton } from './components/AppSkeleton';
import { SavedNote, SubjectFolder } from './types';
import { fetchSubjectFolders, fetchAllLocalNotes, fetchNotesBySubject } from './services/storage';
import { CircleMenu } from './components/CircleMenu';

type BottomTab = 'folders' | 'notes' | 'study' | 'stats';
type OverlayScreen = 'none' | 'capture' | 'result';

interface TabItem {
    id: BottomTab;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    activeIcon: keyof typeof Ionicons.glyphMap;
}

const TABS: TabItem[] = [
    { id: 'folders', label: 'Folders', icon: 'folder-outline', activeIcon: 'folder' },
    { id: 'notes', label: 'Notes', icon: 'document-text-outline', activeIcon: 'document-text' },
    { id: 'study', label: 'Study', icon: 'school-outline', activeIcon: 'school' },
    { id: 'stats', label: 'Stats', icon: 'bar-chart-outline', activeIcon: 'bar-chart' },
];

function GooeySvgFilter() {
    if (Platform.OS !== 'web') return null;
    return (
        <>
            <svg
                xmlns="http://www.w3.org/2000/svg"
                version="1.1"
                style={{
                    position: 'absolute',
                    width: 0,
                    height: 0,
                    pointerEvents: 'none',
                    overflow: 'hidden',
                }}
                aria-hidden="true"
                focusable="false"
            >
                <defs>
                    {/* Lucas Bebber Shadowed Goo Filter */}
                    <filter id="shadowed-goo">
                        <feGaussianBlur in="SourceGraphic" result="blur" stdDeviation="10" />
                        <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="goo" />
                        <feGaussianBlur in="goo" stdDeviation="3" result="shadow" />
                        <feColorMatrix in="shadow" mode="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 -0.2" result="shadow" />
                        <feOffset in="shadow" dx="1" dy="1" result="shadow" />
                        <feComposite in2="shadow" in="goo" result="goo" />
                        <feComposite in2="goo" in="SourceGraphic" result="mix" />
                    </filter>

                    {/* Lucas Bebber Standard Goo Filter */}
                    <filter id="goo">
                        <feGaussianBlur in="SourceGraphic" result="blur" stdDeviation="10" />
                        <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="goo" />
                        <feComposite in2="goo" in="SourceGraphic" result="mix" />
                    </filter>

                    {/* Aliases for universal compatibility */}
                    <filter id="gooey-nav">
                        <feGaussianBlur in="SourceGraphic" result="blur" stdDeviation="10" />
                        <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="goo" />
                        <feGaussianBlur in="goo" stdDeviation="3" result="shadow" />
                        <feColorMatrix in="shadow" mode="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 -0.2" result="shadow" />
                        <feOffset in="shadow" dx="1" dy="1" result="shadow" />
                        <feComposite in2="shadow" in="goo" result="goo" />
                        <feComposite in2="goo" in="SourceGraphic" result="mix" />
                    </filter>
                    <filter id="gooey-filter">
                        <feGaussianBlur in="SourceGraphic" result="blur" stdDeviation="10" />
                        <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="goo" />
                        <feComposite in2="goo" in="SourceGraphic" result="mix" />
                    </filter>
                </defs>
            </svg>
            <style>
                {`
                    .gooey-shadowed-layer {
                        filter: url(#shadowed-goo);
                        -webkit-filter: url(#shadowed-goo);
                    }
                    .gooey-nav-layer {
                        filter: url(#shadowed-goo);
                        -webkit-filter: url(#shadowed-goo);
                    }
                    .gooey-layer {
                        filter: url(#goo);
                        -webkit-filter: url(#goo);
                    }
                `}
            </style>
        </>
    );
}

function MainApp() {
    const insets = useSafeAreaInsets();
    const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
    const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
    const [currentTab, setCurrentTab] = useState<BottomTab>('folders');
    const [overlay, setOverlay] = useState<OverlayScreen>('none');

    const [selectedNote, setSelectedNote] = useState<SavedNote | null>(null);
    const [targetFolder, setTargetFolder] = useState<SubjectFolder | null>(null);
    const [appendNote, setAppendNote] = useState<SavedNote | null>(null);

    const [allNotes, setAllNotes] = useState<SavedNote[]>([]);
    const [folders, setFolders] = useState<SubjectFolder[]>([]);
    const [refreshKey, setRefreshKey] = useState<number>(0);

    // Transient Tab Toast for visual swipe feedback
    const [activeToast, setActiveToast] = useState<{
        label: string;
        icon: keyof typeof Ionicons.glyphMap;
    } | null>(null);

    const toastAnim = useRef(new Animated.Value(0)).current;
    const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const currentTabRef = useRef<BottomTab>(currentTab);
    currentTabRef.current = currentTab;

    // Interactive Swipe & Animated Tab Physics
    const dragX = useRef(new Animated.Value(0)).current;
    const isAnimatingTabRef = useRef<boolean>(false);

    // Transient Tab Toast for visual swipe feedback
    const showTabToast = useCallback(
        (tabInfo: { label: string; icon: keyof typeof Ionicons.glyphMap }) => {
            if (toastTimerRef.current) {
                clearTimeout(toastTimerRef.current);
            }
            setActiveToast(tabInfo);
            Animated.spring(toastAnim, {
                toValue: 1,
                bounciness: 6,
                speed: 16,
                useNativeDriver: true,
            }).start();

            toastTimerRef.current = setTimeout(() => {
                Animated.timing(toastAnim, {
                    toValue: 0,
                    duration: 250,
                    useNativeDriver: true,
                }).start(() => {
                    setActiveToast(null);
                });
            }, 1400);
        },
        [toastAnim]
    );

    // Animated Tab Switcher with directional slide & spring physics
    const animateToTab = useCallback(
        (targetTab: BottomTab, direction?: 'forward' | 'backward') => {
            const cur = currentTabRef.current;
            if (targetTab === cur) {
                Animated.spring(dragX, {
                    toValue: 0,
                    bounciness: 4,
                    speed: 18,
                    useNativeDriver: true,
                }).start();
                return;
            }

            const curIdx = TABS.findIndex((t) => t.id === cur);
            const targetIdx = TABS.findIndex((t) => t.id === targetTab);
            const dir = direction || (targetIdx > curIdx ? 'forward' : 'backward');

            const screenWidth = Dimensions.get('window').width;
            const exitX = dir === 'forward' ? -screenWidth * 0.42 : screenWidth * 0.42;
            const enterX = dir === 'forward' ? screenWidth * 0.38 : -screenWidth * 0.38;

            isAnimatingTabRef.current = true;

            // 1. Slide out current tab
            Animated.timing(dragX, {
                toValue: exitX,
                duration: 160,
                useNativeDriver: true,
            }).start(() => {
                // 2. Switch tab
                setCurrentTab(targetTab);
                const tabInfo = TABS.find((t) => t.id === targetTab);
                if (tabInfo) {
                    showTabToast(tabInfo);
                }

                // 3. Position new tab entering from opposing side
                dragX.setValue(enterX);

                // 4. Spring smoothly into center
                Animated.spring(dragX, {
                    toValue: 0,
                    bounciness: 4,
                    speed: 16,
                    useNativeDriver: true,
                }).start(() => {
                    isAnimatingTabRef.current = false;
                });
            });
        },
        [dragX, showTabToast]
    );

    const handleSelectTab = useCallback(
        (tab: BottomTab) => {
            if (overlay === 'result') {
                setOverlay('none');
                setSelectedNote(null);
            }
            animateToTab(tab);
        },
        [animateToTab, overlay]
    );

    const handleSwipeNext = useCallback(() => {
        const cur = currentTabRef.current;
        const idx = TABS.findIndex((t) => t.id === cur);
        if (idx < TABS.length - 1) {
            animateToTab(TABS[idx + 1].id, 'forward');
        } else {
            // Elastic boundary bounce
            Animated.spring(dragX, {
                toValue: 0,
                bounciness: 8,
                speed: 18,
                useNativeDriver: true,
            }).start();
        }
    }, [animateToTab, dragX]);

    const handleSwipePrev = useCallback(() => {
        const cur = currentTabRef.current;
        const idx = TABS.findIndex((t) => t.id === cur);
        if (idx > 0) {
            animateToTab(TABS[idx - 1].id, 'backward');
        } else {
            // Elastic boundary bounce
            Animated.spring(dragX, {
                toValue: 0,
                bounciness: 8,
                speed: 18,
                useNativeDriver: true,
            }).start();
        }
    }, [animateToTab, dragX]);

    // PanResponder for Main Screen: tracks horizontal drag and animates tab slide
    const screenPanResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => false,
            onStartShouldSetPanResponderCapture: () => false,
            onMoveShouldSetPanResponderCapture: () => false,
            onMoveShouldSetPanResponder: (evt, gestureState) => {
                if (isAnimatingTabRef.current) return false;

                // Horizontal swipe across tabs (ensure dominant horizontal intent)
                const isHorizontalSwipe =
                    Math.abs(gestureState.dx) > 28 &&
                    Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 2.0;
                if (isHorizontalSwipe) return true;

                return false;
            },
            onPanResponderGrant: () => {
                dragX.stopAnimation();
            },
            onPanResponderMove: (_evt, gestureState) => {
                if (isAnimatingTabRef.current) return;

                // Move content with touch if horizontal swipe is active
                if (Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5) {
                    const cur = currentTabRef.current;
                    const idx = TABS.findIndex((t) => t.id === cur);
                    let dx = gestureState.dx;

                    // Rubber band resistance when at the first tab dragging right or last tab dragging left
                    if ((idx === 0 && dx > 0) || (idx === TABS.length - 1 && dx < 0)) {
                        dx = dx * 0.28;
                    } else {
                        dx = dx * 0.85;
                    }

                    dragX.setValue(dx);
                }
            },
            onPanResponderRelease: (evt, gestureState) => {
                if (isAnimatingTabRef.current) return;

                // Check for horizontal tab navigation swipe
                const isHorizontal =
                    Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.4;
                const passedThreshold =
                    Math.abs(gestureState.dx) > 42 || Math.abs(gestureState.vx) > 0.35;

                if (isHorizontal && passedThreshold) {
                    if (gestureState.dx < 0) {
                        handleSwipeNext();
                    } else {
                        handleSwipePrev();
                    }
                } else {
                    // Did not pass swipe threshold -> spring back smoothly to center
                    Animated.spring(dragX, {
                        toValue: 0,
                        bounciness: 6,
                        speed: 20,
                        useNativeDriver: true,
                    }).start();
                }
            },
            onPanResponderTerminate: () => {
                Animated.spring(dragX, {
                    toValue: 0,
                    bounciness: 6,
                    speed: 20,
                    useNativeDriver: true,
                }).start();
            },
        })
    ).current;

    useEffect(() => {
        return () => {
            if (toastTimerRef.current) {
                clearTimeout(toastTimerRef.current);
            }
        };
    }, []);

    // Check login session with realistic skeleton pre-load
    useEffect(() => {
        async function checkAuth() {
            try {
                const [user] = await Promise.all([
                    AsyncStorage.getItem(AUTH_STORAGE_KEY),
                    // Display collegiate skeleton loader before resolving initial login state
                    new Promise((resolve) => setTimeout(resolve, 850)),
                ]);
                setIsLoggedIn(user === 'kushagr');
            } catch {
                setIsLoggedIn(false);
            }
        }
        checkAuth();
    }, []);

    // Refresh all notes for Study screen and Library
    const loadAllNotes = useCallback(async () => {
        try {
            const fetchedFolders = await fetchSubjectFolders();
            setFolders(fetchedFolders);

            const notesList = await fetchAllLocalNotes();
            setAllNotes(notesList);
        } catch (err) {
            console.error('Failed to load notes for app:', err);
        }
    }, []);

    useEffect(() => {
        if (isLoggedIn) {
            loadAllNotes();
        }
    }, [isLoggedIn, loadAllNotes, refreshKey]);

    const handleScanPress = useCallback((folder?: SubjectFolder | null) => {
        setTargetFolder(folder || null);
        setAppendNote(null);
        setOverlay('capture');
    }, []);

    const handleAddMorePages = useCallback((note: SavedNote) => {
        setAppendNote(note);
        setTargetFolder({
            id: note.subjectSlug,
            name: note.subject,
            noteCount: 1,
            updatedAt: Date.now(),
        });
        setOverlay('capture');
    }, []);

    const handleCaptureComplete = useCallback((note: SavedNote) => {
        setSelectedNote(note);
        setAppendNote(null);
        setOverlay('result');
        setRefreshKey((k) => k + 1);
    }, []);

    const handleCaptureCancel = useCallback(() => {
        if (appendNote && selectedNote) {
            setOverlay('result');
        } else {
            setOverlay('none');
        }
        setAppendNote(null);
    }, [appendNote, selectedNote]);

    const handleSelectNote = useCallback((note: SavedNote) => {
        setSelectedNote(note);
        setOverlay('result');
    }, []);

    const handleBackFromResult = useCallback(() => {
        setSelectedNote(null);
        setOverlay('none');
    }, []);

    const handleStartQuiz = useCallback((note: SavedNote) => {
        setSelectedNote(null);
        setOverlay('none');
        setCurrentTab('study');
    }, []);

    const handleLoginSuccess = useCallback(async (_username: string) => {
        setIsLoggingIn(true);
        try {
            await loadAllNotes();
        } catch (e) {
            console.warn(e);
        }
        // Smooth hydration transition with skeleton
        setTimeout(() => {
            setIsLoggedIn(true);
            setIsLoggingIn(false);
        }, 700);
    }, [loadAllNotes]);

    // Checking authentication state or completing login -> Render Collegiate Skeleton Loader
    if (isLoggedIn === null || isLoggingIn) {
        return <AppSkeleton />;
    }

    // Unauthenticated -> Render Collegiate Login Screen
    if (!isLoggedIn) {
        return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
    }

    // Fullscreen Overlays (Capture & Note Viewer)
    if (overlay === 'capture') {
        return (
            <CaptureScreen
                targetFolder={targetFolder}
                appendNote={appendNote}
                onCancel={handleCaptureCancel}
                onComplete={handleCaptureComplete}
            />
        );
    }

    const screenWidth = Dimensions.get('window').width;

    return (
        <View style={styles.appContainer}>
            <StatusBar barStyle="dark-content" backgroundColor="#faf9f6" />

            {/* Note Reader or Active Tab Screen Content with Animated Swipe Gestures */}
            {overlay === 'result' && selectedNote ? (
                <View style={styles.tabContent}>
                    <ResultsScreen
                        note={selectedNote}
                        onBack={handleBackFromResult}
                        onAddMorePages={handleAddMorePages}
                        onStartQuiz={handleStartQuiz}
                    />
                </View>
            ) : (
                <Animated.View
                    style={[
                        styles.tabContent,
                        {
                            transform: [{ translateX: dragX }],
                            opacity: dragX.interpolate({
                                inputRange: [-screenWidth * 0.45, 0, screenWidth * 0.45],
                                outputRange: [0.84, 1, 0.84],
                                extrapolate: 'clamp',
                            }),
                        },
                    ]}
                    {...screenPanResponder.panHandlers}
                >
                    {currentTab === 'folders' && (
                    <HomeScreen
                        key={`home_${refreshKey}`}
                        onScanPress={handleScanPress}
                        onSelectNote={handleSelectNote}
                        onQuickReviewPress={() => handleSelectTab('study')}
                        initialFolder={targetFolder}
                    />
                )}

                {currentTab === 'notes' && (
                    <HomeScreen
                        key={`notes_${refreshKey}`}
                        onScanPress={handleScanPress}
                        onSelectNote={handleSelectNote}
                        onQuickReviewPress={() => handleSelectTab('study')}
                        initialSection="notes"
                    />
                )}

                {currentTab === 'study' && (
                    <StudyScreen
                        notes={allNotes}
                        folders={folders}
                        onStartReview={() => {}}
                        onSelectNote={handleSelectNote}
                    />
                )}

                {currentTab === 'stats' && (
                    <View
                        style={[
                            styles.statsContainer,
                            {
                                paddingTop: Platform.OS === 'android' ? Math.max(insets.top, StatusBar.currentHeight || 0, 16) : Math.max(insets.top, 16),
                                paddingBottom: Math.max(insets.bottom, Platform.OS === 'android' ? 20 : 16),
                            },
                        ]}
                    >
                        <View style={styles.statsInnerMax}>
                            <View style={styles.statsHeader}>
                                <Text style={styles.statsBrandTitle}>cocampus</Text>
                                <Text style={styles.statsHeading}>Academic Analytics</Text>
                                <Text style={styles.statsSub}>Track memory consolidation & retention</Text>
                            </View>

                            <View style={styles.statsCardsRow}>
                                <View style={styles.statMetricCard}>
                                    <Text style={styles.statMetricNumber}>84%</Text>
                                    <Text style={styles.statMetricLabel}>Retention Rate</Text>
                                </View>
                                <View style={styles.statMetricCard}>
                                    <Text style={styles.statMetricNumber}>5 Days</Text>
                                    <Text style={styles.statMetricLabel}>Calm Streak</Text>
                                </View>
                            </View>

                            <View style={styles.statsDetailCard}>
                                <Text style={styles.statsDetailTitle}>Weekly Study Volume</Text>
                                <Text style={styles.statsDetailDesc}>
                                    48 flashcards reviewed this week across your active subject folders.
                                </Text>
                                <TouchableOpacity
                                    style={styles.statsReviewBtn}
                                    onPress={() => handleSelectTab('study')}
                                >
                                    <Text style={styles.statsReviewBtnText}>Jump into Active Recall</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                )}
            </Animated.View>
            )}

            {/* Transient Swipe Tab Indicator Toast */}
            {activeToast && (
                <Animated.View
                    style={[
                        styles.tabToastPill,
                        {
                            top: (Platform.OS === 'android' ? Math.max(insets.top, StatusBar.currentHeight || 0, 16) : Math.max(insets.top, 12)) + 52,
                            opacity: toastAnim,
                            transform: [
                                {
                                    translateY: toastAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [-10, 0],
                                    }),
                                },
                                {
                                    scale: toastAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [0.92, 1],
                                    }),
                                },
                            ],
                        },
                    ]}
                    pointerEvents="none"
                >
                    <Ionicons name={activeToast.icon} size={15} color="#4b6456" style={{ marginRight: 6 }} />
                    <Text style={styles.tabToastText}>{activeToast.label}</Text>
                </Animated.View>
            )}

            {/* Gooey SVG Filter: renders invisible <svg> with declarative feGaussianBlur & feColorMatrix filter */}
            <GooeySvgFilter />

            {/* CircleMenu: Lucas Bebber circular Gooey Bubble Navigation (Translucent ball at bottom-left auto-collapsing under 25s) */}
            <CircleMenu
                items={[
                    {
                        id: 'folders',
                        label: 'Folders',
                        icon: 'folder-outline',
                        activeIcon: 'folder',
                        isActive: currentTab === 'folders',
                        onPress: () => handleSelectTab('folders'),
                    },
                    {
                        id: 'notes',
                        label: 'Notes',
                        icon: 'document-text-outline',
                        activeIcon: 'document-text',
                        isActive: currentTab === 'notes',
                        onPress: () => handleSelectTab('notes'),
                    },
                    {
                        id: 'scan',
                        label: 'Scan',
                        icon: 'camera',
                        activeIcon: 'camera',
                        isAccent: true,
                        onPress: () => handleScanPress(null),
                    },
                    {
                        id: 'study',
                        label: 'Study',
                        icon: 'school-outline',
                        activeIcon: 'school',
                        isActive: currentTab === 'study',
                        onPress: () => handleSelectTab('study'),
                    },
                    {
                        id: 'stats',
                        label: 'Stats',
                        icon: 'bar-chart-outline',
                        activeIcon: 'bar-chart',
                        isActive: currentTab === 'stats',
                        onPress: () => handleSelectTab('stats'),
                    },
                ]}
                activeTabId={currentTab}
                bottomInset={insets.bottom}
                leftInset={insets.left}
                autoCollapseMs={25000}
                initialOpen={true}
            />
        </View>
    );
}

export default function App() {
    return (
        <SafeAreaProvider>
            <MainApp />
        </SafeAreaProvider>
    );
}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        backgroundColor: '#faf9f6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    appContainer: {
        flex: 1,
        backgroundColor: '#faf9f6',
        position: 'relative',
        overflow: 'hidden',
    },
    tabContent: {
        flex: 1,
    },
    navGooeyContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 100,
    },
    liquidMorphBridge: {
        position: 'absolute',
        width: 32,
        height: 52,
        borderRadius: 16,
        backgroundColor: '#182232',
        zIndex: 95,
    },
    liquidTabPill: {
        position: 'absolute',
        top: 3,
        bottom: 3,
        borderRadius: 22,
        backgroundColor: '#e5e2d8',
        zIndex: 1,
    },
    navBarContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderTopWidth: 1,
        borderTopColor: '#efeeeb',
        zIndex: 100,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 8,
        ...(Platform.OS === 'web' ? ({
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
        } as any) : {}),
    },
    circleArrowContainer: {
        position: 'absolute',
        zIndex: 102,
    },
    circleArrowBtn: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: 'rgba(24, 34, 50, 0.76)',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#182232',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
        elevation: 8,
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.38)',
        ...(Platform.OS === 'web' ? ({
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
        } as any) : {}),
    },
    navBarCollapseHandle: {
        position: 'absolute',
        top: -14,
        alignSelf: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        width: 38,
        height: 16,
        borderTopLeftRadius: 10,
        borderTopRightRadius: 10,
        borderWidth: 1,
        borderBottomWidth: 0,
        borderColor: '#efeeeb',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 105,
    },
    tabToastPill: {
        position: 'absolute',
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: '#e9e8e5',
        shadowColor: '#182232',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
        elevation: 6,
        zIndex: 200,
    },
    tabToastText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#182232',
    },
    navBar: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-around',
        paddingHorizontal: 8,
        paddingTop: 6,
        paddingBottom: 4,
        position: 'relative',
        maxWidth: 880,
        width: '100%',
        alignSelf: 'center',
    },
    navItem: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 4,
        flex: 1,
    },
    navLabel: {
        fontSize: 10,
        fontWeight: '600',
        color: '#75777d',
        marginTop: 3,
    },
    navLabelActive: {
        color: '#182232',
        fontWeight: '700',
    },
    centerScanWrap: {
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        top: -14,
    },
    centerScanBtn: {
        width: 54,
        height: 54,
        borderRadius: 27,
        backgroundColor: '#182232',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#182232',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    centerScanLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: '#182232',
        marginTop: 4,
    },
    statsContainer: {
        flex: 1,
        backgroundColor: '#faf9f6',
        paddingHorizontal: 20,
    },
    statsInnerMax: {
        maxWidth: 880,
        width: '100%',
        alignSelf: 'center',
        flex: 1,
    },
    statsHeader: {
        marginBottom: 24,
    },
    statsBrandTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#182232',
        marginBottom: 6,
    },
    statsHeading: {
        fontSize: 26,
        fontWeight: '800',
        color: '#182232',
        letterSpacing: -0.5,
    },
    statsSub: {
        fontSize: 14,
        color: '#75777d',
        marginTop: 4,
    },
    statsCardsRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 20,
    },
    statMetricCard: {
        flex: 1,
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 18,
        borderWidth: 1,
        borderColor: '#e8e6e1',
    },
    statMetricNumber: {
        fontSize: 28,
        fontWeight: '800',
        color: '#182232',
    },
    statMetricLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#75777d',
        marginTop: 4,
    },
    statsDetailCard: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 18,
        borderWidth: 1,
        borderColor: '#e8e6e1',
    },
    statsDetailTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#182232',
        marginBottom: 6,
    },
    statsDetailDesc: {
        fontSize: 13,
        color: '#45474c',
        lineHeight: 19,
        marginBottom: 16,
    },
    statsReviewBtn: {
        backgroundColor: '#182232',
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
    },
    statsReviewBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#ffffff',
    },
});
