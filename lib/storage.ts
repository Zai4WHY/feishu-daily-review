/**
 * Vercel KV 存储操作
 */

import { kv } from "@vercel/kv";
import type { ScheduleMessage, DailyGrid } from "./types.js";

const USER_ID = process.env.SUBSCRIBER_ID || "default";

/** 消息存储 key */
function messageKey(date: string): string {
  return `messages:${USER_ID}:${date}`;
}

/** 网格存储 key */
function gridKey(date: string): string {
  return `grid:${USER_ID}:${date}`;
}

/** 获取某天的所有消息 */
export async function getMessages(date: string): Promise<ScheduleMessage[]> {
  const msgs = await kv.lrange<ScheduleMessage>(messageKey(date), 0, -1);
  return msgs || [];
}

/** 追加一条消息到某天 */
export async function appendMessage(
  date: string,
  msg: ScheduleMessage
): Promise<void> {
  await kv.rpush(messageKey(date), msg);
  await kv.expire(messageKey(date), 7 * 24 * 3600);
}

/** 删除某天的消息 */
export async function clearMessages(date: string): Promise<void> {
  await kv.del(messageKey(date));
}

/** 保存零点生成的网格到 KV */
export async function saveGrid(
  date: string,
  grid: DailyGrid
): Promise<void> {
  await kv.set(gridKey(date), grid);
  await kv.expire(gridKey(date), 7 * 24 * 3600);
}

/** 获取零点生成的网格 */
export async function getGrid(date: string): Promise<DailyGrid | null> {
  return await kv.get<DailyGrid>(gridKey(date));
}
