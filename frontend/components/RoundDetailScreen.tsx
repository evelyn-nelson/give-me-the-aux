import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Alert,
  Image,
  TextInput,
} from "react-native";
import { useAuth } from "../contexts/AuthContext";
import {
  useCreateVote,
  useUpdateVote,
  useDeleteVote,
  useFinalizeVotes,
  useVoteSummary,
} from "../hooks/useVotes";
import { useRound } from "../hooks/useRounds";
import { useGroupRoundMembers } from "../hooks/useGroups";
import {
  Round,
  User,
  Vote,
  Submission,
  Group,
  GroupMemberWithSubmissionStatus,
} from "../types/api";

interface RoundDetailScreenProps {
  round: Round;
  group: Group;
  onBack: () => void;
  onSubmitSongPress: (roundId: string, existingSubmission?: Submission) => void;
  onEditRoundPress?: (round: Round) => void;
}

// Debounced vote state management
interface VoteState {
  count: number;
  comment: string;
}

export const RoundDetailScreen: React.FC<RoundDetailScreenProps> = ({
  round: initialRound,
  group,
  onBack,
  onSubmitSongPress,
  onEditRoundPress,
}) => {
  const { user } = useAuth();
  const [votingState, setVotingState] = useState<Record<string, VoteState>>({});
  const [autoSaveStatus, setAutoSaveStatus] = useState<
    Record<string, "saving" | "saved" | "error">
  >({});

  // Refs for debouncing
  const saveTimeouts = useRef<Record<string, NodeJS.Timeout>>({});
  const pendingVotes = useRef<Record<string, VoteState>>({});

  // Fetch fresh round data using the hook with initial data to avoid loading screen
  const { data: round = initialRound, isLoading: isLoadingRound } = useRound(
    initialRound.id,
    initialRound // Pass initial data to avoid refetch
  );

  // Fetch group members with submission status (only needed during submission phase)
  const { data: groupMembers = [], isLoading: isLoadingMembers } =
    useGroupRoundMembers(group.id, round.id);

  // Get vote summary for the round
  const { data: voteSummary } = useVoteSummary(round.id, user?.id || "");

  const createVoteMutation = useCreateVote();
  const updateVoteMutation = useUpdateVote();
  const deleteVoteMutation = useDeleteVote();
  const finalizeVotesMutation = useFinalizeVotes();

  // Remove the global loading state for vote operations
  const isGlobalLoading = finalizeVotesMutation.isPending;

  // Use the group prop instead of round.group
  const isAdmin = group?.admin?.id === user?.id;
  const userSubmission = round.submissions?.find(
    (s) => s.user?.id === user?.id
  );
  const canSubmit = round.status === "SUBMISSION" && !userSubmission;
  const canVote = round.status === "VOTING";
  const votesAreFinalized = voteSummary?.hasFinalizedVotes || false;

  // Initialize voting state from current votes
  useEffect(() => {
    if (!round.submissions || !user) return;

    const initialState: Record<string, VoteState> = {};
    round.submissions.forEach((submission) => {
      const userVote = submission.votes?.find((v) => v.user?.id === user.id);
      initialState[submission.id] = {
        count: userVote?.count || 0,
        comment: userVote?.comment || "",
      };
    });
    setVotingState(initialState);
  }, [round.submissions, user]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      // Clear all pending timeouts
      Object.values(saveTimeouts.current).forEach(clearTimeout);
    };
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "SUBMISSION":
        return "#FFB000";
      case "VOTING":
        return "#FF8C00";
      case "COMPLETED":
        return "#666";
      default:
        return "#666";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "SUBMISSION":
        return "Submissions Open";
      case "VOTING":
        return "Voting Open";
      case "COMPLETED":
        return "Completed";
      default:
        return status;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
    });
  };

  const getTotalVotes = (submission: Submission) => {
    return (submission.votes || []).reduce(
      (total, vote) => total + vote.count,
      0
    );
  };

  const getUserVoteCount = (submission: Submission) => {
    const userVote = (submission.votes || []).find(
      (v) => v.user?.id === user?.id
    );
    return userVote ? userVote.count : 0;
  };

  const getTotalUserVotes = () => {
    return Object.values(votingState).reduce(
      (total, state) => total + state.count,
      0
    );
  };

  const getRemainingVotes = () => {
    return (group?.votesPerUserPerRound || 0) - getTotalUserVotes();
  };

  // Debounced save function
  const debouncedSave = useCallback(
    async (submissionId: string, voteState: VoteState) => {
      // Clear any existing timeout
      if (saveTimeouts.current[submissionId]) {
        clearTimeout(saveTimeouts.current[submissionId]);
      }

      // Store the pending vote state
      pendingVotes.current[submissionId] = voteState;

      // Set up new timeout
      saveTimeouts.current[submissionId] = setTimeout(async () => {
        const currentPendingVote = pendingVotes.current[submissionId];
        if (!currentPendingVote) return;

        // Set saving status
        setAutoSaveStatus((prev) => ({ ...prev, [submissionId]: "saving" }));

        try {
          const submission = round.submissions?.find(
            (s) => s.id === submissionId
          );
          if (!submission) return;

          const existingVote = submission.votes?.find(
            (v) => v.user?.id === user?.id
          );

          if (
            currentPendingVote.count === 0 &&
            !currentPendingVote.comment.trim() &&
            existingVote
          ) {
            // Delete vote if no count and no comment
            await deleteVoteMutation.mutateAsync({
              submissionId,
              voteId: existingVote.id,
            });
          } else if (existingVote) {
            // Update existing vote (handles both count > 0 and count === 0 with comment)
            await updateVoteMutation.mutateAsync({
              submissionId,
              voteId: existingVote.id,
              count: currentPendingVote.count,
              comment: currentPendingVote.comment.trim() || undefined,
            });
          } else if (
            currentPendingVote.count > 0 ||
            currentPendingVote.comment.trim()
          ) {
            // Create new vote if there's a count or a comment
            await createVoteMutation.mutateAsync({
              submissionId,
              count: currentPendingVote.count,
              comment: currentPendingVote.comment.trim() || undefined,
            });
          }

          // Set saved status
          setAutoSaveStatus((prev) => ({ ...prev, [submissionId]: "saved" }));

          // Clear status after 2 seconds
          setTimeout(() => {
            setAutoSaveStatus((prev) => {
              const newState = { ...prev };
              delete newState[submissionId];
              return newState;
            });
          }, 2000);

          // Clear pending vote
          delete pendingVotes.current[submissionId];
        } catch (error) {
          // Set error status
          setAutoSaveStatus((prev) => ({ ...prev, [submissionId]: "error" }));
          console.error("Vote error:", error);

          // Clear error status after 3 seconds
          setTimeout(() => {
            setAutoSaveStatus((prev) => {
              const newState = { ...prev };
              delete newState[submissionId];
              return newState;
            });
          }, 3000);
        }
      }, 1000); // 1 second debounce
    },
    [
      round.submissions,
      user,
      createVoteMutation,
      updateVoteMutation,
      deleteVoteMutation,
    ]
  );

  const handleVoteChange = useCallback(
    (submissionId: string, newCount: number) => {
      if (!canVote || votesAreFinalized) return;

      const submission = round.submissions?.find((s) => s.id === submissionId);
      if (!submission) return;

      const currentState = votingState[submissionId] || {
        count: 0,
        comment: "",
      };
      const currentTotalVotes = getTotalUserVotes();
      const voteDifference = newCount - currentState.count;

      // Check vote limits
      if (
        currentTotalVotes + voteDifference >
        (group?.votesPerUserPerRound || 0)
      ) {
        Alert.alert("Vote Limit", "You don't have enough votes remaining.");
        return;
      }

      if (newCount > (group?.maxVotesPerSong || 0)) {
        Alert.alert(
          "Vote Limit",
          `You can only give up to ${
            group?.maxVotesPerSong || 0
          } votes per song.`
        );
        return;
      }

      // Update local state immediately for responsive UI
      const newState = { ...currentState, count: Math.max(0, newCount) };
      setVotingState((prev) => ({ ...prev, [submissionId]: newState }));

      // Trigger debounced save
      debouncedSave(submissionId, newState);
    },
    [
      canVote,
      round.submissions,
      group,
      votingState,
      debouncedSave,
      getTotalUserVotes,
    ]
  );

  const handleCommentChange = useCallback(
    (submissionId: string, newComment: string) => {
      if (!canVote) return;

      const currentState = votingState[submissionId] || {
        count: 0,
        comment: "",
      };
      const newState = { ...currentState, comment: newComment };

      // Update local state immediately
      setVotingState((prev) => ({ ...prev, [submissionId]: newState }));

      // Save if there's a vote count OR a comment (to allow comments without votes)
      if (newState.count > 0 || newState.comment.trim()) {
        debouncedSave(submissionId, newState);
      }
    },
    [canVote, votingState, debouncedSave]
  );

  const handleFinalizeVotes = async () => {
    if (!voteSummary?.hasUnfinalizedVotes) return;

    Alert.alert(
      "Finalize Votes",
      `Are you sure you want to finalize your ${voteSummary.totalVotesUsed} votes? You won't be able to change them after this.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Finalize",
          style: "default",
          onPress: async () => {
            try {
              await finalizeVotesMutation.mutateAsync(round.id);
              Alert.alert("Success", "Your votes have been finalized!");
            } catch (error) {
              Alert.alert(
                "Error",
                "Failed to finalize votes. Please try again."
              );
            }
          },
        },
      ]
    );
  };

  const renderSubmissionCard = ({ item: submission }: { item: Submission }) => {
    // Only show the vote count if the user has already voted for this round
    const userHasVotedInRound = (round.submissions || []).some((s) =>
      (s.votes || []).some((v) => v.user?.id === user?.id && v.count > 0)
    );
    const totalVotes = getTotalVotes(submission);
    const isUserSubmission = submission.user?.id === user?.id;

    // Get current vote state (local state for immediate UI updates)
    const currentVoteState = votingState[submission.id] || {
      count: 0,
      comment: "",
    };
    const userVotes = currentVoteState.count;
    const userComment = currentVoteState.comment;

    return (
      <View style={styles.submissionCard}>
        <View style={styles.submissionHeader}>
          <View style={styles.trackInfo}>
            <Text style={styles.trackName}>{submission.trackName}</Text>
            <Text style={styles.artistName}>{submission.artistName}</Text>
            <Text style={styles.albumName}>{submission.albumName}</Text>
          </View>
          {submission.imageUrl && (
            <View style={styles.albumArt}>
              <Image
                source={{ uri: submission.imageUrl }}
                style={styles.albumArt}
                resizeMode="cover"
                accessibilityLabel={`${submission.trackName} album art`}
              />
            </View>
          )}
        </View>

        {submission.comment && (
          <View style={styles.commentContainer}>
            <Text style={styles.commentText}>{submission.comment}</Text>
          </View>
        )}

        <View style={styles.submissionFooter}>
          <Text style={styles.submitterName}>
            Submitted by{" "}
            {isUserSubmission
              ? "You"
              : submission.user?.displayName || "Unknown User"}
          </Text>

          <View style={styles.voteContainer}>
            {/* Show vote total prominently for completed rounds, or for other phases if user has voted */}
            {(round.status === "COMPLETED" || userHasVotedInRound) && (
              <View
                style={[
                  styles.voteDisplayContainer,
                  round.status === "COMPLETED" &&
                    styles.voteDisplayContainerCompleted,
                ]}
              >
                <Text
                  style={[
                    styles.voteCount,
                    round.status === "COMPLETED" && styles.voteCountCompleted,
                  ]}
                >
                  {totalVotes}
                </Text>
                <Text
                  style={[
                    styles.voteCountLabel,
                    round.status === "COMPLETED" &&
                      styles.voteCountLabelCompleted,
                  ]}
                >
                  vote{totalVotes !== 1 ? "s" : ""}
                </Text>
              </View>
            )}

            {canVote && !isUserSubmission && !votesAreFinalized && (
              <View style={styles.voteControls}>
                <TouchableOpacity
                  style={[
                    styles.voteButton,
                    userVotes > 0 && styles.voteButtonActive,
                  ]}
                  onPress={() => handleVoteChange(submission.id, userVotes - 1)}
                  disabled={
                    userVotes === 0 ||
                    autoSaveStatus[submission.id] === "saving"
                  }
                >
                  <Text
                    style={[
                      styles.voteButtonText,
                      userVotes > 0 && styles.voteButtonTextActive,
                    ]}
                  >
                    -
                  </Text>
                </TouchableOpacity>

                <View style={styles.voteCountContainer}>
                  <Text style={styles.userVoteCount}>{userVotes}</Text>
                  {autoSaveStatus[submission.id] && (
                    <View style={styles.autoSaveIndicator}>
                      {autoSaveStatus[submission.id] === "saving" && (
                        <ActivityIndicator size="small" color="#FFB000" />
                      )}
                      {autoSaveStatus[submission.id] === "saved" && (
                        <Text style={styles.autoSaveText}>✓</Text>
                      )}
                      {autoSaveStatus[submission.id] === "error" && (
                        <Text style={styles.autoSaveError}>!</Text>
                      )}
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  style={[
                    styles.voteButton,
                    userVotes < (group?.maxVotesPerSong || 0) &&
                      getRemainingVotes() > 0 &&
                      styles.voteButtonActive,
                  ]}
                  onPress={() => handleVoteChange(submission.id, userVotes + 1)}
                  disabled={
                    userVotes >= (group?.maxVotesPerSong || 0) ||
                    getRemainingVotes() === 0 ||
                    autoSaveStatus[submission.id] === "saving"
                  }
                >
                  <Text
                    style={[
                      styles.voteButtonText,
                      userVotes < (group?.maxVotesPerSong || 0) &&
                        getRemainingVotes() > 0 &&
                        styles.voteButtonTextActive,
                    ]}
                  >
                    +
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Show vote count for finalized votes */}
            {votesAreFinalized && userVotes > 0 && (
              <View style={styles.finalizedVoteDisplay}>
                <Text style={styles.finalizedVoteText}>
                  Your votes: {userVotes}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Comment input for voting */}
        {canVote && !isUserSubmission && !votesAreFinalized && (
          <View style={styles.commentInputContainer}>
            <TextInput
              style={styles.commentInput}
              placeholder={
                userVotes > 0
                  ? "Add a comment about your votes..."
                  : "Add a comment about this song..."
              }
              placeholderTextColor="#666666"
              value={userComment}
              onChangeText={(text) => handleCommentChange(submission.id, text)}
              multiline
              maxLength={500}
              textAlignVertical="top"
            />
            <Text style={styles.commentCounter}>{userComment.length}/500</Text>
          </View>
        )}

        {/* Show existing votes in voting/completed phases */}
        {(round.status === "VOTING" || round.status === "COMPLETED") &&
          submission.votes &&
          submission.votes.length > 0 &&
          (() => {
            // For completed rounds, show all votes (with points or comments), ordered by points descending
            // For voting rounds, only show votes with comments
            const filteredVotes =
              round.status === "COMPLETED"
                ? submission.votes.filter(
                    (vote) => vote.count > 0 || vote.comment
                  )
                : submission.votes.filter((vote) => vote.comment);

            const sortedVotes =
              round.status === "COMPLETED"
                ? filteredVotes.sort((a, b) => {
                    // Sort by count descending (3, 2, 1, 0), then by user name for ties
                    if (b.count !== a.count) {
                      return b.count - a.count;
                    }
                    return a.user.displayName.localeCompare(b.user.displayName);
                  })
                : filteredVotes;

            return (
              sortedVotes.length > 0 && (
                <View style={styles.voteCommentsContainer}>
                  <Text style={styles.voteCommentsTitle}>
                    {round.status === "COMPLETED" ? "Votes:" : "Comments:"}
                  </Text>
                  {sortedVotes.map((vote) => (
                    <View key={vote.id} style={styles.voteCommentItem}>
                      <Text style={styles.voteCommentAuthor}>
                        {vote.user.displayName}
                        {vote.count > 0
                          ? ` (${vote.count} vote${
                              vote.count !== 1 ? "s" : ""
                            })`
                          : " (comment)"}
                        :
                      </Text>
                      {vote.comment && (
                        <Text style={styles.voteCommentText}>
                          {vote.comment}
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              )
            );
          })()}
      </View>
    );
  };

  const renderMemberStatusSection = () => {
    const submittedMembers = groupMembers.filter(
      (member) => member.hasSubmitted
    );
    const pendingMembers = groupMembers.filter(
      (member) => !member.hasSubmitted
    );

    const renderMemberAvatar = (
      member: GroupMemberWithSubmissionStatus,
      index: number
    ) => (
      <View key={member.id} style={styles.memberAvatarSmall}>
        <Text style={styles.memberAvatarSmallText}>
          {member.displayName.charAt(0).toUpperCase()}
        </Text>
      </View>
    );

    return (
      <View style={styles.memberStatusContainer}>
        {/* Submitted Members */}
        <View style={styles.statusGroup}>
          <View style={styles.statusGroupHeader}>
            <View style={styles.statusIndicatorSubmitted} />
            <Text style={styles.statusGroupTitle}>
              Submitted ({submittedMembers.length})
            </Text>
          </View>
          <View style={styles.avatarRow}>
            {submittedMembers.length > 0 ? (
              submittedMembers.map(renderMemberAvatar)
            ) : (
              <Text style={styles.emptyStatusText}>No submissions yet</Text>
            )}
          </View>
        </View>

        {/* Pending Members */}
        <View style={styles.statusGroup}>
          <View style={styles.statusGroupHeader}>
            <View style={styles.statusIndicatorPending} />
            <Text style={styles.statusGroupTitle}>
              Not Submitted ({pendingMembers.length})
            </Text>
          </View>
          <View style={styles.avatarRow}>
            {pendingMembers.length > 0 ? (
              pendingMembers.map(renderMemberAvatar)
            ) : (
              <Text style={styles.emptyStatusText}>
                Everyone has submitted!
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  // Show loading state while fetching round data - now rarely needed since we use initialData
  if (isLoadingRound && !round) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack}>
            <Text style={styles.backText}>‹ Back</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFB000" />
          <Text style={styles.loadingText}>Loading round...</Text>
        </View>
      </View>
    );
  }

  const sortedSubmissions = [...(round.submissions || [])].sort((a, b) => {
    if (round.status === "COMPLETED") {
      return getTotalVotes(b) - getTotalVotes(a);
    }
    return a.trackName.localeCompare(b.trackName);
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        {isAdmin && onEditRoundPress && round.status === "SUBMISSION" && (
          <TouchableOpacity onPress={() => onEditRoundPress(round)}>
            <Text style={styles.editText}>Edit</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.roundInfo}>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(round.status) },
            ]}
          >
            <Text style={styles.statusText}>{getStatusText(round.status)}</Text>
          </View>

          <Text style={styles.roundTheme}>{round.theme}</Text>

          {round.description && (
            <Text style={styles.roundDescription}>{round.description}</Text>
          )}

          <Text style={styles.groupName}>
            in {group?.name || "Unknown Group"}
          </Text>
        </View>

        <View style={styles.timeline}>
          <Text style={styles.sectionTitle}>Timeline</Text>
          <View style={styles.timelineItem}>
            <Text style={styles.timelineLabel}>Submissions:</Text>
            <Text style={styles.timelineDate}>
              {formatDate(round.startDate)} -{" "}
              {formatDate(round.votingStartDate)}
            </Text>
          </View>
          <View style={styles.timelineItem}>
            <Text style={styles.timelineLabel}>Voting:</Text>
            <Text style={styles.timelineDate}>
              {formatDate(round.votingStartDate)} - {formatDate(round.endDate)}
            </Text>
          </View>
        </View>

        {canVote && (
          <View style={styles.votingInfo}>
            <View style={styles.votingHeader}>
              <Text style={styles.sectionTitle}>Your Voting</Text>
              {voteSummary?.hasUnfinalizedVotes && (
                <TouchableOpacity
                  style={[
                    styles.finalizeButton,
                    voteSummary.totalVotesUsed === 0 &&
                      styles.finalizeButtonDisabled,
                  ]}
                  onPress={handleFinalizeVotes}
                  disabled={
                    voteSummary.totalVotesUsed === 0 ||
                    finalizeVotesMutation.isPending
                  }
                >
                  {finalizeVotesMutation.isPending ? (
                    <ActivityIndicator size="small" color="#191414" />
                  ) : (
                    <Text style={styles.finalizeButtonText}>
                      Finalize Votes
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.votingStatsContainer}>
              <Text style={styles.votingStats}>
                {getTotalUserVotes()} of {group?.votesPerUserPerRound || 0}{" "}
                votes used
              </Text>
              <Text style={styles.votingStatsSecondary}>
                {getRemainingVotes()} remaining
              </Text>
            </View>

            <Text style={styles.votingHelpText}>
              You can give up to {group?.maxVotesPerSong || 0} votes per song.
              Add comments to explain your choices!
            </Text>

            {voteSummary?.hasFinalizedVotes && (
              <View style={styles.finalizedIndicator}>
                <Text style={styles.finalizedText}>
                  ✓ Your votes have been finalized
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.submissions}>
          {round.status === "SUBMISSION" ? (
            // Show member submission status during submission phase
            <>
              {/* Show user's submission during submission phase if they have one */}
              {userSubmission && (
                <View style={styles.userSubmissionContainer}>
                  <View style={styles.userSubmissionHeader}>
                    <Text style={styles.sectionTitle}>Your Submission</Text>
                    <TouchableOpacity
                      style={styles.editSubmissionButton}
                      onPress={() =>
                        onSubmitSongPress(round.id, userSubmission)
                      }
                    >
                      <Text style={styles.editSubmissionButtonText}>Edit</Text>
                    </TouchableOpacity>
                  </View>
                  {renderSubmissionCard({ item: userSubmission })}
                </View>
              )}
              <View style={styles.submissionsHeader}>
                <Text style={styles.sectionTitle}>
                  Voting Status ({groupMembers.length})
                </Text>
                {canSubmit && (
                  <TouchableOpacity
                    style={styles.submitButton}
                    onPress={() => onSubmitSongPress(round.id, undefined)}
                  >
                    <Text style={styles.submitButtonText}>+ Submit Song</Text>
                  </TouchableOpacity>
                )}
              </View>

              {groupMembers.length > 0 ? (
                renderMemberStatusSection()
              ) : (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyTitle}>No Members Found</Text>
                  <Text style={styles.emptySubtitle}>
                    There seems to be an issue loading group members.
                  </Text>
                </View>
              )}
            </>
          ) : (
            // Show actual submissions during voting and completed phases
            <>
              <View style={styles.submissionsHeader}>
                <Text style={styles.sectionTitle}>
                  Submissions ({(round.submissions || []).length})
                </Text>
              </View>

              <FlatList
                data={sortedSubmissions}
                renderItem={renderSubmissionCard}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyTitle}>No Submissions</Text>
                    <Text style={styles.emptySubtitle}>
                      No songs were submitted for this round.
                    </Text>
                  </View>
                }
              />
            </>
          )}
        </View>
      </ScrollView>

      {/* Only show loading overlay for finalize operation */}
      {isGlobalLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FFB000" />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#191414",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#404040",
  },
  backButton: {
    padding: 8,
  },
  backText: {
    fontSize: 16,
    color: "#FFB000",
    fontWeight: "500",
  },
  editText: {
    fontSize: 16,
    color: "#FFB000",
  },
  roundInfo: {
    padding: 20,
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginBottom: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    color: "white",
  },
  roundTheme: {
    fontSize: 28,
    fontWeight: "bold",
    color: "white",
    marginBottom: 8,
  },
  roundDescription: {
    fontSize: 16,
    color: "#B3B3B3",
    marginBottom: 8,
    lineHeight: 22,
  },
  groupName: {
    fontSize: 14,
    color: "#FFB000",
    fontWeight: "500",
  },
  timeline: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#404040",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "white",
    marginBottom: 12,
  },
  timelineItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  timelineLabel: {
    fontSize: 14,
    color: "#B3B3B3",
    fontWeight: "500",
  },
  timelineDate: {
    fontSize: 14,
    color: "white",
  },
  votingInfo: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#404040",
  },
  votingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  finalizeButton: {
    backgroundColor: "#FFB000",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 100,
    justifyContent: "center",
    alignItems: "center",
  },
  finalizeButtonDisabled: {
    backgroundColor: "#666666",
    opacity: 0.6,
  },
  finalizeButtonText: {
    color: "#191414",
    fontSize: 14,
    fontWeight: "600",
  },
  votingStatsContainer: {
    marginBottom: 8,
  },
  votingStats: {
    fontSize: 16,
    color: "#FFB000",
    fontWeight: "500",
    marginBottom: 2,
  },
  votingStatsSecondary: {
    fontSize: 14,
    color: "#B3B3B3",
  },
  votingHelpText: {
    fontSize: 14,
    color: "#B3B3B3",
    marginBottom: 12,
  },
  finalizedIndicator: {
    backgroundColor: "#282828",
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#4CAF50",
  },
  finalizedText: {
    fontSize: 14,
    color: "#4CAF50",
    fontWeight: "500",
  },
  submissions: {
    padding: 20,
  },
  submissionsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 16,
  },
  submitButton: {
    backgroundColor: "#FFB000",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  submitButtonText: {
    color: "#191414",
    fontSize: 14,
    fontWeight: "600",
  },
  submissionCard: {
    backgroundColor: "#282828",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#404040",
  },
  submissionHeader: {
    flexDirection: "row",
    marginBottom: 12,
  },
  trackInfo: {
    flex: 1,
  },
  trackName: {
    fontSize: 18,
    fontWeight: "600",
    color: "white",
    marginBottom: 4,
  },
  artistName: {
    fontSize: 16,
    color: "#FFB000",
    marginBottom: 2,
  },
  albumName: {
    fontSize: 14,
    color: "#B3B3B3",
  },
  albumArt: {
    width: 60,
    height: 60,
    backgroundColor: "#404040",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  albumArtPlaceholder: {
    fontSize: 24,
    color: "#B3B3B3",
  },
  commentContainer: {
    marginTop: 12,
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#1f1f1f",
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#FFB000",
  },
  commentText: {
    fontSize: 14,
    color: "#E0E0E0",
    fontStyle: "italic",
    lineHeight: 20,
  },
  submissionFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  submitterName: {
    fontSize: 14,
    color: "#B3B3B3",
  },
  voteContainer: {
    alignItems: "flex-end",
  },
  voteDisplayContainer: {
    alignItems: "center",
    marginBottom: 4,
  },
  voteDisplayContainerCompleted: {
    backgroundColor: "#FFB000",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 60,
  },
  voteCount: {
    fontSize: 14,
    color: "white",
    fontWeight: "500",
    marginBottom: 4,
  },
  voteCountCompleted: {
    fontSize: 18,
    color: "#191414",
    fontWeight: "700",
    lineHeight: 20,
  },
  voteCountLabel: {
    fontSize: 12,
    color: "white",
    fontWeight: "400",
  },
  voteCountLabelCompleted: {
    fontSize: 11,
    color: "#191414",
    fontWeight: "500",
    lineHeight: 12,
  },
  voteControls: {
    flexDirection: "row",
    alignItems: "center",
  },
  voteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#404040",
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 4,
  },
  voteButtonActive: {
    backgroundColor: "#FFB000",
  },
  voteButtonText: {
    fontSize: 18,
    color: "#666",
    fontWeight: "600",
  },
  voteButtonTextActive: {
    color: "#191414",
  },
  voteButtonDisabled: {
    backgroundColor: "#333333",
    opacity: 0.5,
  },
  voteButtonTextDisabled: {
    color: "#666666",
  },
  finalizedVoteDisplay: {
    alignItems: "flex-end",
    marginTop: 8,
  },
  finalizedVoteText: {
    fontSize: 14,
    color: "#B3B3B3",
    fontStyle: "italic",
  },
  userVoteCount: {
    fontSize: 16,
    color: "white",
    fontWeight: "600",
    minWidth: 20,
    textAlign: "center",
  },
  voteCountContainer: {
    alignItems: "center",
    minWidth: 40,
  },
  autoSaveIndicator: {
    marginTop: 2,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  autoSaveText: {
    fontSize: 12,
    color: "#4CAF50",
    fontWeight: "600",
  },
  autoSaveError: {
    fontSize: 12,
    color: "#E53E3E",
    fontWeight: "600",
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "white",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: "#B3B3B3",
    textAlign: "center",
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: "#FFB000",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  emptyButtonText: {
    color: "#191414",
    fontSize: 16,
    fontWeight: "600",
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    color: "#B3B3B3",
    marginTop: 12,
  },
  memberStatusContainer: {
    gap: 20,
  },
  statusGroup: {
    backgroundColor: "#282828",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#404040",
  },
  statusGroupHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  statusGroupTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
    marginLeft: 8,
  },
  statusIndicatorSubmitted: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#4CAF50",
  },
  statusIndicatorPending: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#666666",
  },
  avatarRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  memberAvatarSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FFB000",
    justifyContent: "center",
    alignItems: "center",
  },
  memberAvatarSmallText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#191414",
  },
  emptyStatusText: {
    fontSize: 14,
    color: "#B3B3B3",
    fontStyle: "italic",
  },
  userSubmissionContainer: {
    marginTop: 20,
  },
  userSubmissionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  editSubmissionButton: {
    backgroundColor: "#FFB000",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  editSubmissionButtonText: {
    color: "#191414",
    fontSize: 14,
    fontWeight: "600",
  },
  commentInputContainer: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#282828",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#404040",
  },
  commentInput: {
    fontSize: 14,
    color: "white",
    padding: 0,
    minHeight: 40,
    textAlignVertical: "top",
  },
  commentInputDisabled: {
    backgroundColor: "#1f1f1f",
    color: "#666666",
    opacity: 0.7,
  },
  commentCounter: {
    fontSize: 12,
    color: "#666666",
    textAlign: "right",
    marginTop: 4,
  },
  voteCommentsContainer: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#282828",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#404040",
  },
  voteCommentsTitle: {
    fontSize: 14,
    color: "#B3B3B3",
    fontWeight: "500",
    marginBottom: 8,
  },
  voteCommentItem: {
    marginBottom: 8,
  },
  voteCommentAuthor: {
    fontSize: 13,
    color: "#FFB000",
    fontWeight: "600",
    marginBottom: 2,
  },
  voteCommentText: {
    fontSize: 13,
    color: "#E0E0E0",
    lineHeight: 18,
  },
});
