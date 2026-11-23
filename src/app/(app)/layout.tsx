import { requireUserOrRedirect } from "@/lib/auth";

/**
 * Layout guard for every signed-in page (everything except /login and the API).
 * It runs before the page and sends a visitor with no valid session to /login.
 *
 * It is a safety net, not the only check: each page still calls
 * `requireUser()` itself, and the super-admin pages render a permission screen
 * for a plain admin instead of redirecting. Role and account status always come
 * from the database — never from the cookie.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUserOrRedirect();
  return <>{children}</>;
}
