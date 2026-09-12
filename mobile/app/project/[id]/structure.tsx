import React, { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { SelectSheet } from '@/components/ui/SelectSheet';
import { useTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/stores/uiStore';
import { useDataVersion, DATA_KEYS } from '@/stores/dataVersion';
import { structureService } from '@/services/erpService';
import { STRUCTURE_NODE_TYPE_OPTIONS } from '@/constants/options';
import type { StructureNode, StructureNodeType } from '@/types';

export default function StructureScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; name?: string }>();
  const projectId = String(params.id);
  const showToast = useUIStore((s) => s.showToast);
  const bump = useDataVersion((s) => s.bump);
  const { colors, spacing } = theme;

  const [tree, setTree] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addParentId, setAddParentId] = useState<string | null | undefined>(undefined);
  const [typeSheetFor, setTypeSheetFor] = useState<string | null | undefined>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(!tree);
    try {
      const result = await structureService.getTree(projectId);
      setTree(result.tree ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load structure.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  interface TreeNode {
    kind: 'node' | 'unit';
    _id: string;
    nodeType?: string;
    name: string;
    progressPercentage?: number;
    unitType?: string;
    totalValue?: number;
    status?: string;
    children: TreeNode[];
  }

  const addLevel = (parentId: string | null) => {
    setAddParentId(parentId);
    setTypeSheetFor(parentId ?? '__root__');
  };

  const createNode = async (rawNodeType: string) => {
    const nodeType = rawNodeType as StructureNodeType;
    if (typeSheetFor === null || typeSheetFor === undefined) return;
    const parentId = typeSheetFor === '__root__' ? null : typeSheetFor;
    const label =
      STRUCTURE_NODE_TYPE_OPTIONS.find((o) => o.value === nodeType)?.label ?? 'Level';
    setTypeSheetFor(null);
    // Prompt for a name via Alert.prompt on iOS falls back to a default name.
    const fallbackName = `${label} ${new Date().getTime() % 100}`;
    setBusy(true);
    try {
      await structureService.createNode({
        projectId,
        parentId,
        nodeType,
        name: fallbackName,
      });
      bump(DATA_KEYS.structure);
      showToast(`${label} added — long-press to rename`);
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const renameNode = (node: { _id: string; name: string }) => {
    void node;
    showToast('Rename is available on web console', 'info');
  };

  const deleteNode = (node: { _id: string; name: string }) => {
    Alert.alert(`Delete "${node.name}"?`, 'All sub-levels under it will also be removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          (async () => {
            try {
              await structureService.deleteNode(node._id);
              showToast('Deleted');
              bump(DATA_KEYS.structure);
              await load();
            } catch (err) {
              showToast(err instanceof Error ? err.message : 'Failed', 'error');
            }
          })(),
      },
    ]);
  };

  const renderNode = (node: TreeNode, depth: number): React.ReactNode => {
    if (node.kind === 'unit') {
      return (
        <View
          key={node._id}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 7,
            paddingLeft: depth * 18 + 30,
            gap: 8,
          }}
        >
          <Ionicons name="cube-outline" size={14} color={colors.textFaint} />
          <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '600' }}>
            {node.name}
          </Text>
          <Text style={{ color: colors.textFaint, fontSize: 11.5 }}>{node.unitType}</Text>
          <Badge
            label={String(node.status)}
            tone={
              ['sold'].includes(String(node.status))
                ? 'neutral'
                : ['booked'].includes(String(node.status))
                  ? 'orange'
                  : ['available'].includes(String(node.status))
                    ? 'success'
                    : 'info'
            }
          />
        </View>
      );
    }
    return (
      <View key={node._id}>
        <Pressable
          onPress={() => addLevel(node._id)}
          onLongPress={() => deleteNode({ _id: node._id, name: node.name })}
          accessibilityRole="button"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 9,
            paddingLeft: depth * 18 + 6,
            gap: 8,
          }}
        >
          <Ionicons
            name={
              node.nodeType === 'block'
                ? 'business-outline'
                : node.nodeType === 'floor'
                  ? 'layers-outline'
                  : node.nodeType === 'phase'
                    ? 'git-branch-outline'
                    : 'ellipse-outline'
            }
            size={15}
            color={colors.primary}
          />
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14 }}>
            {node.name}
          </Text>
          <View style={{ flex: 1 }} />
          <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700' }}>
            {Math.round(node.progressPercentage ?? 0)}%
          </Text>
        </Pressable>
        {node.children.map((child) => renderNode(child, depth + 1))}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Structure"
        subtitle={params.name ?? 'Project hierarchy'}
        onBack={() => router.back()}
        right={
          <Button
            label="Add level"
            size="sm"
            onPress={() => addLevel(null)}
            disabled={busy}
          />
        }
      />
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 60 }}>
        {loading && !tree ? (
          <Skeleton height={220} style={{ borderRadius: 14, marginTop: 12 }} />
        ) : error ? (
          <ErrorState message={error} offline onRetry={() => void load()} />
        ) : !tree || tree.length === 0 ? (
          <>
            <EmptyState
              icon="git-network-outline"
              title="No structure yet"
              message="Build the hierarchy: Phase → Tower → Floor → Units. Industrial sites can use Zones & Areas instead."
            />
            <Button label="Add first level" onPress={() => addLevel(null)} />
          </>
        ) : (
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              padding: spacing.md,
              marginTop: spacing.md,
            }}
          >
            {tree.map((node) => renderNode(node, 0))}
          </View>
        )}
        <Text style={{ color: colors.textFaint, fontSize: 12, marginTop: 10 }}>
          Tap a level to add a sub-level. Long-press to delete.
        </Text>
      </ScrollView>

      <SelectSheet
        visible={typeSheetFor != null}
        onClose={() => setTypeSheetFor(null)}
        title="Choose level type"
        options={STRUCTURE_NODE_TYPE_OPTIONS.map((o) => ({ label: o.label, value: o.value }))}
        value=""
        onSelect={(v) => void createNode(v)}
      />
    </View>
  );
}

const styles = StyleSheet.create({});
void styles;

