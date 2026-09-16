"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LogIn } from "lucide-react";
import { SigilLockup } from "@/components/brand/SigilLogo";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <SigilLockup size="lg" showTagline />
        </div>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}

function LoginForm() {
  const params = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        setError(body?.error?.message ?? "Could not sign in.");
        setSubmitting(false);
        return;
      }
      // Full navigation so the new cookie is sent with every following request.
      window.location.assign(safeNext(params.get("next")));
    } catch {
      setError("Could not reach the server.");
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-xl border border-line bg-surface p-6"
    >
      <div>
        <h1 className="text-[22px] leading-tight text-ink">Sign in</h1>
        <p className="mt-1 text-[12px] text-muted">This studio is private.</p>
      </div>
      <Field label="Username">
        <Input
          autoComplete="username"
          autoFocus
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </Field>
      <Field label="Password" error={error ?? undefined}>
        <Input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      <Button
        type="submit"
        variant="accent"
        size="lg"
        className="w-full"
        loading={submitting}
        icon={<LogIn size={15} />}
      >
        Sign in
      </Button>
    </form>
  );
}

/** Only same-origin paths — never let `?next=` redirect off-site. */
function safeNext(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return "/";
  }
  return next;
}
