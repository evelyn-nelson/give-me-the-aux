import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from "react-native";
import { UserProfileScreen } from "./UserProfileScreen";
import { GroupsNavigator } from "./GroupsNavigator";

type TabType = "profile" | "groups";

export const MainNavigator: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>("profile");

  const renderTabIcon = (tab: TabType, isActive: boolean) => {
    const icon = tab === "profile" ? "👤" : "👥";
    return (
      <Text style={[styles.tabIcon, isActive && styles.activeTabIcon]}>
        {icon}
      </Text>
    );
  };

  const renderTabLabel = (tab: TabType) => {
    return tab === "profile" ? "Profile" : "Groups";
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {activeTab === "profile" ? <UserProfileScreen /> : <GroupsNavigator />}
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "profile" && styles.activeTab]}
          onPress={() => setActiveTab("profile")}
        >
          {renderTabIcon("profile", activeTab === "profile")}
          <Text
            style={[
              styles.tabLabel,
              activeTab === "profile" && styles.activeTabLabel,
            ]}
          >
            {renderTabLabel("profile")}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === "groups" && styles.activeTab]}
          onPress={() => setActiveTab("groups")}
        >
          {renderTabIcon("groups", activeTab === "groups")}
          <Text
            style={[
              styles.tabLabel,
              activeTab === "groups" && styles.activeTabLabel,
            ]}
          >
            {renderTabLabel("groups")}
          </Text>
        </TouchableOpacity>
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
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#282828",
    borderTopWidth: 1,
    borderTopColor: "#404040",
    paddingBottom: 20,
    paddingTop: 10,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
  },
  activeTab: {
    // Active tab styling is handled by text colors
  },
  tabIcon: {
    fontSize: 24,
    marginBottom: 4,
    opacity: 0.6,
  },
  activeTabIcon: {
    opacity: 1,
  },
  tabLabel: {
    fontSize: 12,
    color: "#B3B3B3",
    fontWeight: "500",
  },
  activeTabLabel: {
    color: "#FFB000",
    fontWeight: "600",
  },
});
