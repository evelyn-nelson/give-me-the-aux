import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "./useApi";
import {
  Group,
  CreateGroupData,
  UpdateGroupData,
  Round,
  GroupMemberWithSubmissionStatus,
} from "../types/api";
import { groupKeys, roundKeys } from "./queryKeys";

// Utility function to prefetch related data
const prefetchRelatedData = (queryClient: any, group: Group) => {
  // Set individual group data in cache
  queryClient.setQueryData(groupKeys.detail(group.id), group);

  // Set individual round data in cache for each round
  group.rounds?.forEach((round) => {
    queryClient.setQueryData(roundKeys.detail(round.id), round);
  });
};

// Hooks
export const useGroups = () => {
  const api = useApi();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: groupKeys.list(),
    queryFn: async () => {
      const response = await api.get("/api/groups");
      const groups = response.data as Group[];

      // Prefetch individual group and round data into cache
      groups.forEach((group) => {
        prefetchRelatedData(queryClient, group);
      });

      return groups;
    },
    staleTime: 1000 * 60 * 5, // Consider data fresh for 5 minutes
  });
};

export const useGroup = (id: string, initialData?: Group) => {
  const api = useApi();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: groupKeys.detail(id),
    queryFn: async () => {
      const response = await api.get(`/api/groups/${id}`);
      const group = response.data as Group;

      // Prefetch individual round data into cache
      prefetchRelatedData(queryClient, group);

      return group;
    },
    enabled: !!id,
    initialData, // Use provided initial data to avoid loading states
    staleTime: 1000 * 60 * 5, // Consider data fresh for 5 minutes
  });
};

export const useCreateGroup = () => {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateGroupData) => {
      const response = await api.post("/api/groups", data);
      return response.data as Group;
    },
    onSuccess: (newGroup) => {
      // Prefetch the new group's data
      prefetchRelatedData(queryClient, newGroup);
      // Invalidate and refetch groups list
      queryClient.invalidateQueries({ queryKey: groupKeys.lists() });
    },
  });
};

export const useUpdateGroup = () => {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateGroupData }) => {
      const response = await api.patch(`/api/groups/${id}`, data);
      return response.data as Group;
    },
    onSuccess: (updatedGroup) => {
      // Update related data in cache
      prefetchRelatedData(queryClient, updatedGroup);
      // Invalidate groups list to refresh any cached data
      queryClient.invalidateQueries({ queryKey: groupKeys.lists() });
    },
  });
};

export const useDeleteGroup = () => {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/api/groups/${id}`);
      return response.data;
    },
    onSuccess: (_, deletedGroupId) => {
      // Remove the deleted group from cache
      queryClient.removeQueries({ queryKey: groupKeys.detail(deletedGroupId) });
      // Invalidate groups list
      queryClient.invalidateQueries({ queryKey: groupKeys.lists() });
    },
  });
};

export const useGroupRoundMembers = (groupId: string, roundId: string) => {
  const api = useApi();

  return useQuery({
    queryKey: groupKeys.roundMembers(groupId, roundId),
    queryFn: async () => {
      const response = await api.get(
        `/api/groups/${groupId}/rounds/${roundId}/members`
      );
      return response.data as GroupMemberWithSubmissionStatus[];
    },
    enabled: !!groupId && !!roundId,
    staleTime: 1000 * 30, // Consider data fresh for 30 seconds
  });
};
