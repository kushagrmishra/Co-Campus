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
const CENTER_BTN_SIZE = 44;
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

    // Per-item radial dispersal spring animations (inspired by Framer Motion radial spring stagger)
    const itemSpreadAnims = useRef<Animated.Value[]>(
        items.map(() => new Animated.Value(initialOpen ? 1 : 0))
    ).current;

    // Center trigger hub micro-animations (shake & spin on collapse)
    const triggerShakeAnim = useRef(new Animated.Value(0)).current;
    const triggerRotateAnim = useRef(new Animated.Value(0)).current;

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

    // Close / minimize into bottom-left translucent ball with staggered radial retraction & spin
    const closeMenu = useCallback(() => {
        clearCollapseTimer();

        // Staggered retraction of items back to center hub (closeStagger)
        const itemRetractions = items.map((_, i) =>
            Animated.spring(itemSpreadAnims[i], {
                toValue: 0,
                tension: 130,
                friction: 9,
                delay: (items.length - 1 - i) * 26,
                useNativeDriver: true,
            })
        );

        // Center hub subtle shake and -360 rotation during collapse
        Animated.sequence([
            Animated.timing(triggerShakeAnim, {
                toValue: 1,
                duration: 90,
                useNativeDriver: true,
            }),
            Animated.timing(triggerShakeAnim, {
                toValue: 0,
                duration: 60,
                useNativeDriver: true,
            }),
        ]).start();

        Animated.timing(triggerRotateAnim, {
            toValue: -1,
            duration: 220,
            useNativeDriver: true,
        }).start();

        Animated.parallel([
            Animated.timing(openAnim, {
                toValue: 0,
                duration: 220,
                useNativeDriver: true,
            }),
            Animated.spring(ballAnim, {
                toValue: 1,
                bounciness: 7,
                speed: 18,
                useNativeDriver: true,
            }),
            ...itemRetractions,
        ]).start(() => {
            setIsOpen(false);
            onOpenChange?.(false);
        });
    }, [ballAnim, clearCollapseTimer, itemSpreadAnims, items, onOpenChange, openAnim, triggerRotateAnim, triggerShakeAnim]);

    // Open / expand into big circle dial with radial spring blossom (openStagger)
    const openMenu = useCallback(() => {
        clearCollapseTimer();
        setIsOpen(true);
        onOpenChange?.(true);

        triggerRotateAnim.setValue(0);
        triggerShakeAnim.setValue(0);

        // Staggered outward radial release of items (openStagger)
        const itemSprings = items.map((_, i) =>
            Animated.spring(itemSpreadAnims[i], {
                toValue: 1,
                tension: 110,
                friction: 7,
                delay: i * 22,
                useNativeDriver: true,
            })
        );

        Animated.parallel([
            Animated.spring(openAnim, {
                toValue: 1,
                tension: 100,
                friction: 7.5,
                useNativeDriver: true,
            }),
            Animated.timing(ballAnim, {
                toValue: 0,
                duration: 160,
                useNativeDriver: true,
            }),
            ...itemSprings,
        ]).start();

        // Schedule auto-collapse
        autoCollapseTimerRef.current = setTimeout(() => {
            closeMenu();
        }, autoCollapseMs);
    }, [autoCollapseMs, ballAnim, clearCollapseTimer, closeMenu, itemSpreadAnims, items, onOpenChange, openAnim, triggerRotateAnim, triggerShakeAnim]);

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

    // Sync rotation on external active tab change (e.g., swipe navigation between apps)
    useEffect(() => {
        if (activeTabId) {
            const idx = items.findIndex((i) => i.id === activeTabId);
            if (idx !== -1 && idx !== activeIndexRef.current) {
                rotateToItem(idx, false);
                // Collapse nav bar as soon as user scrolls/swipes to another app
                if (isOpenRef.current) {
                    closeMenu();
                }
            }
        }
    }, [activeTabId, closeMenu, items, rotateToItem]);

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
                                  backdropFilter: 'blur(28px) saturate(190%)',
                                  WebkitBackdropFilter: 'blur(28px) saturate(190%)',
                                  boxShadow: '0 8px 28px -4px rgba(15, 23, 42, 0.4), 0 2px 8px rgba(0, 0, 0, 0.12), inset 0 1px 1px rgba(255, 255, 255, 0.45)',
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
                                  backdropFilter: 'blur(24px) saturate(180%)',
                                  WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                                  boxShadow: '0 4px 16px rgba(15, 23, 42, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
                              } as any)
                            : undefined,
                    ]}
                    pointerEvents="none"
                >
                    <Text style={styles.apexLabelText}>{focusedItem.label}</Text>
                </View>

                {/* Subtle Rotary Dial Guide Track with crisp HD glass effect */}
                <View
                    style={[
                        styles.rotaryGuideTrack,
                        Platform.OS === 'web'
                            ? ({
                                  backdropFilter: 'blur(24px) saturate(180%)',
                                  WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                                  boxShadow: '0 6px 28px rgba(15, 23, 42, 0.1), inset 0 0 0 1.5px rgba(255, 255, 255, 0.85)',
                              } as any)
                            : undefined,
                    ]}
                    pointerEvents="none"
                />

                {/* Circular Navigation Nodes distributed evenly around the 360° circle with staggered radial spring */}
                {items.map((item, index) => {
                    // Angle for item index at current rotation
                    // -Math.PI / 2 is the apex (12 o'clock / top position)
                    const theta = -Math.PI / 2 + index * STEP_ANGLE + renderAngle;
                    const cosTheta = Math.cos(theta);
                    const sinTheta = Math.sin(theta);
                    const targetX = RADIUS * cosTheta;
                    const targetY = RADIUS * sinTheta;

                    // Angular distance from apex (-Math.PI / 2)
                    const angleFromApex = index * STEP_ANGLE + renderAngle;
                    let normAngle = angleFromApex % (2 * Math.PI);
                    if (normAngle > Math.PI) normAngle -= 2 * Math.PI;
                    if (normAngle < -Math.PI) normAngle += 2 * Math.PI;
                    const distToApex = Math.abs(normAngle);
                    const isApex = distToApex < 0.38;

                    // Medium scaling: scan node uses balanced medium curve
                    const isScan = item.isAccent;
                    const peakScale = isScan ? 0.33 : 0.46;
                    const targetApexScale = 0.82 + peakScale * Math.max(0, 1 - distToApex / 0.85);

                    // Strictly only ONE item is ever marked as selected (fixes "stat app also selected" bug)
                    const currentActiveId = activeTabId || items[activeIndexRef.current]?.id;
                    const isSelected = item.id === currentActiveId;

                    // Radial spring dispersal interpolation (bursts out from center hub)
                    const spread = itemSpreadAnims[index] || openAnim;
                    const transX = spread.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, targetX],
                    });
                    const transY = spread.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, targetY],
                    });
                    const scale = spread.interpolate({
                        inputRange: [0, 0.25, 1],
                        outputRange: [0.15, 0.4, targetApexScale],
                    });
                    const opacity = spread.interpolate({
                        inputRange: [0, 0.15, 1],
                        outputRange: [0, 0.9, 1],
                    });

                    return (
                        <Animated.View
                            key={`circle-item-${item.id}`}
                            style={[
                                styles.itemNode,
                                {
                                    opacity,
                                    transform: [
                                        { translateX: transX },
                                        { translateY: transY },
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
                                              backdropFilter: 'blur(24px) saturate(180%)',
                                              WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                                              boxShadow: isScan
                                                  ? '0 8px 24px rgba(16, 185, 129, 0.5), 0 2px 6px rgba(0, 0, 0, 0.14), inset 0 1px 1px rgba(255, 255, 255, 0.7)'
                                                  : isSelected
                                                  ? '0 8px 24px rgba(15, 23, 42, 0.48), 0 2px 6px rgba(0, 0, 0, 0.22), inset 0 1px 1px rgba(255, 255, 255, 0.6)'
                                                  : '0 6px 16px rgba(15, 23, 42, 0.1), 0 1px 3px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.98)',
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
                        </Animated.View>
                    );
                })}

                {/* Center Hub Trigger Button: Dead-center aligned with shake & spin micro-animation */}
                <Animated.View
                    style={[
                        styles.centerHubWrapper,
                        {
                            transform: [
                                {
                                    translateX: triggerShakeAnim.interpolate({
                                        inputRange: [0, 0.25, 0.5, 0.75, 1],
                                        outputRange: [0, -3, 3, -2, 0],
                                    }),
                                },
                                {
                                    rotate: triggerRotateAnim.interpolate({
                                        inputRange: [-1, 0],
                                        outputRange: ['-360deg', '0deg'],
                                    }),
                                },
                            ],
                        },
                    ]}
                >
                    <TouchableOpacity
                        style={[
                            styles.centerHubBtn,
                            Platform.OS === 'web'
                                ? ({
                                      backdropFilter: 'blur(28px) saturate(190%)',
                                      WebkitBackdropFilter: 'blur(28px) saturate(190%)',
                                      boxShadow: '0 4px 20px rgba(15, 23, 42, 0.38), inset 0 1px 1px rgba(255, 255, 255, 0.48)',
                                  } as any)
                                : undefined,
                        ]}
                        onPress={closeMenu}
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        accessibilityLabel="Collapse circular menu"
                    >
                        <Ionicons name="close" size={22} color="#ffffff" style={styles.centerHubCloseIcon} />
                    </TouchableOpacity>
                </Animated.View>
            </Animated.View>
        </>
    );
};

