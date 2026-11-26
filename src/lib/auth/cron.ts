import crypto from "node:crypto";

export function verifyCronSecret(
  req: Request,
  expectedSecret: string | undefined = process.env.CRON_SECRET
): boolean {
  if (!expectedSecret || expectedSecret.length === 0) {
    return false;
  }
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }
  const provided = authHeader.slice("Bearer ".length).trim();
  if (!provided) return false;

  const expectedDigest = crypto
    .createHash("sha256")
    .update(expectedSecret)
    .digest();
  const providedDigest = crypto.createHash("sha256").update(provided).digest();

  return crypto.timingSafeEqual(expectedDigest, providedDigest);
}
