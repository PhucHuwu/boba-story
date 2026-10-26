import { requireAdmin } from "@/lib/auth";
import { logout } from "../actions";
import { Nav } from "./Nav";

export default async function DashLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();
  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-4 p-3 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-bold">Boba Story · Quản trị</h1>
        <form action={logout} className="flex items-center gap-2 text-sm text-cocoa">
          <span>{session.u}</span>
          <button className="btn-ghost">Đăng xuất</button>
        </form>
      </header>
      <Nav />
      <main className="flex flex-col gap-4">{children}</main>
    </div>
  );
}
