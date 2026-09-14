import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CameraView } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/Input';
import { PermissionState } from '@/components/ui/PermissionState';
import { SelectField } from '@/components/ui/SelectField';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { UploadProgress } from '@/components/ui/UploadProgress';
import { useTheme } from '@/hooks/useTheme';
import { useCamera, type CameraMode } from '@/hooks/useCamera';
import { useUIStore } from '@/stores/uiStore';
import { usePendingMediaStore } from '@/stores/pendingMediaStore';
import { PHOTO_CATEGORIES, photoService } from '@/services/photoService';
import { getApiErrorMessage } from '@/services/api';

type Params = {
  mode?: 'photo' | 'video' | 'document';
  projectId?: string;
  category?: string;
  /** When set, the captured file is handed back to the previous screen instead of uploaded here. */
  requestId?: string;
};

const MODE_COPY: Record<CameraMode, string> = {
  photo: 'Progress photo',
  video: 'Site progress video',
  document: 'Invoice / challan scanner',
};

const ZOOM_PRESETS = [
  { label: '1×', value: 0 },
  { label: '2×', value: 0.25 },
  { label: '4×', value: 0.55 },
];

/**
 * Site Camera — capture progress photos, material delivery proof, safety
 * issues and completion shots, record site videos, and scan material
 * invoices/delivery challans. Files land in the project gallery, or are
 * returned to an attach-flow via requestId.
 */
