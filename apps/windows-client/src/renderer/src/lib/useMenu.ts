import { useEffect, useRef } from "react";

// Zdarzenia menu aplikacji są re-dispatchowane przez App jako CustomEvent "wb:menu".
// Ten hook pozwala dowolnemu ekranowi zareagować na akcję menu bez przekazywania propsów.
export function useMenuAction(handler: (action: string) => void): void {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => {
    const fn = (e: Event) => ref.current((e as CustomEvent<string>).detail);
    window.addEventListener("wb:menu", fn);
    return () => window.removeEventListener("wb:menu", fn);
  }, []);
}
