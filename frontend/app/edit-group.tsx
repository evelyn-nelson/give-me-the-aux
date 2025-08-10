import React from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { EditGroupScreen } from "../components/EditGroupScreen";
import { useGroup } from "../hooks/useGroups";
import { View, ActivityIndicator, StyleSheet } from "react-native";

export default function EditGroupRoute() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const router = useRouter();
  const { data: group, isLoading } = useGroup(groupId ?? "");

  if (!group || isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFB000" />
      </View>
    );
  }

  return (
    <EditGroupScreen
      group={group}
      onGroupUpdated={(updatedGroup) =>
        router.replace({
          pathname: "/group/[groupId]",
          params: { groupId: updatedGroup.id },
        })
      }
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
