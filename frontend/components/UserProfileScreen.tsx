import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  Alert,
} from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { SettingsScreen } from "./SettingsScreen";

export const UserProfileScreen: React.FC = () => {
  const { user, logout } = useAuth();
  const [showSettings, setShowSettings] = useState(false);

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Logout",
        style: "destructive",
        onPress: logout,
      },
    ]);
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>User not found</Text>
      </View>
    );
  }

  if (showSettings) {
    return (
      <View style={styles.container}>
        <View style={styles.settingsHeader}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setShowSettings(false)}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.settingsTitle}>Settings</Text>
        </View>
        <SettingsScreen />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.welcomeText}>Welcome back!</Text>
        <Text style={styles.subtitle}>Here's your profile information</Text>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => setShowSettings(true)}
        >
          <Text style={styles.settingsButtonText}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.profileSection}>
        {user.avatarUrl ? (
          <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>
              {user.displayName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}

        <View style={styles.userInfo}>
          <Text style={styles.displayName}>{user.displayName}</Text>
          <Text style={styles.email}>{user.email}</Text>
          <Text style={styles.userId}>ID: {user.id}</Text>
        </View>
      </View>

      <View style={styles.statsSection}>
        <Text style={styles.sectionTitle}>Your Stats</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>Groups</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>Submissions</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>Votes</Text>
          </View>
        </View>
      </View>

      <View style={styles.actionsSection}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>

        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionButtonText}>Create New Group</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionButtonText}>Join Existing Group</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionButtonText}>View My Groups</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#191414",
  },
  content: {
    padding: 20,
    paddingTop: 60,
  },
  header: {
    alignItems: "center",
    marginBottom: 30,
    position: "relative",
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFB000",
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: "#B3B3B3",
    textAlign: "center",
  },
  profileSection: {
    alignItems: "center",
    marginBottom: 30,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 15,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#FFB000",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },
  avatarText: {
    fontSize: 36,
    fontWeight: "bold",
    color: "white",
  },
  userInfo: {
    alignItems: "center",
  },
  displayName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "white",
    marginBottom: 5,
  },
  email: {
    fontSize: 16,
    color: "#B3B3B3",
    marginBottom: 5,
  },
  userId: {
    fontSize: 12,
    color: "#666",
  },
  statsSection: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "white",
    marginBottom: 15,
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statCard: {
    flex: 1,
    backgroundColor: "#282828",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginHorizontal: 5,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFB000",
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 12,
    color: "#B3B3B3",
  },
  actionsSection: {
    marginBottom: 30,
  },
  actionButton: {
    backgroundColor: "#282828",
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#404040",
  },
  actionButtonText: {
    color: "white",
    fontSize: 16,
    textAlign: "center",
    fontWeight: "500",
  },
  logoutButton: {
    backgroundColor: "#E53E3E",
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
  },
  logoutButtonText: {
    color: "white",
    fontSize: 16,
    textAlign: "center",
    fontWeight: "600",
  },
  errorText: {
    color: "#E53E3E",
    fontSize: 16,
    textAlign: "center",
    marginTop: 50,
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
  settingsButton: {
    position: "absolute",
    top: 10,
    right: 20,
    padding: 10,
  },
  settingsButtonText: {
    fontSize: 24,
  },
});
