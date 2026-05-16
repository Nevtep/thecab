"use client";

import { useCallback, useEffect, useId, useState, type PropsWithChildren, type ReactNode } from "react";

import { CabButton } from "@/design-system/primitives/CabButton";

import styles from "@/design-system/layout/ConnectedShell.module.css";

export type ConnectedShellProps = PropsWithChildren<{
  sidebar: ReactNode;
  topBar?: ReactNode;
  menuLabel?: string;
  closeMenuLabel?: string;
}>;

export function ConnectedShell({
  sidebar,
  topBar,
  children,
  menuLabel = "Open navigation",
  closeMenuLabel = "Close navigation",
}: ConnectedShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const drawerId = useId();

  const closeMobileNav = useCallback(() => {
    setMobileNavOpen(false);
  }, []);

  useEffect(() => {
    if (!mobileNavOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMobileNav();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeMobileNav, mobileNavOpen]);

  return (
    <div className={styles.shell}>
      <div className={styles.topBar}>
        <CabButton
          tone="secondary"
          controlSize="md"
          className={styles.menuButton}
          aria-expanded={mobileNavOpen}
          aria-controls={drawerId}
          onPress={() => setMobileNavOpen((open) => !open)}
        >
          {mobileNavOpen ? closeMenuLabel : menuLabel}
        </CabButton>
        {topBar ? <div style={{ flex: 1, minWidth: 0 }}>{topBar}</div> : null}
      </div>

      {mobileNavOpen ? (
        <button
          type="button"
          className={styles.backdrop}
          aria-label={closeMenuLabel}
          onClick={closeMobileNav}
        />
      ) : null}

      <div className={styles.body}>
        <aside
          id={drawerId}
          className={[styles.sidebar, mobileNavOpen ? styles.sidebarOpen : ""].filter(Boolean).join(" ")}
        >
          <div className={styles.sidebarInner}>{sidebar}</div>
        </aside>

        <div className={styles.main}>
          <div className={styles.mainInner}>{children}</div>
        </div>
      </div>
    </div>
  );
}
