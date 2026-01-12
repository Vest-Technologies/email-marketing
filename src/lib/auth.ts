import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "your-secret-key-change-in-production"
);

const TOKEN_EXPIRY = "7d";
const COOKIE_NAME = "auth_token";

interface AuthPayload extends JWTPayload {
  email: string;
}

function getCredentials(): { emails: string[]; passwords: string[] } {
  const emailsJson = process.env.AUTH_EMAILS || "[]";
  const passwordsJson = process.env.AUTH_PASSWORDS || "[]";

  try {
    const emails = JSON.parse(emailsJson) as string[];
    const passwords = JSON.parse(passwordsJson) as string[];
    return { emails, passwords };
  } catch {
    console.error("Failed to parse AUTH_EMAILS or AUTH_PASSWORDS from env");
    return { emails: [], passwords: [] };
  }
}

export function validateCredentials(
  email: string,
  password: string
): boolean {
  const { emails, passwords } = getCredentials();

  const emailIndex = emails.findIndex(
    (e) => e.toLowerCase() === email.toLowerCase()
  );

  if (emailIndex === -1) {
    return false;
  }

  return passwords[emailIndex] === password;
}

export async function createToken(email: string): Promise<string> {
  const token = await new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(JWT_SECRET);

  return token;
}

export async function verifyToken(token: string): Promise<AuthPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as AuthPayload;
  } catch {
    return null;
  }
}

export async function getAuthFromCookies(): Promise<AuthPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  return verifyToken(token);
}

export async function setAuthCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });
}

export async function clearAuthCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export { COOKIE_NAME };
