import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { get, makeAuthenticatedRequest } from "./apiUtils";

/** Raw authenticated request returning the Response (kept for existing callers). */
export function apiRequest(method: string, url: string, data?: unknown): Promise<Response> {
  return makeAuthenticatedRequest(url, {
    method,
    body: data === undefined ? undefined : JSON.stringify(data),
  });
}

// Default queryFn: the queryKey parts joined by "/" form the URL.
const defaultQueryFn: QueryFunction = ({ queryKey }) => get(queryKey.join("/"));

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: defaultQueryFn,
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
