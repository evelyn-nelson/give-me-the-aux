import React, { useEffect } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { GroupDetailScreen } from "../../components/GroupDetailScreen";
import { useGroup } from "../../hooks/useGroups";
import { View, ActivityIndicator, StyleSheet, BackHandler } from "react-native";
import { useNavigation } from "@react-navigation/native";

export default function GroupDetailRoute() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const router = useRouter();
  const navigation = useNavigation() as { canGoBack?: () => boolean };
  const { data: group, isLoading } = useGroup(groupId ?? "");

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (
        typeof navigation.canGoBack === "function" &&
        navigation.canGoBack()
      ) {
        return false; // let default handler pop the screen
      }
      router.replace("/");
      return true;
    });
    return () => sub.remove();
  }, [navigation, router]);

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
      onBack={() => {
        if (
          typeof navigation.canGoBack === "function" &&
          navigation.canGoBack()
        ) {
          router.back();
        } else {
          router.replace("/");
        }
      }}
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
