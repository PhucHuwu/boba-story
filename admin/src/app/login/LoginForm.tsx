"use client";

import { useActionState } from "react";
import { login } from "../actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <div>
        <label className="label" htmlFor="username">
          Tên đăng nhập
        </label>
        <input id="username" name="username" className="input" autoComplete="username" defaultValue={state?.username} key={state?.username} required />
      </div>
      <div>
        <label className="label" htmlFor="password">
          Mật khẩu
        </label>
        <input id="password" name="password" type="password" className="input" autoComplete="current-password" required />
      </div>
      {state?.error && (
        <p role="alert" className="rounded-lg bg-[#fdf0ee] px-3 py-2 text-sm text-berry">
          {state.error}
        </p>
      )}
      <button className="btn" disabled={pending}>
        {pending ? "Đang đăng nhập..." : "Đăng nhập"}
      </button>
    </form>
  );
}
