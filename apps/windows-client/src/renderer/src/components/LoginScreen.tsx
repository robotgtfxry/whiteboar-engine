import { useState } from "react";

import { api, type User } from "@whiteboard/api-client";

import { getApiUrl } from "../lib/settings";

export function LoginScreen({ onLogin }: { onLogin: (u: User) => void }) {
  const [email, setEmail] = useState("admin@local");
  const [password, setPassword] = useState("admin");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
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
    <div className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <span className="login-logo">◇</span>
          <div>
            <h1>Whiteboard Engine</h1>
            <div className="muted">Klient tablicy dla Windows</div>
          </div>
        </div>

        <label className="field">
          <span>Email</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        </label>
        <label className="field">
          <span>Hasło</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>

        <button className="primary block" type="submit" disabled={busy}>
          {busy ? "Logowanie…" : "Zaloguj"}
        </button>

        {error && <div className="error">{error}</div>}

        <div className="muted small">
          Domyślne konto: <code>admin@local</code> / <code>admin</code>
          <br />
          Serwer API: <code>{getApiUrl()}</code>
        </div>
      </form>
    </div>
  );
}
