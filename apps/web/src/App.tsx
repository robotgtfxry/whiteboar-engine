import { useEffect, useState } from "react";

import { api, hasToken, type User } from "@whiteboard/api-client";
import { BoardsPage } from "./BoardsPage";
import { BoardView } from "./BoardView";
import { ConvertPage } from "./ConvertPage";
import { LoginPage } from "./LoginPage";
import { UsersPage } from "./UsersPage";

type Tab = "boards" | "users" | "convert";

// URL /room/<id> → otwarty pokój (publiczne id pokoju; tablica ma prywatny sekret). / → panel.
// Trasa jest publiczna (link można komuś wysłać), ale wymaga auth (patrz niżej).
function roomIdFromPath(): string | null {
  const parts = window.location.pathname.replace(/^\/+/, "").split("/");
  return parts[0] === "room" && parts[1] ? parts[1] : null;
}

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("boards");
  const [openRoomId, setOpenRoomId] = useState<string | null>(roomIdFromPath());

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
    const onPop = () => setOpenRoomId(roomIdFromPath());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  function openRoom(roomId: string) {
    if (roomIdFromPath() !== roomId) window.history.pushState(null, "", `/room/${roomId}`);
    setOpenRoomId(roomId);
  }

  function closeRoom() {
    if (roomIdFromPath()) window.history.pushState(null, "", "/");
    setOpenRoomId(null);
  }

  function logout() {
    api.logout();
    setUser(null);
    closeRoom();
  }

  if (loading) return <div className="app">Ładowanie…</div>;

  // Trasa /<id> jest publiczna (link można komuś wysłać), ale bez zalogowania pokazujemy logowanie.
  // Po zalogowaniu openBoardId z URL-a nadal obowiązuje → użytkownik trafia wprost na tablicę.
  if (!user) return <LoginPage onLogin={setUser} />;

  if (openRoomId) {
    return <BoardView key={openRoomId} roomId={openRoomId} onClose={closeRoom} />;
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

      {tab === "boards" && <BoardsPage onOpen={openRoom} />}
      {tab === "users" && <UsersPage isAdmin={user.is_admin} />}
      {tab === "convert" && <ConvertPage />}
    </div>
  );
}
