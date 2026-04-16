/**
 * Captcha verification API
 * Ported from Vue verifition/api/index.js
 */

const BASE_API = import.meta.env.VITE_BASE_URL ?? '';

interface ApiResponse<T> {
  code?: number;
  repCode?: string;
  repMsg?: string;
  message?: string;
  data?: T;
  repData?: T;
}

interface CaptchaGetResponse {
  originalImageBase64: string;
  jigsawImageBase64?: string;
  token: string;
  secretKey: string;
  wordList?: string[];
}

async function request<T>(
  url: string,
  data: Record<string, unknown>,
): Promise<ApiResponse<T>> {
  const response = await fetch(`${BASE_API}${url}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify(data),
  });
  return response.json() as Promise<ApiResponse<T>>;
}

/**
 * Get captcha image and token
 */
export async function reqGet(
  data: { captchaType: string },
): Promise<ApiResponse<CaptchaGetResponse>> {
  return request('/api/identification/captcha/get', data);
}

/**
 * Verify captcha (slide or click)
 */
export async function reqCheck(
  data: {
    captchaType: string;
    pointJson: string;
    token: string;
  },
): Promise<ApiResponse<unknown>> {
  return request('/api/identification/captcha/check', data);
}
