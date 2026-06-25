/**
 * 零点定时任务 —— 生成每日日程汇总并存入 KV
 * Vercel cron 在 UTC 16:00（= 北京时间 00:00）触发
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getMessages, saveGrid } from "../lib/storage.js";
import { generateGrid } from "../lib/deepseek.js";

/** 北京时间昨天的日期 YYYY-MM-DD */
function yesterdayCN(): string {
  const now = new Date();
  const cn = new Date(now.getTime() + 8 * 3600_000 - 24 * 3600_000);
  return cn.toISOString().slice(0, 10);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const date = yesterdayCN();
  console.log(`[Cron] 开始生成 ${date} 的日程汇总...`);

  try {
    const messages = await getMessages(date);

    if (messages.length === 0) {
      console.log(`[Cron] ${date} 没有日程消息`);
      return res.status(200).json({ ok: true, message: "no messages" });
    }

    console.log(`[Cron] 共 ${messages.length} 条消息，调用 AI 生成网格...`);

    // AI 生成48槽网格
    const grid = await generateGrid(date, messages);

    // 保存网格到 KV（用户打开页面时自动加载）
    console.log(`[Cron] 保存网格到 KV...`);
    await saveGrid(date, grid);

    console.log(`[Cron] ${date} 汇总完成`);
    return res.status(200).json({ ok: true, count: messages.length });
  } catch (e: any) {
    console.error(`[Cron] 生成汇总失败:`, e);
    return res.status(500).json({ error: e.message });
  }
}
