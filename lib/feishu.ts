/**
 * 飞书 API 工具函数
 */

const APP_ID = process.env.FEISHU_APP_ID!;
const APP_SECRET = process.env.FEISHU_APP_SECRET!;

interface TenantToken {
  token: string;
  expiresAt: number;
}

let cachedToken: TenantToken | null = null;

/** 获取 tenant_access_token（带缓存） */
async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }

  const resp = await fetch(
    "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_id: APP_ID,
        app_secret: APP_SECRET,
      }),
    }
  );

  if (!resp.ok) {
    throw new Error(`获取飞书 token 失败: ${resp.status} ${await resp.text()}`);
  }

  const data = await resp.json();
  cachedToken = {
    token: data.tenant_access_token,
    expiresAt: Date.now() + (data.expire || 7200) * 1000,
  };
  return cachedToken.token;
}

/** 给用户发送文本消息 */
export async function sendMessage(openId: string, content: string): Promise<void> {
  const token = await getAccessToken();
  const resp = await fetch(
    "https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        receive_id: openId,
        msg_type: "text",
        content: JSON.stringify({ text: content }),
      }),
    }
  );

  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`飞书发送消息失败: ${resp.status} ${errBody}`);
  }
}

/** 上传图片到飞书，返回 image_key */
export async function uploadImage(imageBuffer: Buffer): Promise<string> {
  const token = await getAccessToken();

  // 飞书上传图片使用 multipart/form-data
  const formData = new FormData();
  formData.append("image_type", "message");
  formData.append("image", new Blob([imageBuffer], { type: "image/png" }), "chart.png");

  const resp = await fetch(
    "https://open.feishu.cn/open-apis/im/v1/images",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    }
  );

  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`飞书上传图片失败: ${resp.status} ${errBody}`);
  }

  const data = await resp.json();
  return data.data.image_key;
}

/** 发送图片消息 */
export async function sendImageMessage(
  openId: string,
  imageKey: string
): Promise<void> {
  const token = await getAccessToken();
  const resp = await fetch(
    "https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        receive_id: openId,
        msg_type: "image",
        content: JSON.stringify({ image_key: imageKey }),
      }),
    }
  );

  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`飞书发送图片失败: ${resp.status} ${errBody}`);
  }
}

/** 给用户发送富文本卡片消息 */
export async function sendCardMessage(
  openId: string,
  title: string,
  content: string
): Promise<void> {
  const token = await getAccessToken();
  const card = {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: "plain_text", content: title },
      template: "blue" as const,
    },
    elements: [
      {
        tag: "markdown",
        content,
      },
    ],
  };

  const resp = await fetch(
    "https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        receive_id: openId,
        msg_type: "interactive",
        content: JSON.stringify(card),
      }),
    }
  );

  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`飞书发送卡片消息失败: ${resp.status} ${errBody}`);
  }
}
