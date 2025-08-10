import React from "react";
import { View, StyleSheet, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SettingsScreen } from "../components/SettingsScreen";

export default function SettingsRoute() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <View style={styles.settingsHeader}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityLabel="Back to groups"
        >
          <Ionicons name="chevron-back" size={20} color="#FFB000" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.settingsTitle}>Settings</Text>
      </View>
      <SettingsScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#191414",
  },
  settingsHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#404040",
  },
  backButton: {
    padding: 8,
    marginRight: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  backButtonText: {
    color: "#FFB000",
    fontSize: 16,
    fontWeight: "500",
  },
  settingsTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "white",
  },
});
