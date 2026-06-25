/**
 * REST API: 消息 CRUD + 网格读取
 * GET  /api/messages?date=YYYY-MM-DD     → 获取某天的消息列表
 * POST /api/messages                      → 追加一条消息
 * GET  /api/messages/grid?date=YYYY-MM-DD → 获取零点生成的网格
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getMessages, appendMessage, clearMessages, getGrid } from "../lib/storage.js";

/** 北京时间今天的日期 */
function todayCN(): string {
  const now = new Date();
  const cn = new Date(now.getTime() + 8 * 3600_000);
  return cn.toISOString().slice(0, 10);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const url = new URL(req.url!, `http://${req.headers.host}`);
  const path = url.pathname;
  const date = url.searchParams.get("date") || todayCN();

  try {
    // GET /api/messages/grid?date=YYYY-MM-DD
    if (req.method === "GET" && path.endsWith("/grid")) {
      const grid = await getGrid(date);
      if (!grid) {
        return res.status(200).json({ ok: true, grid: null, message: "网格尚未生成" });
      }
      return res.status(200).json({ ok: true, grid });
    }

    // GET /api/messages?date=YYYY-MM-DD
    if (req.method === "GET") {
      const messages = await getMessages(date);
      return res.status(200).json({ ok: true, date, messages });
    }

    // POST /api/messages  { action: "append", msg: ScheduleMessage }
    // POST /api/messages  { action: "clear" }
    if (req.method === "POST") {
      const body = req.body || {};

      if (body.action === "clear") {
        await clearMessages(date);
        return res.status(200).json({ ok: true, message: "已清空" });
      }

      if (body.action === "append" && body.msg) {
        await appendMessage(date, body.msg);
        return res.status(200).json({ ok: true, message: "已记录" });
      }

      return res.status(400).json({ error: "缺少 action 或 msg" });
    }

    // DELETE /api/messages?date=YYYY-MM-DD
    if (req.method === "DELETE") {
      await clearMessages(date);
      return res.status(200).json({ ok: true, message: "已清空" });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e: any) {
    console.error("[Messages API] 错误:", e);
    return res.status(500).json({ error: e.message });
  }
}
