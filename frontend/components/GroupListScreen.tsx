import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { useGroups } from "../hooks/useGroups";
import { Group } from "../types/api";

interface GroupListScreenProps {
  onGroupPress: (group: Group) => void;
  onCreateGroupPress: () => void;
}

export const GroupListScreen: React.FC<GroupListScreenProps> = ({
  onGroupPress,
  onCreateGroupPress,
}) => {
  const { user } = useAuth();
  const { data: groups = [], isLoading, error, refetch } = useGroups();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const renderGroupCard = ({ item: group }: { item: Group }) => {
    const isAdmin = group.adminId === user?.id;
    const activeRound = group.rounds.find(
      (r) => r.status === "SUBMISSION" || r.status === "VOTING"
    );

    return (
      <TouchableOpacity
        style={styles.groupCard}
        onPress={() => onGroupPress(group)}
      >
        <View style={styles.groupHeader}>
          <Text style={styles.groupName}>{group.name}</Text>
          {isAdmin && (
            <View style={styles.adminBadge}>
              <Text style={styles.adminBadgeText}>Admin</Text>
            </View>
          )}
        </View>

        <View style={styles.groupStats}>
          <Text style={styles.statText}>
            {group._count.members} member
            {group._count.members !== 1 ? "s" : ""}
          </Text>
          <Text style={styles.statText}>•</Text>
          <Text style={styles.statText}>
            {group._count.rounds} round{group._count.rounds !== 1 ? "s" : ""}
          </Text>
        </View>

        {activeRound && (
          <View style={styles.activeRoundContainer}>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor:
                    activeRound.status === "SUBMISSION" ? "#FFB000" : "#FF8C00",
                },
              ]}
            >
              <Text style={styles.statusText}>
                {activeRound.status === "SUBMISSION"
                  ? "Submissions Open"
                  : "Voting Open"}
              </Text>
            </View>
            <Text style={styles.roundTheme}>{activeRound.theme}</Text>
          </View>
        )}

        <View style={styles.groupFooter}>
          <Text style={styles.createdDate}>
            Created {new Date(group.createdAt).toLocaleDateString()}
          </Text>
          <Text style={styles.chevron}>›</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFB000" />
        <Text style={styles.loadingText}>Loading groups...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Failed to load groups</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Groups</Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={onCreateGroupPress}
        >
          <Text style={styles.createButtonText}>+ New Group</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={groups}
        renderItem={renderGroupCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FFB000"
          />
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No Groups Yet</Text>
            <Text style={styles.emptySubtitle}>
              Create your first group to start voting on music with friends!
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={onCreateGroupPress}
            >
              <Text style={styles.emptyButtonText}>
                Create Your First Group
              </Text>
            </TouchableOpacity>
          </View>
        }
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
    paddingBottom: 15,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "white",
  },
  createButton: {
    backgroundColor: "#FFB000",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  createButtonText: {
    color: "#191414",
    fontSize: 14,
    fontWeight: "600",
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  groupCard: {
    backgroundColor: "#282828",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#404040",
  },
  groupHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  groupName: {
    fontSize: 18,
    fontWeight: "600",
    color: "white",
    flex: 1,
  },
  adminBadge: {
    backgroundColor: "#FFB000",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  adminBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#191414",
  },
  groupStats: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  statText: {
    fontSize: 14,
    color: "#B3B3B3",
    marginHorizontal: 4,
  },
  activeRoundContainer: {
    marginBottom: 12,
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
    color: "white",
  },
  roundTheme: {
    fontSize: 14,
    color: "#FFB000",
    fontWeight: "500",
  },
  groupFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  createdDate: {
    fontSize: 12,
    color: "#B3B3B3",
  },
  chevron: {
    fontSize: 20,
    color: "#B3B3B3",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#191414",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#B3B3B3",
  },
  emptyContainer: {
    alignItems: "center",
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "white",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: "#B3B3B3",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
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
  errorText: {
    color: "#E53E3E",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: "#FFB000",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  retryButtonText: {
    color: "#191414",
    fontSize: 16,
    fontWeight: "600",
  },
});
