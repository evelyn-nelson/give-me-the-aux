import React from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CreateRoundScreen } from "../../../components/CreateRoundScreen";
import { useGroup } from "../../../hooks/useGroups";
import { View, ActivityIndicator, StyleSheet } from "react-native";

export default function CreateRoundRoute() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const router = useRouter();
  const { data: group, isLoading } = useGroup(groupId ?? "");

  if (!groupId || isLoading || !group) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFB000" />
      </View>
    );
  }

  return (
    <CreateRoundScreen
      groupId={groupId}
      groupName={group.name}
      onRoundCreated={() => router.back()}
      onCancel={() => router.back()}
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
