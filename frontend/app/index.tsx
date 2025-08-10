import React from "react";
import { useRouter } from "expo-router";
import { GroupListScreen } from "../components/GroupListScreen";
import { Group } from "../types/api";
import { useAuth } from "../contexts/AuthContext";
import { View, StyleSheet } from "react-native";
import { LoginScreen } from "../components/LoginScreen";

export default function Index() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.container}>
        <LoginScreen />
      </View>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  const handleGroupPress = (group: Group) => {
    router.push({
      pathname: "/group/[groupId]",
      params: { groupId: group.id },
    });
  };

  return (
    <View style={styles.container}>
      <GroupListScreen
        onGroupPress={handleGroupPress}
        onCreateGroupPress={() => router.push("/create-group")}
        onOpenSettings={() => router.push("/settings")}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#191414",
  },
});
