import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "./useApi";
import {
  Submission,
  Vote,
  CreateSubmissionData,
  CreateVoteData,
} from "../types/api";

// Query Keys
export const submissionKeys = {
  all: ["submissions"] as const,
  lists: () => [...submissionKeys.all, "list"] as const,
  list: (roundId: string) => [...submissionKeys.lists(), roundId] as const,
  details: () => [...submissionKeys.all, "detail"] as const,
  detail: (id: string) => [...submissionKeys.details(), id] as const,
};

export const voteKeys = {
  all: ["votes"] as const,
  lists: () => [...voteKeys.all, "list"] as const,
  list: (submissionId: string) => [...voteKeys.lists(), submissionId] as const,
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
      });
      return response.data as Submission;
    },
    onSuccess: (newSubmission, variables) => {
      // Invalidate submissions list for the round
      queryClient.invalidateQueries({
        queryKey: submissionKeys.list(variables.roundId),
      });
      // Invalidate round detail to refresh submission count
      queryClient.invalidateQueries({ queryKey: ["rounds", "detail"] });
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
      });
      return response.data as Submission;
    },
    onSuccess: (updatedSubmission, variables) => {
      // Invalidate submissions list for the round
      queryClient.invalidateQueries({
        queryKey: submissionKeys.list(variables.roundId),
      });
      // Invalidate round detail to refresh submission count
      queryClient.invalidateQueries({ queryKey: ["rounds", "detail"] });
      // Invalidate specific submission detail
      queryClient.invalidateQueries({
        queryKey: submissionKeys.detail(updatedSubmission.id),
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
    },
  });
};

export const useVotes = (submissionId: string) => {
  const api = useApi();

  return useQuery({
    queryKey: voteKeys.list(submissionId),
    queryFn: async () => {
      const response = await api.get(`/api/submissions/${submissionId}/votes`);
      return response.data as Vote[];
    },
    enabled: !!submissionId,
  });
};

export const useCreateVote = () => {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateVoteData) => {
      const response = await api.post(
        `/api/submissions/${data.submissionId}/votes`,
        {
          count: data.count,
          comment: data.comment,
        }
      );
      return response.data as Vote;
    },
    onSuccess: (newVote, variables) => {
      // Invalidate votes list for the submission
      queryClient.invalidateQueries({
        queryKey: voteKeys.list(variables.submissionId),
      });
      // Invalidate submission detail to refresh vote count
      queryClient.invalidateQueries({
        queryKey: submissionKeys.detail(variables.submissionId),
      });
      // Invalidate submissions list to refresh vote counts
      queryClient.invalidateQueries({ queryKey: submissionKeys.lists() });
    },
  });
};

export const useUpdateVote = () => {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      submissionId,
      voteId,
      data,
    }: {
      submissionId: string;
      voteId: string;
      data: { count: number; comment?: string };
    }) => {
      const response = await api.patch(
        `/api/submissions/${submissionId}/votes/${voteId}`,
        data
      );
      return response.data as Vote;
    },
    onSuccess: (updatedVote, variables) => {
      // Invalidate votes list for the submission
      queryClient.invalidateQueries({
        queryKey: voteKeys.list(variables.submissionId),
      });
      // Invalidate submission detail to refresh vote count
      queryClient.invalidateQueries({
        queryKey: submissionKeys.detail(variables.submissionId),
      });
      // Invalidate submissions list to refresh vote counts
      queryClient.invalidateQueries({ queryKey: submissionKeys.lists() });
    },
  });
};

export const useDeleteVote = () => {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      submissionId,
      voteId,
    }: {
      submissionId: string;
      voteId: string;
    }) => {
      const response = await api.delete(
        `/api/submissions/${submissionId}/votes/${voteId}`
      );
      return response.data;
    },
    onSuccess: (_, { submissionId }) => {
      // Invalidate votes list for the submission
      queryClient.invalidateQueries({
        queryKey: voteKeys.list(submissionId),
      });
      // Invalidate submission detail to refresh vote count
      queryClient.invalidateQueries({
        queryKey: submissionKeys.detail(submissionId),
      });
      // Invalidate submissions list to refresh vote counts
      queryClient.invalidateQueries({ queryKey: submissionKeys.lists() });
    },
  });
};
