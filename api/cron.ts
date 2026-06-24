/**
 * 零点定时任务 —— 生成每日日程汇总图片并推送
 * Vercel cron 在 UTC 16:00（= 北京时间 00:00）触发
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getMessages } from "../lib/storage.js";
import { generateGrid } from "../lib/deepseek.js";
import { sendMessage, uploadImage, sendImageMessage } from "../lib/feishu.js";
// chart 模块依赖原生绑定，动态导入

const USER_ID = process.env.FEISHU_USER_ID!;

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
      await sendMessage(USER_ID, `${date} 没有记录任何日程。记得随时告诉我你在做什么~`);
      return res.status(200).json({ ok: true, message: "no messages" });
    }

    console.log(`[Cron] 共 ${messages.length} 条消息，调用 AI 生成网格...`);

    // 1. AI 生成48槽网格
    const grid = await generateGrid(date, messages);

    // 2. 渲染为图片（动态导入）
    console.log(`[Cron] 渲染图表...`);
    const { renderChart } = await import("../lib/chart.js");
    const imageBuffer = await renderChart(date, grid);

    // 3. 上传飞书
    console.log(`[Cron] 上传图片...`);
    const imageKey = await uploadImage(imageBuffer);

    // 4. 发送图片
    console.log(`[Cron] 发送图片...`);
    await sendImageMessage(USER_ID, imageKey);

    console.log(`[Cron] ${date} 汇总已发送`);

    return res.status(200).json({ ok: true, count: messages.length });
  } catch (e: any) {
    console.error(`[Cron] 生成汇总失败:`, e);
    try {
      await sendMessage(USER_ID, `日程复盘失败: ${e.message}`);
    } catch {}
    return res.status(500).json({ error: e.message });
  }
}
