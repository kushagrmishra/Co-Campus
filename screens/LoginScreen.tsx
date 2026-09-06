import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TextInput,
    TouchableOpacity,
    StatusBar,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppSkeleton } from '../components/AppSkeleton';

export const AUTH_STORAGE_KEY = '@cocampus_auth_user';

interface LoginScreenProps {
    onLoginSuccess: (username: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
    const insets = useSafeAreaInsets();
    const topPadding = Platform.OS === 'android' ? Math.max(insets.top, StatusBar.currentHeight || 0, 16) : Math.max(insets.top, 12);
    const bottomPadding = Math.max(insets.bottom, Platform.OS === 'android' ? 16 : 12);

    const [username, setUsername] = useState<string>('kushagr');
    const [password, setPassword] = useState<string>('user1');
    const [showPassword, setShowPassword] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(false);

    const handleLogin = async () => {
        setErrorMessage(null);
        const trimmedUser = username.trim().toLowerCase();
        const trimmedPass = password.trim();

        if (!trimmedUser || !trimmedPass) {
            setErrorMessage('Please enter both username and password.');
            return;
        }

        setLoading(true);

        setTimeout(async () => {
            if (trimmedUser === 'kushagr' && trimmedPass === 'user1') {
                try {
                    await AsyncStorage.setItem(AUTH_STORAGE_KEY, 'kushagr');
                } catch (e) {
                    console.warn('Failed to save auth state:', e);
                }
                setLoading(false);
                onLoginSuccess('kushagr');
            } else {
                setLoading(false);
                setErrorMessage('Invalid username or password. Please use kushagr / user1.');
            }
        }, 500);
    };

    if (loading) {
        return <AppSkeleton />;
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#faf9f6" />
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <ScrollView
                    contentContainerStyle={[
                        styles.scrollWrap,
                        { paddingTop: topPadding + 10, paddingBottom: bottomPadding + 20 },
                    ]}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                <View style={styles.contentWrap}>
                    {/* Brand Header */}
                    <View style={styles.brandHeader}>
                        <View style={styles.brandIconBox}>
                            <Ionicons name="school-outline" size={32} color="#182232" />
                        </View>
                        <Text style={styles.brandTitle}>cocampus</Text>
                        <Text style={styles.brandSubtitle}>Academic Sanctuary & Study Intelligence</Text>
                    </View>

                    {/* Login Card */}
                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                            <Text style={styles.cardHeading}>Sign In to Library</Text>
                            <Text style={styles.cardSubtext}>Access your lecture notes, syllabus, and study decks.</Text>
                        </View>

                        {errorMessage && (
                            <View style={styles.errorBanner}>
                                <Ionicons name="alert-circle-outline" size={18} color="#ba1a1a" />
                                <Text style={styles.errorText}>{errorMessage}</Text>
                            </View>
                        )}

                        {/* Username Field */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Username</Text>
                            <View style={styles.inputWrapper}>
                                <Ionicons name="person-outline" size={18} color="#75777d" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Enter username (kushagr)"
                                    placeholderTextColor="#a0a2a8"
                                    value={username}
                                    onChangeText={setUsername}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                />
                            </View>
                        </View>

                        {/* Password Field */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Password</Text>
                            <View style={styles.inputWrapper}>
                                <Ionicons name="lock-closed-outline" size={18} color="#75777d" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Enter password (user1)"
                                    placeholderTextColor="#a0a2a8"
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry={!showPassword}
                                    autoCapitalize="none"
                                />
                                <TouchableOpacity
                                    onPress={() => setShowPassword(!showPassword)}
                                    style={styles.eyeBtn}
                                >
                                    <Ionicons
                                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                                        size={18}
                                        color="#75777d"
                                    />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Sign In Button */}
                        <TouchableOpacity
                            style={styles.signInBtn}
                            onPress={handleLogin}
                            disabled={loading}
                            activeOpacity={0.9}
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color="#ffffff" />
                            ) : (
                                <>
                                    <Text style={styles.signInBtnText}>Sign In</Text>
                                    <Ionicons name="arrow-forward" size={16} color="#ffffff" />
                                </>
                            )}
                        </TouchableOpacity>

                        {/* Quiet Credentials Helper */}
                        <View style={styles.credentialPill}>
                            <Ionicons name="key-outline" size={14} color="#4b6456" />
                            <Text style={styles.credentialPillText}>
                                Authorized login: <Text style={styles.boldText}>kushagr</Text> • Password: <Text style={styles.boldText}>user1</Text>
                            </Text>
                        </View>
                    </View>

                    {/* Footer Note */}
                    <View style={styles.footerWrap}>
                        <Ionicons name="shield-checkmark-outline" size={14} color="#75777d" />
                        <Text style={styles.footerText}>Secure University Cloud Sync & Offline Storage</Text>
                    </View>
                </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#faf9f6',
    },
    keyboardView: {
        flex: 1,
    },
    scrollWrap: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    contentWrap: {
        width: '100%',
        maxWidth: 440,
        alignSelf: 'center',
        paddingVertical: 16,
    },
    brandHeader: {
        alignItems: 'center',
        marginBottom: 28,
    },
    brandIconBox: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#efeeeb',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#e3e2df',
    },
    brandTitle: {
        fontSize: 32,
        fontWeight: '800',
        color: '#182232',
        letterSpacing: -0.5,
    },
    brandSubtitle: {
        fontSize: 14,
        color: '#4b6456',
        marginTop: 4,
        fontWeight: '500',
    },
    card: {
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 24,
        borderWidth: 1,
        borderColor: '#e9e8e5',
        shadowColor: '#182232',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 16,
        elevation: 2,
    },
    cardHeader: {
        marginBottom: 20,
    },
    cardHeading: {
        fontSize: 20,
        fontWeight: '700',
        color: '#182232',
    },
    cardSubtext: {
        fontSize: 13,
        color: '#75777d',
        marginTop: 4,
        lineHeight: 18,
    },
    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#ffdad6',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 16,
    },
    errorText: {
        flex: 1,
        fontSize: 12,
        color: '#93000a',
        fontWeight: '600',
    },
    inputGroup: {
        marginBottom: 16,
    },
    inputLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#45474c',
        marginBottom: 6,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f4f3f0',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e3e2df',
        paddingHorizontal: 12,
        height: 48,
    },
    inputIcon: {
        marginRight: 8,
    },
    input: {
        flex: 1,
        fontSize: 15,
        color: '#182232',
        height: '100%',
    },
    eyeBtn: {
        padding: 6,
    },
    signInBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#182232',
        borderRadius: 14,
        height: 50,
        marginTop: 10,
        shadowColor: '#182232',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 3,
    },
    signInBtnText: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    credentialPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#cde9d8',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginTop: 18,
    },
    credentialPillText: {
        fontSize: 12,
        color: '#082015',
    },
    boldText: {
        fontWeight: '700',
    },
    footerWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginTop: 24,
    },
    footerText: {
        fontSize: 12,
        color: '#75777d',
    },
});
