import { useEffect, useState } from "react";

import { api, hasToken, type User } from "@whiteboard/api-client";
import { BoardsPage } from "./BoardsPage";
import { BoardView } from "./BoardView";
import { ConvertPage } from "./ConvertPage";
import { LoginPage } from "./LoginPage";
import { UsersPage } from "./UsersPage";

type Tab = "boards" | "users" | "convert";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// URL /<id> → otwarta tablica; / → panel. Trasa jest publiczna, ale wymaga auth (patrz niżej).
function boardIdFromPath(): string | null {
  const seg = window.location.pathname.replace(/^\/+/, "").split("/")[0];
  return UUID_RE.test(seg) ? seg : null;
}

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("boards");
  const [openBoardId, setOpenBoardId] = useState<string | null>(boardIdFromPath());

  useEffect(() => {
    if (!hasToken()) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then(setUser)
      .catch(() => api.logout())
      .finally(() => setLoading(false));
  }, []);

  // Synchronizacja z przyciskami wstecz/naprzód przeglądarki.
  useEffect(() => {
    const onPop = () => setOpenBoardId(boardIdFromPath());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  function openBoard(id: string) {
    if (boardIdFromPath() !== id) window.history.pushState(null, "", `/${id}`);
    setOpenBoardId(id);
  }

  function closeBoard() {
    if (boardIdFromPath()) window.history.pushState(null, "", "/");
    setOpenBoardId(null);
  }

  function logout() {
    api.logout();
    setUser(null);
    closeBoard();
  }

  if (loading) return <div className="app">Ładowanie…</div>;

  // Trasa /<id> jest publiczna (link można komuś wysłać), ale bez zalogowania pokazujemy logowanie.
  // Po zalogowaniu openBoardId z URL-a nadal obowiązuje → użytkownik trafia wprost na tablicę.
  if (!user) return <LoginPage onLogin={setUser} />;

  if (openBoardId) {
    return <BoardView key={openBoardId} boardId={openBoardId} onClose={closeBoard} />;
  }

  return (
    <div className="app">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1>Whiteboard Engine — panel</h1>
        <div className="row">
          <span className="sub" style={{ margin: 0 }}>
            {user.display_name}
            {user.is_admin ? " (admin)" : ""}
          </span>
          <button className="ghost" onClick={logout}>
            Wyloguj
          </button>
        </div>
      </div>

      <div className="tabs" style={{ marginTop: 16 }}>
        <button className={tab === "boards" ? "active" : ""} onClick={() => setTab("boards")}>
          Tablice
        </button>
        <button className={tab === "users" ? "active" : ""} onClick={() => setTab("users")}>
          Użytkownicy
        </button>
        <button className={tab === "convert" ? "active" : ""} onClick={() => setTab("convert")}>
          Konwersja
        </button>
      </div>

      {tab === "boards" && <BoardsPage onOpen={openBoard} />}
      {tab === "users" && <UsersPage isAdmin={user.is_admin} />}
      {tab === "convert" && <ConvertPage />}
    </div>
  );
}
