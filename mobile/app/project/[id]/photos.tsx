import React, { useCallback, useState } from 'react';
import {
  Dimensions,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Haptics from 'expo-haptics';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { Badge } from '@/components/ui/Badge';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Input } from '@/components/ui/Input';
import { SelectField } from '@/components/ui/SelectField';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { UploadProgress } from '@/components/ui/UploadProgress';
import { PermissionState } from '@/components/ui/PermissionState';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { useTheme } from '@/hooks/useTheme';
import { useResource } from '@/hooks/useResource';
import { useUIStore } from '@/stores/uiStore';
import { useDataVersionKey, DATA_KEYS } from '@/stores/dataVersion';
import {
  deletePhoto,
  photoService,
  PHOTO_CATEGORIES,
  validateMediaFile,
} from '@/services/photoService';
import { usePendingMediaStore } from '@/stores/pendingMediaStore';
import type { MediaKind, PhotoCategory, SiteMedia } from '@/types';
import { formatDate, relativeTime } from '@/lib/format';
import { resolveFileUrl } from '@/services/api';

type KindTab = MediaKind;

const KIND_TABS: { label: string; value: KindTab; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: 'Photos', value: 'image', icon: 'images-outline' },
  { label: 'Videos', value: 'video', icon: 'videocam-outline' },
  { label: 'Documents', value: 'document', icon: 'document-text-outline' },
];

const categoryLabel = (v: PhotoCategory) =>
  PHOTO_CATEGORIES.find((c) => c.value === v)?.label ?? v;

/**
 * Project gallery — progress/delivery/safety/completion photos, site videos
 * and scanned invoices/challans in one place, with camera capture, library
 * picking, compression, validation and upload progress.
 */
