import { useRouter } from 'expo-router';

import { Header, Screen } from '@/components/ui/Screen';
import { EmptyState } from '@/components/ui/StateViews';

export default function NotFound() {
  const router = useRouter();
  return (
    <Screen>
      <Header title="Not found" back />
      <EmptyState icon="compass" title="Wrong turn" body="That page does not exist." actionLabel="Back to Today" onAction={() => router.replace('/')} />
    </Screen>
  );
}
