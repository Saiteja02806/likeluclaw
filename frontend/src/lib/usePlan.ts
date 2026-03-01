import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function usePlan() {
  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.getProfile(),
    staleTime: 60_000,
  });

  const plan = profile?.plan || 'free';
  const isPremium = plan !== 'free';

  return { plan, isPremium, isLoading };
}
