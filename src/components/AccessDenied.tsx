"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { Shell } from "@/components/Shell";
import { Button } from "@/components/ui";
import type { AdminRole } from "@/lib/schema";

/**
 * Shown when a signed-in user opens a page their role cannot use. The URL stays
 * where it is, so the menu keeps its context and nothing is silently redirected.
 */
export function AccessDenied({
  role,
  displayName,
  page
}: {
  role: AdminRole;
  displayName?: string;
  page: string;
}) {
  const router = useRouter();

  return (
    <Shell
      title="You do not have permission"
      subtitle={`Your account cannot open ${page}.`}
      role={role}
      displayName={displayName}
    >
      <div className="mx-auto flex max-w-xl flex-col items-center rounded-2xl border border-slate-200 bg-white px-8 py-12 text-center shadow-card">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <p className="mt-4 max-w-md text-sm leading-6 text-slate-600">
          Only a super admin can open {page}. Ask a super admin to change your role if
          you need access to it.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Button onClick={() => router.back()}>Go back</Button>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-school-700 ring-1 ring-inset ring-school-300 transition hover:bg-school-50"
          >
            Go to the generator
          </Link>
        </div>
      </div>
    </Shell>
  );
}
