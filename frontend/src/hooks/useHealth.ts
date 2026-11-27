import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '../lib/api-client'
import { queryKeys } from '../store/query-keys'
import type { HealthStatus } from '../types/api'

export const useHealth = (verbose = false) =>
  useQuery({
    queryKey: queryKeys.health(verbose),
    queryFn: () =>
      apiRequest<HealthStatus>('/health', {
        params: verbose ? { verbose: 'true' } : undefined,
      }),
  })