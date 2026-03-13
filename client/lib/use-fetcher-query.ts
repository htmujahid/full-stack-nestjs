import { useQuery } from '@tanstack/react-query';
import { fetcher, type FetcherOptions } from './fetcher';

export function useFetcherQuery<T>(url: string, options?: FetcherOptions) {
  return useQuery({
    queryKey: [url],
    queryFn: () => fetcher<T>(url, options).then((r) => r.data),
  });
}
