import type { FastifyReply } from "fastify";
import { env } from "../config/env.js";

const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export function setSessionCookie(reply: FastifyReply, token: string) {
  reply.setCookie(env.COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(reply: FastifyReply) {
  reply.clearCookie(env.COOKIE_NAME, { path: "/" });
}
