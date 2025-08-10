import React from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface ChatFloatingButtonProps {
  onPress: () => void;
  unreadCount?: number;
}

export const ChatFloatingButton: React.FC<ChatFloatingButtonProps> = ({
  onPress,
  unreadCount = 0,
}) => {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.floatingButton,
        pressed && styles.floatingButtonPressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Open group chat"
    >
      <Ionicons name="chatbubble-ellipses" size={24} color="#191414" />
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {unreadCount > 99 ? "99+" : unreadCount}
          </Text>
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  floatingButton: {
    position: "absolute",
    bottom: 30,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FFB000",
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  floatingButtonPressed: {
    transform: [{ scale: 0.97 }],
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: "#E53E3E",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#191414",
  },
  badgeText: {
    color: "white",
    fontSize: 10,
    fontWeight: "600",
    paddingHorizontal: 4,
  },
});
