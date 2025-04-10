import { useContext } from "react";
import { OAuthContext } from "@/context/oauth-context";

export function useOAuth() {
  return useContext(OAuthContext);
}
