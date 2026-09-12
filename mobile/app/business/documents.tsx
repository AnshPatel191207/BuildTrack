import React, { useCallback, useState } from 'react';
import { Linking, Text } from 'react-native';
import { Badge } from '@/components/ui/Badge';
import { ErpListScreen, RowCard } from '@/components/erp/ListScreenKit';
import { documentService } from '@/services/erpService';
import { DOCUMENT_CATEGORY_OPTIONS } from '@/constants/options';
import { useTheme } from '@/hooks/useTheme';
import { resolveFileUrl } from '@/services/api';
import { formatDateShort } from '@/lib/format';
import { useDataVersionKey, DATA_KEYS } from '@/stores/dataVersion';
import type { DocumentFile } from '@/types';

export default function DocumentsScreen() {
  const { colors } = useTheme();
  const [category, setCategory] = useState('');
  const version = useDataVersionKey(DATA_KEYS.documents);

  const fetchPage = useCallback(
    async (page: number) =>
      documentService.list({ category: category || undefined, page }),
    [category, version],
  );

  return (
    <ErpListScreen<DocumentFile>
      title="Documents"
      subtitle="Central document vault"
      fetchPage={fetchPage}
      deps={[category, version]}
      keyExtractor={(d) => d._id}
      addRoute="/modal/document"
      addLabel="Upload"
      chips={[
        { label: 'All', value: '' },
        ...DOCUMENT_CATEGORY_OPTIONS.map((o) => ({ label: o.label, value: o.value })),
      ]}
      chipValue={category}
      onChipChange={setCategory}
      renderItem={(doc) => (
        <RowCard
          icon={
            doc.kind === 'image'
              ? 'image-outline'
              : doc.kind === 'video'
                ? 'videocam-outline'
                : 'document-text-outline'
          }
          title={doc.title}
          subtitle={[
            doc.projectId && typeof doc.projectId === 'object' ? doc.projectId.name : undefined,
            `Uploaded ${formatDateShort(doc.createdAt)}`,
            doc.expiryDate ? `Expires ${formatDateShort(doc.expiryDate)}` : undefined,
          ]
            .filter(Boolean)
            .join(' · ')}
          right={
            <Text
              style={{ color: colors.primary, fontSize: 12.5, fontWeight: '700' }}
              onPress={() => {
                const url = resolveFileUrl(doc.url);
                if (url) void Linking.openURL(url);
              }}
            >
              Open
            </Text>
          }
        />
      )}
      emptyTitle="No documents"
      emptyMessage="Store drawings, NOCs, approvals and agreements here."
    />
  );
}
