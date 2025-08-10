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
  Pressable,
} from "react-native";
import { useAuth } from "../contexts/AuthContext";
import {
  useCreateGroupInvite,
  useDeleteGroup,
  useGroup,
} from "../hooks/useGroups";
import { ChatFloatingButton } from "./ChatFloatingButton";
import { ChatModal } from "./ChatModal";
import { Group, Round, User } from "../types/api";
import * as Clipboard from "expo-clipboard";
import { Platform } from "react-native";

interface GroupDetailScreenProps {
  group: Group;
  onBack: () => void;
  onRoundPress: (round: Round) => void;
  onCreateRoundPress: (groupId: string) => void;
  onEditGroupPress: (group: Group) => void;
}

export const GroupDetailScreen: React.FC<GroupDetailScreenProps> = ({
  group: initialGroup,
  onBack,
  onRoundPress,
  onCreateRoundPress,
  onEditGroupPress,
}) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"rounds" | "members">("rounds");
  const [chatModalVisible, setChatModalVisible] = useState(false);

  // Fetch fresh group data using the hook with initial data to avoid loading screen
  const { data: group = initialGroup, isLoading: isLoadingGroup } = useGroup(
    initialGroup.id,
    initialGroup // Pass initial data to avoid refetch
  );

  const deleteGroupMutation = useDeleteGroup();
  const isLoading = deleteGroupMutation.isPending;
  const createInviteMutation = useCreateGroupInvite();

  // Use the group data, fallback to initialGroup if group is undefined
  const currentGroup = group || initialGroup;
  const isAdmin = currentGroup.adminId === user?.id;

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
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Sort rounds: current round first, then upcoming rounds in order, then finished rounds in reverse order
  const getSortedRounds = (rounds: Round[]) => {
    if (!rounds || rounds.length === 0) return [];

    // Separate rounds by status
    const currentRounds = rounds.filter(
      (round) => round.status === "SUBMISSION" || round.status === "VOTING"
    );

    const upcomingRounds = rounds.filter(
      (round) => round.status === "INACTIVE"
    );

    const finishedRounds = rounds.filter(
      (round) => round.status === "COMPLETED"
    );

    const sortedCurrentRounds = currentRounds.sort((a, b) => a.order - b.order);
    const sortedUpcomingRounds = upcomingRounds.sort(
      (a, b) => a.order - b.order
    );
    const sortedFinishedRounds = finishedRounds.sort(
      (a, b) => b.order - a.order
    );
    const sortedRounds = [
      ...sortedCurrentRounds,
      ...sortedUpcomingRounds,
      ...sortedFinishedRounds,
    ];

    return sortedRounds;
  };

  const handleDeleteGroup = () => {
    Alert.alert(
      "Delete Group",
      "Are you sure you want to delete this group? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteGroupMutation.mutateAsync(currentGroup.id);
              onBack();
            } catch (error) {
              Alert.alert("Error", "Failed to delete group. Please try again.");
            }
          },
        },
      ]
    );
  };

  const handleInviteCopy = async () => {
    try {
      const invite = await createInviteMutation.mutateAsync({
        groupId: currentGroup.id,
      });
      await Clipboard.setStringAsync(invite.url);
      Alert.alert(
        "Invite Link Copied",
        "A new invite link was copied to your clipboard."
      );
    } catch (err) {
      Alert.alert(
        "Error",
        (err as Error)?.message || "Failed to create invite"
      );
    }
  };

  const renderRoundCard = ({ item: round }: { item: Round }) => (
    <Pressable
      style={({ pressed }) => [
        styles.roundCard,
        pressed && styles.roundCardPressed,
      ]}
      onPress={() => onRoundPress(round)}
    >
      <View style={styles.roundHeader}>
        <View style={styles.roundInfo}>
          <Text style={styles.roundTheme}>{round.theme}</Text>
          <Text style={styles.roundDescription}>
            {round.description || "No description"}
          </Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(round.status) },
          ]}
        >
          <Text style={styles.statusText}>{getStatusText(round.status)}</Text>
        </View>
      </View>

      <View style={styles.roundStatsRow}>
        <View style={styles.roundStats}>
          <Text style={styles.statText}>
            {round._count?.submissions || 0} submission
            {(round._count?.submissions || 0) !== 1 ? "s" : ""}
          </Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </View>

      <View style={styles.roundDateContainer}>
        <Text style={styles.roundDateLine}>
          Start: {formatDate(round.startDate)}
        </Text>
        <Text style={styles.roundDateLine}>
          End: {formatDate(round.endDate)}
        </Text>
      </View>
    </Pressable>
  );

  // Calculate vote totals for each member across completed rounds
  const calculateMemberVoteTotals = () => {
    const voteTotals: { [userId: string]: number } = {};

    // Initialize vote totals for all members
    currentGroup.members?.forEach((member) => {
      voteTotals[member.user.id] = 0;
    });

    // Sum votes from completed rounds
    currentGroup.rounds?.forEach((round) => {
      if (round.status === "COMPLETED") {
        round.submissions?.forEach((submission) => {
          // Add votes received on this submission to the submission author's total
          submission.votes?.forEach((vote) => {
            if (voteTotals[submission.user.id] !== undefined) {
              voteTotals[submission.user.id] += vote.count;
            }
          });
        });
      }
    });

    return voteTotals;
  };

  // Get sorted members by vote total
  const getSortedMembers = () => {
    const voteTotals = calculateMemberVoteTotals();
    const membersWithVoteTotals = (currentGroup.members || []).map(
      (member) => ({
        ...member,
        totalVotes: voteTotals[member.user.id] || 0,
      })
    );

    // Sort by total votes (descending), then by name (ascending) for ties
    return membersWithVoteTotals.sort((a, b) => {
      if (b.totalVotes !== a.totalVotes) {
        return b.totalVotes - a.totalVotes;
      }
      return (a.user.displayName || "").localeCompare(b.user.displayName || "");
    });
  };

  const renderMemberCard = ({
    item,
  }: {
    item: { user: User; totalVotes: number };
  }) => (
    <View style={styles.memberCard}>
      <View style={styles.memberAvatar}>
        <Text style={styles.memberAvatarText}>
          {item.user.displayName?.charAt(0)?.toUpperCase() || "?"}
        </Text>
      </View>
      <View style={styles.memberInfo}>
        <Text style={styles.memberName}>
          {item.user.displayName || "Unknown User"}
        </Text>
        <View style={styles.memberDetails}>
          <View style={styles.memberBadges}>
            {item.user.id === currentGroup.adminId && (
              <Text style={styles.adminLabel}>Admin</Text>
            )}
          </View>
          <Text style={styles.voteTotal}>
            {item.totalVotes} vote{item.totalVotes !== 1 ? "s" : ""}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        {isAdmin && (
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => onEditGroupPress(currentGroup)}>
              <Text style={styles.editText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleInviteCopy}
              style={styles.inviteButton}
            >
              <Text style={styles.inviteText}>Invite</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleDeleteGroup}
              style={styles.deleteButton}
            >
              <Text style={styles.deleteText}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.groupInfo}>
          <Text style={styles.groupName}>{currentGroup.name}</Text>
          <View style={styles.groupStats}>
            <Text style={styles.statText}>
              {currentGroup._count?.members || 0} member
              {(currentGroup._count?.members || 0) !== 1 ? "s" : ""}
            </Text>
            <Text style={styles.statDot}>•</Text>
            <Text style={styles.statText}>
              {currentGroup._count?.rounds || 0} round
              {(currentGroup._count?.rounds || 0) !== 1 ? "s" : ""}
            </Text>
          </View>
          <Text style={styles.createdDate}>
            Created {formatDate(currentGroup.createdAt)}
          </Text>
        </View>

        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === "rounds" && styles.activeTab]}
            onPress={() => setActiveTab("rounds")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "rounds" && styles.activeTabText,
              ]}
            >
              Rounds
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === "members" && styles.activeTab]}
            onPress={() => setActiveTab("members")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "members" && styles.activeTabText,
              ]}
            >
              Members
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === "rounds" ? (
          <View style={styles.tabContent}>
            {isAdmin && (
              <Pressable
                style={({ pressed }) => [
                  styles.createRoundButton,
                  pressed && styles.createRoundButtonPressed,
                ]}
                onPress={() => onCreateRoundPress(currentGroup.id)}
              >
                <Text style={styles.createRoundText}>+ Create New Round</Text>
              </Pressable>
            )}

            <FlatList
              data={getSortedRounds(currentGroup.rounds || [])}
              renderItem={renderRoundCard}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyTitle}>No Rounds Yet</Text>
                  <Text style={styles.emptySubtitle}>
                    {isAdmin
                      ? "Create the first round to get started!"
                      : "The admin will create rounds for voting."}
                  </Text>
                </View>
              }
            />
          </View>
        ) : (
          <View style={styles.tabContent}>
            <FlatList
              data={getSortedMembers()}
              renderItem={renderMemberCard}
              keyExtractor={(item) => item.user.id}
              scrollEnabled={false}
            />
          </View>
        )}
      </ScrollView>

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FFB000" />
        </View>
      )}
      {createInviteMutation.isPending && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FFB000" />
        </View>
      )}

      <ChatFloatingButton
        onPress={() => setChatModalVisible(true)}
        unreadCount={0} // TODO: Implement unread message count
      />

      <ChatModal
        visible={chatModalVisible}
        onClose={() => setChatModalVisible(false)}
        groupId={currentGroup.id}
        groupName={currentGroup.name}
      />
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
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  editText: {
    fontSize: 16,
    color: "#FFB000",
    marginRight: 16,
  },
  inviteButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "#282828",
    borderWidth: 1,
    borderColor: "#404040",
    marginRight: 8,
  },
  inviteText: {
    fontSize: 14,
    color: "#FFB000",
    fontWeight: "600",
  },
  deleteButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "#E53E3E",
  },
  deleteText: {
    fontSize: 14,
    color: "white",
    fontWeight: "600",
  },
  groupInfo: {
    padding: 20,
  },
  groupName: {
    fontSize: 28,
    fontWeight: "bold",
    color: "white",
    marginBottom: 8,
  },
  groupStats: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  statText: {
    fontSize: 16,
    color: "#B3B3B3",
    marginHorizontal: 4,
  },
  statDot: {
    fontSize: 16,
    color: "#666666",
    marginHorizontal: 4,
  },
  createdDate: {
    fontSize: 14,
    color: "#B3B3B3",
  },
  tabs: {
    flexDirection: "row",
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#404040",
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: "center",
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: "#FFB000",
  },
  tabText: {
    fontSize: 16,
    color: "#B3B3B3",
    fontWeight: "500",
  },
  activeTabText: {
    color: "#FFB000",
    fontWeight: "600",
  },
  tabContent: {
    padding: 20,
  },
  createRoundButton: {
    backgroundColor: "#FFB000",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignSelf: "flex-start",
    marginBottom: 20,
  },
  createRoundButtonPressed: {
    transform: [{ scale: 0.98 }],
  },
  createRoundText: {
    color: "#191414",
    fontSize: 14,
    fontWeight: "600",
  },
  roundCard: {
    backgroundColor: "#282828",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#404040",
  },
  roundCardPressed: {
    borderColor: "#FFB000",
    transform: [{ scale: 0.99 }],
  },
  roundHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  roundInfo: {
    flex: 1,
    marginRight: 12,
  },
  roundTheme: {
    fontSize: 18,
    fontWeight: "600",
    color: "white",
    marginBottom: 4,
  },
  roundDescription: {
    fontSize: 14,
    color: "#B3B3B3",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
    color: "white",
  },
  roundStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  roundStats: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    flexWrap: "wrap",
  },
  chevron: {
    fontSize: 24,
    color: "#B3B3B3",
  },
  roundDateContainer: {
    marginTop: 6,
  },
  roundDateLine: {
    fontSize: 14,
    color: "#B3B3B3",
    lineHeight: 18,
  },
  memberCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#404040",
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFB000",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  memberAvatarText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#191414",
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: "500",
    color: "white",
    marginBottom: 2,
  },
  memberDetails: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  memberBadges: {
    flexDirection: "row",
    alignItems: "center",
  },
  adminLabel: {
    fontSize: 12,
    color: "#FFB000",
    fontWeight: "600",
  },
  voteTotal: {
    fontSize: 12,
    color: "#B3B3B3",
    fontWeight: "500",
  },
  statTextDate: {
    flexShrink: 1,
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
