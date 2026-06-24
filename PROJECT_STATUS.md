# 飞书日程复盘机器人 —— 项目状态

## 项目简介

一个飞书自建应用机器人，通过对话方式记录日程，AI 自动生成每日时间复盘图表。

## 用户交互流程

```
用户在飞书跟机器人聊天
     │
     ▼
发消息："我到教学楼学习数学了"
     │  AI 提取：地点=教学楼，事件=自习，分类=上课/科研
     │  存入 Vercel KV
     ▼
机器人回复："收到！已记录日程。"
     │
     ▼
发 /数据 → 机器人返回今日所有记录（JSON）
发 /预览 → 机器人返回今日时间分配图表（PNG图片）
     │
     ▼
每天零点 → 自动推送昨日日程复盘图表
```

## 技术架构

| 层 | 技术 |
|----|------|
| 平台 | 飞书自建应用（机器人单聊） |
| 部署 | Vercel Serverless（新加坡 sin1） |
| 后端 | TypeScript (CommonJS 编译) |
| AI | DeepSeek API |
| 存储 | Vercel KV（Redis 协议） |
| 图表 | @resvg/resvg-wasm（SVG → PNG） |
| 定时 | Vercel Cron（每天 UTC 16:00 = 北京时间 00:00） |

## 代码结构

```
feishu-bot/
├── vercel.json            # 部署到 sin1，cron 零点触发
├── package.json           # openai, @vercel/kv, @resvg/resvg-wasm
├── tsconfig.json          # CommonJS 模块系统
├── .env.example           # 需要的环境变量
├── SETUP.md               # 部署指南
├── api/
│   ├── feishu.ts          # 飞书 webhook 回调 + 命令路由
│   ├── cron.ts            # 零点生成复盘图表
│   └── health.ts          # 保活端点
└── lib/
    ├── types.ts           # 数据类型 + 6大分类
    ├── feishu.ts          # 飞书 API（发消息/上传图片）
    ├── deepseek.ts        # DeepSeek AI（提取事件/生成网格）
    ├── chart.ts           # SVG 生成 + resvg 渲染 PNG
    └── storage.ts         # Vercel KV 存储
```

## 当前进度

- ✅ 飞书开放平台应用已创建
- ✅ 全部代码已写完推送到 GitHub
- ✅ Vercel 部署成功（浏览器访问正常）
- ❌ **飞书 URL 验证连通性测试不通（3秒超时）**

## 最大阻碍：飞书 ⇔ Vercel 网络不通

### 现象
- 浏览器能正常访问 `https://feishu-daily-review.vercel.app/api/feishu`，返回 405（证明函数活着）
- 飞书事件订阅页面填写回调 URL 后点保存，3秒超时
- Vercel 的 Function Logs 里**没有任何请求记录**（说明飞书的请求根本没到达 Vercel）

### 已尝试
1. ✅ 代码侧 URL 验证逻辑正确（检查 `type === "url_verification"`，返回 `challenge`）
2. ✅ 修复了 ESM/CommonJS 模块编译问题
3. ✅ 切换到新加坡区域部署（sin1）
4. ❌ 国内域名方案被否决（不想花钱 + 后续可能还有坑）

### 可能的根因
1. **飞书国内版服务器在中国大陆**，`vercel.app` 域名被 DNS 污染/阻断
2. **Vercel 函数冷启动**（第一次请求 1-2 秒唤醒 + 飞书 3 秒超时）
3. 两者叠加

## 需要讨论的方向

1. **不用 Vercel，换国内可直连的部署平台**（阿里云函数计算、腾讯云 SCF）
2. **飞书长连接模式**（需要常驻进程，不能用 Serverless）
3. **Telegram Bot + 翻墙**（国内用户需翻墙，体验打折）
4. **买域名 + 绑定 Vercel**（最简单但花钱，约 10 元/年）
5. **Cloudflare Workers**（workers.dev 域名国内是否有同样问题不明）
6. 其他同学的奇技淫巧
