import { queryOptions } from "@tanstack/react-query";
import { getSession } from "@/lib/api/auth";

export const sessionQueryKey = ["auth", "session"] as const;

export const sessionQueryOptions = queryOptions({
  queryKey: sessionQueryKey,
  queryFn: getSession,
  staleTime: 30_000,
  gcTime: 5 * 60_000,
});
