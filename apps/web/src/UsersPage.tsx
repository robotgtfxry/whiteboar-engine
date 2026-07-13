import { useEffect, useState } from "react";

import { api, type User } from "./api";

export function UsersPage({ isAdmin }: { isAdmin: boolean }) {
  const [users, setUsers] = useState<User[]>([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setUsers(await api.listUsers());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    try {
      await api.createUser({ email, display_name: name, password });
      setEmail("");
      setName("");
      setPassword("");
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function remove(id: string) {
    try {
      await api.deleteUser(id);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <>
      {isAdmin && (
        <div className="panel">
          <div className="row">
            <input placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input
              placeholder="nazwa wyświetlana"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              type="password"
              placeholder="hasło (min. 6)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button onClick={create} disabled={!email || !name || password.length < 6}>
              Dodaj użytkownika
            </button>
          </div>
          {error && <div className="error">{error}</div>}
        </div>
      )}
      {!isAdmin && error && (
        <div className="panel">
          <div className="error">{error}</div>
        </div>
      )}

      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>Nazwa</th>
              <th>Email</th>
              <th>Rola</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.display_name}</td>
                <td>{u.email}</td>
                <td>{u.is_admin ? <span className="badge">admin</span> : "—"}</td>
                <td>
                  {!u.is_admin && (
                    <button className="danger" onClick={() => remove(u.id)}>
                      Usuń
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
