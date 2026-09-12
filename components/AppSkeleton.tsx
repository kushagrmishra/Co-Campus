import React, { useEffect, useRef } from 'react';
import {
    StyleSheet,
    View,
    Animated,
    Platform,
    StatusBar,
    ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

interface ShimmerBlockProps {
    width?: number | string;
    height: number;
    borderRadius?: number;
    style?: any;
    opacityAnim: Animated.Value;
    baseColor?: string;
}

const ShimmerBlock: React.FC<ShimmerBlockProps> = ({
    width = '100%',
    height,
    borderRadius = 6,
    style,
    opacityAnim,
    baseColor = '#e6e4df',
}) => {
    return (
        <Animated.View
            style={[
                {
                    width: width as any,
                    height,
                    borderRadius,
                    backgroundColor: baseColor,
                    opacity: opacityAnim,
                },
                style,
            ]}
        />
    );
};

export const AppSkeleton: React.FC = () => {
    const insets = useSafeAreaInsets();
    const shimmerAnim = useRef(new Animated.Value(0.4)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(shimmerAnim, {
                    toValue: 0.95,
                    duration: 850,
                    useNativeDriver: true,
                }),
                Animated.timing(shimmerAnim, {
                    toValue: 0.4,
                    duration: 850,
                    useNativeDriver: true,
                }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [shimmerAnim]);

    const topPadding =
        Platform.OS === 'android'
            ? Math.max(insets.top, StatusBar.currentHeight || 0, 16)
            : Math.max(insets.top, 12);
    const bottomPadding = Math.max(insets.bottom, Platform.OS === 'android' ? 20 : 16);

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#faf9f6" />
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[
                    styles.scrollContent,
                    {
                        paddingTop: topPadding + 8,
                        paddingBottom: bottomPadding + 90,
                    },
                ]}
                showsVerticalScrollIndicator={false}
                scrollEnabled={false}
            >
                <View style={styles.contentConstrained}>
                    {/* Header Row Skeleton */}
                    <View style={styles.headerRow}>
                        <View style={styles.headerLeft}>
                            {/* Avatar Circle */}
                            <ShimmerBlock
                                width={44}
                                height={44}
                                borderRadius={22}
                                opacityAnim={shimmerAnim}
                                baseColor="#dedcd6"
                            />
                            <View style={styles.headerTextGroup}>
                                <ShimmerBlock
                                    width={100}
                                    height={18}
                                    borderRadius={6}
                                    opacityAnim={shimmerAnim}
                                    baseColor="#dedcd6"
                                />
                                <ShimmerBlock
                                    width={140}
                                    height={12}
                                    borderRadius={4}
                                    opacityAnim={shimmerAnim}
                                    baseColor="#e6e4df"
                                    style={{ marginTop: 6 }}
                                />
                            </View>
                        </View>

                        {/* Term Pill */}
                        <ShimmerBlock
                            width={92}
                            height={34}
                            borderRadius={17}
                            opacityAnim={shimmerAnim}
                            baseColor="#dedcd6"
                        />
                    </View>

                    {/* Search Bar Skeleton */}
                    <View style={styles.searchBar}>
                        <View style={styles.searchIconPlaceholder}>
                            <Ionicons name="search-outline" size={18} color="#bcbaa0" />
                        </View>
                        <ShimmerBlock
                            width="60%"
                            height={14}
                            borderRadius={4}
                            opacityAnim={shimmerAnim}
                            baseColor="#dedcd6"
                        />
                        <View style={styles.searchFilterPlaceholder}>
                            <Ionicons name="options-outline" size={16} color="#bcbaa0" />
                        </View>
                    </View>

                    {/* Urgent Exam Card Skeleton */}
                    <View style={styles.urgentBannerCard}>
                        <View style={styles.urgentBannerTop}>
                            <View style={styles.urgentTagRow}>
                                <View style={styles.urgentDotPlaceholder} />
                                <ShimmerBlock
                                    width={110}
                                    height={12}
                                    borderRadius={4}
                                    opacityAnim={shimmerAnim}
                                    baseColor="#dedcd6"
                                />
                            </View>
                            <ShimmerBlock
                                width={75}
                                height={22}
                                borderRadius={11}
                                opacityAnim={shimmerAnim}
                                baseColor="#dedcd6"
                            />
                        </View>
                        <ShimmerBlock
                            width="80%"
                            height={18}
                            borderRadius={6}
                            opacityAnim={shimmerAnim}
                            baseColor="#dedcd6"
                            style={{ marginTop: 10 }}
                        />
                        <ShimmerBlock
                            width="50%"
                            height={12}
                            borderRadius={4}
                            opacityAnim={shimmerAnim}
                            baseColor="#e6e4df"
                            style={{ marginTop: 6 }}
                        />
                    </View>

                    {/* Section 1: Subject Folders Header */}
                    <View style={styles.sectionHeader}>
                        <ShimmerBlock
                            width={130}
                            height={20}
                            borderRadius={6}
                            opacityAnim={shimmerAnim}
                            baseColor="#dedcd6"
                        />
                        <ShimmerBlock
                            width={65}
                            height={28}
                            borderRadius={14}
                            opacityAnim={shimmerAnim}
                            baseColor="#dedcd6"
                        />
                    </View>

                    {/* 2x2 Folder Card Grid Skeleton */}
                    <View style={styles.folderGrid}>
                        {[0, 1, 2, 3].map((item) => (
                            <View key={`folder_skel_${item}`} style={styles.folderCard}>
                                <View style={styles.folderCardTop}>
                                    <ShimmerBlock
                                        width={36}
                                        height={36}
                                        borderRadius={10}
                                        opacityAnim={shimmerAnim}
                                        baseColor="#dedcd6"
                                    />
                                    <ShimmerBlock
                                        width={48}
                                        height={18}
                                        borderRadius={9}
                                        opacityAnim={shimmerAnim}
                                        baseColor="#dedcd6"
                                    />
                                </View>
                                <ShimmerBlock
                                    width="85%"
                                    height={15}
                                    borderRadius={5}
                                    opacityAnim={shimmerAnim}
                                    baseColor="#dedcd6"
                                    style={{ marginTop: 14 }}
                                />
                                <ShimmerBlock
                                    width="55%"
                                    height={11}
                                    borderRadius={4}
                                    opacityAnim={shimmerAnim}
                                    baseColor="#e6e4df"
                                    style={{ marginTop: 6 }}
                                />
                                <View style={styles.folderCardBottom}>
                                    <ShimmerBlock
                                        width={70}
                                        height={16}
                                        borderRadius={8}
                                        opacityAnim={shimmerAnim}
                                        baseColor="#dedcd6"
                                    />
                                </View>
                            </View>
                        ))}
                    </View>

                    {/* Section 2: Recent Notes Header */}
                    <View style={[styles.sectionHeader, { marginTop: 24 }]}>
                        <ShimmerBlock
                            width={110}
                            height={20}
                            borderRadius={6}
                            opacityAnim={shimmerAnim}
                            baseColor="#dedcd6"
                        />
                        <ShimmerBlock
                            width={50}
                            height={14}
                            borderRadius={4}
                            opacityAnim={shimmerAnim}
                            baseColor="#dedcd6"
                        />
                    </View>

                    {/* Recent Notes List Skeleton */}
                    <View style={styles.noteList}>
                        {[0, 1, 2].map((item) => (
                            <View key={`note_skel_${item}`} style={styles.noteItem}>
                                <ShimmerBlock
                                    width={44}
                                    height={44}
                                    borderRadius={12}
                                    opacityAnim={shimmerAnim}
                                    baseColor="#dedcd6"
                                />
                                <View style={styles.noteItemContent}>
                                    <ShimmerBlock
                                        width="75%"
                                        height={15}
                                        borderRadius={5}
                                        opacityAnim={shimmerAnim}
                                        baseColor="#dedcd6"
                                    />
                                    <ShimmerBlock
                                        width="45%"
                                        height={11}
                                        borderRadius={4}
                                        opacityAnim={shimmerAnim}
                                        baseColor="#e6e4df"
                                        style={{ marginTop: 6 }}
                                    />
                                </View>
                                <ShimmerBlock
                                    width={42}
                                    height={22}
                                    borderRadius={11}
                                    opacityAnim={shimmerAnim}
                                    baseColor="#dedcd6"
                                />
                            </View>
                        ))}
                    </View>
                </View>
            </ScrollView>

            {/* Bottom Floating Navigation Bar Skeleton */}
            <View
                style={[
                    styles.bottomBarWrap,
                    {
                        bottom: Math.max(insets.bottom, Platform.OS === 'android' ? 16 : 10) + 4,
                    },
                ]}
            >
                <View style={styles.bottomBarContainer}>
                    {[0, 1, 2, 3].map((tabIdx) => (
                        <View key={`tab_skel_${tabIdx}`} style={styles.bottomBarTab}>
                            <ShimmerBlock
                                width={24}
                                height={24}
                                borderRadius={12}
                                opacityAnim={shimmerAnim}
                                baseColor="#dedcd6"
                            />
                            <ShimmerBlock
                                width={36}
                                height={8}
                                borderRadius={4}
                                opacityAnim={shimmerAnim}
                                baseColor="#dedcd6"
                                style={{ marginTop: 5 }}
                            />
                        </View>
                    ))}
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#faf9f6',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 16,
    },
    contentConstrained: {
        width: '100%',
        maxWidth: 720,
        alignSelf: 'center',
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerTextGroup: {
        marginLeft: 12,
    },
    searchBar: {
        height: 48,
        backgroundColor: '#ffffff',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#e9e8e5',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        marginBottom: 16,
        shadowColor: '#182232',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
    },
    searchIconPlaceholder: {
        marginRight: 10,
        opacity: 0.5,
    },
    searchFilterPlaceholder: {
        marginLeft: 'auto',
        opacity: 0.5,
    },
    urgentBannerCard: {
        backgroundColor: '#ffffff',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#e5e3de',
        padding: 16,
        marginBottom: 20,
        shadowColor: '#182232',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 1,
    },
    urgentBannerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    urgentTagRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    urgentDotPlaceholder: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#bcbaa0',
        marginRight: 8,
        opacity: 0.5,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    folderGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginHorizontal: -4,
    },
    folderCard: {
        width: '48%',
        backgroundColor: '#ffffff',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e9e8e5',
        padding: 14,
        marginBottom: 10,
        marginHorizontal: '1%',
        shadowColor: '#182232',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
    },
    folderCardTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    folderCardBottom: {
        marginTop: 14,
        flexDirection: 'row',
        alignItems: 'center',
    },
    noteList: {
        marginTop: 4,
    },
    noteItem: {
        height: 72,
        backgroundColor: '#ffffff',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#e9e8e5',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        marginBottom: 10,
        shadowColor: '#182232',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1,
    },
    noteItemContent: {
        flex: 1,
        marginLeft: 12,
        marginRight: 8,
    },
    bottomBarWrap: {
        position: 'absolute',
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 50,
    },
    bottomBarContainer: {
        width: '92%',
        maxWidth: 420,
        height: 62,
        backgroundColor: 'rgba(255, 255, 255, 0.94)',
        borderRadius: 31,
        borderWidth: 1,
        borderColor: '#e5e3de',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingHorizontal: 12,
        shadowColor: '#182232',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 4,
    },
    bottomBarTab: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 6,
        paddingHorizontal: 8,
    },
});
