import { useState } from "react";

import { api, type User } from "@whiteboard/api-client";

export function LoginPage({ onLogin }: { onLogin: (u: User) => void }) {
  const [email, setEmail] = useState("admin@local");
  const [password, setPassword] = useState("admin");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.login(email, password);
      onLogin(await api.me());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app" style={{ maxWidth: 360 }}>
      <h1>Whiteboard Engine</h1>
      <div className="sub">Zaloguj się</div>
      <form className="panel" onSubmit={submit}>
        <div style={{ display: "grid", gap: 10 }}>
          <input placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input
            type="password"
            placeholder="hasło"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit" disabled={busy}>
            {busy ? "Logowanie…" : "Zaloguj"}
          </button>
          {error && <div className="error">{error}</div>}
          <div className="sub">Domyślne konto admina: admin@local / admin</div>
        </div>
      </form>
    </div>
  );
}
