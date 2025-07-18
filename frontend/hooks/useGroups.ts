import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "./useApi";
import { Group, CreateGroupData, UpdateGroupData } from "../types/api";

// Query Keys
export const groupKeys = {
  all: ["groups"] as const,
  lists: () => [...groupKeys.all, "list"] as const,
  list: () => [...groupKeys.lists()] as const,
  details: () => [...groupKeys.all, "detail"] as const,
  detail: (id: string) => [...groupKeys.details(), id] as const,
};

// Hooks
export const useGroups = () => {
  const api = useApi();

  return useQuery({
    queryKey: groupKeys.list(),
    queryFn: async () => {
      const response = await api.get("/api/groups");
      return response.data as Group[];
    },
  });
};

export const useGroup = (id: string) => {
  const api = useApi();

  return useQuery({
    queryKey: groupKeys.detail(id),
    queryFn: async () => {
      const response = await api.get(`/api/groups/${id}`);
      return response.data as Group;
    },
    enabled: !!id,
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
    onSuccess: () => {
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
      // Update the specific group in cache
      queryClient.setQueryData(groupKeys.detail(updatedGroup.id), updatedGroup);
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
