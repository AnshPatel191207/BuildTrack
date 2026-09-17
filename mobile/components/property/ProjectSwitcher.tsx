import React, { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useProjectStore } from '@/stores/projectStore';
import { useResource } from '@/hooks/useResource';
import { propertyService } from '@/services/propertyService';
import type { PropertyProject } from '@/types';

interface Props {
  onProjectChange?: (project: PropertyProject) => void;
}

export function ProjectSwitcher({ onProjectChange }: Props) {
  const { colors, radius, spacing } = useTheme();
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const activeProjectName = useProjectStore((s) => s.activeProjectName);
  const activeProjectLogo = useProjectStore((s) => s.activeProjectLogo);
  const setActiveProject = useProjectStore((s) => s.setActiveProject);

  const [modalOpen, setModalOpen] = useState(false);

  const { data: projects, loading } = useResource<PropertyProject[]>(
    () => propertyService.listProjects(),
    [],
  );

  const handleSelect = async (project: PropertyProject) => {
    await setActiveProject(project);
    setModalOpen(false);
    onProjectChange?.(project);
  };

  return (
    <>
      <Pressable
        onPress={() => setModalOpen(true)}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.surfaceAlt,
          borderColor: colors.borderStrong,
          borderWidth: 1,
          borderRadius: radius.md,
          paddingHorizontal: 10,
          paddingVertical: 6,
          opacity: pressed ? 0.8 : 1,
        })}
      >
        {activeProjectLogo ? (
          <Image
            source={{ uri: activeProjectLogo }}
            style={{ width: 22, height: 22, borderRadius: 4, marginRight: 8, resizeMode: 'contain' }}
          />
        ) : (
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: 4,
              backgroundColor: colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 8,
            }}
          >
            <Ionicons name="business" size={12} color="#FFFFFF" />
          </View>
        )}
        <View style={{ marginRight: 6 }}>
          <Text style={{ fontSize: 9.5, color: colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 }}>
            Active Project
          </Text>
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }} numberOfLines={1}>
            {activeProjectName}
          </Text>
        </View>
        <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
      </Pressable>

      {/* Switcher Modal */}
      <Modal visible={modalOpen} transparent animationType="fade">
        <Pressable
          onPress={() => setModalOpen(false)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.lg,
              padding: spacing.lg,
              width: '100%',
              maxWidth: 420,
              maxHeight: '75%',
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <View>
                <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>Switch Builder Project</Text>
                <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                  Theme, logo, and documents adapt instantly
                </Text>
              </View>
              <Pressable onPress={() => setModalOpen(false)}>
                <Ionicons name="close" size={22} color={colors.textFaint} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
              {projects?.map((p) => {
                const isSelected = p._id === activeProjectId;
                const projectPrimary = (p as any).theme?.primary || colors.primary;
                const projectLogo = (p as any).branding?.logoUrl;

                return (
                  <Pressable
                    key={p._id}
                    onPress={() => void handleSelect(p)}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: isSelected ? colors.surfaceAlt : colors.surface,
                      borderColor: isSelected ? projectPrimary : colors.border,
                      borderWidth: isSelected ? 2 : 1,
                      borderRadius: radius.md,
                      padding: 12,
                      opacity: pressed ? 0.85 : 1,
                    })}
                  >
                    {projectLogo ? (
                      <Image
                        source={{ uri: projectLogo }}
                        style={{ width: 36, height: 36, borderRadius: 6, marginRight: 12, resizeMode: 'contain' }}
                      />
                    ) : (
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 6,
                          backgroundColor: projectPrimary,
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 12,
                        }}
                      >
                        <Ionicons name="business" size={20} color="#FFFFFF" />
                      </View>
                    )}

                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
                        {p.name}
                      </Text>
                      <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                        {p.builderName ? `By ${p.builderName}` : p.projectCode} • {p.location || 'Location N/A'}
                      </Text>
                    </View>

                    {isSelected ? (
                      <Ionicons name="checkmark-circle" size={22} color={projectPrimary} />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
