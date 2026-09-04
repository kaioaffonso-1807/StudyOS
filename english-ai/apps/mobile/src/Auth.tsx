import React, { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from './supabase';

type AuthProps = { onRecoveryStart?: () => void; onRecoveryComplete?: () => void };

function parseAuthCallback(url: string) {
  const [base, hash = ''] = url.split('#', 2);
  const query = base.includes('?') ? base.split('?')[1] : '';
  const params = new URLSearchParams(`${query}&${hash}`);
  return {
    accessToken: params.get('access_token'),
    refreshToken: params.get('refresh_token'),
    type: params.get('type'),
    error: params.get('error_description') ?? params.get('error_code'),
  };
}

export default function Auth({ onRecoveryStart, onRecoveryComplete }: AuthProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [signUp, setSignUp] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    const handleUrl = async (url: string) => {
      const callback = parseAuthCallback(url);
      if (callback.error) {
        Alert.alert('Recovery error', callback.error);
        return;
      }
      if (callback.accessToken && callback.refreshToken && callback.type === 'recovery') {
        onRecoveryStart?.();
        const { error } = await client.auth.setSession({
          access_token: callback.accessToken,
          refresh_token: callback.refreshToken,
        });
        if (error) Alert.alert('Recovery error', error.message);
        else setRecovery(true);
      }
    };
    Linking.getInitialURL().then((url) => { if (url) void handleUrl(url); });
    const subscription = Linking.addEventListener('url', ({ url }) => { void handleUrl(url); });
    return () => subscription.remove();
  }, [onRecoveryStart]);

  const submit = async () => {
    if (!supabase) {
      Alert.alert('Configuration required', 'Configure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.');
      return;
    }
    if (!email.trim() || password.length < 6) {
      Alert.alert('Invalid data', 'Enter a valid email and a password with at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      const result = signUp
        ? await supabase.auth.signUp({ email: email.trim(), password })
        : await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (result.error) throw result.error;
      if (signUp && !result.data.session) Alert.alert('Check your email', 'Confirm your email before signing in.');
    } catch (error: any) {
      Alert.alert('Authentication error', error?.message ?? 'Unable to authenticate.');
    } finally {
      setLoading(false);
    }
  };

  const sendReset = async () => {
    if (!supabase || !email.trim()) {
      Alert.alert('Email required', 'Enter your account email first.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: 'studyos://auth/reset',
      });
      if (error) throw error;
      Alert.alert('Check your email', 'We sent a password recovery link to your email.');
      setResetting(false);
    } catch (error: any) {
      Alert.alert('Recovery error', error?.message ?? 'Unable to send the recovery email.');
    } finally {
      setLoading(false);
    }
  };

  const updatePassword = async () => {
    if (!supabase || password.length < 6) {
      Alert.alert('Invalid password', 'Use at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      Alert.alert('Password updated', 'Your password has been changed.');
      setRecovery(false);
      setPassword('');
      onRecoveryComplete?.();
    } catch (error: any) {
      Alert.alert('Update error', error?.message ?? 'Unable to update your password.');
    } finally {
      setLoading(false);
    }
  };

  if (recovery) return (
    <View style={styles.container}>
      <Text style={styles.logo}>StudyOS · English AI</Text>
      <Text style={styles.title}>Choose a new password</Text>
      <Text style={styles.muted}>Your recovery link is active. Set a new password to continue.</Text>
      <TextInput value={password} onChangeText={setPassword} placeholder="New password" secureTextEntry style={styles.input} />
      <Pressable style={styles.primary} onPress={updatePassword} disabled={loading}><Text style={styles.primaryText}>{loading ? 'Please wait…' : 'Update password'}</Text></Pressable>
    </View>
  );

  if (resetting) return (
    <View style={styles.container}>
      <Text style={styles.logo}>StudyOS · English AI</Text>
      <Text style={styles.title}>Reset your password</Text>
      <Text style={styles.muted}>Enter your account email and we will send you a secure recovery link.</Text>
      <TextInput value={email} onChangeText={setEmail} placeholder="Email" autoCapitalize="none" keyboardType="email-address" style={styles.input} />
      <Pressable style={styles.primary} onPress={sendReset} disabled={loading}><Text style={styles.primaryText}>{loading ? 'Sending…' : 'Send recovery link'}</Text></Pressable>
      <Pressable style={styles.link} onPress={() => setResetting(false)}><Text>Back to sign in</Text></Pressable>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>StudyOS · English AI</Text>
      <Text style={styles.title}>{signUp ? 'Create your account' : 'Welcome back'}</Text>
      <Text style={styles.muted}>Your progress and learning memory stay connected to your account.</Text>
      <TextInput value={email} onChangeText={setEmail} placeholder="Email" autoCapitalize="none" keyboardType="email-address" style={styles.input} />
      <TextInput value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry style={styles.input} />
      <Pressable style={styles.primary} onPress={submit} disabled={loading}><Text style={styles.primaryText}>{loading ? 'Please wait…' : signUp ? 'Create account' : 'Sign in'}</Text></Pressable>
      {!signUp && <Pressable style={styles.link} onPress={() => setResetting(true)}><Text>Forgot your password?</Text></Pressable>}
      <Pressable style={styles.link} onPress={() => setSignUp((value) => !value)}><Text>{signUp ? 'Already have an account? Sign in' : 'New here? Create an account'}</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12, backgroundColor: '#f5f7fb' },
  logo: { fontSize: 20, fontWeight: '800', marginBottom: 24 },
  title: { fontSize: 30, fontWeight: '800' },
  muted: { color: '#667386', lineHeight: 21, marginBottom: 10 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d9dfe8', borderRadius: 12, padding: 14 },
  primary: { backgroundColor: '#17202a', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 4 },
  primaryText: { color: '#fff', fontWeight: '700' },
  link: { padding: 12, alignItems: 'center' },
});
