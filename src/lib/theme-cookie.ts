export type SiteTheme = "light" | "dark" | "system";

/** SSR-safe: initial theme for the html class comes from the cookie. */
export function readThemeCookie(value: string | undefined | null): SiteTheme {
  return value === "light" || value === "dark" ? value : "system";
}
