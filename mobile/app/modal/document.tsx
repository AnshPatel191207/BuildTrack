import { useFocusEffect, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { Text, TextInput, View } from 'react-native';
import { FormModalShell } from '@/components/erp/FormModalShell';
import { SelectField } from '@/components/ui/SelectField';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/stores/uiStore';
import { useDataVersion, DATA_KEYS } from '@/stores/dataVersion';
import { documentService } from '@/services/erpService';
import { projectService } from '@/services/projectService';
import { DOCUMENT_CATEGORY_OPTIONS } from '@/constants/options';
import { validateMediaFile } from '@/services/photoService';
import { usePendingMediaStore } from '@/stores/pendingMediaStore';

export default function DocumentModal() {
  const theme = useTheme();
  const showToast = useUIStore((s) => s.showToast);
  const bump = useDataVersion((s) => s.bump);
  const router = useRouter();
  const { colors } = theme;
  const [saving, setSaving] = useState(false);
  const [projects, setProjects] = useState<{ label: string; value: string }[]>([]);
  const [projectId, setProjectId] = useState('');
  const [category, setCategory] = useState('other');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<{ uri: string; mimeType: string } | null>(null);

  useEffect(() => {
    projectService
      .listProjects({})
      .then((list) =>
        setProjects([
          { label: 'Company-level document', value: '' },
          ...list.items.map((p) => ({ label: p.name, value: p._id })),
        ]),
      )
      .catch(() => {});
  }, []);

  // Receive a captured file back from the camera flow.
  useFocusEffect(
    useCallback2(() => {
      const media = usePendingMediaStore.getState().consume('document:file');
      if (!media) return;
      const problem = validateMediaFile({ mimeType: media.mimeType });
      if (problem) {
        showToast(problem, 'error');
        return;
      }
      setFile({ uri: media.uri, mimeType: media.mimeType });
    }, []),
  );

  const submit = async () => {
    if (!file) {
      showToast('Attach a file — snap a photo or scan a PDF', 'error');
      return;
    }
    if (title.trim().length < 2) {
      showToast('Give the document a title', 'error');
      return;
    }
    setSaving(true);
    try {
      await documentService.upload(
        { uri: file.uri, mimeType: file.mimeType },
        { title: title.trim(), category, projectId: projectId || undefined },
      );
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showToast('Document uploaded');
      bump(DATA_KEYS.documents);
      router.back();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Upload failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModalShell
      title="Upload document"
      subtitle="Drawings · NOCs · agreements"
      submitting={saving}
      submitLabel="Upload"
      onSubmit={submit}
    >
      <View>
        <Text style={{ color: colors.textMuted, fontSize: 12.5, fontWeight: '700', marginBottom: 8 }}>
          Document title *
        </Text>
        <View
          style={{
            backgroundColor: colors.surfaceAlt,
            borderRadius: 9,
            paddingHorizontal: 12,
          }}
        >
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Tower A structural drawing"
            placeholderTextColor={colors.textFaint}
            style={{ color: colors.text, fontSize: 14.5, paddingVertical: 11 }}
          />
        </View>
      </View>
      <SelectField
        label="Category"
        options={[...DOCUMENT_CATEGORY_OPTIONS]}
        value={category}
        onChange={(v) => setCategory(v as string)}
        required
      />
      <SelectField
        label="Linked project"
        options={[{ label: projects[0]?.label ?? 'Loading…', value: '' }, ...projects.slice(1)]}
        value={projectId}
        onChange={setProjectId}
      />
      {file ? (
        <Text style={{ color: colors.success, fontSize: 13, fontWeight: '600' }}>
          Attached: {file.mimeType === 'application/pdf' ? 'PDF scan' : 'Photo'} ✓
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button
          label="Snap photo"
          variant="secondary"
          size="sm"
          onPress={() =>
            router.push({ pathname: '/camera', params: { mode: 'photo', requestId: 'document:file' } } as never)
          }
          style={{ flex: 1 }}
        />
        <Button
          label="Scan PDF"
          variant="secondary"
          size="sm"
          onPress={() =>
            router.push({ pathname: '/camera', params: { mode: 'document', requestId: 'document:file' } } as never)
          }
          style={{ flex: 1 }}
        />
      </View>
    </FormModalShell>
  );
}

// Local alias to keep the focus-effect callback dependency-free.
// eslint-disable-next-line react-hooks/exhaustive-deps
function useCallback2(fn: () => void, _deps: unknown[] = []): () => void {
  return React.useCallback(fn, []);
}



