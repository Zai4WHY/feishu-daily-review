/** 一条日程消息 */
export interface ScheduleMessage {
  /** ISO 时间戳 */
  timestamp: string;
  /** AI 提取的地点 */
  location: string;
  /** AI 提取的事件 */
  event: string;
  /** AI 分类 */
  category: string;
}

/** 一个30分钟时间槽 */
export interface TimeSlot {
  /** 时间段 如 "00:00-00:30" */
  time: string;
  /** 活动描述 */
  activity: string;
  /** 地点 */
  location: string;
  /** 分类 */
  category: string;
}

/** AI 返回的完整一天时间网格 */
export interface DailyGrid {
  /** 48个时间槽 */
  slots: TimeSlot[];
  /** 分类汇总，单位小时 */
  summary: Record<string, number>;
}

/** 事件分类 */
export const CATEGORIES = [
  "上课/科研",
  "实习/找工作",
  "劳动",
  "主线",
  "其它非常不想做但是被迫做的事",
  "不知道在干什么",
] as const;

/** 分类对应颜色（浅底色） */
export const CATEGORY_COLORS: Record<string, string> = {
  "上课/科研": "#BBDEFB",
  "实习/找工作": "#C8E6C9",
  "劳动": "#FFE0B2",
  "主线": "#E1BEE7",
  "其它非常不想做但是被迫做的事": "#FFCDD2",
  "不知道在干什么": "#EEEEEE",
};
