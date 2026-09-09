"use client";

import {
  type UseMutationOptions,
  type UseQueryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { get, list, send } from "./browser";
import type { ListEnvelope } from "./envelope";
import { type ApiError, describeForToast, toApiError } from "./errors";

/**
 * TanStack Query wrappers that make the two things every screen needs
 * automatic rather than remembered:
 *
 *  - **Errors become toasts that carry the request id.** Every failure path
 *    goes through `describeForToast`, so no call site can accidentally ship an
 *    error message a support engineer cannot trace.
 *  - **A successful mutation refreshes the server components.**
 *    `router.refresh()` re-runs the server render, so a table fetched on the
 *    server updates after an action taken on the client without the screen
 *    keeping a second, client-side copy of the same rows.
 */

/** GET a single resource. */
export function useApiQuery<T>(
  key: readonly unknown[],
  path: string,
  options?: Omit<UseQueryOptions<T, ApiError>, "queryKey" | "queryFn">,
) {
  return useQuery<T, ApiError>({
    queryKey: key,
    queryFn: async () => {
      try {
        return await get<T>(path);
      } catch (cause) {
        throw toApiError(cause);
      }
    },
    ...options,
  });
}

/** GET a page. */
export function useApiList<T>(
  key: readonly unknown[],
  path: string,
  options?: Omit<UseQueryOptions<ListEnvelope<T>, ApiError>, "queryKey" | "queryFn">,
) {
  return useQuery<ListEnvelope<T>, ApiError>({
    queryKey: key,
    queryFn: async () => {
      try {
        return await list<T>(path);
      } catch (cause) {
        throw toApiError(cause);
      }
    },
    ...options,
  });
}

export interface ApiMutationConfig<TResult, TVariables> {
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  /** Built per-call so path parameters can come from the variables. */
  path: (variables: TVariables) => string;
  body?: (variables: TVariables) => unknown;
  /** Toast shown on success. Omit for a silent mutation. */
  successMessage?: (result: TResult, variables: TVariables) => string;
  /** Query keys to invalidate after success. */
  invalidate?: readonly (readonly unknown[])[];
  /** Re-run the server render after success. Defaults to true. */
  refreshRoute?: boolean;
  onSuccess?: (result: TResult, variables: TVariables) => void;
}

export function useApiMutation<TResult = unknown, TVariables = void>(
  config: ApiMutationConfig<TResult, TVariables>,
  options?: Omit<UseMutationOptions<TResult, ApiError, TVariables>, "mutationFn">,
) {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation<TResult, ApiError, TVariables>({
    mutationFn: async (variables) => {
      try {
        return await send<TResult>(
          config.method,
          config.path(variables),
          config.body ? config.body(variables) : undefined,
        );
      } catch (cause) {
        throw toApiError(cause);
      }
    },
    onSuccess: (result, variables, context, mutation) => {
      if (config.successMessage) {
        toast.success(config.successMessage(result, variables));
      }
      for (const key of config.invalidate ?? []) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
      if (config.refreshRoute !== false) {
        router.refresh();
      }
      config.onSuccess?.(result, variables);
      options?.onSuccess?.(result, variables, context, mutation);
    },
    onError: (error, variables, context, mutation) => {
      const { title, description } = describeForToast(error);
      toast.error(title, description ? { description } : undefined);
      options?.onError?.(error, variables, context, mutation);
    },
    ...options,
  });
}

/** Surfaces an arbitrary failure as the same toast shape as a mutation. */
export function reportError(error: unknown): void {
  const { title, description } = describeForToast(error);
  toast.error(title, description ? { description } : undefined);
}
