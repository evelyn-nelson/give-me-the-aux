import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useAuth } from "../contexts/AuthContext";
import {
  useCreateVote,
  useUpdateVote,
  useDeleteVote,
} from "../hooks/useSubmissions";
import { useRound } from "../hooks/useRounds";
import { Round, User, Vote, Submission, Group } from "../types/api";

interface RoundDetailScreenProps {
  round: Round;
  group: Group;
  onBack: () => void;
  onSubmitSongPress: (roundId: string) => void;
  onEditRoundPress?: (round: Round) => void;
}

export const RoundDetailScreen: React.FC<RoundDetailScreenProps> = ({
  round: initialRound,
  group,
  onBack,
  onSubmitSongPress,
  onEditRoundPress,
}) => {
  const { user } = useAuth();
  const [votingState, setVotingState] = useState<Record<string, number>>({});

  // Fetch fresh round data using the hook with initial data to avoid loading screen
  const { data: round = initialRound, isLoading: isLoadingRound } = useRound(
    initialRound.id,
    initialRound // Pass initial data to avoid refetch
  );

  const createVoteMutation = useCreateVote();
  const updateVoteMutation = useUpdateVote();
  const deleteVoteMutation = useDeleteVote();

  const isLoading =
    createVoteMutation.isPending ||
    updateVoteMutation.isPending ||
    deleteVoteMutation.isPending;

  // Use the group prop instead of round.group
  const isAdmin = group?.admin?.id === user?.id;
  const canSubmit =
    round.status === "SUBMISSION" &&
    !round.submissions?.find((s) => s.user?.id === user?.id);
  const canVote = round.status === "VOTING";

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
    return (round.submissions || []).reduce((total, submission) => {
      const userVote = submission.votes?.find((v) => v.user?.id === user?.id);
      return total + (userVote ? userVote.count : 0);
    }, 0);
  };

  const getRemainingVotes = () => {
    return (group?.votesPerUserPerRound || 0) - getTotalUserVotes();
  };

  const handleVote = async (submissionId: string, voteCount: number) => {
    if (!canVote) return;

    const currentVotes = getUserVoteCount(
      round.submissions.find((s) => s.id === submissionId)!
    );
    const voteDifference = voteCount - currentVotes;

    if (
      getTotalUserVotes() + voteDifference >
      (group?.votesPerUserPerRound || 0)
    ) {
      Alert.alert("Vote Limit", "You don't have enough votes remaining.");
      return;
    }

    if (voteCount > (group?.maxVotesPerSong || 0)) {
      Alert.alert(
        "Vote Limit",
        `You can only give up to ${group?.maxVotesPerSong || 0} votes per song.`
      );
      return;
    }

    try {
      const existingVote = round.submissions
        .find((s) => s.id === submissionId)
        ?.votes.find((v) => v.user.id === user?.id);

      if (voteCount === 0 && existingVote) {
        // Delete vote
        await deleteVoteMutation.mutateAsync({
          submissionId,
          voteId: existingVote.id,
        });
      } else if (existingVote) {
        // Update existing vote
        await updateVoteMutation.mutateAsync({
          submissionId,
          voteId: existingVote.id,
          data: { count: voteCount },
        });
      } else if (voteCount > 0) {
        // Create new vote
        await createVoteMutation.mutateAsync({
          submissionId,
          count: voteCount,
        });
      }
    } catch (error) {
      Alert.alert("Error", "Failed to submit vote. Please try again.");
    }
  };

  const renderSubmissionCard = ({ item: submission }: { item: Submission }) => {
    const totalVotes = getTotalVotes(submission);
    const userVotes = getUserVoteCount(submission);
    const isUserSubmission = submission.user?.id === user?.id;

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
              <Text style={styles.albumArtPlaceholder}>♪</Text>
            </View>
          )}
        </View>

        <View style={styles.submissionFooter}>
          <Text style={styles.submitterName}>
            Submitted by{" "}
            {isUserSubmission
              ? "You"
              : submission.user?.displayName || "Unknown User"}
          </Text>

          <View style={styles.voteContainer}>
            <Text style={styles.voteCount}>
              {totalVotes} vote{totalVotes !== 1 ? "s" : ""}
            </Text>

            {canVote && !isUserSubmission && (
              <View style={styles.voteControls}>
                <TouchableOpacity
                  style={[
                    styles.voteButton,
                    userVotes > 0 && styles.voteButtonActive,
                  ]}
                  onPress={() =>
                    handleVote(submission.id, Math.max(0, userVotes - 1))
                  }
                  disabled={userVotes === 0 || isLoading}
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

                <Text style={styles.userVoteCount}>{userVotes}</Text>

                <TouchableOpacity
                  style={[
                    styles.voteButton,
                    userVotes < (group?.maxVotesPerSong || 0) &&
                      getRemainingVotes() > 0 &&
                      styles.voteButtonActive,
                  ]}
                  onPress={() => handleVote(submission.id, userVotes + 1)}
                  disabled={
                    userVotes >= (group?.maxVotesPerSong || 0) ||
                    getRemainingVotes() === 0 ||
                    isLoading
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
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backText}>‹ Back</Text>
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
            <Text style={styles.sectionTitle}>Your Voting</Text>
            <Text style={styles.votingStats}>
              {getRemainingVotes()} of {group?.votesPerUserPerRound || 0} votes
              remaining
            </Text>
            <Text style={styles.votingHelpText}>
              You can give up to {group?.maxVotesPerSong || 0} votes per song
            </Text>
          </View>
        )}

        <View style={styles.submissions}>
          <View style={styles.submissionsHeader}>
            <Text style={styles.sectionTitle}>
              Submissions ({(round.submissions || []).length})
            </Text>
            {canSubmit && (
              <TouchableOpacity
                style={styles.submitButton}
                onPress={() => onSubmitSongPress(round.id)}
              >
                <Text style={styles.submitButtonText}>+ Submit Song</Text>
              </TouchableOpacity>
            )}
          </View>

          <FlatList
            data={sortedSubmissions}
            renderItem={renderSubmissionCard}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyTitle}>No Submissions Yet</Text>
                <Text style={styles.emptySubtitle}>
                  {round.status === "SUBMISSION"
                    ? "Be the first to submit a song!"
                    : "No songs were submitted for this round."}
                </Text>
                {canSubmit && (
                  <TouchableOpacity
                    style={styles.emptyButton}
                    onPress={() => onSubmitSongPress(round.id)}
                  >
                    <Text style={styles.emptyButtonText}>Submit Your Song</Text>
                  </TouchableOpacity>
                )}
              </View>
            }
          />
        </View>
      </ScrollView>

      {isLoading && (
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
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#404040",
  },
  backText: {
    fontSize: 16,
    color: "#FFB000",
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
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#404040",
  },
  votingStats: {
    fontSize: 16,
    color: "#FFB000",
    fontWeight: "500",
    marginBottom: 4,
  },
  votingHelpText: {
    fontSize: 14,
    color: "#B3B3B3",
  },
  submissions: {
    padding: 20,
  },
  submissionsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
  voteCount: {
    fontSize: 14,
    color: "white",
    fontWeight: "500",
    marginBottom: 4,
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
  userVoteCount: {
    fontSize: 16,
    color: "white",
    fontWeight: "600",
    minWidth: 20,
    textAlign: "center",
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
});
