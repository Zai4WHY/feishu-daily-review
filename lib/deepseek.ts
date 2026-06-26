/**
 * DeepSeek AI 调用
 * DeepSeek API 兼容 OpenAI SDK
 */

import OpenAI from "openai";
import type { ScheduleMessage, DailyGrid } from "./types.js";
import { CATEGORIES } from "./types.js";

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY!,
  baseURL: "https://api.deepseek.com",
});

/** 从用户消息中提取地点和事件 */
export async function extractInfo(text: string, customRule?: string): Promise<{
  location: string;
  event: string;
  category: string;
}> {
  const ruleSection = customRule ? `\n\n分类标准：${customRule}\n` : "";

  const prompt = `用户发了一条日程消息，请提取其中的地点、事件，并判断事件分类。

消息内容："${text}"

事件分类（只能从以下选一个）：
${CATEGORIES.map((c) => `- ${c}`).join("\n")}${ruleSection}
请只返回 JSON，不要其他内容：
{"location": "地点名（没有则空字符串）", "event": "事件描述", "category": "分类名"}`;

  const resp = await client.chat.completions.create({
    model: "deepseek-chat",
    messages: [{ role: "user", content: prompt }],
    temperature: 0,
    max_tokens: 200,
  });

  const raw = resp.choices[0]?.message?.content?.trim() || "";
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error("No JSON found");
  } catch {
    return { location: "", event: text, category: "不知道在干什么" };
  }
}

/** 根据全天消息生成48个时间槽的网格数据（纯程序逻辑，不依赖 AI） */
export function generateGrid(
  date: string,
  messages: ScheduleMessage[]
): DailyGrid {
  interface Segment {
    start: number;
    end: number;
    activity: string;
    location: string;
    category: string;
  }

  const segments: Segment[] = [];

  // 00:00 到第一条消息之前：睡觉 @ 家
  const firstStart = messages.length > 0 ? toMinutes(messages[0].timestamp) : 1440;
  if (firstStart > 0) {
    segments.push({
      start: 0,
      end: firstStart,
      activity: "睡觉",
      location: "家",
      category: "主线",
    });
  }

  // 每条消息到下一条消息之间
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    const start = toMinutes(m.timestamp);
    const end = i + 1 < messages.length ? toMinutes(messages[i + 1].timestamp) : 1440;

    segments.push({
      start,
      end,
      activity: m.event || "",
      location: m.location || "",
      category: m.category || "不知道在干什么",
    });
  }

  // 生成48个槽
  const slots: DailyGrid["slots"] = [];
  const summary: Record<string, number> = Object.fromEntries(
    CATEGORIES.map((c) => [c, 0])
  );

  for (let slotIndex = 0; slotIndex < 48; slotIndex++) {
    const slotStart = slotIndex * 30;
    const slotEnd = slotStart + 30;

    const durationMap = new Map<
      string,
      { duration: number; location: string; category: string }
    >();

    for (const seg of segments) {
      const overlapStart = Math.max(seg.start, slotStart);
      const overlapEnd = Math.min(seg.end, slotEnd);
      if (overlapEnd <= overlapStart) continue;

      const duration = overlapEnd - overlapStart;
      const existing = durationMap.get(seg.activity);
      if (existing) {
        existing.duration += duration;
      } else {
        durationMap.set(seg.activity, {
          duration,
          location: seg.location,
          category: seg.category,
        });
      }
    }

    let bestActivity = "睡觉";
    let bestDuration = -1;
    let bestLocation = "家";
    let bestCategory = "主线";

    for (const [activity, info] of durationMap.entries()) {
      if (info.duration > bestDuration) {
        bestDuration = info.duration;
        bestActivity = activity;
        bestLocation = info.location;
        bestCategory = info.category;
      }
    }

    const timeLabel = `${formatTime(slotStart)}-${formatTime(slotEnd)}`;

    slots.push({
      time: timeLabel,
      activity: bestActivity,
      location: bestLocation,
      category: bestCategory,
    });

    if (bestCategory in summary) {
      summary[bestCategory] += 0.5;
    }
  }

  return { slots, summary };
}

function toMinutes(timestamp: string): number {
  const h = parseInt(timestamp.slice(11, 13), 10);
  const m = parseInt(timestamp.slice(14, 16), 10);
  const s = parseInt(timestamp.slice(17, 19), 10);
  return h * 60 + m + s / 60;
}

function formatTime(minutes: number): string {
  if (minutes === 1440) return "24:00";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
