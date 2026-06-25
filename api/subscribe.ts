/**
 * Web Push 订阅管理
 * POST   /api/subscribe              → 保存订阅
 * DELETE /api/subscribe?endpoint=... → 删除订阅
 * GET    /api/subscribe/vapid        → 获取 VAPID 公钥
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { saveSubscription, removeSubscription } from "../lib/storage.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const url = new URL(req.url!, `http://${req.headers.host}`);
  const path = url.pathname;

  try {
    // GET /api/subscribe/vapid → 返回 VAPID 公钥（前端需要）
    if (req.method === "GET" && path.endsWith("/vapid")) {
      const publicKey = process.env.VAPID_PUBLIC_KEY;
      if (!publicKey) {
        return res.status(500).json({ error: "VAPID 公钥未配置" });
      }
      return res.status(200).json({ publicKey });
    }

    // POST /api/subscribe
    if (req.method === "POST") {
      const sub = req.body;
      if (!sub || !sub.endpoint) {
        return res.status(400).json({ error: "无效的订阅对象" });
      }
      await saveSubscription(sub);
      return res.status(200).json({ ok: true });
    }

    // DELETE /api/subscribe?endpoint=...
    if (req.method === "DELETE") {
      const endpoint = url.searchParams.get("endpoint");
      if (!endpoint) {
        return res.status(400).json({ error: "缺少 endpoint 参数" });
      }
      await removeSubscription(endpoint);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e: any) {
    console.error("[Subscribe API] 错误:", e);
    return res.status(500).json({ error: e.message });
  }
}
