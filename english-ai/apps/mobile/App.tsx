import React, { useState } from 'react';
import { SafeAreaView, View, Text, Pressable, TextInput, StyleSheet, ScrollView } from 'react-native';

type Screen = 'home' | 'placement' | 'speak' | 'progress';
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

type ChatMessage = { role: 'ai' | 'user'; text: string };

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [level, setLevel] = useState('A1');
  const [reply, setReply] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'ai', text: 'Hi! 👋 How was your day?' }]);
  const [mistake, setMistake] = useState(false);
  const [loading, setLoading] = useState(false);

  const send = async () => {
    const value = reply.trim();
    if (!value || loading) return;
    setMessages((m) => [...m, { role: 'user', text: value }]);
    setReply('');
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/v1/conversations`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: value, level })
      });
      if (!response.ok) throw new Error('API error');
      const data = await response.json();
      setMessages((m) => [...m, { role: 'ai', text: data.reply }]);
      setMistake(Boolean(data.correction));
    } catch {
      setMessages((m) => [...m, { role: 'ai', text: 'I could not reach the learning server. Check your API connection and try again.' }]);
    } finally { setLoading(false); }
  };

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}><Text style={styles.logo}>StudyOS · English AI</Text><Text style={styles.pill}>{level}</Text></View>
      <View style={styles.nav}>{(['home','placement','speak','progress'] as Screen[]).map((s) => <Pressable key={s} style={styles.navButton} onPress={() => setScreen(s)}><Text>{s[0].toUpperCase()+s.slice(1)}</Text></Pressable>)}</View>
      {screen === 'home' && <>
        <View style={styles.hero}><Text style={styles.title}>Your English, every day.</Text><Text style={styles.muted}>Practice real English with an adaptive AI tutor.</Text><Pressable style={styles.primary} onPress={() => setScreen('speak')}><Text style={styles.primaryText}>🎙 Start speaking</Text></Pressable></View>
        <View style={styles.card}><Text style={styles.small}>TODAY'S GOAL</Text><Text style={styles.big}>10 min</Text><Text style={styles.muted}>5 min speaking · 5 min review</Text></View>
        <View style={styles.card}><Text style={styles.small}>RECOMMENDED</Text><Text style={styles.section}>Past tense</Text><Text style={styles.muted}>Practice irregular verbs through conversation.</Text></View>
      </>}
      {screen === 'placement' && <View style={styles.card}><Text style={styles.section}>Quick placement</Text><Text style={styles.muted}>Choose your starter level based on how comfortable you feel.</Text>{['A1','A2','B1','B2','C1'].map(l => <Pressable key={l} style={[styles.option, level===l && styles.selected]} onPress={() => setLevel(l)}><Text style={styles.optionText}>{l}</Text></Pressable>)}<Pressable style={styles.primary} onPress={() => setScreen('progress')}><Text style={styles.primaryText}>Save profile</Text></Pressable></View>}
      {screen === 'speak' && <View style={styles.card}><Text style={styles.section}>AI Speaking Lab</Text><View style={styles.chat}>{messages.map((m,i)=><Text key={i} style={m.role==='ai'?styles.ai:styles.me}>{m.text}</Text>)}</View><TextInput value={reply} onChangeText={setReply} onSubmitEditing={send} placeholder="Type your answer in English..." style={styles.input}/><Pressable style={styles.primary} onPress={send}><Text style={styles.primaryText}>{loading ? 'Thinking…' : 'Send'}</Text></Pressable>{mistake && <Text style={styles.mistake}>❌ A correction was detected and added to your review.</Text>}</View>}
      {screen === 'progress' && <View style={styles.card}><Text style={styles.section}>Learning profile</Text><Text style={styles.big}>{level}</Text><Text style={styles.muted}>Starter CEFR level</Text>{[['Speaking','28%'],['Grammar','36%'],['Vocabulary','42%']].map(([a,b])=><View key={a} style={styles.metric}><Text>{a}</Text><Text style={styles.bold}>{b}</Text></View>)}<Text style={styles.mistake}>{mistake ? '1 mistake ready for review.' : 'Start speaking to discover your weak points.'}</Text></View>}
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({safe:{flex:1,backgroundColor:'#f5f7fb'},container:{padding:20,gap:14},header:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},logo:{fontSize:20,fontWeight:'800'},pill:{backgroundColor:'#e9eefc',paddingHorizontal:12,paddingVertical:7,borderRadius:20},nav:{flexDirection:'row',gap:7,flexWrap:'wrap'},navButton:{backgroundColor:'#fff',padding:10,borderRadius:10},hero:{backgroundColor:'#fff',padding:24,borderRadius:18},title:{fontSize:32,fontWeight:'800',marginBottom:8},muted:{color:'#667386',lineHeight:21},primary:{backgroundColor:'#17202a',padding:14,borderRadius:12,alignItems:'center',marginTop:16},primaryText:{color:'#fff',fontWeight:'700'},card:{backgroundColor:'#fff',padding:22,borderRadius:18},small:{fontSize:12,color:'#7b8797',fontWeight:'700'},big:{fontSize:30,fontWeight:'800',marginTop:6},section:{fontSize:21,fontWeight:'800',marginBottom:8},option:{padding:15,borderWidth:1,borderColor:'#dce2ea',borderRadius:11,marginTop:9},selected:{backgroundColor:'#e9eefc'},optionText:{fontWeight:'700'},chat:{backgroundColor:'#f7f8fa',padding:12,borderRadius:12,minHeight:230},ai:{backgroundColor:'#fff',padding:11,borderRadius:12,marginBottom:8},me:{backgroundColor:'#17202a',color:'#fff',padding:11,borderRadius:12,marginBottom:8},input:{borderWidth:1,borderColor:'#d9dfe8',borderRadius:10,padding:13,marginTop:12},mistake:{marginTop:14,color:'#8a3b12'},metric:{flexDirection:'row',justifyContent:'space-between',paddingVertical:15,borderBottomWidth:1,borderBottomColor:'#edf0f4'},bold:{fontWeight:'800'}});
