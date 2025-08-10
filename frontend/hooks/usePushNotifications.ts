import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { useApi } from "./useApi";
import { router } from "expo-router";

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

function navigateFromNotificationData(data: any) {
  const roundId = data?.roundId as string | undefined;
  const groupId = (data?.groupId as string | undefined) ?? undefined;
  if (roundId) {
    router.push({
      pathname: "/round/[roundId]",
      params: groupId ? { roundId, groupId } : { roundId },
    });
  }
}

export function usePushNotifications(enabled: boolean) {
  const api = useApi();

  useEffect(() => {
    if (!enabled) return;

    let isMounted = true;
    let responseListener: Notifications.Subscription | undefined;

    (async () => {
      const token = await registerForPushNotificationsAsync();
      if (!isMounted) return;

      if (token) {
        try {
          await api.registerPushToken({ token, platform: Platform.OS });
        } catch {}
      }

      // Handle cold-start notification navigation
      try {
        const last = await Notifications.getLastNotificationResponseAsync();
        if (last?.notification?.request?.content?.data) {
          navigateFromNotificationData(last.notification.request.content.data);
        }
      } catch {}

      // Subscribe to notification response (tap)
      responseListener = Notifications.addNotificationResponseReceivedListener(
        (response) => {
          const data = response.notification.request.content.data;
          navigateFromNotificationData(data);
        }
      );
    })();

    return () => {
      isMounted = false;
      if (responseListener) {
        responseListener.remove();
      }
    };
  }, [enabled]);
}
