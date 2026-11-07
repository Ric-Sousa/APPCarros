import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { get } from "./apiUtils";

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
