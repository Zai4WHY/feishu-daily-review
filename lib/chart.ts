/**
 * 图表渲染：将 DailyGrid 数据构建为 SVG 字符串
 * SVG 直接嵌入前端 DOM，无需 PNG 转换
 */

import type { DailyGrid } from "./types.js";
import { CATEGORY_COLORS, CATEGORIES } from "./types.js";

const MAX_WIDTH = 860;
const MIN_WIDTH = 500;
const PADDING = 16;
const TITLE_H = 56;
const SUMMARY_TITLE_H = 30;
const SUMMARY_ITEM_H = 28;
const BORDER_COLOR = "#e0e0e0";
const CELL_FONT_SIZE = 12;
const CELL_PADDING = 16; // 8px left + 8px right
const MIN_COL_WIDTH = 4 * CELL_FONT_SIZE + CELL_PADDING; // 64px ≈ 4 CJK chars

/** 构建可嵌入 DOM 的 SVG 字符串 */
export function buildSvg(date: string, grid: DailyGrid): string {
  const colTime = 120;

  // 动态计算活动和地点列宽
  let maxActW = 0, maxLocW = 0;
  for (const slot of grid.slots) {
    maxActW = Math.max(maxActW, measureTextWidth(slot.activity, CELL_FONT_SIZE));
    maxLocW = Math.max(maxLocW, measureTextWidth(slot.location, CELL_FONT_SIZE));
  }
  const colAct = Math.max(MIN_COL_WIDTH, Math.ceil(maxActW) + CELL_PADDING);
  const colLoc = Math.max(MIN_COL_WIDTH, Math.ceil(maxLocW) + CELL_PADDING);
  const W = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, PADDING * 2 + colTime + colAct + colLoc));

  const rowH = 25;
  const headerH = 34;
  const tableBodyH = grid.slots.length * rowH;
  const summaryH = SUMMARY_TITLE_H + CATEGORIES.length * SUMMARY_ITEM_H + 20;
  const svgH = PADDING + TITLE_H + 8 + headerH + tableBodyH + 20 + summaryH + PADDING;

  let html = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${svgH}" viewBox="0 0 ${W} ${svgH}">
  <rect width="100%" height="100%" fill="#ffffff"/>
  <style>
    text { font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; }
    .title { font-size: 20px; font-weight: 700; fill: #212121; }
    .th-text { font-size: 13px; font-weight: 700; fill: #ffffff; }
    .cell-text { font-size: 12px; fill: #333333; }
    .sum-label { font-size: 12px; font-weight: 600; fill: #333333; }
    .sum-value { font-size: 12px; font-weight: 700; fill: #555555; }
  </style>

  <!-- 标题 -->
  <rect x="${PADDING}" y="${PADDING}" width="${W - PADDING * 2}" height="${TITLE_H}" rx="6" fill="#f5f7fa"/>
  <text x="${W / 2}" y="${PADDING + TITLE_H / 2 + 7}" text-anchor="middle" class="title">${date} 日程复盘</text>

  <!-- 表头 -->
  <rect x="${PADDING}" y="${PADDING + TITLE_H + 8}" width="${W - PADDING * 2}" height="${headerH}" rx="4" fill="#616161"/>
  <text x="${PADDING + colTime / 2}" y="${PADDING + TITLE_H + 8 + headerH / 2 + 5}" text-anchor="middle" class="th-text">时间段</text>
  <text x="${PADDING + colTime + colAct / 2}" y="${PADDING + TITLE_H + 8 + headerH / 2 + 5}" text-anchor="middle" class="th-text">活动</text>
  <text x="${PADDING + colTime + colAct + colLoc / 2}" y="${PADDING + TITLE_H + 8 + headerH / 2 + 5}" text-anchor="middle" class="th-text">地点</text>
`;

  // 数据行
  const tableTop = PADDING + TITLE_H + 8 + headerH;
  for (let i = 0; i < grid.slots.length; i++) {
    const slot = grid.slots[i];
    const y = tableTop + i * rowH;
    const bg = CATEGORY_COLORS[slot.category] || "#f5f5f5";
    const isOdd = i % 2 === 1;

    html += `
  <rect x="${PADDING}" y="${y}" width="${W - PADDING * 2}" height="${rowH}" fill="${bg}" fill-opacity="${isOdd ? "0.7" : "0.5"}"/>
  <!-- 竖线分隔 -->
  <line x1="${PADDING + colTime}" y1="${y}" x2="${PADDING + colTime}" y2="${y + rowH}" stroke="${BORDER_COLOR}" stroke-width="0.5"/>
  <line x1="${PADDING + colTime + colAct}" y1="${y}" x2="${PADDING + colTime + colAct}" y2="${y + rowH}" stroke="${BORDER_COLOR}" stroke-width="0.5"/>
  <!-- 横线 -->
  <line x1="${PADDING}" y1="${y + rowH}" x2="${W - PADDING}" y2="${y + rowH}" stroke="${BORDER_COLOR}" stroke-width="0.5"/>

  <text x="${PADDING + colTime / 2}" y="${y + rowH / 2 + 4}" text-anchor="middle" class="cell-text">${esc(slot.time)}</text>
  <text x="${PADDING + colTime + 8}" y="${y + rowH / 2 + 4}" text-anchor="start" class="cell-text">${esc(slot.activity)}</text>
  <text x="${PADDING + colTime + colAct + 8}" y="${y + rowH / 2 + 4}" text-anchor="start" class="cell-text">${esc(slot.location)}</text>
`;
  }

  // 外边框
  const tableEnd = tableTop + tableBodyH;
  html += `
  <rect x="${PADDING}" y="${tableTop}" width="${W - PADDING * 2}" height="${tableBodyH}" fill="none" stroke="#bdbdbd" stroke-width="1" rx="0"/>
`;

  // 汇总区域
  const sumTop = tableEnd + 20;
  html += `
  <rect x="${PADDING}" y="${sumTop}" width="${W - PADDING * 2}" height="${summaryH}" rx="6" fill="#fafafa" stroke="#e0e0e0" stroke-width="1"/>
  <text x="${PADDING + 16}" y="${sumTop + SUMMARY_TITLE_H / 2 + 5}" class="sum-label" style="font-size:14px;">分类汇总</text>
`;

  for (let j = 0; j < CATEGORIES.length; j++) {
    const cat = CATEGORIES[j];
    const hours = grid.summary[cat] || 0;
    const pct = Math.min(100, Math.round((hours / 24) * 100));
    const bg = CATEGORY_COLORS[cat];
    const itemY = sumTop + SUMMARY_TITLE_H + 4 + j * SUMMARY_ITEM_H;
    const barW = Math.max(2, Math.round((W - PADDING * 2 - 280) * (pct / 100)));

    html += `
  <!-- 标签 -->
  <rect x="${PADDING + 16}" y="${itemY}" width="230" height="20" rx="4" fill="${bg}"/>
  <text x="${PADDING + 16 + 115}" y="${itemY + 14}" text-anchor="middle" class="sum-label">${cat}</text>
  <!-- 进度条背景 -->
  <rect x="${PADDING + 16 + 238}" y="${itemY + 2}" width="${W - PADDING * 2 - 310}" height="16" rx="8" fill="#eeeeee"/>
  <!-- 进度条 -->
  <rect x="${PADDING + 16 + 238}" y="${itemY + 2}" width="${barW}" height="16" rx="8" fill="${bg}"/>
  <!-- 数值 -->
  <text x="${W - PADDING - 12}" y="${itemY + 14}" text-anchor="end" class="sum-value">${hours.toFixed(1)}h</text>
`;
  }

  html += `</svg>`;
  return html;
}

/** 估算文本渲染宽度（CJK ≈ fontSize，ASCII ≈ fontSize * 0.55） */
function measureTextWidth(text: string, fontSize: number): number {
  let w = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    // CJK ranges: Unified Ideographs, Ext-A, Symbols, Fullwidth Forms, Ext-B+
    if ((code >= 0x4e00 && code <= 0x9fff) ||
        (code >= 0x3400 && code <= 0x4dbf) ||
        (code >= 0x3000 && code <= 0x303f) ||
        (code >= 0xff00 && code <= 0xffef) ||
        code >= 0x20000) {
      w += fontSize;
    } else {
      w += fontSize * 0.55;
    }
  }
  return w;
}

/** 转义 SVG 文本中的特殊字符 */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
