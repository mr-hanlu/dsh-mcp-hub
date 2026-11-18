// 结构化错误：插件对外只暴露已知 code 的文案，未知异常一律收敛为通用提示并记日志。
// 浏览器与 Host 共用，因此不依赖 Node 内置模块。
const STATUS = {
  REQUEST_INVALID: 400,
  BODY_TOO_LARGE: 413,
  FIELD_UNSUPPORTED: 400,
  UNSUPPORTED_ACTION: 400,
  CONFIG_INVALID: 422,
  HIDDEN_VALUE_CHANGED: 422,
  WRITE_REJECTED: 422,
  NAME_TAKEN: 409,
  NAME_CLEANING: 409,
  REVISION_CONFLICT: 409,
  NOT_WRITABLE: 403,
  INHERITED_ROW: 403,
  CANDIDATE_STALE: 410,
  ROW_NOT_FOUND: 404,
  SERVICE_CLOSED: 503,
  SERVICE_UNAVAILABLE: 503,
  CATALOG_UNAVAILABLE: 502,
  CATALOG_INVALID: 502,
};

export class HubError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'HubError';
    this.code = code;
    this.status = STATUS[code] ?? 500;
  }
}

export function fail(code, message) {
  throw new HubError(code, message);
}

export const isHubError = error => error instanceof HubError;