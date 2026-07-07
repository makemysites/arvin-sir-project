import { createHmac } from "crypto";

// The OTP itself is never stored — only this keyed hash of it.
export function hashOtp(code: string, email: string) {
  return createHmac("sha256", process.env.AUTH_SECRET!)
    .update(`${email}:${code}`)
    .digest("hex");
}
