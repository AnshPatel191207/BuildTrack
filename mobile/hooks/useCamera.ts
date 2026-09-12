import { useCallback, useEffect, useState } from 'react';
import { Camera, type CameraType } from 'expo-camera';
import { ensurePermission, type PermissionResult } from '@/lib/permissions';

export type CameraMode = 'photo' | 'video' | 'document';

/**
 * Camera session state shared by the Site Camera screen:
 * permission handling plus facing / flash / zoom / mode controls that map
 * 1:1 onto expo-camera's CameraView props.
 */
export function useCamera(mode: CameraMode = 'photo') {
  const [permission, setPermission] = useState<PermissionResult | null>(null);
  const [permissionChecked, setPermissionChecked] = useState(false);
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<'on' | 'off'>('off');
  const [zoom, setZoom] = useState(0);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const result = await ensurePermission('camera');
      if (!mounted) return;
      // Video needs the microphone too.
      if (result.granted && mode === 'video') {
        const mic = await ensurePermission('microphone');
        if (mounted) setPermission(mic.granted ? mic : { granted: false, canAskAgain: mic.canAskAgain });
      } else if (mounted) {
        setPermission(result);
      }
      if (mounted) setPermissionChecked(true);
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Recording timer.
  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  const retryPermission = useCallback(async () => {
    setPermissionChecked(false);
    const result = await ensurePermission('camera');
    if (result.granted && mode === 'video') {
      const mic = await ensurePermission('microphone');
      setPermission(mic.granted ? mic : { granted: false, canAskAgain: mic.canAskAgain });
    } else {
      setPermission(result);
    }
    setPermissionChecked(true);
  }, [mode]);

  const toggleFacing = useCallback(() => {
    setFacing((f) => (f === 'back' ? 'front' : 'back'));
  }, []);

  const toggleFlash = useCallback(() => {
    setFlash((f) => (f === 'on' ? 'off' : 'on'));
  }, []);

  const startRecording = useCallback(() => {
    setRecordSeconds(0);
    setRecording(true);
  }, []);

  const stopRecording = useCallback(() => {
    setRecording(false);
  }, []);

  return {
    permission,
    permissionChecked,
    retryPermission,
    facing,
    toggleFacing,
    flash,
    toggleFlash,
    zoom,
    setZoom,
    recording,
    recordSeconds,
    startRecording,
    stopRecording,
    isFrontCamera: facing === 'front',
  };
}
