/**
 * 零点定时任务 —— 生成每日日程汇总并推送
 * Vercel cron 在 UTC 16:00（= 北京时间 00:00）触发
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import webpush from "web-push";
import { getMessages, saveGrid, getSubscriptions } from "../lib/storage.js";
import { generateGrid } from "../lib/deepseek.js";

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY!;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY!;
const VAPID_EMAIL = process.env.VAPID_EMAIL || "mailto:example@example.com";

// 初始化 web-push
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

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

    // 1. AI 生成48槽网格
    const grid = await generateGrid(date, messages);

    // 2. 保存网格到 KV
    console.log(`[Cron] 保存网格到 KV...`);
    await saveGrid(date, grid);

    // 3. 发送 Web Push 通知
    const subscriptions = await getSubscriptions();
    console.log(`[Cron] 共 ${subscriptions.length} 个订阅，发送推送...`);

    if (subscriptions.length > 0 && VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
      const payload = JSON.stringify({
        title: "昨日日程复盘已生成",
        body: `${date} 的日程汇总已准备好，点击查看`,
        icon: "/icon-192.png",
        data: { date },
      });

      const results = await Promise.allSettled(
        subscriptions.map((sub) =>
          webpush.sendNotification(sub as any, payload).catch((err: any) => {
            console.error(`[Cron] 推送失败 (${sub.endpoint?.slice(0, 40)}...):`, err.statusCode, err.message);
            throw err;
          })
        )
      );

      const successCount = results.filter((r) => r.status === "fulfilled").length;
      console.log(`[Cron] 推送完成: ${successCount}/${subscriptions.length} 成功`);
    }

    console.log(`[Cron] ${date} 汇总完成`);
    return res.status(200).json({ ok: true, count: messages.length });
  } catch (e: any) {
    console.error(`[Cron] 生成汇总失败:`, e);
    return res.status(500).json({ error: e.message });
  }
}
