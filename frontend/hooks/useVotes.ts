import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "./useApi";
import { Vote, CreateVoteData, FinalizeVotesResponse } from "../types/api";

// Vote query keys for cache management
export const voteKeys = {
  all: ["votes"] as const,
  lists: () => [...voteKeys.all, "list"] as const,
  list: (submissionId: string) => [...voteKeys.lists(), submissionId] as const,
};

// Get all votes for a submission
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

// Create a new vote
export const useCreateVote = () => {
  const queryClient = useQueryClient();
  const api = useApi();

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
        queryKey: ["submissions", variables.submissionId],
      });

      // Invalidate submissions list to refresh vote counts
      queryClient.invalidateQueries({
        queryKey: ["submissions"],
      });
    },
  });
};

// Update an existing vote
export const useUpdateVote = () => {
  const queryClient = useQueryClient();
  const api = useApi();

  return useMutation({
    mutationFn: async (data: {
      submissionId: string;
      voteId: string;
      count: number;
      comment?: string;
    }) => {
      const { submissionId, voteId, ...updateData } = data;
      const response = await api.put(
        `/api/submissions/${submissionId}/votes/${voteId}`,
        updateData
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
        queryKey: ["submissions", variables.submissionId],
      });

      // Invalidate submissions list to refresh vote counts
      queryClient.invalidateQueries({
        queryKey: ["submissions"],
      });
    },
  });
};

// Delete a vote
export const useDeleteVote = () => {
  const queryClient = useQueryClient();
  const api = useApi();

  return useMutation({
    mutationFn: async (data: { submissionId: string; voteId: string }) => {
      const { submissionId, voteId } = data;
      await api.delete(`/api/submissions/${submissionId}/votes/${voteId}`);
    },
    onSuccess: (_, variables) => {
      // Invalidate votes list for the submission
      queryClient.invalidateQueries({
        queryKey: voteKeys.list(variables.submissionId),
      });

      // Invalidate submission detail to refresh vote count
      queryClient.invalidateQueries({
        queryKey: ["submissions", variables.submissionId],
      });

      // Invalidate submissions list to refresh vote counts
      queryClient.invalidateQueries({
        queryKey: ["submissions"],
      });
    },
  });
};

// Finalize all votes for a user in a round
export const useFinalizeVotes = () => {
  const queryClient = useQueryClient();
  const api = useApi();

  return useMutation({
    mutationFn: async (roundId: string) => {
      const response = await api.post(
        `/api/submissions/rounds/${roundId}/votes/finalize`
      );
      return response.data as FinalizeVotesResponse;
    },
    onSuccess: (finalizeResponse, roundId) => {
      // Invalidate all vote-related queries
      queryClient.invalidateQueries({
        queryKey: voteKeys.all,
      });

      // Invalidate submissions for this round
      queryClient.invalidateQueries({
        queryKey: ["submissions", "round", roundId],
      });

      // Invalidate round details
      queryClient.invalidateQueries({
        queryKey: ["rounds", roundId],
      });

      // Invalidate all submissions lists
      queryClient.invalidateQueries({
        queryKey: ["submissions"],
      });
    },
  });
};

// Helper hook to check if user has any votes in a round
export const useUserVotesInRound = (roundId: string) => {
  const api = useApi();

  return useQuery({
    queryKey: ["votes", "round", roundId, "user"],
    queryFn: async () => {
      // This would need a new endpoint to get user's votes for a round
      // For now, we could get submissions for the round and check votes on each
      const response = await api.get(`/api/submissions/round/${roundId}`);
      const submissions = response.data;

      // Extract current user's votes from all submissions
      const userVotes: Vote[] = [];
      submissions.forEach((submission: any) => {
        if (submission.votes) {
          userVotes.push(...submission.votes.filter((vote: Vote) => vote.user));
        }
      });

      return userVotes;
    },
    enabled: !!roundId,
  });
};

// Helper hook to get vote summary for a round
export const useVoteSummary = (roundId: string) => {
  const api = useApi();

  return useQuery({
    queryKey: ["votes", "summary", roundId],
    queryFn: async () => {
      const response = await api.get(`/api/submissions/round/${roundId}`);
      const submissions = response.data;

      let totalVotesUsed = 0;
      let hasUnfinalizedVotes = false;
      let hasFinalizedVotes = false;

      submissions.forEach((submission: any) => {
        if (submission.votes) {
          submission.votes.forEach((vote: Vote) => {
            totalVotesUsed += vote.count;
            if (vote.isFinalized) {
              hasFinalizedVotes = true;
            } else {
              hasUnfinalizedVotes = true;
            }
          });
        }
      });

      return {
        totalVotesUsed,
        hasUnfinalizedVotes,
        hasFinalizedVotes,
        canFinalize: hasUnfinalizedVotes && !hasFinalizedVotes,
      };
    },
    enabled: !!roundId,
  });
};
