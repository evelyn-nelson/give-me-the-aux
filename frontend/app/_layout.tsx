import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "../contexts/AuthContext";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { usePushNotifications } from "../hooks/usePushNotifications";
import { SettingsProvider, useSettings } from "../contexts/SettingsContext";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
    },
    mutations: {
      retry: 1,
    },
  },
});

// Ensure this hook runs within the AuthProvider context
const NotificationsBootstrap: React.FC = () => {
  const { notificationsEnabled, isLoaded } = useSettings();
  usePushNotifications(isLoaded && notificationsEnabled);
  return null;
};

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SettingsProvider>
            <StatusBar style="light" />
            <NotificationsBootstrap />
            <SafeAreaView
              style={{ flex: 1, backgroundColor: "#191414" }}
              edges={["top", "bottom"]}
            >
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: "#191414" },
                }}
              />
            </SafeAreaView>
          </SettingsProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
