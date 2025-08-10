import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { useApi } from "./useApi";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function registerForPushNotificationsAsync(): Promise<string | null> {
  try {
    if (!Device.isDevice) {
      return null;
    }

    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();

    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true },
      });
      finalStatus = status;
    }
    if (finalStatus !== "granted") {
      return null;
    }

    const projectId =
      (Constants as any)?.expoConfig?.extra?.eas?.projectId ??
      (Constants as any)?.easConfig?.projectId;
    if (!projectId) {
      return null;
    }

    const token = (await Notifications.getExpoPushTokenAsync({ projectId }))
      .data;

    if (Platform.OS === "ios") {
      await Notifications.setBadgeCountAsync(0);
    }

    return token;
  } catch (error) {
    return null;
  }
}

export function usePushNotifications(enabled: boolean) {
  const api = useApi();

  useEffect(() => {
    if (!enabled) return;

    let isMounted = true;

    (async () => {
      const token = await registerForPushNotificationsAsync();
      if (!isMounted) return;

      if (token) {
        try {
          await api.registerPushToken({ token, platform: Platform.OS });
        } catch {}
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [enabled]);
}
