import { PrismaClient } from "@prisma/client";
import { Expo, ExpoPushMessage, ExpoPushTicket } from "expo-server-sdk";

const prisma = new PrismaClient();
const expo = new Expo();

export type NotificationPayload = {
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
};

export async function sendToUserIds(
  userIds: string[],
  payload: NotificationPayload
): Promise<ExpoPushTicket[]> {
  const tokens = await prisma.pushToken.findMany({
    where: { userId: { in: userIds }, isRevoked: false },
    select: { token: true },
  });

  const messages: ExpoPushMessage[] = [];
  for (const { token } of tokens) {
    if (!Expo.isExpoPushToken(token)) continue;
    messages.push({
      to: token,
      sound: "default",
      title: payload.title,
      body: payload.body,
      data: payload.data,
      priority: "high",
    });
  }

  if (messages.length === 0) {
    console.log(
      `[Notifications] No valid Expo tokens for users: ${userIds.length}`
    );
    return [];
  }

  console.log(
    `[Notifications] Sending ${messages.length} push messages to ${userIds.length} users`
  );

  const chunks = expo.chunkPushNotifications(messages);
  const tickets: ExpoPushTicket[] = [];
  for (const chunk of chunks) {
    try {
      const receiptChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...receiptChunk);
    } catch (err) {
      console.error("[Notifications] Error sending push chunk:", err);
    }
  }

  const errors = tickets.filter((t) => t.status === "error");
  if (errors.length > 0) {
    console.warn("[Notifications] Ticket errors:", errors);
  }

  return tickets;
}

export async function sendToGroupMembers(
  groupId: string,
  payload: NotificationPayload
): Promise<ExpoPushTicket[]> {
  const members = await prisma.groupMember.findMany({
    where: { groupId },
    select: { userId: true },
  });
  const userIds = members.map((m) => m.userId);
  if (userIds.length === 0) return [];
  return sendToUserIds(userIds, payload);
}

export async function sendToRoundMembers(
  roundId: string,
  payload: NotificationPayload
): Promise<ExpoPushTicket[]> {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    select: { groupId: true },
  });
  if (!round) return [];
  return sendToGroupMembers(round.groupId, payload);
}
