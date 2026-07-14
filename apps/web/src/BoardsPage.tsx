import { useEffect, useState } from "react";

import {
  api,
  type AccessLevel,
  type Board,
  type BoardSummary,
  type BoardVersionSummary,
  deviceName,
  type Permission,
  setDeviceName,
  type User,
} from "@whiteboard/api-client";
import { isUniDoc } from "@whiteboard/core";

import { BoardCanvas } from "./BoardCanvas";

export function BoardsPage({ onOpen }: { onOpen: (id: string) => void }) {
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [selected, setSelected] = useState<Board | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function loadBoards() {
    try {
      setBoards(await api.listBoards());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    loadBoards();
  }, []);

  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const b = await api.importDevbrd(file);
      setInfo(`Zaimportowano „${b.title}” z ${file.name}.`);
      await loadBoards();
      await open(b.id);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function open(id: string) {
    try {
      setSelected(await api.getBoard(id));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function create() {
    try {
      const b = await api.createBoard({ title: newTitle });
      setNewTitle("");
      await loadBoards();
      await open(b.id);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function remove(id: string) {
    try {
      await api.deleteBoard(id);
      if (selected?.id === id) setSelected(null);
      await loadBoards();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <>
      <div className="panel">
        <div className="row">
          <input
            placeholder="tytuł nowej tablicy"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <button onClick={create} disabled={!newTitle}>
            Utwórz tablicę
          </button>
          <label className="ghost" style={{ padding: "8px 14px", borderRadius: 6, cursor: "pointer" }}>
            Importuj .devbrd
            <input
              type="file"
              accept=".devbrd,application/json"
              style={{ display: "none" }}
              onChange={onImport}
            />
          </label>
        </div>
        {info && <div className="sub" style={{ marginTop: 8 }}>{info}</div>}
        {error && <div className="error">{error}</div>}
      </div>

      <div className="panel">
        {boards.length === 0 && <div className="sub">Brak tablic.</div>}
        {boards.map((b) => (
          <div
            key={b.id}
            className={"list-item" + (selected?.id === b.id ? " selected" : "")}
            onClick={() => open(b.id)}
          >
            <div>
              <div>{b.title}</div>
              <div className="mono">{b.id}</div>
            </div>
            <div className="row">
              <button
                disabled={!b.room_id}
                onClick={(e) => {
                  e.stopPropagation();
                  if (b.room_id) onOpen(b.room_id);
                }}
              >
                Otwórz
              </button>
              <button
                className="danger"
                onClick={(e) => {
                  e.stopPropagation();
                  remove(b.id);
                }}
              >
                Usuń
              </button>
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <BoardDetail
          board={selected}
          onChange={(b) => {
            setSelected(b);
            loadBoards();
          }}
        />
      )}
    </>
  );
}

function BoardDetail({ board, onChange }: { board: Board; onChange: (b: Board) => void }) {
  const [docText, setDocText] = useState(JSON.stringify(board.document, null, 2));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDocText(JSON.stringify(board.document, null, 2));
  }, [board.id, board.updated_at]);

  async function saveDocument() {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(docText);
    } catch {
      setError("Dokument nie jest poprawnym JSON-em");
      return;
    }
    try {
      const updated = await api.updateBoard(board.id, { document: parsed });
      setError(null);
      onChange(updated);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="panel">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <strong>{board.title}</strong>
        <span className="mono">właściciel: {board.owner_id}</span>
      </div>

      {isUniDoc(board.document) && (board.document as { nodes: unknown[] }).nodes.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <p className="sub">Podgląd (render zapisanego modelu — round-trip):</p>
          <BoardCanvas doc={board.document as never} />
        </div>
      )}

      <p className="sub" style={{ marginTop: 12 }}>
        Treść dokumentu (JSONB) — docelowo uniwersalny model z packages/core:
      </p>
      <textarea value={docText} onChange={(e) => setDocText(e.target.value)} />
      <div className="row" style={{ marginTop: 8 }}>
        <button onClick={saveDocument}>Zapisz dokument</button>
        {error && <span className="error">{error}</span>}
      </div>

      <VersionHistory board={board} onRestore={onChange} />
      <PermissionsPanel boardId={board.id} />
    </div>
  );
}

function VersionHistory({ board, onRestore }: { board: Board; onRestore: (b: Board) => void }) {
  const [versions, setVersions] = useState<BoardVersionSummary[]>([]);
  const [dev, setDev] = useState(deviceName());
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setVersions(await api.listVersions(board.id));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board.id, board.updated_at]);

  async function saveVersion() {
    try {
      await api.saveVersion(board.id);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function restore(versionId: string) {
    try {
      onRestore(await api.restoreVersion(board.id, versionId));
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div style={{ marginTop: 20, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <strong>Historia wersji</strong>
        <div className="row">
          <span className="sub" style={{ margin: 0 }}>
            to urządzenie: <span className="mono">{dev}</span>
          </span>
          <button
            className="ghost"
            onClick={() => {
              const n = prompt("Nazwa tego urządzenia (widoczna w historii):", dev);
              if (n && n.trim()) {
                setDeviceName(n);
                setDev(n.trim());
              }
            }}
          >
            Zmień
          </button>
          <button className="ghost" onClick={saveVersion}>
            Zapisz wersję
          </button>
        </div>
      </div>
      {error && <div className="error">{error}</div>}
      <table style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th>Kiedy</th>
            <th>Kto</th>
            <th>Urządzenie</th>
            <th>Obiekty</th>
            <th>Notatka</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {versions.map((v) => (
            <tr key={v.id}>
              <td className="mono">{new Date(v.created_at).toLocaleString()}</td>
              <td>{v.created_by_name ?? "—"}</td>
              <td className="mono">{v.device ?? "—"}</td>
              <td>{v.node_count}</td>
              <td>{v.note ?? "—"}</td>
              <td>
                <button className="ghost" onClick={() => restore(v.id)}>
                  Przywróć
                </button>
              </td>
            </tr>
          ))}
          {versions.length === 0 && (
            <tr>
              <td colSpan={6} className="sub">
                Brak wersji — pojawią się po zapisach tablicy.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function PermissionsPanel({ boardId }: { boardId: string }) {
  const [perms, setPerms] = useState<Permission[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [userId, setUserId] = useState("");
  const [level, setLevel] = useState<AccessLevel>("read");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const [p, u] = await Promise.all([api.listPermissions(boardId), api.listUsers()]);
      setPerms(p);
      setUsers(u);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    load();
  }, [boardId]);

  function nameFor(id: string) {
    return users.find((u) => u.id === id)?.display_name ?? id;
  }

  async function grant() {
    try {
      await api.grantPermission(boardId, { user_id: userId, level });
      setUserId("");
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function revoke(uid: string) {
    try {
      await api.revokePermission(boardId, uid);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div style={{ marginTop: 20, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
      <strong>Dostępy</strong>
      <div className="row" style={{ marginTop: 10 }}>
        <select value={userId} onChange={(e) => setUserId(e.target.value)}>
          <option value="">— wybierz użytkownika —</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.display_name} ({u.email})
            </option>
          ))}
        </select>
        <select value={level} onChange={(e) => setLevel(e.target.value as AccessLevel)}>
          <option value="read">read</option>
          <option value="edit">edit</option>
          <option value="owner">owner</option>
        </select>
        <button onClick={grant} disabled={!userId}>
          Nadaj dostęp
        </button>
      </div>
      {error && <div className="error">{error}</div>}

      <table style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th>Użytkownik</th>
            <th>Poziom</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {perms.map((p) => (
            <tr key={p.id}>
              <td>{nameFor(p.user_id)}</td>
              <td>
                <span className="badge">{p.level}</span>
              </td>
              <td>
                <button className="danger" onClick={() => revoke(p.user_id)}>
                  Odbierz
                </button>
              </td>
            </tr>
          ))}
          {perms.length === 0 && (
            <tr>
              <td colSpan={3} className="sub">
                Brak nadanych dostępów (właściciel i admin mają dostęp automatycznie).
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
