import { mediaDevices, RTCPeerConnection, RTCSessionDescription } from 'react-native-webrtc';

type RealtimeOptions = { apiUrl: string; level: string; goal?: string; accessToken?: string };
type RealtimeHandlers = { onTranscript?: (text: string) => void; onState?: (state: 'connecting' | 'connected' | 'disconnected' | 'error') => void; onError?: (message: string) => void };

export async function startRealtime(options: RealtimeOptions, handlers: RealtimeHandlers = {}) {
  handlers.onState?.('connecting');
  let stream: Awaited<ReturnType<typeof mediaDevices.getUserMedia>> | undefined;
  let pc: RTCPeerConnection | undefined;
  try {
    stream = await mediaDevices.getUserMedia({ audio: true, video: false });
    pc = new RTCPeerConnection({ iceServers: [] });
    stream.getTracks().forEach((track) => pc?.addTrack(track, stream!));

    const channel = pc.createDataChannel('oai-events');
    channel.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'conversation.item.input_audio_transcription.completed') handlers.onTranscript?.(String(data.transcript ?? ''));
        if (data.type === 'error') handlers.onError?.(String(data.error?.message ?? 'Realtime error'));
      } catch { /* Ignore non-JSON events. */ }
    };

    const offer = await pc.createOffer({});
    await pc.setLocalDescription(offer);
    const headers: Record<string, string> = { 'Content-Type': 'application/sdp' };
    if (options.accessToken) headers.Authorization = `Bearer ${options.accessToken}`;
    const response = await fetch(`${options.apiUrl}/api/v1/realtime/call`, {
      method: 'POST',
      headers,
      body: offer.sdp ?? ''
    });
    if (!response.ok) throw new Error(await response.text());
    await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: await response.text() }));
    handlers.onState?.('connected');

    pc.onconnectionstatechange = () => {
      if (pc?.connectionState === 'disconnected' || pc?.connectionState === 'failed' || pc?.connectionState === 'closed') handlers.onState?.('disconnected');
    };
    return { pc, stream, channel, stop: () => { stream?.getTracks().forEach((track) => track.stop()); pc?.close(); handlers.onState?.('disconnected'); } };
  } catch (error) {
    stream?.getTracks().forEach((track) => track.stop());
    pc?.close();
    handlers.onState?.('error');
    handlers.onError?.(error instanceof Error ? error.message : 'Unable to start realtime session');
    throw error;
  }
}
