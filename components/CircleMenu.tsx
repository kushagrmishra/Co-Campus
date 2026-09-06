import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    Animated,
    Platform,
    Dimensions,
    PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface CircleMenuItem {
    id: string;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    activeIcon?: keyof typeof Ionicons.glyphMap;
    isActive?: boolean;
    isAccent?: boolean;
    onPress: () => void;
}

export interface CircleMenuProps {
    items: CircleMenuItem[];
    activeTabId?: string;
    bottomInset?: number;
    leftInset?: number;
    autoCollapseMs?: number; // 25 seconds default
    initialOpen?: boolean;
    onOpenChange?: (isOpen: boolean) => void;
}

const CONTAINER_SIZE = 248;
const RADIUS = 96;
const BASE_ITEM_SIZE = 46;
const AUTO_COLLAPSE_MS = 15000; // 15 seconds
const TOTAL_ITEMS = 5;
const STEP_ANGLE = (2 * Math.PI) / TOTAL_ITEMS; // 72 degrees in radians

// Compute shortest angular distance between two angles in radians (always in [-PI, PI])
const getShortestAngleDelta = (fromAngle: number, toAngle: number): number => {
    let delta = (toAngle - fromAngle) % (2 * Math.PI);
    if (delta > Math.PI) delta -= 2 * Math.PI;
    if (delta < -Math.PI) delta += 2 * Math.PI;
    return delta;
};

