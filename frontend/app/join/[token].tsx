import React, { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  View,
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  BackHandler,
} from "react-native";
import { useAuth } from "../../contexts/AuthContext";
import { useApi } from "../../hooks/useApi";

export default function JoinByTokenRoute() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const { user, login } = useAuth();
  const api = useApi();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Handle system back (Android) when there's no stack
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      router.replace("/");
      return true;
    });
    return () => sub.remove();
  }, [router]);

  useEffect(() => {
    const run = async () => {
      if (!token) return;
      try {
        if (!user) {
          // Trigger login; user will return and hook will resume
          await login();
        }
        // Accept invite
        const response = await api.post(`/api/invites/accept/${token}`);
        const { group, joined } = response.data as {
          group: any;
          joined: boolean;
        };
        // Navigate to group
        router.replace({
          pathname: "/group/[groupId]",
          params: { groupId: group.id },
        });
      } catch (e: any) {
        setError(e?.message || "Failed to accept invite");
      }
    };
    run();
  }, [token, user]);

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => router.replace("/")}
        >
          <Text style={styles.retryText}>Go Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#FFB000" />
      <Text style={styles.infoText}>Joining group…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#191414",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  infoText: {
    marginTop: 12,
    color: "#B3B3B3",
  },
  errorText: {
    color: "#E53E3E",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: "#FFB000",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryText: {
    color: "#191414",
    fontWeight: "600",
  },
});
