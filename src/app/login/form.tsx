"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/client";
import { Field, Spinner } from "@/components/ui";

export function LoginForm({ setup }: { setup: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(setup ? "/api/auth/setup" : "/api/auth/login", { body: form });
      router.replace(setup ? "/accounts?welcome=1" : params.get("next") || "/");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="panel p-6 space-y-4">
      <div>
        <h2 className="font-bold">{setup ? "Create your owner account" : "Sign in"}</h2>
        {setup && <p className="text-xs muted mt-1">First run: this account will own the dashboard.</p>}
      </div>
      {setup && (
        <Field label="Your name" hint="Used to sign AI-written emails">
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
      )}
      <Field label="Email">
        <input className="input" type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </Field>
      <Field label="Password" hint={setup ? "At least 8 characters" : undefined}>
        <input className="input" type="password" required minLength={setup ? 8 : 1} autoComplete={setup ? "new-password" : "current-password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
      </Field>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="btn btn-primary w-full" disabled={busy}>
        {busy && <Spinner />} {setup ? "Create account" : "Sign in"}
      </button>
    </form>
  );
}