export const CircleMenu: React.FC<CircleMenuProps> = ({
    items,
    activeTabId,
    bottomInset = 0,
    leftInset = 0,
    autoCollapseMs = AUTO_COLLAPSE_MS,
    initialOpen = false,
    onOpenChange,
}) => {
    const [isOpen, setIsOpen] = useState<boolean>(initialOpen);

    // Active item index
    const initialIndex = Math.max(
        0,
        items.findIndex((item) => item.isActive || item.id === activeTabId)
    );
    const activeIndexRef = useRef<number>(initialIndex);

    // Current rotation in radians (Animated.Value for smooth 60fps gestures)
    // When rotationAngle = -initialIndex * STEP_ANGLE, item initialIndex is at the top apex (-PI/2)
    const rotationAngle = useRef(
        new Animated.Value(-initialIndex * STEP_ANGLE)
    ).current;
    const currentAngleVal = useRef<number>(-initialIndex * STEP_ANGLE);

    // Open/Close transition animations
    const openAnim = useRef(new Animated.Value(initialOpen ? 1 : 0)).current;
    const ballAnim = useRef(new Animated.Value(initialOpen ? 0 : 1)).current;

    // 15-second auto-collapse timer
    const autoCollapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const navCollapseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isOpenRef = useRef<boolean>(isOpen);
    isOpenRef.current = isOpen;

    const clearCollapseTimer = useCallback(() => {
        if (autoCollapseTimerRef.current) {
            clearTimeout(autoCollapseTimerRef.current);
            autoCollapseTimerRef.current = null;
        }
        if (navCollapseTimeoutRef.current) {
            clearTimeout(navCollapseTimeoutRef.current);
            navCollapseTimeoutRef.current = null;
        }
    }, []);

    // Close / minimize into bottom-left translucent ball
    const closeMenu = useCallback(() => {
        clearCollapseTimer();

        Animated.parallel([
            Animated.timing(openAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.spring(ballAnim, {
                toValue: 1,
                bounciness: 6,
                speed: 18,
                useNativeDriver: true,
            }),
        ]).start(() => {
            setIsOpen(false);
            onOpenChange?.(false);
        });
    }, [ballAnim, clearCollapseTimer, onOpenChange, openAnim]);

    // Open / expand into big circle dial
    const openMenu = useCallback(() => {
        clearCollapseTimer();
        setIsOpen(true);
        onOpenChange?.(true);

        Animated.parallel([
            Animated.spring(openAnim, {
                toValue: 1,
                bounciness: 7,
                speed: 14,
                useNativeDriver: true,
            }),
            Animated.timing(ballAnim, {
                toValue: 0,
                duration: 180,
                useNativeDriver: true,
            }),
        ]).start();

        // Schedule auto-collapse
        autoCollapseTimerRef.current = setTimeout(() => {
            closeMenu();
        }, autoCollapseMs);
    }, [autoCollapseMs, ballAnim, clearCollapseTimer, closeMenu, onOpenChange, openAnim]);

    const resetCollapseTimer = useCallback(() => {
        clearCollapseTimer();
        if (isOpenRef.current) {
            autoCollapseTimerRef.current = setTimeout(() => {
                closeMenu();
            }, autoCollapseMs);
        }
    }, [autoCollapseMs, clearCollapseTimer, closeMenu]);

    // Mount lifecycle
    useEffect(() => {
        const id = rotationAngle.addListener(({ value }) => {
            currentAngleVal.current = value;
        });
        if (initialOpen) {
            autoCollapseTimerRef.current = setTimeout(() => {
                closeMenu();
            }, autoCollapseMs);
        }
        return () => {
            rotationAngle.removeListener(id);
            clearCollapseTimer();
        };
    }, [autoCollapseMs, clearCollapseTimer, closeMenu, initialOpen, rotationAngle]);

    // Rotate to target item via shortest angular arc
    const rotateToItem = useCallback(
        (targetIndex: number, shouldTriggerPress = true) => {
            resetCollapseTimer();
            const boundedIndex = ((targetIndex % TOTAL_ITEMS) + TOTAL_ITEMS) % TOTAL_ITEMS;
            activeIndexRef.current = boundedIndex;

            // Target base angle so item boundedIndex is at apex (-Math.PI / 2)
            const targetBase = -boundedIndex * STEP_ANGLE;

            // Compute shortest angular delta to avoid unwanted 360-degree reverse flips
            const curVal = currentAngleVal.current;
            const delta = getShortestAngleDelta(curVal, targetBase);
            const targetAngle = curVal + delta;

            // Stop any conflicting in-flight animation immediately
            rotationAngle.stopAnimation();

            // Smooth spring rotation to destination
            Animated.spring(rotationAngle, {
                toValue: targetAngle,
                tension: 58,
                friction: 10,
                useNativeDriver: true,
            }).start();

            // Immediately trigger press so screen transition occurs synchronously with dial rotation
            if (shouldTriggerPress) {
                items[boundedIndex]?.onPress();

                // Collapse nav bar as soon as user scrolls/navigates to an app
                if (navCollapseTimeoutRef.current) {
                    clearTimeout(navCollapseTimeoutRef.current);
                }
                navCollapseTimeoutRef.current = setTimeout(() => {
                    closeMenu();
                }, 80);
            }
        },
        [closeMenu, items, resetCollapseTimer, rotationAngle]
    );

    // Sync rotation on external active tab change (e.g., swipe navigation)
    useEffect(() => {
        if (activeTabId) {
            const idx = items.findIndex((i) => i.id === activeTabId);
            if (idx !== -1 && idx !== activeIndexRef.current) {
                rotateToItem(idx, false);
            }
        }
    }, [activeTabId]);

    // PanResponder for spinning / scrolling the circular wheel
    const panStartAngle = useRef<number>(0);
    const panStartRotation = useRef<number>(0);
    const centerCoords = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const circleContainerRef = useRef<View>(null);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => false,
            onStartShouldSetPanResponderCapture: () => false,
            onMoveShouldSetPanResponderCapture: () => false,
            onMoveShouldSetPanResponder: (_evt, gestureState) => {
                // Only capture when explicitly dragged more than 8 pixels
                return Math.hypot(gestureState.dx, gestureState.dy) > 8;
            },
            onPanResponderGrant: (evt) => {
                resetCollapseTimer();
                rotationAngle.stopAnimation();
                panStartRotation.current = currentAngleVal.current;

                if (circleContainerRef.current) {
                    circleContainerRef.current.measure((_x, _y, width, height, pageX, pageY) => {
                        centerCoords.current = {
                            x: pageX + width / 2,
                            y: pageY + height / 2,
                        };
                    });
                }
                const touchX = evt.nativeEvent.pageX;
                const touchY = evt.nativeEvent.pageY;
                panStartAngle.current = Math.atan2(
                    touchY - centerCoords.current.y,
                    touchX - centerCoords.current.x
                );
            },
            onPanResponderMove: (evt, gestureState) => {
                resetCollapseTimer();
                const touchX = evt.nativeEvent.pageX;
                const touchY = evt.nativeEvent.pageY;
                const currentTouchAngle = Math.atan2(
                    touchY - centerCoords.current.y,
                    touchX - centerCoords.current.x
                );
                let deltaAngle = currentTouchAngle - panStartAngle.current;

                // Handle boundary wrap around -PI to PI
                if (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
                if (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;

                // Also incorporate horizontal swipe for intuitive thumb rotation
                const swipeContribution = gestureState.dx * 0.008;
                const newRotation = panStartRotation.current + deltaAngle + swipeContribution;
                rotationAngle.setValue(newRotation);
            },
            onPanResponderRelease: () => {
                resetCollapseTimer();
                // When rotation stops, calculate which item is closest to apex
                const currentRot = currentAngleVal.current;
                const rawIdx = -currentRot / STEP_ANGLE;
                let nearestIdx = Math.round(rawIdx) % TOTAL_ITEMS;
                if (nearestIdx < 0) nearestIdx += TOTAL_ITEMS;
                rotateToItem(nearestIdx, true);
            },
        })
    ).current;

    // Calculate positions for each of the 5 circular items around the wheel
    // Using Animated.Value listener to drive coordinates smoothly
    const [renderAngle, setRenderAngle] = useState<number>(currentAngleVal.current);

    useEffect(() => {
        const id = rotationAngle.addListener(({ value }) => {
            setRenderAngle(value);
        });
        return () => rotationAngle.removeListener(id);
    }, [rotationAngle]);

    const activeItem = items[activeIndexRef.current] || items[0];

    // Dynamically calculate which item is currently at or closest to the apex
    const rawApexIdx = -renderAngle / STEP_ANGLE;
    let nearestApexIdx = Math.round(rawApexIdx) % TOTAL_ITEMS;
    if (nearestApexIdx < 0) nearestApexIdx += TOTAL_ITEMS;
    const focusedItem = items[nearestApexIdx] || activeItem;

    return (
        <>
            {/* 1. Small Translucent Ball at Bottom-Left when Collapsed */}
            <Animated.View
                style={[
                    styles.ballContainer,
                    {
                        left: Math.max(leftInset, 18),
                        bottom: Math.max(bottomInset, Platform.OS === 'android' ? 18 : 14) + 12,
                        opacity: ballAnim,
                        transform: [
                            { scale: ballAnim },
                            {
                                translateY: ballAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [20, 0],
                                }),
                            },
                        ],
                    },
                ]}
                pointerEvents={isOpen ? 'none' : 'auto'}
            >
                <TouchableOpacity
                    style={[
                        styles.ballButton,
                        Platform.OS === 'web'
                            ? ({
                                  backdropFilter: 'blur(24px)',
                                  WebkitBackdropFilter: 'blur(24px)',
                                  boxShadow: '0 8px 24px -4px rgba(15, 23, 42, 0.35), 0 2px 6px rgba(0, 0, 0, 0.1)',
                              } as any)
                            : undefined,
                    ]}
                    onPress={openMenu}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Open circular navigation dial"
                >
                    <Ionicons
                        name={activeItem?.icon || 'compass'}
                        size={22}
                        color="#ffffff"
                    />
                    <View style={styles.ballPulseDot} />
                </TouchableOpacity>
            </Animated.View>

            {/* 2. Big Circular Rotary Dial Wheel when Open */}
            <Animated.View
                ref={circleContainerRef}
                style={[
                    styles.circleWrapper,
                    {
                        bottom: Math.max(bottomInset, Platform.OS === 'android' ? 18 : 14) + 14,
                        opacity: openAnim,
                        transform: [
                            { scale: openAnim },
                            {
                                translateY: openAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [30, 0],
                                }),
                            },
                        ],
                    },
                    Platform.OS === 'web'
                        ? ({
                              WebkitFontSmoothing: 'antialiased',
                              MozOsxFontSmoothing: 'grayscale',
                          } as any)
                        : undefined,
                ]}
                pointerEvents={isOpen ? 'box-none' : 'none'}
                {...panResponder.panHandlers}
            >
                {/* Dynamic Floating Label Badge for the active/focused item */}
                <View
                    style={[
                        styles.apexLabelBadge,
                        Platform.OS === 'web'
                            ? ({
                                  backdropFilter: 'blur(24px)',
                                  WebkitBackdropFilter: 'blur(24px)',
                                  boxShadow: '0 4px 16px rgba(15, 23, 42, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.25)',
                              } as any)
                            : undefined,
                    ]}
                    pointerEvents="none"
                >
                    <Text style={styles.apexLabelText}>{focusedItem.label}</Text>
                </View>

                {/* Subtle Rotary Dial Guide Ring */}
                <View
                    style={[
                        styles.rotaryGuideTrack,
                        Platform.OS === 'web'
                            ? ({
                                  backdropFilter: 'blur(20px)',
                                  WebkitBackdropFilter: 'blur(20px)',
                                  boxShadow: '0 4px 24px rgba(15, 23, 42, 0.08), inset 0 0 0 1px rgba(255, 255, 255, 0.75)',
                              } as any)
                            : undefined,
                    ]}
                    pointerEvents="none"
                />

                {/* Circular Navigation Nodes distributed evenly around the 360° circle */}
                {items.map((item, index) => {
                    // Angle for item index at current rotation
                    // -Math.PI / 2 is the apex (12 o'clock / top position)
                    const theta = -Math.PI / 2 + index * STEP_ANGLE + renderAngle;
                    const x = RADIUS * Math.cos(theta);
                    const y = RADIUS * Math.sin(theta);

                    // Angular distance from apex (-Math.PI / 2)
                    const angleFromApex = index * STEP_ANGLE + renderAngle;
                    let normAngle = angleFromApex % (2 * Math.PI);
                    if (normAngle > Math.PI) normAngle -= 2 * Math.PI;
                    if (normAngle < -Math.PI) normAngle += 2 * Math.PI;
                    const distToApex = Math.abs(normAngle);
                    const isApex = distToApex < 0.38;

                    // Medium scaling: scan node uses balanced medium curve (peaks at 1.15x instead of 1.28x)
                    const isScan = item.isAccent;
                    const peakScale = isScan ? 0.33 : 0.46;
                    const scale = 0.82 + peakScale * Math.max(0, 1 - distToApex / 0.85);

                    // Strictly only ONE item is ever marked as selected (fixes "stat app also selected" bug)
                    const currentActiveId = activeTabId || items[activeIndexRef.current]?.id;
                    const isSelected = item.id === currentActiveId;

                    return (
                        <View
                            key={`circle-item-${item.id}`}
                            style={[
                                styles.itemNode,
                                {
                                    transform: [
                                        { translateX: x },
                                        { translateY: y },
                                        { scale },
                                    ],
                                },
                            ]}
                        >
                            <TouchableOpacity
                                style={[
                                    styles.itemBubble,
                                    isScan
                                        ? styles.itemBubbleScan
                                        : isSelected
                                        ? styles.itemBubbleActive
                                        : styles.itemBubbleInactive,
                                    Platform.OS === 'web'
                                        ? ({
                                              boxShadow: isScan
                                                  ? '0 6px 20px rgba(16, 185, 129, 0.45), 0 2px 6px rgba(0, 0, 0, 0.12), inset 0 1px 1px rgba(255, 255, 255, 0.6)'
                                                  : isSelected
                                                  ? '0 6px 20px rgba(15, 23, 42, 0.4), 0 2px 6px rgba(0, 0, 0, 0.2), inset 0 1px 1px rgba(255, 255, 255, 0.5)'
                                                  : '0 4px 12px rgba(15, 23, 42, 0.08), 0 1px 3px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.95)',
                                          } as any)
                                        : undefined,
                                ]}
                                onPress={() => rotateToItem(index, true)}
                                activeOpacity={0.82}
                                accessibilityRole="button"
                                accessibilityLabel={item.label}
                            >
                                <Ionicons
                                    name={
                                        isSelected && item.activeIcon
                                            ? item.activeIcon
                                            : item.icon
                                    }
                                    size={isScan ? (isApex ? 21 : 20) : isApex ? 22 : 19}
                                    color={
                                        isScan || isSelected
                                            ? '#ffffff'
                                            : '#334155'
                                    }
                                />

                                {/* Active Tab Dot - strictly shown ONLY for the selected tab */}
                                {isSelected && !isScan && (
                                    <View style={styles.activeDot} />
                                )}
                            </TouchableOpacity>
                        </View>
                    );
                })}

                {/* Center Hub Trigger Button: Tap to collapse into small ball */}
                <TouchableOpacity
                    style={[
                        styles.centerHubBtn,
                        Platform.OS === 'web'
                            ? ({
                                  backdropFilter: 'blur(20px)',
                                  WebkitBackdropFilter: 'blur(20px)',
                                  boxShadow: '0 4px 16px rgba(15, 23, 42, 0.32), inset 0 1px 1px rgba(255, 255, 255, 0.35)',
                              } as any)
                            : undefined,
                    ]}
                    onPress={closeMenu}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Collapse circular menu"
                >
                    <Ionicons name="close" size={20} color="#ffffff" />
                </TouchableOpacity>
            </Animated.View>
        </>
    );
};

