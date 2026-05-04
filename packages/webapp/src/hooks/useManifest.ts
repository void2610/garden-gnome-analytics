import { useQuery } from '@tanstack/react-query';
import { fetchManifest } from '../lib/manifest';

export function useManifest() {
  return useQuery({
    queryKey: ['manifest'],
    queryFn: fetchManifest,
  });
}
