import React from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { GroupDetailScreen } from "../../components/GroupDetailScreen";
import { useGroup } from "../../hooks/useGroups";
import { View, ActivityIndicator, StyleSheet } from "react-native";

export default function GroupDetailRoute() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const router = useRouter();
  const { data: group, isLoading } = useGroup(groupId ?? "");

  if (isLoading || !group) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFB000" />
      </View>
    );
  }

  return (
    <GroupDetailScreen
      group={group}
      onBack={() => router.back()}
      onRoundPress={(round) =>
        router.push({
          pathname: "/round/[roundId]",
          params: { roundId: round.id, groupId: group.id },
        })
      }
      onCreateRoundPress={() =>
        router.push({
          pathname: "/group/[groupId]/create-round",
          params: { groupId: group.id },
        })
      }
      onEditGroupPress={(g) =>
        router.push({ pathname: "/edit-group", params: { groupId: g.id } })
      }
    />
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: "#191414",
    alignItems: "center",
    justifyContent: "center",
  },
});
