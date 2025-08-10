import React from "react";
import { View, StyleSheet, SafeAreaView } from "react-native";
import { GroupsNavigator } from "./GroupsNavigator";

export const MainNavigator: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <GroupsNavigator />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#191414",
  },
  content: {
    flex: 1,
  },
});
