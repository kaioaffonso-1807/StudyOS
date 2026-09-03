import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from './supabase';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [signUp, setSignUp] = useState(false);

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

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>StudyOS · English AI</Text>
      <Text style={styles.title}>{signUp ? 'Create your account' : 'Welcome back'}</Text>
      <Text style={styles.muted}>Your progress and learning memory stay connected to your account.</Text>
      <TextInput value={email} onChangeText={setEmail} placeholder="Email" autoCapitalize="none" keyboardType="email-address" style={styles.input} />
      <TextInput value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry style={styles.input} />
      <Pressable style={styles.primary} onPress={submit} disabled={loading}><Text style={styles.primaryText}>{loading ? 'Please wait…' : signUp ? 'Create account' : 'Sign in'}</Text></Pressable>
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