const styles = StyleSheet.create({
    // Collapsed Translucent Ball at Bottom-Left (Ultra HD Glassmorphism)
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
        backgroundColor: 'rgba(15, 23, 42, 0.88)',
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.42)',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.32,
        shadowRadius: 14,
        elevation: 9,
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
        top: (CONTAINER_SIZE - (RADIUS * 2 + 10)) / 2,
        left: (CONTAINER_SIZE - (RADIUS * 2 + 10)) / 2,
        width: RADIUS * 2 + 10,
        height: RADIUS * 2 + 10,
        borderRadius: RADIUS + 5,
        borderWidth: 1.5,
        borderColor: 'rgba(15, 23, 42, 0.08)',
        borderStyle: 'solid',
        backgroundColor: 'rgba(255, 255, 255, 0.72)',
    },

    // Center Hub Button Wrapper & Inner Button (100% Dead Centered)
    centerHubWrapper: {
        position: 'absolute',
        top: (CONTAINER_SIZE - CENTER_BTN_SIZE) / 2,
        left: (CONTAINER_SIZE - CENTER_BTN_SIZE) / 2,
        width: CENTER_BTN_SIZE,
        height: CENTER_BTN_SIZE,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
    },
    centerHubBtn: {
        width: CENTER_BTN_SIZE,
        height: CENTER_BTN_SIZE,
        borderRadius: CENTER_BTN_SIZE / 2,
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
    },
    centerHubCloseIcon: {
        textAlign: 'center',
        lineHeight: 22,
        alignSelf: 'center',
    },

    // Circular Node
    itemNode: {
        position: 'absolute',
        top: (CONTAINER_SIZE - BASE_ITEM_SIZE) / 2,
        left: (CONTAINER_SIZE - BASE_ITEM_SIZE) / 2,
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
