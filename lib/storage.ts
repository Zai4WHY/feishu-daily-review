/**
 * Vercel KV 存储操作
 */

import { kv } from "@vercel/kv";
import type { ScheduleMessage } from "./types";

const USER_ID = process.env.FEISHU_USER_ID!;

/** 消息存储 key */
function messageKey(date: string): string {
  return `messages:${USER_ID}:${date}`;
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
  // 设置过期时间为7天
  await kv.expire(messageKey(date), 7 * 24 * 3600);
}

/** 删除某天的消息 */
export async function clearMessages(date: string): Promise<void> {
  await kv.del(messageKey(date));
}
