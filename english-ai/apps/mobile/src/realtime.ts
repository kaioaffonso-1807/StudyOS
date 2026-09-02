import { mediaDevices, RTCPeerConnection, RTCSessionDescription } from 'react-native-webrtc';

type RealtimeOptions = { apiUrl: string; level: string; goal?: string };

type RealtimeHandlers = {
  onTranscript?: (text: string) => void;
  onState?: (state: 'connecting' | 'connected' | 'disconnected' | 'error') => void;
  onError?: (message: string) => void;
};

export async function startRealtime(options: RealtimeOptions, handlers: RealtimeHandlers = {}) {
  handlers.onState?.('connecting');
  const stream = await mediaDevices.getUserMedia({ audio: true, video: false });
  const pc = new RTCPeerConnection({ iceServers: [] });
  stream.getTracks().forEach((track) => pc.addTrack(track, stream));

  const offer = await pc.createOffer({});
  await pc.setLocalDescription(offer);

  const response = await fetch(`${options.apiUrl}/api/v1/realtime/call`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sdp: offer.sdp, level: options.level, goal: options.goal })
  });
  if (!response.ok) throw new Error(await response.text());

  const answerSdp = await response.text();
  await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: answerSdp }));
  handlers.onState?.('connected');

  const channel = pc.createDataChannel('oai-events');
  channel.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'conversation.item.input_audio_transcription.completed') {
        handlers.onTranscript?.(String(data.transcript ?? ''));
      }
      if (data.type === 'error') handlers.onError?.(String(data.error?.message ?? 'Realtime error'));
    } catch {
      // Ignore non-JSON data channel messages.
    }
  };

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
      handlers.onState?.('disconnected');
    }
  };

  return {
    pc,
    stream,
    stop: () => {
      stream.getTracks().forEach((track) => track.stop());
      pc.close();
      handlers.onState?.('disconnected');
    }
  };
}
