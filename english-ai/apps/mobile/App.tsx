import React, { useCallback, useEffect, useState } from 'react';
import { SafeAreaView, View, Text, Pressable, TextInput, StyleSheet, ScrollView } from 'react-native';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import Auth from './src/Auth';
import Billing from './src/Billing';
import { supabase } from './src/supabase';

type Screen = 'home' | 'placement' | 'speak' | 'progress' | 'account';
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';
type ChatMessage = { role: 'ai' | 'user'; text: string };
type DailyLesson = { title: string; level: string; minutes: number; primarySkill: string; focus: string; reason: string; activities: Array<{ id: string; type: string; title: string; skill: string; minutes: number; instruction: string }> };
type Progress = { scores: Record<string, number>; overall: number; cefrLevel: string; nextLevel: string | null };

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [screen, setScreen] = useState<Screen>('home');
  const [level, setLevel] = useState('A1');
  const [reply, setReply] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'ai', text: 'Hi! 👋 How was your day?' }]);
  const [mistake, setMistake] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recordingError, setRecordingError] = useState('');
  const [lesson, setLesson] = useState<DailyLesson | null>(null);
  const [lessonError, setLessonError] = useState('');
  const [progress, setProgress] = useState<Progress | null>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);

  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthLoading(false); });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => data.subscription.unsubscribe();
  }, []);

  const apiFetch = useCallback(async (path: string, init: RequestInit = {}) => {
    const token = session?.access_token;
    const headers = new Headers(init.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
    return fetch(`${API_URL}${path}`, { ...init, headers });
  }, [session?.access_token]);

  const loadProgress = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      const response = await apiFetch(`/api/v1/users/${session.user.id}/progress`);
      if (!response.ok) return;
      const data = await response.json();
      setProgress(data.progress);
      if (data.progress?.cefrLevel) setLevel(data.progress.cefrLevel);
    } catch { /* Keep the current UI state if the API is unavailable. */ }
  }, [apiFetch, session?.user?.id]);

  const loadLesson = useCallback(async () => {
    if (!session?.user?.id) return;
    setLessonError('');
    try {
      const response = await apiFetch(`/api/v1/users/${session.user.id}/lesson/today?minutes=10`);
      if (!response.ok) throw new Error('Lesson API error');
      const data = await response.json();
      setLesson(data.lesson);
      if (data.progress) setProgress(data.progress);
    } catch { setLessonError('Could not load your personalized lesson.'); }
  }, [apiFetch, session?.user?.id]);

  useEffect(() => {
    if (!session) return;
    AudioModule.requestRecordingPermissionsAsync().then(async (permission) => {
      if (permission.granted) await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    }).catch(() => undefined);
    void loadProgress();
    void loadLesson();
  }, [session?.user?.id, loadProgress, loadLesson]);

  const handleRecoveryStart = useCallback(() => setRecoveryMode(true), []);
  const handleRecoveryComplete = useCallback(() => setRecoveryMode(false), []);

  const send = async () => {
    const value = reply.trim();
    if (!value || loading || !session) return;
    setMessages((m) => [...m, { role: 'user', text: value }]); setReply(''); setLoading(true);
    try {
      const response = await apiFetch('/api/v1/conversations', { method: 'POST', body: JSON.stringify({ message: value, level }) });
      if (!response.ok) throw new Error('API error');
      const data = await response.json();
      setMessages((m) => [...m, { role: 'ai', text: data.reply }]); setMistake(Boolean(data.correction));
      if (data.progress) setProgress(data.progress);
      void loadLesson();
    } catch { setMessages((m) => [...m, { role: 'ai', text: 'I could not reach the learning server. Check your API connection and try again.' }]); }
    finally { setLoading(false); }
  };

  const savePlacement = async () => {
    if (!session) return;
    const scoreByLevel: Record<string, number> = { A1: 20, A2: 40, B1: 60, B2: 80, C1: 95 };
    try {
      const response = await apiFetch('/api/v1/placement/submit', { method: 'POST', body: JSON.stringify({ score: scoreByLevel[level] }) });
      if (!response.ok) throw new Error('Placement error');
      await loadProgress();
      await loadLesson();
      setScreen('home');
    } catch { setLessonError('Could not save your placement.'); }
  };

  const startRecording = async () => {
    setRecordingError('');
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) { setRecordingError('Microphone permission is required.'); return; }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch { setRecordingError('Could not start the microphone.'); }
  };

  const stopRecording = async () => {
    if (!recorderState.isRecording || !session) return;
    setLoading(true); setRecordingError('');
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) throw new Error('Recording URI unavailable');
      const form = new FormData();
      form.append('file', { uri, name: 'speech.m4a', type: 'audio/m4a' } as any);
      form.append('level', level);
      const response = await apiFetch('/api/v1/voice/turn', { method: 'POST', body: form });
      if (!response.ok) throw new Error('Voice API error');
      const data = await response.json();
      if (data.transcript) setMessages((m) => [...m, { role: 'user', text: data.transcript }]);
      if (data.reply) setMessages((m) => [...m, { role: 'ai', text: data.reply }]);
      setMistake(Boolean(data.correction));
      if (data.progress) setProgress(data.progress);
      void loadLesson();
    } catch { setRecordingError('Voice processing failed. Check the API connection and try again.'); }
    finally { setLoading(false); }
  };

  if (authLoading) return <SafeAreaView style={styles.safe}><View style={styles.authLoading}><Text style={styles.logo}>StudyOS · English AI</Text><Text style={styles.muted}>Loading your learning space…</Text></View></SafeAreaView>;
  if (!session || recoveryMode) return <SafeAreaView style={styles.safe}><Auth onRecoveryStart={handleRecoveryStart} onRecoveryComplete={handleRecoveryComplete} /></SafeAreaView>;

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}><Text style={styles.logo}>StudyOS · English AI</Text><View style={styles.headerRight}><Text style={styles.pill}>{level}</Text><Pressable onPress={() => supabase?.auth.signOut()}><Text style={styles.signOut}>Sign out</Text></Pressable></View></View>
      <View style={styles.nav}>{(['home','placement','speak','progress','account'] as Screen[]).map((s) => <Pressable key={s} style={styles.navButton} onPress={() => setScreen(s)}><Text>{s[0].toUpperCase()+s.slice(1)}</Text></Pressable>)}</View>
      {screen === 'home' && <>
        <View style={styles.hero}><Text style={styles.title}>Your English, every day.</Text><Text style={styles.muted}>You don't study English. You use it.</Text><Pressable style={styles.primary} onPress={() => setScreen('speak')}><Text style={styles.primaryText}>🎙 Start speaking</Text></Pressable></View>
        {lesson ? <View style={styles.card}><Text style={styles.small}>YOUR LESSON TODAY</Text><Text style={styles.section}>{lesson.title}</Text><Text style={styles.big}>{lesson.minutes} min</Text><Text style={styles.muted}>Focus: {lesson.primarySkill} · {lesson.focus}</Text><Text style={styles.reason}>{lesson.reason}</Text>{lesson.activities.map((activity) => <View key={activity.id} style={styles.activity}><Text style={styles.bold}>{activity.title} · {activity.minutes} min</Text><Text style={styles.muted}>{activity.instruction}</Text></View>)}<Pressable style={styles.primary} onPress={() => setScreen('speak')}><Text style={styles.primaryText}>Start personalized lesson</Text></Pressable></View> : <View style={styles.card}><Text style={styles.muted}>{lessonError || 'Building your lesson…'}</Text></View>}
      </>}
      {screen === 'placement' && <View style={styles.card}><Text style={styles.section}>Quick placement</Text><Text style={styles.muted}>Choose your starter level based on how comfortable you feel.</Text>{['A1','A2','B1','B2','C1'].map(l => <Pressable key={l} style={[styles.option, level===l && styles.selected]} onPress={() => setLevel(l)}><Text style={styles.optionText}>{l}</Text></Pressable>)}<Pressable style={styles.primary} onPress={savePlacement}><Text style={styles.primaryText}>Save profile</Text></Pressable></View>}
      {screen === 'speak' && <View style={styles.card}><Text style={styles.section}>AI Speaking Lab</Text><Text style={styles.muted}>Practice the focus from today's lesson. Type or speak; the AI corrects and responds.</Text><View style={styles.chat}>{messages.map((m,i)=><Text key={i} style={m.role==='ai'?styles.ai:styles.me}>{m.text}</Text>)}</View><TextInput value={reply} onChangeText={setReply} onSubmitEditing={send} placeholder="Type your answer in English..." style={styles.input}/><View style={styles.actions}><Pressable style={[styles.primary, styles.action]} onPress={send}><Text style={styles.primaryText}>{loading ? 'Thinking…' : 'Send'}</Text></Pressable><Pressable style={[styles.mic, recorderState.isRecording && styles.recording]} onPress={recorderState.isRecording ? stopRecording : startRecording}><Text style={styles.micText}>{recorderState.isRecording ? '⏹ Stop & analyze' : '🎙 Speak'}</Text></Pressable></View>{recordingError ? <Text style={styles.error}>{recordingError}</Text> : null}{mistake && <Text style={styles.mistake}>❌ A correction was detected and added to your review.</Text>}</View>}
      {screen === 'progress' && <View style={styles.card}><Text style={styles.section}>Learning profile</Text><Text style={styles.big}>{progress?.cefrLevel ?? level}</Text><Text style={styles.muted}>Current CEFR level · Overall {progress?.overall ?? 0}%</Text>{[['Speaking','speaking'],['Listening','listening'],['Grammar','grammar'],['Vocabulary','vocabulary'],['Pronunciation','pronunciation']].map(([label,key])=><View key={key} style={styles.metric}><Text>{label}</Text><Text style={styles.bold}>{Math.round(progress?.scores?.[key] ?? 0)}%</Text></View>)}<Text style={styles.mistake}>{progress?.nextLevel ? `Next target: ${progress.nextLevel}.` : 'You reached the current top target.'}</Text></View>}
      {screen === 'account' && <Billing apiFetch={apiFetch} onDeleted={async () => { await supabase?.auth.signOut(); setScreen('home'); }} />}
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({safe:{flex:1,backgroundColor:'#f5f7fb'},authLoading:{flex:1,justifyContent:'center',padding:24},container:{padding:20,gap:14},header:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},headerRight:{flexDirection:'row',alignItems:'center',gap:10},logo:{fontSize:20,fontWeight:'800'},pill:{backgroundColor:'#e9eefc',paddingHorizontal:12,paddingVertical:7,borderRadius:20},signOut:{fontSize:12,color:'#667386'},nav:{flexDirection:'row',gap:7,flexWrap:'wrap'},navButton:{backgroundColor:'#fff',padding:10,borderRadius:10},hero:{backgroundColor:'#fff',padding:24,borderRadius:18},title:{fontSize:32,fontWeight:'800',marginBottom:8},muted:{color:'#667386',lineHeight:21},primary:{backgroundColor:'#17202a',padding:14,borderRadius:12,alignItems:'center',marginTop:16},primaryText:{color:'#fff',fontWeight:'700'},card:{backgroundColor:'#fff',padding:22,borderRadius:18},small:{fontSize:12,color:'#7b8797',fontWeight:'700'},big:{fontSize:30,fontWeight:'800',marginTop:6},section:{fontSize:21,fontWeight:'800',marginBottom:8},reason:{marginTop:10,color:'#59677a',fontStyle:'italic'},activity:{paddingVertical:12,borderBottomWidth:1,borderBottomColor:'#edf0f4'},option:{padding:15,borderWidth:1,borderColor:'#dce2ea',borderRadius:11,marginTop:9},selected:{backgroundColor:'#e9eefc'},optionText:{fontWeight:'700'},chat:{backgroundColor:'#f7f8fa',padding:12,borderRadius:12,minHeight:230,marginTop:12},ai:{backgroundColor:'#fff',padding:11,borderRadius:12,marginBottom:8},me:{backgroundColor:'#17202a',color:'#fff',padding:11,borderRadius:12,marginBottom:8},input:{borderWidth:1,borderColor:'#d9dfe8',borderRadius:10,padding:13,marginTop:12},actions:{gap:8},action:{marginTop:12},mic:{backgroundColor:'#e9eefc',padding:14,borderRadius:12,alignItems:'center',marginTop:4},recording:{backgroundColor:'#f3dede'},micText:{fontWeight:'800'},error:{marginTop:12,color:'#a33'},mistake:{marginTop:14,color:'#8a3b12'},metric:{flexDirection:'row',justifyContent:'space-between',paddingVertical:15,borderBottomWidth:1,borderBottomColor:'#edf0f4'},bold:{fontWeight:'800'}});
