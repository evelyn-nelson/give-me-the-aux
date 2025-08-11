import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Switch,
} from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { useApi } from "../hooks/useApi";
import { useSettings } from "../contexts/SettingsContext";
import * as WebBrowser from "expo-web-browser";

export const SettingsScreen: React.FC = () => {
  const { user, logout } = useAuth();
  const api = useApi();
  const { notificationsEnabled, setNotificationsEnabled } = useSettings();

  const handleToggleNotifications = async (next: boolean) => {
    // Optimistically update persisted setting
    await setNotificationsEnabled(next);
    try {
      if (next) {
        // Enabling: global bootstrap will register the token
      } else {
        // Disabling: revoke user's tokens so we stop sending pushes
        await api.revokePushToken();
      }
    } catch (err) {
      Alert.alert(
        "Notifications",
        next
          ? "Failed to enable notifications"
          : "Failed to disable notifications"
      );
      // Revert persisted setting on failure
      await setNotificationsEnabled(!next);
    }
  };

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

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "This action cannot be undone. Are you sure you want to delete your account?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            // Handle account deletion
            console.log("Account deletion requested");
          },
        },
      ]
    );
  };

  const openLegalPage = async (path: "/privacy" | "/terms") => {
    const baseUrl = process.env.EXPO_PUBLIC_API_URL;
    if (!baseUrl) {
      Alert.alert(
        "Unavailable",
        "Server URL is not configured. Please set EXPO_PUBLIC_API_URL."
      );
      return;
    }

    const url = `${baseUrl}${path}`;
    try {
      await WebBrowser.openBrowserAsync(url, {
        // Styling options by platform
        toolbarColor: "#282828", // Android
        controlsColor: "#FFB000", // iOS
      });
    } catch (e) {
      Alert.alert("Error", "Unable to open link right now.");
    }
  };

  const renderSettingItem = (
    title: string,
    subtitle?: string,
    onPress?: () => void,
    rightComponent?: React.ReactNode
  ) => (
    <TouchableOpacity
      style={styles.settingItem}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      {rightComponent && (
        <View style={styles.settingRight}>{rightComponent}</View>
      )}
    </TouchableOpacity>
  );

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>User not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
        <Text style={styles.headerSubtitle}>Manage your account</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        {renderSettingItem(
          "Display Name",
          user.displayName,
          undefined,
          <Text style={styles.settingValue}>{user.displayName}</Text>
        )}
        {renderSettingItem(
          "Email",
          user.email,
          undefined,
          <Text style={styles.settingValue}>{user.email}</Text>
        )}
        {renderSettingItem(
          "User ID",
          user.id,
          undefined,
          <Text style={styles.settingValue}>{user.id}</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        {renderSettingItem(
          "Push Notifications",
          "Receive notifications for new rounds and votes",
          undefined,
          <Switch
            value={notificationsEnabled}
            onValueChange={handleToggleNotifications}
            trackColor={{ false: "#404040", true: "#FFB000" }}
            thumbColor={notificationsEnabled ? "#fff" : "#f4f3f4"}
          />
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Data & Privacy</Text>
        {renderSettingItem("Export My Data", "Download all your data", () => {
          Alert.alert("Export Data", "Data export feature coming soon!");
        })}
        {renderSettingItem("Privacy Policy", "Read our privacy policy", () => {
          openLegalPage("/privacy");
        })}
        {renderSettingItem(
          "Terms of Service",
          "Read our terms of service",
          () => {
            openLegalPage("/terms");
          }
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Support</Text>
        {renderSettingItem("Help & FAQ", "Get help and find answers", () => {
          Alert.alert("Help & FAQ", "Help section coming soon!");
        })}
        {renderSettingItem(
          "Contact Support",
          "Get in touch with our team",
          () => {
            Alert.alert(
              "Contact Support",
              "Contact support feature coming soon!"
            );
          }
        )}
        {renderSettingItem("About", "App version and information", () => {
          Alert.alert(
            "About",
            "Give Me The Aux v1.0.0\n\nA music voting app for friends!"
          );
        })}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Actions</Text>
        {renderSettingItem(
          "Logout",
          "Sign out of your account",
          handleLogout,
          <Text style={styles.dangerText}>Logout</Text>
        )}
        {renderSettingItem(
          "Delete Account",
          "Permanently delete your account and data",
          handleDeleteAccount,
          <Text style={styles.dangerText}>Delete</Text>
        )}
      </View>
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
    marginBottom: 30,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFB000",
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: "#B3B3B3",
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
    marginBottom: 15,
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 15,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: "#404040",
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    color: "white",
    fontWeight: "500",
  },
  settingSubtitle: {
    fontSize: 14,
    color: "#B3B3B3",
    marginTop: 2,
  },
  settingRight: {
    marginLeft: 10,
  },
  settingValue: {
    fontSize: 14,
    color: "#666",
  },
  dangerText: {
    fontSize: 14,
    color: "#E53E3E",
    fontWeight: "500",
  },
  errorText: {
    color: "#E53E3E",
    fontSize: 16,
    textAlign: "center",
    marginTop: 50,
  },
});
