import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { useAuth } from "../contexts/AuthContext";

interface User {
  id: string;
  spotifyId: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  country?: string;
  createdAt: string; // ISO date string
}

interface Group {
  id: string;
  name: string;
  adminId: string;
  submissionDurationDays: number;
  votingDurationDays: number;
  votesPerUserPerRound: number;
  maxVotesPerSong: number;
  createdAt: string;
  description: string;
  // Computed fields (from API)
  memberCount?: number;
  isAdmin?: boolean;
  lastActivity?: string;
}

interface RecentActivity {
  id: string;
  type: "submission" | "vote" | "round_start" | "round_end";
  description: string;
  timestamp: string;
  groupName: string;
}

export const UserGroupsScreen: React.FC = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"groups" | "activity">("groups");

  // Mock data - in real app this would come from API
  const mockGroups: Group[] = [
    {
      id: "1",
      name: "Weekend Vibes",
      adminId: "1",
      submissionDurationDays: 7,
      votingDurationDays: 7,
      votesPerUserPerRound: 5,
      maxVotesPerSong: 3,
      createdAt: "2021-01-01",
      description: "Chill music for the weekend",
      memberCount: 5,
      isAdmin: true,
      lastActivity: "2 hours ago",
    },
    {
      id: "2",
      name: "Workout Mix",
      adminId: "2",
      submissionDurationDays: 7,
      votingDurationDays: 7,
      votesPerUserPerRound: 5,
      maxVotesPerSong: 3,
      createdAt: "2021-01-02",
      description: "High energy tracks for workouts",
      memberCount: 8,
      isAdmin: false,
      lastActivity: "1 day ago",
    },
  ];

  const mockActivity: RecentActivity[] = [
    {
      id: "1",
      type: "submission",
      description: "You submitted 'Blinding Lights' to Weekend Vibes",
      timestamp: "2 hours ago",
      groupName: "Weekend Vibes",
    },
    {
      id: "2",
      type: "vote",
      description: "You voted for 'Dance Monkey' in Workout Mix",
      timestamp: "1 day ago",
      groupName: "Workout Mix",
    },
    {
      id: "3",
      type: "round_start",
      description: "New round started: 'Summer Hits' in Weekend Vibes",
      timestamp: "3 days ago",
      groupName: "Weekend Vibes",
    },
  ];

  const renderGroupItem = ({ item }: { item: Group }) => (
    <TouchableOpacity style={styles.groupCard}>
      <View style={styles.groupHeader}>
        <Text style={styles.groupName}>{item.name}</Text>
        {item.isAdmin && (
          <View style={styles.adminBadge}>
            <Text style={styles.adminText}>Admin</Text>
          </View>
        )}
      </View>
      <Text style={styles.groupDescription}>{item.description}</Text>
      <View style={styles.groupFooter}>
        <Text style={styles.memberCount}>{item.memberCount} members</Text>
        <Text style={styles.lastActivity}>{item.lastActivity}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderActivityItem = ({ item }: { item: RecentActivity }) => (
    <View style={styles.activityCard}>
      <View style={styles.activityHeader}>
        <Text style={styles.activityType}>{item.type.toUpperCase()}</Text>
        <Text style={styles.activityTimestamp}>{item.timestamp}</Text>
      </View>
      <Text style={styles.activityDescription}>{item.description}</Text>
      <Text style={styles.groupName}>{item.groupName}</Text>
    </View>
  );

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "submission":
        return "🎵";
      case "vote":
        return "👍";
      case "round_start":
        return "🚀";
      case "round_end":
        return "🏁";
      default:
        return "📝";
    }
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>User not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Groups & Activity</Text>
        <Text style={styles.headerSubtitle}>
          Welcome back, {user.displayName}!
        </Text>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "groups" && styles.activeTab]}
          onPress={() => setActiveTab("groups")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "groups" && styles.activeTabText,
            ]}
          >
            My Groups ({mockGroups.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "activity" && styles.activeTab]}
          onPress={() => setActiveTab("activity")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "activity" && styles.activeTabText,
            ]}
          >
            Recent Activity ({mockActivity.length})
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1DB954" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : (
        <ScrollView style={styles.content}>
          {activeTab === "groups" ? (
            <View>
              {mockGroups.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateTitle}>No Groups Yet</Text>
                  <Text style={styles.emptyStateText}>
                    Create your first group or join an existing one to get
                    started!
                  </Text>
                  <TouchableOpacity style={styles.createGroupButton}>
                    <Text style={styles.createGroupButtonText}>
                      Create New Group
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <FlatList
                  data={mockGroups}
                  renderItem={renderGroupItem}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                />
              )}
            </View>
          ) : (
            <View>
              {mockActivity.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateTitle}>No Activity Yet</Text>
                  <Text style={styles.emptyStateText}>
                    Start participating in groups to see your activity here!
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={mockActivity}
                  renderItem={renderActivityItem}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                />
              )}
            </View>
          )}
        </ScrollView>
      )}

      <View style={styles.fabContainer}>
        <TouchableOpacity style={styles.fab}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#191414",
  },
  header: {
    padding: 20,
    paddingTop: 60,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1DB954",
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: "#B3B3B3",
  },
  tabContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  activeTab: {
    borderBottomColor: "#1DB954",
  },
  tabText: {
    fontSize: 14,
    color: "#B3B3B3",
    fontWeight: "500",
  },
  activeTabText: {
    color: "#1DB954",
    fontWeight: "600",
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  groupCard: {
    backgroundColor: "#282828",
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  groupHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  groupName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
    flex: 1,
  },
  adminBadge: {
    backgroundColor: "#1DB954",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  adminText: {
    fontSize: 10,
    color: "white",
    fontWeight: "bold",
  },
  groupDescription: {
    fontSize: 14,
    color: "#B3B3B3",
    marginBottom: 10,
  },
  groupFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  memberCount: {
    fontSize: 12,
    color: "#666",
  },
  lastActivity: {
    fontSize: 12,
    color: "#666",
  },
  activityCard: {
    backgroundColor: "#282828",
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  activityHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  activityType: {
    fontSize: 12,
    color: "#1DB954",
    fontWeight: "bold",
  },
  activityTimestamp: {
    fontSize: 12,
    color: "#666",
  },
  activityDescription: {
    fontSize: 14,
    color: "white",
    marginBottom: 5,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "white",
    marginBottom: 10,
  },
  emptyStateText: {
    fontSize: 14,
    color: "#B3B3B3",
    textAlign: "center",
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  createGroupButton: {
    backgroundColor: "#1DB954",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
  },
  createGroupButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#B3B3B3",
  },
  fabContainer: {
    position: "absolute",
    bottom: 20,
    right: 20,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#1DB954",
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabText: {
    fontSize: 24,
    color: "white",
    fontWeight: "bold",
  },
  errorText: {
    color: "#E53E3E",
    fontSize: 16,
    textAlign: "center",
    marginTop: 50,
  },
});