export default function SiteCameraScreen() {
  const params = useLocalSearchParams<Params>();
  const mode: CameraMode =
    params.mode === 'video' ? 'video' : params.mode === 'document' ? 'document' : 'photo';
  const projectId = params.projectId;
  const requestId = params.requestId;

  const theme = useTheme();
  const router = useRouter();
  const showToast = useUIStore((s) => s.showToast);
  const setPending = usePendingMediaStore((s) => s.setPending);
  const cam = useCamera(mode);
  const { spacing } = theme;

  const cameraRef = useRef<CameraView>(null);
  const zoomStepRef = useRef(0);
  const recStartRef = useRef<number | null>(null);
  const [captured, setCaptured] = useState<{
    uri: string;
    durationSeconds?: number;
    mimeType: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadFraction, setUploadFraction] = useState<number | null>(null);
  const [focusRing, setFocusRing] = useState<{ x: number; y: number; key: number } | null>(null);
  const [singleShotFocus, setSingleShotFocus] = useState(false);
  const [saveSheetVisible, setSaveSheetVisible] = useState(false);
  const [category, setCategory] = useState<string>(
    params.category && PHOTO_CATEGORIES.some((c) => c.value === params.category)
      ? params.category
      : 'progress',
  );
  const [description, setDescription] = useState('');
  const [discardAsk, setDiscardAsk] = useState(false);

  useEffect(() => {
    if (!focusRing) return;
    const t = setTimeout(() => setFocusRing(null), 900);
    return () => clearTimeout(t);
  }, [focusRing]);

  const handleTapToFocus = useCallback((e: any) => {
    const { locationX, locationY } = e.nativeEvent ?? {};
    if (locationX == null || locationY == null) return;
    void Haptics.selectionAsync().catch(() => {});
    setFocusRing({ x: locationX, y: locationY, key: Date.now() });
    // Trigger an AF pass: flip to single-shot briefly.
    setSingleShotFocus(true);
    setTimeout(() => setSingleShotFocus(false), 500);
  }, []);

  const handleShutter = async () => {
    if (busy || !cameraRef.current) return;
    try {
      if (mode === 'video') {
        if (!cam.recording) {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          recStartRef.current = Date.now();
          cam.startRecording();
          cameraRef.current
            .recordAsync({ maxDuration: 180 })
            .then((video) => {
              const seconds =
                recStartRef.current != null
                  ? Math.max(1, Math.round((Date.now() - recStartRef.current) / 1000))
                  : 1;
              if (video?.uri) {
                setCaptured({ uri: video.uri, durationSeconds: seconds, mimeType: 'video/mp4' });
              }
            })
            .catch(() => {
              showToast('Recording failed. Please try again.', 'error');
            });
          return;
        }
        // Stop — the recordAsync promise above resolves with the file.
        cam.stopRecording();
        setBusy(true);
        setTimeout(() => setBusy(false), 800);
        return;
      }

      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      setBusy(true);
      const photo = await cameraRef.current.takePictureAsync({
        quality: mode === 'document' ? 0.9 : 0.8,
        imageType: 'jpg',
        exif: false,
      });
      if (photo?.uri) setCaptured({ uri: photo.uri, mimeType: 'image/jpeg' });
      else showToast('Could not capture. Please try again.', 'error');
    } catch {
      showToast('Camera error. Please try again.', 'error');
      if (cam.recording) cam.stopRecording();
    } finally {
      setBusy(false);
    }
  };

  const deliverPending = (uri: string, mimeType: string, durationSeconds?: number): boolean => {
    if (!requestId) return false;
    setPending(requestId, { uri, mimeType, durationSeconds });
    router.back();
    return true;
  };

  const openSaveSheet = () => {
    if (!captured) return;
    if (deliverPending(captured.uri, captured.mimeType, captured.durationSeconds)) return;
    setSaveSheetVisible(true);
  };

  const handleSave = async () => {
    if (!captured || !projectId || uploadFraction != null) return;
    setSaveSheetVisible(false);
    setUploadFraction(0);
    try {
      await photoService.uploadPhoto(
        {
          uri: captured.uri,
          mimeType: captured.mimeType,
          durationSeconds: captured.durationSeconds,
        },
        {
          projectId,
          category: category as never,
          description: description.trim() || undefined,
        },
        (f) => setUploadFraction(f),
      );
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showToast(
        mode === 'document'
          ? 'Scan saved to project documents'
          : mode === 'video'
            ? 'Video saved to project gallery'
            : 'Photo saved to project gallery',
        'success',
      );
      router.back();
    } catch (err) {
      showToast(getApiErrorMessage(err), 'error');
      setUploadFraction(null);
    }
  };

  // ── Permission / loading states ──────────────────────────────────
  if (!cam.permissionChecked || cam.permission == null) {
    return (
      <SafeAreaView style={[styles.centered, styles.flex1]}>
        <ActivityIndicator color="#fff" size="large" />
        <Text style={{ color: '#ccc', marginTop: spacing.md }}>Preparing camera…</Text>
      </SafeAreaView>
    );
  }

  if (!cam.permission.granted) {
    return (
      <SafeAreaView style={[styles.flex1, { backgroundColor: theme.colors.background }]}>
        <PermissionState
          area={mode === 'video' ? 'microphone' : 'camera'}
          permanentlyDenied={!cam.permission.canAskAgain}
          onRequest={() => void cam.retryPermission()}
        />
        <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xl }}>
          <Button label="Close" variant="ghost" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Captured preview ─────────────────────────────────────────────
  if (captured) {
    return (
      <SafeAreaView style={[styles.flex1, { backgroundColor: '#000' }]}>
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
          <Text style={styles.previewTitle}>
            {mode === 'document' ? 'Scan preview' : mode === 'video' ? 'Video preview' : 'Photo preview'}
          </Text>
        </View>

        {captured.mimeType.startsWith('image/') ? (
          <Image source={{ uri: captured.uri }} style={styles.previewImage} resizeMode="contain" />
        ) : (
          <View style={[styles.previewImage, styles.center]}>
            <Ionicons name="videocam" size={64} color="rgba(255,255,255,0.7)" />
            <Text style={{ color: '#fff', marginTop: 12 }}>
              Video · {Math.round(captured.durationSeconds ?? 0)}s
            </Text>
            <Text style={styles.videoHint}>
              Playback opens in the project gallery after upload.
            </Text>
          </View>
        )}

        {uploadFraction != null ? (
          <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
            <UploadProgress fraction={uploadFraction} label="Uploading…" />
          </View>
        ) : (
          <View style={[styles.previewActions, { gap: spacing.md, paddingBottom: spacing.xl }]}>
            <Button
              label="Retake"
              variant="ghost"
              fullWidth={false}
              style={{ flex: 1 }}
              onPress={() => setDiscardAsk(true)}
            />
            <Button
              label={requestId ? 'Use this capture' : 'Save & upload'}
              fullWidth={false}
              style={{ flex: 2 }}
              onPress={openSaveSheet}
            />
          </View>
        )}

        <ConfirmDialog
          visible={discardAsk}
          title="Discard this capture?"
          message={
            mode === 'video'
              ? 'The recorded video will be deleted.'
              : mode === 'document'
                ? 'The scan will be deleted.'
                : 'The photo will be deleted.'
          }
          confirmLabel="Discard"
          onCancel={() => setDiscardAsk(false)}
          onConfirm={() => {
            setDiscardAsk(false);
            setCaptured(null);
          }}
        />

        <BottomSheet
          visible={saveSheetVisible}
          onClose={() => setSaveSheetVisible(false)}
          title="Add to project"
        >
          <View style={{ paddingHorizontal: theme.spacing.lg, gap: theme.spacing.md, paddingBottom: theme.spacing.lg }}>
            <SelectField
              label="Category"
              options={PHOTO_CATEGORIES}
              value={category}
              onChange={(v) => setCategory(v)}
            />
            <Input
              label="Description"
              value={description}
              onChangeText={setDescription}
              placeholder={
                mode === 'document' ? 'e.g. Cement bill #4412 — Shakti Suppliers' : 'What does this show?'
              }
              maxLength={300}
              multiline
            />
            <Button
              label={mode === 'document' ? 'Save scan' : mode === 'video' ? 'Save video' : 'Save photo'}
              size="lg"
              onPress={() => void handleSave()}
            />
          </View>
        </BottomSheet>
      </SafeAreaView>
    );
  }

  // ── Live camera ──────────────────────────────────────────────────
  return (
    <View style={[styles.flex1, { backgroundColor: '#000' }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={handleTapToFocus}>
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={cam.facing as never}
          flash={mode === 'photo' && cam.flash === 'on' ? 'on' : 'off'}
          enableTorch={mode !== 'photo' && cam.flash === 'on'}
          autofocus={singleShotFocus ? ('singleShot' as never) : ('on' as never)}
          zoom={cam.zoom}
          mode={mode === 'video' ? 'video' : 'picture'}
          videoQuality="720p"
        />
      </Pressable>

      {/* Focus ring */}
      {focusRing ? (
        <View
          pointerEvents="none"
          style={[styles.focusRing, { left: focusRing.x - 36, top: focusRing.y - 36 }]}
        />
      ) : null}

      {/* Document guide frame */}
      {mode === 'document' ? (
        <View pointerEvents="none" style={styles.docGuideWrap}>
          <View style={styles.docGuide} />
          <Text style={styles.docHint}>Place the invoice inside the frame</Text>
        </View>
      ) : null}

      {/* Recording indicator */}
      {cam.recording ? (
        <View style={styles.recChip}>
          <View style={styles.recDot} />
          <Text style={styles.recText}>{formatRec(cam.recordSeconds)}</Text>
        </View>
      ) : null}

      {/* Top bar */}
      <SafeAreaView edges={['top']} style={styles.topBar}>
        <Pressable accessibilityLabel="Close camera" onPress={() => router.back()} hitSlop={8} style={styles.roundBtn}>
          <Ionicons name="close" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.modeLabel}>{MODE_COPY[mode]}</Text>
        <Pressable
          accessibilityLabel={cam.flash === 'on' ? 'Flash off' : 'Flash on'}
          onPress={cam.toggleFlash}
          hitSlop={8}
          style={[
            styles.roundBtn,
            { backgroundColor: cam.flash === 'on' ? 'rgba(255,214,10,0.9)' : 'rgba(30,30,30,0.55)' },
          ]}
        >
          <Ionicons name={cam.flash === 'on' ? 'flash' : 'flash-off'} size={20} color={cam.flash === 'on' ? '#111' : '#fff'} />
        </Pressable>
      </SafeAreaView>

      {/* Zoom controls */}
      <View style={styles.zoomRow} pointerEvents="box-none">
        <Pressable accessibilityLabel="Zoom out" onPress={() => adjustZoom(-1)} style={styles.roundBtnSmall}>
          <Ionicons name="remove" size={18} color="#fff" />
        </Pressable>
        {ZOOM_PRESETS.map((p) => (
          <Pressable
            key={p.label}
            accessibilityRole="button"
            onPress={() => {
              cam.setZoom(p.value);
              setZoomPreset(p.value);
            }}
            style={[
              styles.zoomChip,
              { backgroundColor: cam.zoom === p.value ? 'rgba(255,255,255,0.92)' : 'rgba(30,30,30,0.55)' },
            ]}
          >
            <Text
              style={{
                color: cam.zoom === p.value ? '#111' : '#fff',
                fontSize: 12,
                fontWeight: '700',
              }}
            >
              {p.label}
            </Text>
          </Pressable>
        ))}
        <Pressable accessibilityLabel="Zoom in" onPress={() => adjustZoom(1)} style={styles.roundBtnSmall}>
          <Ionicons name="add" size={18} color="#fff" />
        </Pressable>
      </View>

      {/* Bottom controls */}
      <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
        <Pressable accessibilityLabel="Switch camera" onPress={cam.toggleFacing} style={styles.flipBtn}>
          <Ionicons name="camera-reverse-outline" size={26} color="#fff" />
        </Pressable>

        <Pressable
          accessibilityLabel={cam.recording ? 'Stop recording' : 'Capture'}
          onPress={() => void handleShutter()}
          disabled={busy}
          style={styles.shutterOuter}
        >
          {busy && mode !== 'video' ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <View
              style={[
                styles.shutterInner,
                cam.recording && styles.shutterRecording,
                mode === 'document' && styles.shutterDoc,
              ]}
            />
          )}
        </Pressable>

        <View style={{ width: 56 }} />
      </SafeAreaView>
    </View>
  );

  function adjustZoom(step: number) {
    const next = Math.min(1, Math.max(0, Number((cam.zoom + step * 0.1).toFixed(2))));
    cam.setZoom(next);
    setZoomPreset(next);
  }

  function setZoomPreset(value: number) {
    zoomStepRef.current = Math.round(value * 10);
  }

  function formatRec(total: number): string {
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  focusRing: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: 'rgba(255,214,10,0.95)',
    backgroundColor: 'rgba(255,214,10,0.08)',
  },
  docGuideWrap: {
    ...(StyleSheet.absoluteFill as any),
    alignItems: 'center',
    justifyContent: 'center',
  },
  docGuide: {
    width: '78%',
    height: '52%',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
    borderStyle: 'dashed',
  },
  docHint: {
    color: '#fff',
    fontSize: 13,
    marginTop: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    overflow: 'hidden',
  },
  recChip: {
    position: 'absolute',
    top: 64,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  recDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#ff3b30',
  },
  recText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  modeLabel: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    overflow: 'hidden',
  },
  roundBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(30,30,30,0.55)',
  },
  roundBtnSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(30,30,30,0.55)',
  },
  zoomRow: {
    position: 'absolute',
    right: 14,
    bottom: 150,
    alignItems: 'flex-end',
    gap: 8,
  },
  zoomChip: {
    minWidth: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 26,
    paddingBottom: 18,
  },
  flipBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(30,30,30,0.55)',
  },
  shutterOuter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#fff',
  },
  shutterRecording: {
    borderRadius: 10,
    backgroundColor: '#ff3b30',
    width: 46,
    height: 46,
  },
  shutterDoc: {
    borderRadius: 14,
  },
  previewTitle: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
    textAlign: 'center',
  },
  previewImage: {
    flex: 1,
    width: '100%',
  },
  videoFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111',
  },
  videoHint: {
    color: '#aaa',
    fontSize: 12.5,
    marginTop: 6,
    textAlign: 'center',
    paddingHorizontal: 48,
    lineHeight: 18,
  },
  center: { alignItems: 'center', justifyContent: 'center' },
  previewActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
});
