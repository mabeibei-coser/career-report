/** 大陆手机号校验（11 位，1[3-9] 开头）。仅做格式校验，不查号段归属。 */
export function isValidCnMobile(s: string): boolean {
  return /^1[3-9]\d{9}$/.test(s);
}
