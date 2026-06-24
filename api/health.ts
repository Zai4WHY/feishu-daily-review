/**
 * 保活端点 —— 被 cron 每5分钟 ping 一次，防止函数冷启动
 * 同时让飞书 URL 验证走同区域 warm 实例
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return res.status(200).json({ ok: true });
}
