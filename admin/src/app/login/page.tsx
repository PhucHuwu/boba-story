import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="card w-full max-w-sm">
        <h1 className="text-xl font-bold">Boba Story · Quản trị</h1>
        <p className="mb-4 text-sm text-cocoa">Đăng nhập để xem góp ý và thống kê.</p>
        <LoginForm />
      </div>
    </main>
  );
}
