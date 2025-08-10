import React from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SubmitSongScreen } from "../components/SubmitSongScreen";
import { useRound } from "../hooks/useRounds";
import { useGroup } from "../hooks/useGroups";
import { View, ActivityIndicator, StyleSheet } from "react-native";

export default function SubmitSongRoute() {
  const { roundId, groupId } = useLocalSearchParams<{
    roundId: string;
    groupId: string;
  }>();
  const router = useRouter();
  const { data: round, isLoading: isLoadingRound } = useRound(roundId ?? "");
  const { data: group, isLoading: isLoadingGroup } = useGroup(groupId ?? "");

  if (!round || isLoadingRound || !group || isLoadingGroup) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFB000" />
      </View>
    );
  }

  return (
    <SubmitSongScreen
      round={round}
      group={group}
      onBack={() => router.back()}
      onSuccess={() => router.back()}
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
