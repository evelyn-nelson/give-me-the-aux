import { StatusBar } from "expo-status-bar";
import { StyleSheet, View } from "react-native";
import { LoginScreen } from "./components/LoginScreen";
import { MainNavigator } from "./components/MainNavigator";
import { AuthProvider, useAuth } from "./contexts/AuthContext";

const AppContent: React.FC = () => {
  const { user, isLoading } = useAuth();

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
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#191414",
  },
});
