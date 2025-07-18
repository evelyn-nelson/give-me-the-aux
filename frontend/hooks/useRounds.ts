import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "./useApi";
import {
  Round,
  CreateRoundData,
  UpdateRoundData,
  ReorderRoundsData,
} from "../types/api";

// Query Keys
export const roundKeys = {
  all: ["rounds"] as const,
  lists: () => [...roundKeys.all, "list"] as const,
  list: (groupId: string) => [...roundKeys.lists(), groupId] as const,
  details: () => [...roundKeys.all, "detail"] as const,
  detail: (id: string) => [...roundKeys.details(), id] as const,
};

// Hooks
export const useRounds = (groupId: string) => {
  const api = useApi();

  return useQuery({
    queryKey: roundKeys.list(groupId),
    queryFn: async () => {
      const response = await api.get(`/api/rounds/group/${groupId}`);
      return response.data as Round[];
    },
    enabled: !!groupId,
  });
};

export const useRound = (id: string) => {
  const api = useApi();

  return useQuery({
    queryKey: roundKeys.detail(id),
    queryFn: async () => {
      const response = await api.get(`/api/rounds/${id}`);
      return response.data as Round;
    },
    enabled: !!id,
  });
};

export const useCreateRound = () => {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateRoundData) => {
      const response = await api.post("/api/rounds", data);
      return response.data as Round;
    },
    onSuccess: (newRound) => {
      // Invalidate rounds list for the group
      queryClient.invalidateQueries({
        queryKey: roundKeys.list(newRound.group.id),
      });
      // Invalidate groups list to refresh group data
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
  });
};

export const useUpdateRound = () => {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateRoundData }) => {
      const response = await api.patch(`/api/rounds/${id}`, data);
      return response.data as Round;
    },
    onSuccess: (updatedRound) => {
      // Update the specific round in cache
      queryClient.setQueryData(roundKeys.detail(updatedRound.id), updatedRound);
      // Invalidate rounds list for the group
      queryClient.invalidateQueries({
        queryKey: roundKeys.list(updatedRound.group.id),
      });
    },
  });
};

export const useReorderRounds = () => {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      groupId,
      data,
    }: {
      groupId: string;
      data: ReorderRoundsData;
    }) => {
      const response = await api.patch(`/api/rounds/reorder/${groupId}`, data);
      return response.data as Round[];
    },
    onSuccess: (updatedRounds, { groupId }) => {
      // Update the rounds list for the group
      queryClient.setQueryData(roundKeys.list(groupId), updatedRounds);
    },
  });
};

export const useDeleteRound = () => {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/api/rounds/${id}`);
      return response.data;
    },
    onSuccess: (_, deletedRoundId) => {
      // Remove the deleted round from cache
      queryClient.removeQueries({ queryKey: roundKeys.detail(deletedRoundId) });
      // Invalidate all rounds lists to refresh data
      queryClient.invalidateQueries({ queryKey: roundKeys.lists() });
    },
  });
};
