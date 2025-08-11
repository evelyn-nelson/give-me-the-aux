import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from "react";
import * as SecureStore from "expo-secure-store";
import { makeRedirectUri, useAuthRequest } from "expo-auth-session";
import { Alert } from "react-native";

interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshTokens: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

// Spotify OAuth configuration
const discovery = {
  authorizationEndpoint: "https://accounts.spotify.com/authorize",
  tokenEndpoint: "https://accounts.spotify.com/api/token",
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // prevent concurrent refresh storms
  const isRefreshingRef = useRef<Promise<boolean> | null>(null);

  // Create redirect URI with custom scheme
  const redirectUri = makeRedirectUri({
    scheme: "givemetheaux",
    path: "auth",
  });

  // Debug: Log the redirect URI being used
  console.log("Redirect URI being used:", redirectUri);

  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID!,
      scopes: [
        "user-read-email",
        "user-read-private",
        "playlist-modify-public",
        "playlist-modify-private",
        "user-library-read",
      ],
      usePKCE: true,
      redirectUri,
    },
    discovery
  );

  useEffect(() => {
    loadStoredUser();
  }, []);

  useEffect(() => {
    if (response?.type === "success") {
      handleSpotifyResponse(response);
    }
  }, [response]);

  const loadStoredUser = async () => {
    try {
      const accessToken = await SecureStore.getItemAsync("accessToken");
      const refreshToken = await SecureStore.getItemAsync("refreshToken");

      console.log("Loading stored user - tokens found:", {
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
        accessTokenLength: accessToken?.length || 0,
      });

      if (accessToken && refreshToken) {
        const user = await fetchUserProfile(accessToken);
        setUser(user);
        console.log("Successfully loaded user:", user.displayName);
      } else {
        console.log("No stored tokens found, user needs to login");
      }
    } catch (error) {
      console.error("Error loading stored user:", error);
      // Clear invalid tokens
      await SecureStore.deleteItemAsync("accessToken");
      await SecureStore.deleteItemAsync("refreshToken");
      console.log("Cleared invalid tokens");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSpotifyResponse = async (response: any) => {
    try {
      const { code } = response.params;

      const apiResponse = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/api/auth/spotify`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            code,
            redirectUri,
            codeVerifier: request?.codeVerifier, // Send the code verifier for PKCE
          }),
        }
      );

      const result = await apiResponse.json();

      if (!apiResponse.ok) {
        if (result?.code === "REGION_RESTRICTED") {
          Alert.alert(
            "Not available in your region",
            "Give Me The Aux is only available in the United States at this time."
          );
        } else {
          Alert.alert(
            "Login failed",
            result?.error || "Unable to complete login. Please try again."
          );
        }
        return; // Do not store any tokens
      }

      if (result.data) {
        await SecureStore.setItemAsync("accessToken", result.data.accessToken);
        await SecureStore.setItemAsync(
          "refreshToken",
          result.data.refreshToken
        );
        setUser(result.data.user);
      }
    } catch (error) {
      console.error("Spotify auth error:", error);
      Alert.alert("Login error", "Something went wrong. Please try again.");
    }
  };

  const fetchUserProfile = async (token: string): Promise<User> => {
    console.log("Fetching user profile with token length:", token.length);

    const response = await fetch(
      `${process.env.EXPO_PUBLIC_API_URL}/api/auth/me`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    console.log("User profile response status:", response.status);

    if (response.status === 401) {
      console.log("Token expired, attempting refresh...");
      // Token expired, try to refresh
      const refreshed = await refreshTokens();
      if (!refreshed) {
        console.log("Token refresh failed");
        // Refresh failed, clear storage and force re-login
        await SecureStore.deleteItemAsync("accessToken");
        await SecureStore.deleteItemAsync("refreshToken");
        setUser(null);
        throw new Error("Token expired and refresh failed");
      }

      console.log("Token refresh successful, retrying...");
      // Retry with new token
      const newToken = await SecureStore.getItemAsync("accessToken");
      if (newToken) {
        return await fetchUserProfile(newToken);
      }
    }

    if (!response.ok) {
      console.error(
        "User profile fetch failed:",
        response.status,
        response.statusText
      );
      throw new Error(`Failed to fetch user profile: ${response.status}`);
    }

    const result = await response.json();
    console.log("User profile fetch successful");
    return result.data;
  };

  const refreshTokens = async (): Promise<boolean> => {
    if (isRefreshingRef.current) {
      return isRefreshingRef.current;
    }

    const doRefresh = (async () => {
      try {
        const refreshToken = await SecureStore.getItemAsync("refreshToken");

        if (!refreshToken) {
          console.log("No refresh token available");
          return false;
        }

        console.log("Attempting to refresh tokens...");

        const response = await fetch(
          `${process.env.EXPO_PUBLIC_API_URL}/api/auth/refresh`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ refreshToken }),
          }
        );

        console.log("Refresh response status:", response.status);

        if (response.ok) {
          const result = await response.json();
          await SecureStore.setItemAsync(
            "accessToken",
            result.data.accessToken
          );
          await SecureStore.setItemAsync(
            "refreshToken",
            result.data.refreshToken
          );
          console.log("Tokens refreshed successfully");
          return true;
        }

        console.log("Token refresh failed:", response.status);
        return false;
      } catch (error) {
        console.error("Token refresh error:", error);
        return false;
      } finally {
        // small delay to prevent hammering on repeated 401s
        await new Promise((r) => setTimeout(r, 250));
        isRefreshingRef.current = null;
      }
    })();

    isRefreshingRef.current = doRefresh;
    return doRefresh;
  };

  const login = async () => {
    if (request) {
      await promptAsync();
    }
  };

  const logout = async () => {
    try {
      const accessToken = await SecureStore.getItemAsync("accessToken");

      // Call logout endpoint to revoke refresh tokens
      if (accessToken) {
        await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/auth/logout`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
      }
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      await SecureStore.deleteItemAsync("accessToken");
      await SecureStore.deleteItemAsync("refreshToken");
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, isLoading, login, logout, refreshTokens }}
    >
      {children}
    </AuthContext.Provider>
  );
};
