/**
 * DeepSeek API 代理 —— 密钥藏在服务端
 * POST /api/proxy
 *   { action: "extract", text: "..." } → 提取信息
 *   { action: "grid", date: "...", messages: [...] } → 生成网格
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { extractInfo, generateGrid } from "../lib/deepseek.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { action, text, date, messages, customRule } = req.body || {};

  try {
    if (action === "extract") {
      if (!text) {
        return res.status(400).json({ error: "缺少 text 参数" });
      }
      const result = await extractInfo(text, customRule);
      return res.status(200).json({ ok: true, ...result });
    }

    if (action === "grid") {
      if (!date || !messages) {
        return res.status(400).json({ error: "缺少 date 或 messages 参数" });
      }
      const grid = await generateGrid(date, messages);
      return res.status(200).json({ ok: true, grid });
    }

    return res.status(400).json({ error: "无效的 action，支持 extract / grid" });
  } catch (e: any) {
    console.error("[Proxy API] 错误:", e);
    return res.status(500).json({ error: e.message });
  }
}
