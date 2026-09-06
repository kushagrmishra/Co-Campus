import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    Animated,
    Platform,
    Pressable,
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
    bottomInset?: number;
    leftInset?: number;
    autoCollapseMs?: number; // 25 seconds default
    initialOpen?: boolean;
    onOpenChange?: (isOpen: boolean) => void;
}

const CONSTANTS = {
    itemSize: 48,
    triggerSize: 52,
    radius: 125,
    openStagger: 35, // ms stagger between items expanding
    closeStagger: 30, // ms stagger between items collapsing
    autoCollapseMs: 25000, // 25 seconds
};

// Corner arc placement (bottom-left quadrant fanning into the screen)
const pointOnArc = (index: number, total: number, radius: number) => {
    // theta from 0 (horizontal right along bottom) to PI/2 (straight up along left)
    const minAngle = 0.05; // ~3 deg off bottom
    const maxAngle = Math.PI / 2 - 0.05; // ~87 deg off horizontal
    const step = (maxAngle - minAngle) / Math.max(total - 1, 1);
    const theta = minAngle + index * step;
    const x = radius * Math.cos(theta);
    const y = -radius * Math.sin(theta); // negative y moves UP in screen coordinates
    return { x, y };
};

export const CircleMenu: React.FC<CircleMenuProps> = ({
    items,
    bottomInset = 0,
    leftInset = 0,
    autoCollapseMs = CONSTANTS.autoCollapseMs,
    initialOpen = true,
    onOpenChange,
}) => {
    const [isOpen, setIsOpen] = useState<boolean>(initialOpen);
    const [activeHoverId, setActiveHoverId] = useState<string | null>(null);

    // Animated values for each item (0 = collapsed at origin, 1 = expanded at arc pos)
    const itemAnims = useRef<Animated.Value[]>(
        items.map(() => new Animated.Value(initialOpen ? 1 : 0))
    ).current;

    // Trigger animations: shake, scale, rotate
    const triggerShake = useRef(new Animated.Value(0)).current;
    const triggerScale = useRef(new Animated.Value(1)).current;
    const triggerRotate = useRef(new Animated.Value(initialOpen ? 1 : 0)).current;
    const triggerOpacity = useRef(new Animated.Value(initialOpen ? 1 : 0.85)).current;

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

    const playShakeAnimation = useCallback(() => {
        Animated.sequence([
            Animated.timing(triggerShake, { toValue: 3, duration: 40, useNativeDriver: true }),
            Animated.timing(triggerShake, { toValue: -3, duration: 40, useNativeDriver: true }),
            Animated.timing(triggerShake, { toValue: 2, duration: 40, useNativeDriver: true }),
            Animated.timing(triggerShake, { toValue: -2, duration: 40, useNativeDriver: true }),
            Animated.timing(triggerShake, { toValue: 0, duration: 40, useNativeDriver: true }),
        ]).start();
    }, [triggerShake]);

    // Close animation with staggered sucking back into the translucent ball
    const closeMenu = useCallback(() => {
        clearCollapseTimer();
        playShakeAnimation();

        // Trigger pulse and rotation
        Animated.parallel([
            Animated.sequence([
                Animated.timing(triggerScale, { toValue: 1.15, duration: 100, useNativeDriver: true }),
                Animated.timing(triggerScale, { toValue: 1, duration: 150, useNativeDriver: true }),
            ]),
            Animated.timing(triggerRotate, { toValue: 0, duration: 250, useNativeDriver: true }),
            Animated.timing(triggerOpacity, { toValue: 0.82, duration: 250, useNativeDriver: true }),
        ]).start();

        // Staggered collapse back to (0, 0)
        items.forEach((_, idx) => {
            const reverseIdx = items.length - 1 - idx;
            setTimeout(() => {
                Animated.spring(itemAnims[reverseIdx], {
                    toValue: 0,
                    bounciness: 5,
                    speed: 18,
                    useNativeDriver: true,
                }).start();
            }, idx * CONSTANTS.closeStagger);
        });

        setIsOpen(false);
        onOpenChange?.(false);
    }, [clearCollapseTimer, items, itemAnims, onOpenChange, playShakeAnimation, triggerOpacity, triggerRotate, triggerScale]);

    // Open animation with staggered liquid pop-out
    const openMenu = useCallback(() => {
        clearCollapseTimer();

        // Trigger pulse and rotation
        Animated.parallel([
            Animated.sequence([
                Animated.timing(triggerScale, { toValue: 0.9, duration: 80, useNativeDriver: true }),
                Animated.timing(triggerScale, { toValue: 1.08, duration: 120, useNativeDriver: true }),
                Animated.timing(triggerScale, { toValue: 1, duration: 100, useNativeDriver: true }),
            ]),
            Animated.timing(triggerRotate, { toValue: 1, duration: 280, useNativeDriver: true }),
            Animated.timing(triggerOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        ]).start();

        // Staggered spring expansion
        items.forEach((_, idx) => {
            setTimeout(() => {
                Animated.spring(itemAnims[idx], {
                    toValue: 1,
                    bounciness: 8,
                    speed: 16,
                    useNativeDriver: true,
                }).start();
            }, idx * CONSTANTS.openStagger);
        });

        setIsOpen(true);
        onOpenChange?.(true);

        // Schedule 25-second auto-collapse
        autoCollapseTimerRef.current = setTimeout(() => {
            closeMenu();
        }, autoCollapseMs);
    }, [autoCollapseMs, clearCollapseTimer, closeMenu, items, itemAnims, onOpenChange, triggerOpacity, triggerRotate, triggerScale]);

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
        if (initialOpen) {
            autoCollapseTimerRef.current = setTimeout(() => {
                closeMenu();
            }, autoCollapseMs);
        }
        return () => {
            clearCollapseTimer();
        };
    }, [autoCollapseMs, clearCollapseTimer, closeMenu, initialOpen]);

    const handleTriggerPress = () => {
        if (isOpen) {
            closeMenu();
        } else {
            openMenu();
        }
    };

    const handleItemPress = (item: CircleMenuItem) => {
        resetCollapseTimer();
        item.onPress();
    };

    // Rotation interpolation for trigger icon
    const triggerSpin = triggerRotate.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '90deg'],
    });

    const triggerContainerPos = {
        bottom: Math.max(bottomInset, Platform.OS === 'android' ? 18 : 14) + 12,
        left: Math.max(leftInset, 18),
    };

    return (
        <View
            style={[
                styles.wrapper,
                triggerContainerPos,
                // Apply SVG Gooey Filter on Web to make circular child blobs merge liquidly
                Platform.OS === 'web'
                    ? ({
                          filter: 'url(#shadowed-goo)',
                          WebkitFilter: 'url(#shadowed-goo)',
                      } as any)
                    : undefined,
            ]}
            pointerEvents="box-none"
        >
            {/* Circular Menu Items expanding out on the arc */}
            {items.map((item, index) => {
                const { x: targetX, y: targetY } = pointOnArc(index, items.length, CONSTANTS.radius);
                const anim = itemAnims[index];

                const translateX = anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, targetX],
                });

                const translateY = anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, targetY],
                });

                const scale = anim.interpolate({
                    inputRange: [0, 0.4, 1],
                    outputRange: [0.35, 0.7, 1],
                });

                const opacity = anim.interpolate({
                    inputRange: [0, 0.2, 1],
                    outputRange: [0, 0.8, 1],
                });

                const isItemActive = item.isActive;
                const isScan = item.isAccent;

                return (
                    <Animated.View
                        key={`circle-item-${item.id}`}
                        style={[
                            styles.itemNode,
                            {
                                opacity,
                                transform: [
                                    { translateX },
                                    { translateY },
                                    { scale },
                                ],
                            },
                        ]}
                        pointerEvents={isOpen ? 'auto' : 'none'}
                    >
                        <Pressable
                            onPress={() => handleItemPress(item)}
                            onHoverIn={() => setActiveHoverId(item.id)}
                            onHoverOut={() => setActiveHoverId(null)}
                            style={({ pressed }) => [
                                styles.itemButton,
                                isItemActive && styles.itemButtonActive,
                                isScan && styles.itemButtonScan,
                                pressed && styles.itemButtonPressed,
                            ]}
                            accessibilityRole="button"
                            accessibilityLabel={item.label}
                        >
                            <Ionicons
                                name={
                                    isItemActive && item.activeIcon
                                        ? item.activeIcon
                                        : item.icon
                                }
                                size={isScan ? 22 : 20}
                                color={
                                    isScan
                                        ? '#ffffff'
                                        : isItemActive
                                        ? '#ffffff'
                                        : '#2d3748'
                                }
                            />

                            {/* Active Tab Dot */}
                            {isItemActive && !isScan && (
                                <View style={styles.activeDot} />
                            )}
                        </Pressable>

                        {/* Floating Tooltip Label (visible on hover or when active) */}
                        {(isOpen && (activeHoverId === item.id || isItemActive)) && (
                            <View style={styles.labelPill} pointerEvents="none">
                                <Text style={styles.labelText}>{item.label}</Text>
                            </View>
                        )}
                    </Animated.View>
                );
            })}

            {/* Main Translucent Trigger Ball sitting at bottom-left */}
            <Animated.View
                style={[
                    styles.triggerNode,
                    {
                        transform: [
                            { translateX: triggerShake },
                            { scale: triggerScale },
                        ],
                        opacity: triggerOpacity,
                    },
                ]}
            >
                <TouchableOpacity
                    style={[
                        styles.triggerButton,
                        isOpen ? styles.triggerButtonOpen : styles.triggerButtonCollapsed,
                    ]}
                    onPress={handleTriggerPress}
                    activeOpacity={0.82}
                    accessibilityRole="button"
                    accessibilityLabel={isOpen ? 'Collapse navigation menu' : 'Expand navigation menu'}
                >
                    <Animated.View style={{ transform: [{ rotate: triggerSpin }] }}>
                        <Ionicons
                            name={isOpen ? 'close' : 'compass'}
                            size={22}
                            color="#ffffff"
                        />
                    </Animated.View>
                </TouchableOpacity>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        position: 'absolute',
        width: CONSTANTS.triggerSize,
        height: CONSTANTS.triggerSize,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
    },
    triggerNode: {
        width: CONSTANTS.triggerSize,
        height: CONSTANTS.triggerSize,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
    },
    triggerButton: {
        width: CONSTANTS.triggerSize,
        height: CONSTANTS.triggerSize,
        borderRadius: CONSTANTS.triggerSize / 2,
        alignItems: 'center',
        justifyContent: 'center',
        // Translucent liquid styling
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.28,
        shadowRadius: 8,
        elevation: 8,
    },
    triggerButtonCollapsed: {
        backgroundColor: 'rgba(24, 34, 50, 0.82)',
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.28)',
    },
    triggerButtonOpen: {
        backgroundColor: '#182232',
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.4)',
    },
    itemNode: {
        position: 'absolute',
        width: CONSTANTS.itemSize,
        height: CONSTANTS.itemSize,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 90,
    },
    itemButton: {
        width: CONSTANTS.itemSize,
        height: CONSTANTS.itemSize,
        borderRadius: CONSTANTS.itemSize / 2,
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.16,
        shadowRadius: 6,
        elevation: 6,
    },
    itemButtonActive: {
        backgroundColor: '#182232',
        borderColor: '#0f172a',
        shadowColor: '#182232',
        shadowOpacity: 0.32,
        shadowRadius: 8,
    },
    itemButtonScan: {
        backgroundColor: '#1e7e45',
        borderColor: '#166534',
        shadowColor: '#1e7e45',
        shadowOpacity: 0.4,
        shadowRadius: 8,
    },
    itemButtonPressed: {
        transform: [{ scale: 0.94 }],
    },
    activeDot: {
        position: 'absolute',
        bottom: 5,
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#22c55e',
    },
    labelPill: {
        position: 'absolute',
        bottom: -22,
        backgroundColor: 'rgba(15, 23, 42, 0.88)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    labelText: {
        color: '#ffffff',
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 0.2,
    },
});
