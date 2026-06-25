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

/** 根据全天消息生成48个时间槽的网格数据 */
export async function generateGrid(
  date: string,
  messages: ScheduleMessage[]
): Promise<DailyGrid> {
  const messageList = messages
    .map(
      (m, i) =>
        `${i + 1}. [${m.timestamp.slice(11, 16)}] 文本:"${m.text}" 地点:${m.location || "未知"} 事件:${m.event || m.text} 分类:${m.category || "未分类"}`
    )
    .join("\n");

  const categories = CATEGORIES.join("、");

  const prompt = `你是一个日程管理助手。用户在 ${date} 记录了以下活动消息。

消息按时间顺序排列。每条消息的活动一直持续到下一条消息开始。

对于每个30分钟槽，根据消息时间点计算槽内各活动的持续时长，取时长最长的活动填满整个槽。

例如：上条消息12:00"午睡"，13:03消息"去小卖部"，13:13消息"在教室楼开始自习"。
13:00-13:30槽内：午睡3分钟（13:00-13:03）、买东西10分钟（13:03-13:13）、自习17分钟（13:13-13:30）。自习17分钟最长，该槽填"自习"。

如果没有地点，沿用上一条的地点。如果第一条消息没有地点，假定从"家"开始。

00:00到第一条消息之间的时间填"睡觉"。
最后一条消息之后到24:00的时间，假定该活动持续。

消息列表：
${messageList}

事件分类只有：${categories}
"主线"包含：睡觉、吃饭、娱乐（玩手机、和狗玩、看视频等）
"劳动"包含：通勤（地铁、公交、走路等）、家务、遛狗等体力性质的事

请生成48个时间槽的数据，每30分钟一个。
输出必须严格是以下 JSON 格式，不要任何其他内容：

{
  "slots": [
    {"time": "00:00-00:30", "activity": "活动", "location": "地点", "category": "分类"},
    {"time": "00:30-01:00", "activity": "活动", "location": "地点", "category": "分类"},
    ...共48个，覆盖00:00到24:00
  ],
  "summary": {
    "上课/科研": 0,
    "实习/找工作": 0,
    "劳动": 0,
    "主线": 0,
    "其它非常不想做但是被迫做的事": 0,
    "不知道在干什么": 0
  }
}

summary 中每个分类的值是小时数（0.5的倍数），即该分类出现了几个30分钟槽乘以0.5。
相邻的相同活动和地点的槽请合并为相同描述。
24:00是最后一个槽的结束时间，最后一个槽是"23:30-24:00"。`;

  const resp = await client.chat.completions.create({
    model: "deepseek-chat",
    messages: [{ role: "user", content: prompt }],
    temperature: 0,
    max_tokens: 4000,
  });

  const raw = resp.choices[0]?.message?.content?.trim() || "";
  console.log("AI 网格原始输出前200字:", raw.slice(0, 200));

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in AI output");
    const grid = JSON.parse(jsonMatch[0]) as DailyGrid;
    // 基本校验
    if (!grid.slots || grid.slots.length < 48) {
      throw new Error(`slots 数量不足: ${grid.slots?.length}`);
    }
    return grid;
  } catch (e) {
    console.error("解析 AI 网格输出失败:", e);
    // 降级：返回空网格
    return buildFallbackGrid(messages);
  }
}

/** 降级方案：纯靠代码逻辑构建网格，不依赖 AI */
function buildFallbackGrid(messages: ScheduleMessage[]): DailyGrid {
  const slots: DailyGrid["slots"] = [];
  const summary: Record<string, number> = {};
  for (const c of CATEGORIES) summary[c] = 0;

  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}-${m === 0 ? String(h).padStart(2, "0") : String(h).padStart(2, "0")}:${m === 0 ? "30" : String(h + 1 === 24 ? "00" : String(h + 1).padStart(2, "0")).padStart(2, "0")}`;
      // 简化：找最近的消息作为当前活动
      const minutes = h * 60 + m;
      let matchedMsg: ScheduleMessage | undefined;
      for (let i = messages.length - 1; i >= 0; i--) {
        const msgMinutes = parseTimeToMinutes(messages[i].timestamp);
        if (msgMinutes !== null && msgMinutes <= minutes) {
          matchedMsg = messages[i];
          break;
        }
      }
      const cat = matchedMsg?.category || "不知道在干什么";
      slots.push({
        time: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}-${m === 0 ? String(h).padStart(2, "0") + ":30" : String((h + 1) % 24).padStart(2, "0") + ":00"}`,
        activity: matchedMsg?.event || matchedMsg?.text || "未知",
        location: matchedMsg?.location || "",
        category: cat,
      });
      summary[cat] = (summary[cat] || 0) + 0.5;
    }
  }
  return { slots, summary };
}

function parseTimeToMinutes(iso: string): number | null {
  try {
    // 北京时间 ISO 字符串
    const match = iso.match(/T(\d{2}):(\d{2})/);
    if (match) {
      return parseInt(match[1]) * 60 + parseInt(match[2]);
    }
    return null;
  } catch {
    return null;
  }
}
