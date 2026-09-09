import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { auth } from "@/lib/auth";
import { isDevelopment } from "@/lib/env";
import { Sidebar, MobileNav } from "@/components/app/nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const uid = session?.user?.id as string | undefined;
  if (!uid) redirect("/login");
  const user = await db.user.findUnique({
    where: { id: uid },
    select: { name: true, email: true, role: true, emailVerified: true },
  });
  if (!user) redirect("/login");
  return (
    <div className="flex min-h-dvh">
      <Sidebar
        user={{
          ...user,
          role: user.role === "ADMIN" ? "ADMIN" : "USER",
          emailVerified: Boolean(user.emailVerified),
        }}
        isDev={isDevelopment()}
      />
      <main id="main" className="min-w-0 flex-1 pb-20 lg:pb-0">
        {children}
      </main>
      <MobileNav />
    </div>
  );
}
