import React, { useEffect, useState } from 'react';
import { Alert, AppState, Platform, Pressable, Text, View, StyleSheet } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

type BillingProps = { apiFetch: (path: string, init?: RequestInit) => Promise<Response>; onDeleted: () => void };
type UsageAction = { used: number; limit: number; remaining: number };
type BillingState = { plan: string; active: boolean; status: string; currentPeriodEnd?: string | null; cancelAtPeriodEnd?: boolean };

export default function Billing({ apiFetch, onDeleted }: BillingProps) {
  const [billing, setBilling] = useState<BillingState | null>(null);
  const [usage, setUsage] = useState<Record<string, UsageAction>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const load = async () => {
    try {
      const [entitlementResponse, usageResponse] = await Promise.all([apiFetch('/api/v1/billing/entitlement'), apiFetch('/api/v1/billing/usage')]);
      if (entitlementResponse.ok) setBilling(await entitlementResponse.json());
      if (usageResponse.ok) { const data = await usageResponse.json(); setUsage(data.actions ?? {}); }
    } catch { setMessage('Billing information is temporarily unavailable.'); }
  };

  useEffect(() => { void load(); }, [apiFetch]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void load();
    });
    return () => subscription.remove();
  }, [apiFetch]);

  const openCheckout = async (cycle: 'monthly' | 'yearly') => {
    setBusy(true); setMessage('');
    try {
      const response = await apiFetch('/api/v1/billing/checkout', { method: 'POST', body: JSON.stringify({ cycle }) });
      const data = await response.json();
      if (!response.ok || !data.url) throw new Error();
      await WebBrowser.openBrowserAsync(data.url);
      await load();
    } catch { setMessage('Could not open checkout. Please try again.'); }
    finally { setBusy(false); }
  };
  const openPortal = async () => {
    setBusy(true); setMessage('');
    try {
      const response = await apiFetch('/api/v1/billing/portal', { method: 'POST', body: JSON.stringify({}) });
      const data = await response.json();
      if (!response.ok || !data.url) throw new Error();
      await WebBrowser.openBrowserAsync(data.url);
      await load();
    } catch { setMessage('Could not open subscription management.'); }
    finally { setBusy(false); }
  };
  const exportData = async () => {
    setBusy(true); setMessage('');
    try {
      const response = await apiFetch('/api/v1/users/me/export');
      if (!response.ok) throw new Error();
      const json = await response.text();
      if (Platform.OS === 'web') {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'studyos-data.json'; anchor.click();
        URL.revokeObjectURL(url);
      } else {
        const uri = `${FileSystem.cacheDirectory}studyos-data.json`;
        await FileSystem.writeAsStringAsync(uri, json, { encoding: FileSystem.EncodingType.UTF8 });
        if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'Export your StudyOS data' });
        else setMessage('Data exported to the device cache.');
      }
    } catch { setMessage('Could not export your data.'); }
    finally { setBusy(false); }
  };
  const deleteData = () => Alert.alert('Delete your data', 'This permanently removes your StudyOS learning data, history, usage and billing records. Your authentication account remains active.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => {
      setBusy(true); setMessage('');
      try { const response = await apiFetch('/api/v1/users/me/data', { method: 'DELETE' }); if (!response.ok) throw new Error(); onDeleted(); }
      catch { setMessage('Could not delete your data.'); }
      finally { setBusy(false); }
    } },
  ]);

  return <View style={styles.card}>
    <Text style={styles.title}>Plan & account</Text>
    <Text style={styles.plan}>{billing?.active ? 'PRO' : 'FREE'}</Text>
    <Text style={styles.muted}>{billing?.active ? 'Your Pro subscription is active.' : 'Start free. Upgrade when you need more practice.'}</Text>
    {Object.entries(usage).map(([key, value]) => <View style={styles.row} key={key}><Text>{key.replace('_', ' ')}</Text><Text style={styles.bold}>{value.used}/{value.limit}</Text></View>)}
    {billing?.active ? <Pressable style={styles.primary} onPress={openPortal} disabled={busy}><Text style={styles.primaryText}>{busy ? 'Opening…' : 'Manage subscription'}</Text></Pressable> : <View style={styles.actions}>
      <Pressable style={styles.primary} onPress={() => openCheckout('monthly')} disabled={busy}><Text style={styles.primaryText}>Upgrade monthly</Text></Pressable>
      <Pressable style={styles.secondary} onPress={() => openCheckout('yearly')} disabled={busy}><Text style={styles.secondaryText}>Upgrade yearly</Text></Pressable>
    </View>}
    <Text style={styles.section}>Privacy & data</Text>
    <Pressable style={styles.secondary} onPress={exportData} disabled={busy}><Text style={styles.secondaryText}>Export my data</Text></Pressable>
    <Pressable style={styles.danger} onPress={deleteData} disabled={busy}><Text style={styles.dangerText}>Delete my learning data</Text></Pressable>
    {message ? <Text style={styles.message}>{message}</Text> : null}
  </View>;
}
const styles = StyleSheet.create({ card:{backgroundColor:'#fff',padding:22,borderRadius:18}, title:{fontSize:22,fontWeight:'800'}, plan:{fontSize:30,fontWeight:'900',marginTop:8}, muted:{color:'#667386',lineHeight:21,marginTop:4}, row:{flexDirection:'row',justifyContent:'space-between',paddingVertical:13,borderBottomWidth:1,borderBottomColor:'#edf0f4'}, bold:{fontWeight:'800'}, section:{fontSize:17,fontWeight:'800',marginTop:22,marginBottom:8}, actions:{gap:8}, primary:{backgroundColor:'#17202a',padding:14,borderRadius:12,alignItems:'center',marginTop:14}, primaryText:{color:'#fff',fontWeight:'700'}, secondary:{backgroundColor:'#e9eefc',padding:14,borderRadius:12,alignItems:'center',marginTop:8}, secondaryText:{fontWeight:'800'}, danger:{backgroundColor:'#f8e4e4',padding:14,borderRadius:12,alignItems:'center',marginTop:8}, dangerText:{color:'#8d2222',fontWeight:'800'}, message:{color:'#8a3b12',marginTop:12} });
