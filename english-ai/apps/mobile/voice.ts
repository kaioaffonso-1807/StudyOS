import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';

export { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState };

export async function requestMicrophone() {
  const permission = await AudioModule.requestRecordingPermissionsAsync();
  if (!permission.granted) throw new Error('Microphone permission was denied.');
  await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
}
