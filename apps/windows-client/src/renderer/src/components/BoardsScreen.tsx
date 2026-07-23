import { useCallback, useEffect, useRef, useState } from "react";

import { api, type BoardSummary } from "@whiteboard/api-client";

import { DEVBRD_EXTENSIONS, openFiles } from "../lib/desktopFiles";
import { useMenuAction } from "../lib/useMenu";
import { Icon } from "./ui/Icon";
import { useToast } from "./ui/Toast";

export function BoardsScreen({ onOpen }: { onOpen: (roomId: string) => void }) {
  const toast = useToast();
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [query, setQuery] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      setBoards(await api.listBoards());
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const create = useCallback(async () => {
    const title = newTitle.trim() || "Nowa tablica";
    try {
      const b = await api.createBoard({ title });
      setNewTitle("");
      await load();
      if (b.room_id) onOpen(b.room_id);
      else toast.info("Utworzono tablicę.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, [newTitle, load, onOpen, toast]);

  const importDevbrd = useCallback(async () => {
    const files = await openFiles(DEVBRD_EXTENSIONS);
    if (!files.length) return;
    try {
      const b = await api.importDevbrd(files[0]);
      toast.success(`Zaimportowano „${b.title}".`);
      await load();
      if (b.room_id) onOpen(b.room_id);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, [load, onOpen, toast]);

  useMenuAction((a) => {
    if (a === "menu:new-board") titleRef.current?.focus();
    if (a === "menu:import-devbrd") importDevbrd();
  });

  async function remove(id: string, title: string) {
    if (!window.confirm(`Usunąć tablicę „${title}"? Tej operacji nie można cofnąć.`)) return;
    try {
      await api.deleteBoard(id);
      toast.info("Usunięto tablicę.");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const filtered = boards.filter((b) => b.title.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="screen">
      <header className="screen-head">
        <h2>Tablice</h2>
        <div className="row tight">
          <div className="search">
            <Icon name="search" size={16} />
            <input placeholder="Szukaj tablic…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <button className="ghost" onClick={importDevbrd}>
            <Icon name="import" size={16} />
            <span>Importuj .devbrd</span>
          </button>
        </div>
      </header>

      <div className="create-bar">
        <input
          ref={titleRef}
          placeholder="Tytuł nowej tablicy…"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create()}
        />
        <button className="primary" onClick={create}>
          <Icon name="plus" size={16} />
          <span>Utwórz tablicę</span>
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          {boards.length === 0 ? "Brak tablic. Utwórz pierwszą powyżej." : "Brak wyników wyszukiwania."}
        </div>
      ) : (
        <div className="board-grid">
          {filtered.map((b) => (
            <div
              key={b.id}
              className="board-card"
              onDoubleClick={() => b.room_id && onOpen(b.room_id)}
            >
              <div className="board-card-top">
                <div className="board-card-title ellipsis" title={b.title}>
                  {b.title}
                </div>
                {b.room_id && <span className="badge">pokój</span>}
              </div>
              <div className="muted small">
                Zaktualizowano {new Date(b.updated_at).toLocaleString()}
              </div>
              <div className="board-card-actions">
                <button
                  className="primary sm"
                  disabled={!b.room_id}
                  title={b.room_id ? "Otwórz tablicę" : "Brak pokoju"}
                  onClick={() => b.room_id && onOpen(b.room_id)}
                >
                  Otwórz
                </button>
                <button className="danger sm icon-btn" title="Usuń" onClick={() => remove(b.id, b.title)}>
                  <Icon name="trash" size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
