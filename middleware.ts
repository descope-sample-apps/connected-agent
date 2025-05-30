// src/middleware.ts
import { authMiddleware } from "@descope/nextjs-sdk/server";

export default authMiddleware({
  projectId: process.env.NEXT_PUBLIC_DESCOPE_PROJECT_ID,
  redirectUrl: "/login",
  publicRoutes: [
    "/",
    "/overview",
    "/login",
    "/oauth-redirect",
    "/connections",
    "/api/oauth/callback",
  ],
  logLevel: "info",
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};
