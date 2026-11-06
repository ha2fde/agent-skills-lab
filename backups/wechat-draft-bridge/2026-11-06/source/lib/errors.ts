export class UserFacingError extends Error {}
export function safeError(error: unknown): string {
  return error instanceof UserFacingError ? error.message : "服务暂时未能完成请求，请稍后重试；如果写入结果未知，请先查询草稿箱。";
}