export default function PhotosScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const showToast = useUIStore((s) => s.showToast);
  const photosVersion = useDataVersionKey(DATA_KEYS.photos);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing, radius } = theme;

  const [kindTab, setKindTab] = useState<KindTab>('image');
  const [filter, setFilter] = useState<PhotoCategory | 'all'>('all');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [picked, setPicked] = useState<{
    uri: string;
    mimeType: string;
    durationSeconds?: number;
    kind: MediaKind;
  } | null>(null);
  const [uploadCategory, setUploadCategory] = useState<PhotoCategory>('progress');
  const [uploadDesc, setUploadDesc] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
  const [mediaLibraryDenied, setMediaLibraryDenied] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SiteMedia | null>(null);

  const fetcher = useCallback(
    () => photoService.listPhotos({ projectId: id }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, photosVersion],
  );
  const { data, loading, error, offlineData, refreshing, refresh, reload } =
    useResource(fetcher, [fetcher]);

  const items = (data ?? []).filter((m) => m.kind === kindTab);
  const filtered =
    kindTab === 'image' ? items.filter((p) => filter === 'all' || p.category === filter) : items;

  // ── Picking & compression ────────────────────────────────────────

  /** Resize + compress large photos so site uploads are fast. */
  const compressImage = async (
    asset: ImagePicker.ImagePickerAsset,
  ): Promise<{ uri: string; mimeType: string }> => {
    try {
      if ((asset.width ?? 0) > 1600 || (asset.fileSize ?? 0) > 2_500_000) {
        const context = ImageManipulator.ImageManipulator.manipulate(asset.uri);
        context.resize({ width: 1600 });
        const rendered = await context.renderAsync();
        const saved = await rendered.saveAsync({
          compress: 0.75,
          format: ImageManipulator.SaveFormat.JPEG,
        });
        return { uri: saved.uri, mimeType: 'image/jpeg' };
      }
    } catch {
      // fall through to the original asset
    }
    return {
      uri: asset.uri,
      mimeType: asset.mimeType ?? 'image/jpeg',
    };
  };

  const openCameraScreen = (mode: 'photo' | 'video' | 'document') => {
    setUploadOpen(false);
    router.push({
      pathname: '/camera',
      params: { mode, projectId: id, requestId: `gallery:${id}` },
    });
  };

  // Camera screen hands the captured file back through pendingMediaStore.
  useFocusEffect(
    useCallback(() => {
      const media = usePendingMediaStore.getState().consume(`gallery:${id}`);
      if (media) {
        stagePicked({
          uri: media.uri,
          mimeType: media.mimeType,
          kind: media.mimeType.startsWith('video')
            ? 'video'
            : media.mimeType === 'application/pdf'
              ? 'document'
              : 'image',
          durationSeconds: media.durationSeconds,
        });
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]),
  );

  const pickFromLibrary = async (media: 'images' | 'videos') => {
    setUploadOpen(false);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setMediaLibraryDenied(true);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes:
        media === 'images'
          ? ['images']
          : ['videos'],
      quality: 1,
      videoMaxDuration: 180,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];

    if (media === 'images') {
      const compressed = await compressImage(asset);
      stagePicked({
        uri: compressed.uri,
        mimeType: compressed.mimeType,
        kind: 'image',
        sizeBytes: asset.fileSize,
      });
    } else {
      const mimeType =
        asset.mimeType ??
        (asset.uri.toLowerCase().endsWith('.mov') ? 'video/quicktime' : 'video/mp4');
      stagePicked({
        uri: asset.uri,
        mimeType,
        durationSeconds: asset.duration ? Math.round(asset.duration / 1000) : undefined,
        kind: 'video',
        sizeBytes: asset.fileSize,
      });
    }
  };

  const stagePicked = (file: {
    uri: string;
    mimeType: string;
    kind: MediaKind;
    durationSeconds?: number;
    sizeBytes?: number | null;
  }) => {
    const problem = validateMediaFile({ mimeType: file.mimeType, sizeBytes: file.sizeBytes });
    if (problem) {
      showToast(problem, 'error');
      return;
    }
    setPicked(file);
    setUploadCategory(file.kind === 'document' ? 'material' : 'progress');
    setUploadDesc('');
    setProgress(null);
    setUploadOpen(true);
  };

  const startUpload = async () => {
    if (!picked) return;
    setProgress(0);
    try {
      await photoService.uploadPhoto(
        picked,
        { projectId: id!, category: uploadCategory, description: uploadDesc.trim() || undefined },
        (f) => setProgress(f),
      );
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showToast('Uploaded to project gallery');
      setPicked(null);
      setUploadDesc('');
      setUploadOpen(false);
      void reload();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not upload file', 'error');
    } finally {
      setProgress(null);
    }
  };

  const confirmDeleteItem = () => {
    if (!deleteTarget) return;
    deletePhoto(deleteTarget._id)
      .then(() => {
        showToast(deleteTarget.kind === 'image' ? 'Photo deleted' : 'File deleted');
        setDeleteTarget(null);
        void reload();
      })
      .catch((err) =>
        showToast(err instanceof Error ? err.message : 'Could not delete file', 'error'),
      );
  };

  const openViewer = (item: SiteMedia) => {
    router.push({
      pathname: '/media-viewer',
      params: {
        uri: item.url,
        kind: item.kind,
        title: item.description || categoryLabel(item.category),
        subtitle: formatDate(item.createdAt.slice(0, 10)),
      },
    });
  };

  // ── Layout ───────────────────────────────────────────────────────

  const cols = 2;
  const gap = 10;
  const tile = (Dimensions.get('window').width - spacing.lg * 2 - gap * (cols - 1)) / cols;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Gallery" onBack={() => router.back()} />
      <OfflineBanner />

      {/* Kind tabs */}
      <View style={[styles.kindRow, { paddingHorizontal: spacing.lg }]}>
        {KIND_TABS.map((t) => {
          const active = kindTab === t.value;
          const count = (data ?? []).filter((m) => m.kind === t.value).length;
          return (
            <Pressable
              key={t.value}
              onPress={() => setKindTab(t.value)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={[
                styles.kindTab,
                {
                  backgroundColor: active ? `${colors.primary}22` : colors.surfaceAlt,
                  borderColor: active ? colors.primary : 'transparent',
                  borderRadius: radius.md,
                },
              ]}
            >
              <Ionicons name={t.icon} size={16} color={active ? colors.primary : colors.textFaint} />
              <Text
                style={{
                  color: active ? colors.primary : colors.textMuted,
                  fontWeight: '700',
                  fontSize: 12.5,
                }}
              >
                {t.label}
              </Text>
              <View style={styles.countChip}>
                <Text style={{ color: colors.textFaint, fontSize: 10.5, fontWeight: '700' }}>{count}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Category chips (photos only) */}
      {kindTab === 'image' ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: 8 }}>
          {[{ label: 'All', value: 'all' as const }, ...PHOTO_CATEGORIES].map((f) => {
            const active = filter === f.value;
            return (
              <Pressable
                key={f.value}
                onPress={() => setFilter(f.value)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={{
                  backgroundColor: active ? colors.primary : colors.surfaceAlt,
                  borderRadius: radius.full,
                  paddingHorizontal: 13,
                  paddingVertical: 7,
                }}
              >
                <Text style={{ color: active ? colors.onPrimary : colors.textMuted, fontSize: 12.5, fontWeight: '700' }}>
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} />}
      >
        {loading && !data ? (
          <View style={styles.gridWrap}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} width={tile} height={tile + 44} style={{ borderRadius: radius.md }} />
            ))}
          </View>
        ) : error && !data ? (
          <ErrorState message={error} offline={offlineData} onRetry={() => void reload()} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={
              kindTab === 'image'
                ? 'images-outline'
                : kindTab === 'video'
                  ? 'videocam-outline'
                  : 'document-text-outline'
            }
            title={
              kindTab === 'image'
                ? 'No photos yet'
                : kindTab === 'video'
                  ? 'No site videos yet'
                  : 'No document scans yet'
            }
            message={
              kindTab === 'image'
                ? 'Capture progress shots, material deliveries or safety issues.'
                : kindTab === 'video'
                  ? 'Record walkthroughs and milestone footage for daily reports.'
                  : 'Scan material bills, delivery challans and purchase receipts.'
            }
            actionLabel={
              kindTab === 'image'
                ? 'Take photo'
                : kindTab === 'video'
                  ? 'Record video'
                  : 'Scan document'
            }
            onAction={() =>
              openCameraScreen(kindTab === 'video' ? 'video' : kindTab === 'document' ? 'document' : 'photo')
            }
          />
        ) : (
          <>
            <View style={[styles.gridWrap, { marginTop: 14 }]}>
              {filtered.map((item) => {
                const uri = resolveFileUrl(item.url);
                return (
                  <Pressable
                    key={item._id}
                    onPress={() => openViewer(item)}
                    onLongPress={() => setDeleteTarget(item)}
                    accessibilityRole="imagebutton"
                    accessibilityLabel={
                      item.kind === 'image'
                        ? `Photo: ${categoryLabel(item.category)}`
                        : item.kind === 'video'
                          ? 'Site video'
                          : 'Document scan'
                    }
                    style={({ pressed }) => ({
                      width: tile,
                      marginBottom: gap,
                      borderRadius: radius.md,
                      overflow: 'hidden',
                      backgroundColor: colors.surfaceAlt,
                      opacity: pressed ? 0.8 : 1,
                    })}
                  >
                    {item.kind === 'image' && uri ? (
                      <Image source={{ uri }} resizeMode="cover" style={{ width: tile, height: tile }} />
                    ) : (
                      <View style={{ width: tile, height: tile, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        <Ionicons
                          name={item.kind === 'video' ? 'videocam' : 'document-text'}
                          size={30}
                          color={colors.textFaint}
                        />
                        {item.kind === 'video' && item.durationSeconds ? (
                          <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                            {Math.floor(item.durationSeconds / 60)}:
                            {(item.durationSeconds % 60).toString().padStart(2, '0')}
                          </Text>
                        ) : null}
                      </View>
                    )}
                    <View style={{ padding: 9 }}>
                      <Badge
                        label={
                          item.kind === 'document'
                            ? 'Scan'
                            : item.kind === 'video'
                              ? 'Video'
                              : categoryLabel(item.category)
                        }
                        tone={item.kind === 'video' ? 'info' : item.kind === 'document' ? 'warning' : 'neutral'}
                      />
                      {item.description ? (
                        <Text numberOfLines={2} style={{ color: colors.text, fontSize: 12, marginTop: 6, lineHeight: 16 }}>
                          {item.description}
                        </Text>
                      ) : null}
                      <Text numberOfLines={1} style={{ color: colors.textFaint, fontSize: 10.5, marginTop: 4 }}>
                        {formatDate(item.createdAt.slice(0, 10))} · {relativeTime(item.createdAt)}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <Text style={{ color: colors.textFaint, fontSize: 11.5, textAlign: 'center', marginTop: 4 }}>
              Tap to view · long-press to delete
            </Text>
          </>
        )}
      </ScrollView>

      {/* Add button */}
      <Pressable
        onPress={() => setUploadOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Add media"
        style={({ pressed }) => ({
          position: 'absolute',
          right: 20,
          bottom: insets.bottom + 20,
          height: 48,
          paddingHorizontal: 18,
          borderRadius: 24,
          backgroundColor: colors.primary,
          opacity: pressed ? 0.85 : 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 7,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.25,
          shadowRadius: 10,
          elevation: 8,
        })}
      >
        <Ionicons name="add-circle-outline" size={19} color={colors.onPrimary} />
        <Text style={{ color: colors.onPrimary, fontWeight: '800', fontSize: 14.5 }}>Add</Text>
      </Pressable>

      {/* Add-media sheet */}
      <BottomSheet visible={uploadOpen} onClose={() => !progress && setUploadOpen(false)} title="Add to gallery">
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.md }}>
          {picked ? (
            <>
              {picked.kind === 'image' ? (
                <Image
                  source={{ uri: picked.uri }}
                  resizeMode="cover"
                  style={{ width: '100%', height: 200, borderRadius: radius.md }}
                />
              ) : (
                <View
                  style={{
                    height: 90,
                    borderRadius: radius.md,
                    backgroundColor: colors.surfaceAlt,
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'row',
                    gap: 10,
                  }}
                >
                  <Ionicons name={picked.kind === 'video' ? 'videocam' : 'document-attach'} size={24} color={colors.primary} />
                  <Text style={{ color: colors.text, fontWeight: '600', fontSize: 13.5 }}>
                    {picked.kind === 'video'
                      ? `Video selected${picked.durationSeconds ? ` · ${Math.round(picked.durationSeconds)}s` : ''}`
                      : 'Scan selected'}
                  </Text>
                </View>
              )}

              {progress != null ? (
                <UploadProgress fraction={progress} label="Uploading…" />
              ) : (
                <>
                  <SelectField
                    label="Category"
                    options={[...PHOTO_CATEGORIES]}
                    value={uploadCategory}
                    onChange={(v) => setUploadCategory(v as PhotoCategory)}
                    required
                  />
                  <Input
                    label="Description"
                    value={uploadDesc}
                    onChangeText={setUploadDesc}
                    placeholder={
                      picked.kind === 'document'
                        ? 'e.g. Cement bill #4412 — Shakti Suppliers'
                        : 'e.g. Slab pouring started — Tower A'
                    }
                    multiline
                  />
                  <Button label="Upload now" size="lg" onPress={() => void startUpload()} />
                </>
              )}
            </>
          ) : (
            <>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button label="Take photo" variant="secondary" size="sm" onPress={() => openCameraScreen('photo')} style={{ flex: 1 }} />
                <Button label="Record video" variant="secondary" size="sm" onPress={() => openCameraScreen('video')} style={{ flex: 1 }} />
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button label="Pick photo" variant="secondary" size="sm" onPress={() => void pickFromLibrary('images')} style={{ flex: 1 }} />
                <Button label="Pick video" variant="secondary" size="sm" onPress={() => void pickFromLibrary('videos')} style={{ flex: 1 }} />
              </View>
              <Button
                label="Scan invoice / challan"
                onPress={() => openCameraScreen('document')}
              />
              <Text style={{ color: colors.textFaint, fontSize: 11.5, textAlign: 'center', lineHeight: 16 }}>
                Images up to 8 MB · Videos up to 64 MB · PDF scans up to 10 MB
              </Text>
            </>
          )}
        </View>
      </BottomSheet>

      {/* Library permission recovery */}
      <ConfirmDialog
        visible={deleteTarget != null}
        title={
          deleteTarget?.kind === 'image'
            ? 'Delete this photo?'
            : deleteTarget?.kind === 'video'
              ? 'Delete this video?'
              : 'Delete this scan?'
        }
        message="This removes it from the project gallery for everyone."
        confirmLabel="Delete"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDeleteItem}
      />

      <BottomSheet visible={mediaLibraryDenied} onClose={() => setMediaLibraryDenied(false)}>
        <PermissionState
          area="mediaLibrary"
          permanentlyDenied
          onRequest={() => setMediaLibraryDenied(false)}
        />
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  gridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  kindRow: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 4,
    paddingBottom: 8,
  },
  kindTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderWidth: 1,
  },
  countChip: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(127,127,127,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
});