const styles = StyleSheet.create({
    // Collapsed Translucent Ball at Bottom-Left
    ballContainer: {
        position: 'absolute',
        width: 50,
        height: 50,
        zIndex: 9999,
    },
    ballButton: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: 'rgba(15, 23, 42, 0.86)',
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.38)',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.28,
        shadowRadius: 12,
        elevation: 8,
    },
    ballPulseDot: {
        position: 'absolute',
        top: 7,
        right: 7,
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: '#10b981',
        borderWidth: 1.5,
        borderColor: '#ffffff',
    },

    // Expanded Big Circular Rotary Dial Wheel
    circleWrapper: {
        position: 'absolute',
        alignSelf: 'center',
        width: CONTAINER_SIZE,
        height: CONTAINER_SIZE,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
    },
    rotaryGuideTrack: {
        position: 'absolute',
        width: RADIUS * 2 + 10,
        height: RADIUS * 2 + 10,
        borderRadius: RADIUS + 5,
        borderWidth: 1.5,
        borderColor: 'rgba(15, 23, 42, 0.08)',
        borderStyle: 'solid',
        backgroundColor: 'rgba(255, 255, 255, 0.72)',
    },

    // Center Hub Button
    centerHubBtn: {
        position: 'absolute',
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(15, 23, 42, 0.92)',
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.48)',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.28,
        shadowRadius: 8,
        elevation: 6,
        zIndex: 100,
    },

    // Circular Node
    itemNode: {
        position: 'absolute',
        width: BASE_ITEM_SIZE,
        height: BASE_ITEM_SIZE,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 90,
    },
    itemBubble: {
        width: BASE_ITEM_SIZE,
        height: BASE_ITEM_SIZE,
        borderRadius: BASE_ITEM_SIZE / 2,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.16,
        shadowRadius: 8,
        elevation: 6,
    },
    itemBubbleInactive: {
        backgroundColor: 'rgba(255, 255, 255, 0.96)',
        borderWidth: 1,
        borderColor: 'rgba(203, 213, 225, 0.85)',
    },
    itemBubbleActive: {
        backgroundColor: '#0f172a',
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.55)',
        shadowColor: '#0f172a',
        shadowOpacity: 0.38,
        shadowRadius: 10,
    },
    itemBubbleScan: {
        backgroundColor: '#10b981',
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.7)',
        shadowColor: '#10b981',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.36,
        shadowRadius: 7,
        elevation: 5,
    },
    activeDot: {
        position: 'absolute',
        bottom: 4,
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#22c55e',
        borderWidth: 0.5,
        borderColor: '#ffffff',
    },
    apexLabelBadge: {
        position: 'absolute',
        top: -26,
        alignSelf: 'center',
        paddingHorizontal: 13,
        paddingVertical: 4,
        borderRadius: 14,
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.28)',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.24,
        shadowRadius: 6,
        elevation: 4,
        zIndex: 110,
    },
    apexLabelText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#ffffff',
        letterSpacing: 0.4,
    },
});
