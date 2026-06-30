/**
 * Upstash Redis 存储操作
 */

import { Redis } from "@upstash/redis";
import type { ScheduleMessage, DailyGrid } from "./types.js";

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});
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
  const msgs = await redis.lrange(messageKey(date), 0, -1);
  if (!msgs || msgs.length === 0) return [];
  return msgs.map((m: string) => JSON.parse(m) as ScheduleMessage);
}

/** 追加一条消息到某天 */
export async function appendMessage(
  date: string,
  msg: ScheduleMessage
): Promise<void> {
  await redis.rpush(messageKey(date), JSON.stringify(msg));
  await redis.expire(messageKey(date), 7 * 24 * 3600);
}

/** 删除某天的消息 */
export async function clearMessages(date: string): Promise<void> {
  await redis.del(messageKey(date));
}

/** 保存零点生成的网格到 Redis */
export async function saveGrid(
  date: string,
  grid: DailyGrid
): Promise<void> {
  await redis.set(gridKey(date), JSON.stringify(grid));
  await redis.expire(gridKey(date), 7 * 24 * 3600);
}

/** 获取零点生成的网格 */
export async function getGrid(date: string): Promise<DailyGrid | null> {
  const raw = await redis.get(gridKey(date));
  if (!raw) return null;
  return JSON.parse(raw as string) as DailyGrid;
}
