import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from "@tanstack/react-query";
import { Message } from "../types/api";
import { useApi } from "./useApi";
import { messageKeys } from "./queryKeys";

// Basic hook for recent messages (default behavior)
export const useMessages = (groupId: string, isActive = false) => {
  const { getMessages } = useApi();

  return useQuery({
    queryKey: messageKeys.list(groupId),
    queryFn: () => getMessages(groupId), // Gets default 50 most recent
    enabled: !!groupId && isActive,
    // Aggressive polling when chat is active, slower when not
    refetchInterval: isActive ? 3000 : 15000, // 3s when active, 15s when inactive
    staleTime: 2000, // Consider data stale after 2 seconds for real-time feel
    refetchOnWindowFocus: true,
  });
};

// Advanced hook with pagination for full chat history
export const useInfiniteMessages = (
  groupId: string,
  pageSize = 50,
  isActive = true
) => {
  const { getMessages } = useApi();

  return useInfiniteQuery({
    queryKey: messageKeys.infinite(groupId),
    queryFn: ({ pageParam = 0 }) => getMessages(groupId, pageSize, pageParam),
    enabled: !!groupId && isActive,
    getNextPageParam: (lastPage, allPages) => {
      // If we got fewer messages than requested, we've reached the end
      if (lastPage.length < pageSize) return undefined;
      // Next offset is the total number of messages we've loaded
      return allPages.length * pageSize;
    },
    // Smart polling: aggressive when chat is visible/active
    refetchInterval: isActive ? 2000 : 10000, // 2s when active, 10s when background
    staleTime: 1000, // Very fresh data for active chats
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    initialPageParam: 0,
    // Memory management: limit pages but allow reasonable chat history
    maxPages: 15, // 750 messages max (15 pages * 50 messages)
    // Aggressive garbage collection for old pages
    gcTime: 5 * 60 * 1000, // 5 minutes instead of default 5 minutes
  });
};

export const useCreateMessage = () => {
  const { createMessage } = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { groupId: string; content: string }) =>
      createMessage(data),
    onSuccess: async (newMessage, variables) => {
      try {
        // 1. Optimistic update for immediate UI feedback
        queryClient.setQueryData(
          messageKeys.infinite(variables.groupId),
          (oldData: any) => {
            if (!oldData) {
              return {
                pages: [[newMessage]],
                pageParams: [0],
              };
            }

            // Safely update the first page with the new message
            const newPages = [...oldData.pages];
            if (newPages.length > 0) {
              newPages[0] = [newMessage, ...newPages[0]];

              // Trim first page if it gets too large (prevent memory bloat)
              if (newPages[0].length > 60) {
                newPages[0] = newPages[0].slice(0, 50);
              }
            } else {
              newPages[0] = [newMessage];
            }

            return {
              ...oldData,
              pages: newPages,
            };
          }
        );

        // Update basic messages cache if it exists
        queryClient.setQueryData(
          messageKeys.list(variables.groupId),
          (oldData: Message[] | undefined) => {
            if (!oldData) return [newMessage];
            const updated = [newMessage, ...oldData];
            return updated.slice(0, 50); // Keep only latest 50
          }
        );

        // 2. Immediately refetch to get server state and any missed messages
        await Promise.all([
          queryClient.refetchQueries({
            queryKey: messageKeys.infinite(variables.groupId),
            type: "active",
          }),
          queryClient.refetchQueries({
            queryKey: messageKeys.list(variables.groupId),
            type: "active",
          }),
        ]);

        // 3. Temporarily boost polling for next 30 seconds to catch quick responses
        setTimeout(() => {
          queryClient.invalidateQueries({
            queryKey: messageKeys.infinite(variables.groupId),
          });
        }, 500); // Quick follow-up check after 500ms

        setTimeout(() => {
          queryClient.invalidateQueries({
            queryKey: messageKeys.infinite(variables.groupId),
          });
        }, 2000); // Another check after 2s

        setTimeout(() => {
          queryClient.invalidateQueries({
            queryKey: messageKeys.infinite(variables.groupId),
          });
        }, 5000); // Final boost check after 5s
      } catch (error) {
        console.warn("Cache update error:", error);
        // Fallback: force refetch if cache operations fail
        queryClient.refetchQueries({
          queryKey: messageKeys.list(variables.groupId),
        });
        queryClient.refetchQueries({
          queryKey: messageKeys.infinite(variables.groupId),
        });
      }
    },
    onError: (error) => {
      console.error("Message send error:", error);
    },
  });
};
