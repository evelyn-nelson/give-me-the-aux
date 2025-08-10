import React from "react";
import { TouchableOpacity, Text, StyleSheet, View } from "react-native";

interface ChatFloatingButtonProps {
  onPress: () => void;
  unreadCount?: number;
}

export const ChatFloatingButton: React.FC<ChatFloatingButtonProps> = ({
  onPress,
  unreadCount = 0,
}) => {
  return (
    <TouchableOpacity style={styles.floatingButton} onPress={onPress}>
      <Text style={styles.chatIcon}>💬</Text>
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {unreadCount > 99 ? "99+" : unreadCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
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
  chatIcon: {
    fontSize: 24,
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
