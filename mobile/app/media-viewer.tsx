import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';

type Params = {
  uri?: string;
  kind?: 'image' | 'video' | 'document';
  mimeType?: string;
  title?: string;
  subtitle?: string;
  /** Documents can't render inline — offer to open externally. */
};

/** Full-screen viewer for gallery photos and site videos. */
export default function MediaViewerScreen() {
  const { uri, kind = 'image', title, subtitle } = useLocalSearchParams<Params>();
  const theme = useTheme();
  const router = useRouter();
  const [loadError, setLoadError] = useState(false);

  const player = useVideoPlayer(kind === 'video' && uri ? uri : null, (p) => {
    p.loop = false;
  });

  if (!uri) {
    return (
      <SafeAreaView style={[styles.flex1, styles.center, { backgroundColor: '#000' }]}>
        <Text style={{ color: '#fff' }}>Nothing to show</Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={[styles.flex1, { backgroundColor: '#000' }]}>
      <SafeAreaView edges={['top']} style={styles.topBar}>
        <Pressable accessibilityLabel="Close" onPress={() => router.back()} hitSlop={8} style={styles.roundBtn}>
          <Ionicons name="close" size={24} color="#fff" />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 10 }}>
          {title ? (
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }} numberOfLines={1}>
              {title}
            </Text>
          ) : null}
          {subtitle ? (
            <Text style={{ color: '#aaa', fontSize: 12, marginTop: 2 }} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <View style={{ width: 42 }} />
      </SafeAreaView>

      <View style={styles.stage}>
        {kind === 'video' ? (
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            allowsPictureInPicture
          />
        ) : kind === 'document' ? (
          <View style={styles.center}>
            <Ionicons name="document-text" size={72} color="rgba(255,255,255,0.75)" />
            <Text style={{ color: '#fff', marginTop: 14, fontWeight: '700' }}>PDF document scan</Text>
            <Text style={{ color: '#aaa', fontSize: 13, marginTop: 6, textAlign: 'center', paddingHorizontal: 44 }}>
              Scanned invoices are stored with the project documents.
            </Text>
          </View>
        ) : loadError ? (
          <View style={styles.center}>
            <Ionicons name="image-outline" size={56} color="#888" />
            <Text style={{ color: '#ccc', marginTop: 10 }}>Could not load this image.</Text>
          </View>
        ) : (
          <Image
            source={{ uri }}
            style={StyleSheet.absoluteFill}
            resizeMode="contain"
            onError={() => setLoadError(true)}
          />
        )}
      </View>

      <SafeAreaView edges={['bottom']} style={{ paddingBottom: 14 }}>
        <Text style={{ color: '#777', fontSize: 11.5, textAlign: 'center' }}>
          {kind === 'video'
            ? 'Site progress videos stay attached to daily reports and the project timeline.'
            : undefined}
        </Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 6,
    zIndex: 10,
  },
  roundBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(40,40,40,0.7)',
  },
  stage: {
    ...(StyleSheet.absoluteFill as any),
    justifyContent: 'center',
  },
});
