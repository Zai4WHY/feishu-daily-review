/**
 * 飞书事件订阅回调接口
 * POST /api/feishu
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { extractInfo, generateGrid } from "../lib/deepseek";
import { getMessages, appendMessage } from "../lib/storage";
import { sendMessage, uploadImage, sendImageMessage } from "../lib/feishu";
// chart 模块依赖原生绑定，改为动态导入，只在需要时才加载
import type { ScheduleMessage } from "../lib/types";

/** 北京时间日期 YYYY-MM-DD */
function todayCN(): string {
  const now = new Date();
  const cn = new Date(now.getTime() + 8 * 3600_000);
  return cn.toISOString().slice(0, 10);
}

/** 北京时间 ISO 时间戳 */
function isoCN(): string {
  const now = new Date();
  return new Date(now.getTime() + 8 * 3600_000).toISOString();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body;

  // 飞书 URL 验证挑战 —— 必须1秒内响应
  if (body?.type === "url_verification") {
    return res.status(200).json({ challenge: body.challenge });
  }

  // 只处理文字消息接收事件
  if (body?.header?.event_type === "im.message.receive_v1") {
    const event = body.event;
    const message = event?.message;

    if (message?.message_type !== "text") {
      return res.status(200).json({ code: 0 });
    }

    // 解析文本
    let text: string;
    try {
      text = JSON.parse(message.content).text || "";
    } catch {
      text = message.content || "";
    }
    if (!text.trim()) {
      return res.status(200).json({ code: 0 });
    }

    const openId = event.sender?.sender_id?.open_id;
    if (!openId) {
      return res.status(200).json({ code: 0 });
    }

    const date = todayCN();
    const timestamp = isoCN();
    console.log(`收到消息: "${text}" from ${openId}`);

    // 先响应飞书，避免3秒超时
    res.status(200).json({ code: 0 });

    // 异步处理
    handleMessage(text, openId, date, timestamp).catch((e) =>
      console.error("处理消息失败:", e)
    );
    return;
  }

  return res.status(200).json({ code: 0 });
}

/** 根据消息内容路由处理 */
async function handleMessage(
  text: string,
  openId: string,
  date: string,
  timestamp: string
): Promise<void> {
  const trimmed = text.trim();

  // 命令路由
  if (trimmed === "/数据") {
    await handleShowData(openId, date);
    return;
  }

  if (trimmed === "/预览") {
    await handlePreview(openId, date);
    return;
  }

  // 普通日程消息
  await handleScheduleMessage(text, openId, date, timestamp);
}

/** /数据 —— 返回今天已存储的 JSON 数据 */
async function handleShowData(openId: string, date: string): Promise<void> {
  try {
    const messages = await getMessages(date);
    if (messages.length === 0) {
      await sendMessage(openId, "今天还没有记录任何日程。");
      return;
    }
    const json = JSON.stringify(messages, null, 2);
    await sendMessage(openId, `📋 ${date} 原始数据（${messages.length}条）：\n\`\`\`json\n${json}\n\`\`\``);
  } catch (e) {
    console.error("/数据 失败:", e);
    await sendMessage(openId, "获取数据失败，请稍后再试。");
  }
}

/** /预览 —— 立即生成今天的图表图片 */
async function handlePreview(openId: string, date: string): Promise<void> {
  try {
    const messages = await getMessages(date);
    if (messages.length === 0) {
      await sendMessage(openId, "今天还没有记录任何日程，无法生成预览。");
      return;
    }

    await sendMessage(openId, `正在生成 ${date} 的图表预览...（共${messages.length}条消息）`);

    // 1. AI 生成网格
    const grid = await generateGrid(date, messages);

    // 2. 渲染图片（动态导入，避免全局加载原生模块导致崩溃）
    const { renderChart } = await import("../lib/chart");
    const imageBuffer = await renderChart(date, grid);

    // 3. 上传到飞书
    const imageKey = await uploadImage(imageBuffer);

    // 4. 发送图片
    await sendImageMessage(openId, imageKey);

    console.log(`预览已发送: ${date}`);
  } catch (e: any) {
    console.error("/预览 失败:", e);
    await sendMessage(openId, `生成预览失败: ${e.message}`);
  }
}

/** 处理普通日程消息 */
async function handleScheduleMessage(
  text: string,
  openId: string,
  date: string,
  timestamp: string
): Promise<void> {
  // 回复确认
  try {
    await sendMessage(openId, "收到！已记录日程。");
  } catch (e) {
    console.error("回复确认失败:", e);
  }

  // AI 提取信息
  let location = "";
  let event = "";
  let category = "不知道在干什么";

  try {
    const info = await extractInfo(text);
    location = info.location;
    event = info.event;
    category = info.category;
    console.log(`AI 提取: 地点="${location}" 事件="${event}" 分类="${category}"`);
  } catch (e) {
    console.error("AI 提取失败:", e);
  }

  // 存储
  const msg: ScheduleMessage = { timestamp, text, location, event, category };
  try {
    await appendMessage(date, msg);
    console.log("已存储:", msg);
  } catch (e) {
    console.error("存储失败:", e);
  }
}
