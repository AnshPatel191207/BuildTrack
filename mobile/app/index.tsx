import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { ErrorState } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/hooks/useTheme';

/** Route gate — decides where the user lands based on auth + onboarding state. */
export default function Index() {
  const status = useAuthStore((s) => s.status);
  const bootError = useAuthStore((s) => s.bootError);
  const retryBootstrap = useAuthStore((s) => s.retryBootstrap);
  const { colors, spacing } = useTheme();

  if (status === 'booting') {
    return null; // splash screen still visible
  }

  if (status === 'error') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.background }}>
        <ErrorState
          offline
          message={bootError ?? undefined}
          onRetry={() => void retryBootstrap()}
        />
      </View>
    );
  }

  if (status === 'unauthenticated') {
    return <Redirect href="/(auth)/login" />;
  }
  if (status === 'onboarding') {
    return <Redirect href="/onboarding/company" />;
  }
  if (status === 'authenticated') {
    return <Redirect href="/(tabs)/dashboard" />;
  }

  // Fallback — shouldn't happen.
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
      <Button label="Reload app" onPress={() => void retryBootstrap()} />
    </View>
  );
}
