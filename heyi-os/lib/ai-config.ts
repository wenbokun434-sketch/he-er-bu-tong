// Public service identity only. Credentials stay in server environment variables.
export const AI_PROVIDER = "ACCTOKEN（DeepSeek）";
export const AI_MODEL = "deepseek-v4.1-flash";
export const AI_BASE_URL = "https://www.acctoken.com/v1";
export const AI_CONSENT_VERSION = "acctoken-deepseek-v1";

export function assistantEndpoint(baseUrl = AI_BASE_URL) {
  const url = new URL(baseUrl);
  if (url.origin !== "https://www.acctoken.com" || url.pathname.replace(/\/$/, "") !== "/v1" || url.username || url.password || url.search || url.hash) {
    throw new Error("AI 接口地址与已告知的服务商不一致，请项目所有者检查配置。");
  }
  return `${url.origin}/v1/responses`;
}
