import { StatusBar } from "expo-status-bar";
import { StyleSheet, View } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LoginScreen } from "./components/LoginScreen";
import { MainNavigator } from "./components/MainNavigator";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { usePushNotifications } from "./hooks/usePushNotifications";

const AppContent: React.FC = () => {
  const { user, isLoading } = useAuth();

  // Temporarily register for push notifications on app start to trigger iOS prompt
  usePushNotifications(true);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        {/* Loading state handled by LoginScreen */}
        <LoginScreen />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      {user ? <MainNavigator /> : <LoginScreen />}
    </View>
  );
};

export default function App() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: 2,
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000, // 10 minutes
      },
      mutations: {
        retry: 1,
      },
    },
  });

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#191414",
  },
});
