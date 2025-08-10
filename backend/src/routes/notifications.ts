import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { sendToUserIds } from "../services/notifications";

const prisma = new PrismaClient();
const router = Router();

router.post("/token", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { token, platform } = req.body as {
      token: string;
      platform?: string;
    };
    if (!token) return res.status(400).json({ error: "Missing token" });

    const saved = await prisma.pushToken.upsert({
      where: { token },
      create: { token, userId, platform },
      update: { userId, platform, isRevoked: false, lastUsedAt: new Date() },
    });

    return res.json({ data: { id: saved.id } });
  } catch (error) {
    console.error("/api/notifications/token error", error);
    res.status(500).json({ error: "Failed to save push token" });
  }
});

router.post("/test", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const tickets = await sendToUserIds([userId], {
      title: "Give Me The Aux",
      body: "Test push from backend",
      data: { source: "test-endpoint" },
    });
    return res.json({ data: tickets });
  } catch (error) {
    console.error("/api/notifications/test error", error);
    res.status(500).json({ error: "Failed to send test push" });
  }
});

export default router;
