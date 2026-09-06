import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    StyleSheet,
    View,
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

    // 25-second auto-collapse timer
    const autoCollapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isOpenRef = useRef<boolean>(isOpen);
    isOpenRef.current = isOpen;

    const clearCollapseTimer = useCallback(() => {
        if (autoCollapseTimerRef.current) {
            clearTimeout(autoCollapseTimerRef.current);
            autoCollapseTimerRef.current = null;
        }
    }, []);

    // Close / minimize into bottom-left translucent ball
    const closeMenu = useCallback(() => {
        clearCollapseTimer();

        Animated.parallel([
            Animated.timing(openAnim, {
                toValue: 0,
                duration: 220,
                useNativeDriver: true,
            }),
            Animated.spring(ballAnim, {
                toValue: 1,
                bounciness: 6,
                speed: 16,
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

        // Schedule 25-second auto-collapse
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

    // Rotate to target item
    const rotateToItem = useCallback(
        (targetIndex: number, shouldTriggerPress = true) => {
            resetCollapseTimer();
            const boundedIndex = ((targetIndex % TOTAL_ITEMS) + TOTAL_ITEMS) % TOTAL_ITEMS;
            activeIndexRef.current = boundedIndex;

            // Target rotation so item boundedIndex is at apex (-Math.PI / 2)
            // Current angle normalized: find closest multiple of STEP_ANGLE
            const curVal = currentAngleVal.current;
            const targetOffset = -boundedIndex * STEP_ANGLE;
            // Find k such that targetOffset + 2*PI*k is closest to curVal
            const diff = targetOffset - curVal;
            const k = Math.round(diff / (2 * Math.PI));
            const nearestAngle = targetOffset - k * (2 * Math.PI);

            Animated.spring(rotationAngle, {
                toValue: nearestAngle,
                bounciness: 6,
                speed: 16,
                useNativeDriver: true,
            }).start(() => {
                if (shouldTriggerPress) {
                    items[boundedIndex]?.onPress();
                }
            });
        },
        [items, resetCollapseTimer, rotationAngle]
    );

    // Sync rotation on external active tab change
    useEffect(() => {
        if (activeTabId) {
            const idx = items.findIndex((i) => i.id === activeTabId);
            if (idx !== -1 && idx !== activeIndexRef.current) {
                rotateToItem(idx, false);
            }
        }
    }, [activeTabId, items, rotateToItem]);

    // PanResponder for spinning / scrolling the circular wheel
    const panStartAngle = useRef<number>(0);
    const panStartRotation = useRef<number>(0);
    const centerCoords = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const circleContainerRef = useRef<View>(null);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_evt, gestureState) => {
                return (
                    Math.abs(gestureState.dx) > 4 || Math.abs(gestureState.dy) > 4
                );
            },
            onPanResponderGrant: (evt) => {
                resetCollapseTimer();
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
                // When rotation stops, calculate which item is closest to the apex (-PI/2)
                // Position of item i is: -PI/2 + i * STEP + rotation
                // Apex is when -PI/2 + i * STEP + rotation = -PI/2 (mod 2*PI)
                // i.e., i * STEP + rotation = 0 (mod 2*PI)
                // i = -rotation / STEP
                const currentRot = currentAngleVal.current;
                const rawIdx = -currentRot / STEP_ANGLE;
                const nearestIdx = Math.round(rawIdx);
                rotateToItem(nearestIdx, true); // Opens that page automatically!
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
                                  backdropFilter: 'blur(16px)',
                                  WebkitBackdropFilter: 'blur(16px)',
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
                              filter: 'url(#shadowed-goo)',
                              WebkitFilter: 'url(#shadowed-goo)',
                          } as any)
                        : undefined,
                ]}
                pointerEvents={isOpen ? 'box-none' : 'none'}
                {...panResponder.panHandlers}
            >
                {/* Subtle Rotary Dial Guide Ring */}
                <View style={styles.rotaryGuideTrack} pointerEvents="none" />

                {/* Circular Navigation Nodes distributed evenly around the 360° circle */}
                {items.map((item, index) => {
                    // Angle for item index at current rotation
                    // -Math.PI / 2 is the apex (12 o'clock / top position)
                    const theta = -Math.PI / 2 + index * STEP_ANGLE + renderAngle;
                    const x = RADIUS * Math.cos(theta);
                    const y = RADIUS * Math.sin(theta);

                    // Distance from apex (-Math.PI / 2)
                    let angleDiff = Math.abs((theta % (2 * Math.PI)) - (-Math.PI / 2));
                    if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;

                    // Centered/active item is BIG (1.28x), others are small (0.82x)
                    const isApex = angleDiff < 0.45;
                    const scale = isApex ? 1.28 : 0.82;
                    const isScan = item.isAccent;
                    const isCurrentActive = isApex || item.isActive;

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
                                        : isCurrentActive
                                        ? styles.itemBubbleActive
                                        : styles.itemBubbleInactive,
                                ]}
                                onPress={() => rotateToItem(index, true)}
                                activeOpacity={0.82}
                                accessibilityRole="button"
                                accessibilityLabel={item.label}
                            >
                                <Ionicons
                                    name={
                                        isCurrentActive && item.activeIcon
                                            ? item.activeIcon
                                            : item.icon
                                    }
                                    size={isScan ? 24 : isApex ? 22 : 19}
                                    color={
                                        isScan || isCurrentActive
                                            ? '#ffffff'
                                            : '#475569'
                                    }
                                />

                                {/* Active Tab Dot */}
                                {isCurrentActive && !isScan && (
                                    <View style={styles.activeDot} />
                                )}
                            </TouchableOpacity>
                        </View>
                    );
                })}

                {/* Center Hub Trigger Button: Tap to collapse into small ball */}
                <TouchableOpacity
                    style={styles.centerHubBtn}
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
        backgroundColor: 'rgba(15, 23, 42, 0.78)',
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.38)',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.32,
        shadowRadius: 10,
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
        borderWidth: 1,
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
        backgroundColor: 'rgba(255, 255, 255, 0.65)',
    },

    // Center Hub Button
    centerHubBtn: {
        position: 'absolute',
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(15, 23, 42, 0.88)',
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.42)',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
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
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 6,
    },
    itemBubbleInactive: {
        backgroundColor: 'rgba(255, 255, 255, 0.94)',
        borderWidth: 1,
        borderColor: 'rgba(226, 232, 240, 0.9)',
    },
    itemBubbleActive: {
        backgroundColor: 'rgba(15, 23, 42, 0.92)',
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.45)',
        shadowColor: '#182232',
        shadowOpacity: 0.42,
        shadowRadius: 10,
    },
    itemBubbleScan: {
        backgroundColor: '#10b981',
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.55)',
        shadowColor: '#10b981',
        shadowOpacity: 0.48,
        shadowRadius: 10,
    },
    activeDot: {
        position: 'absolute',
        bottom: 4,
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#22c55e',
    },
});
