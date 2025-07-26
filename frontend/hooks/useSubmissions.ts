import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "./useApi";
import { Submission, CreateSubmissionData } from "../types/api";
import { roundKeys } from "./useRounds";

// Query Keys
export const submissionKeys = {
  all: ["submissions"] as const,
  lists: () => [...submissionKeys.all, "list"] as const,
  list: (roundId: string) => [...submissionKeys.lists(), roundId] as const,
  details: () => [...submissionKeys.all, "detail"] as const,
  detail: (id: string) => [...submissionKeys.details(), id] as const,
};

// Hooks
export const useSubmissions = (roundId: string) => {
  const api = useApi();

  return useQuery({
    queryKey: submissionKeys.list(roundId),
    queryFn: async () => {
      const response = await api.get(`/api/submissions/round/${roundId}`);
      return response.data as Submission[];
    },
    enabled: !!roundId,
  });
};

export const useSubmission = (id: string) => {
  const api = useApi();

  return useQuery({
    queryKey: submissionKeys.detail(id),
    queryFn: async () => {
      const response = await api.get(`/api/submissions/${id}`);
      return response.data as Submission;
    },
    enabled: !!id,
  });
};

export const useCreateSubmission = () => {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateSubmissionData) => {
      const response = await api.post(`/api/submissions`, {
        roundId: data.roundId,
        spotifyTrackId: data.spotifyTrackId,
        trackName: data.trackName,
        artistName: data.artistName,
        albumName: data.albumName,
        imageUrl: data.imageUrl,
        spotifyUrl: data.spotifyUrl,
        previewUrl: data.previewUrl,
        comment: data.comment,
      });
      return response.data as Submission;
    },
    onSuccess: (newSubmission, variables) => {
      // Invalidate submissions list for the round
      queryClient.invalidateQueries({
        queryKey: submissionKeys.list(variables.roundId),
      });

      // CRITICAL FIX: Properly invalidate round queries to refresh submission data
      queryClient.invalidateQueries({
        queryKey: roundKeys.all,
      });
    },
  });
};

// Note: Backend handles both create and update in the same POST endpoint
export const useUpdateSubmission = () => {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateSubmissionData) => {
      const response = await api.post(`/api/submissions`, {
        roundId: data.roundId,
        spotifyTrackId: data.spotifyTrackId,
        trackName: data.trackName,
        artistName: data.artistName,
        albumName: data.albumName,
        imageUrl: data.imageUrl,
        spotifyUrl: data.spotifyUrl,
        previewUrl: data.previewUrl,
        comment: data.comment,
      });
      return response.data as Submission;
    },
    onSuccess: (updatedSubmission, variables) => {
      // Invalidate submissions list for the round
      queryClient.invalidateQueries({
        queryKey: submissionKeys.list(variables.roundId),
      });

      // Invalidate specific submission detail
      queryClient.invalidateQueries({
        queryKey: submissionKeys.detail(updatedSubmission.id),
      });

      // CRITICAL FIX: Properly invalidate round queries to refresh submission data
      queryClient.invalidateQueries({
        queryKey: roundKeys.all,
      });
    },
  });
};

export const useDeleteSubmission = () => {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/api/submissions/${id}`);
      return response.data;
    },
    onSuccess: (_, deletedSubmissionId) => {
      // Remove the deleted submission from cache
      queryClient.removeQueries({
        queryKey: submissionKeys.detail(deletedSubmissionId),
      });

      // Invalidate all submissions lists to refresh data
      queryClient.invalidateQueries({ queryKey: submissionKeys.lists() });

      // CRITICAL FIX: Properly invalidate round queries to refresh submission data
      queryClient.invalidateQueries({
        queryKey: roundKeys.all,
      });
    },
  });
};
