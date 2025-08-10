import React from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { RoundDetailScreen } from "../../components/RoundDetailScreen";
import { useRound } from "../../hooks/useRounds";
import { useGroup } from "../../hooks/useGroups";
import { View, ActivityIndicator, StyleSheet } from "react-native";

export default function RoundDetailRoute() {
  const { roundId, groupId } = useLocalSearchParams<{
    roundId: string;
    groupId?: string;
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
    <RoundDetailScreen
      round={round}
      group={group}
      onBack={() => router.back()}
      onSubmitSongPress={(_rid, existingSubmission) =>
        router.push({
          pathname: "/submit-song",
          params: {
            roundId: round.id,
            groupId: group.id,
            existingSubmissionId: existingSubmission?.id,
          },
        })
      }
      onEditRoundPress={() => router.setParams({ roundId: round.id })}
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
