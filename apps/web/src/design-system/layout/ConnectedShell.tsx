"use client";

import type { PropsWithChildren, ReactNode } from "react";

import styles from "@/design-system/layout/ConnectedShell.module.css";

export type ConnectedShellProps = PropsWithChildren<{
  sidebar: ReactNode;
  topBar?: ReactNode;
}>;

export function ConnectedShell({
  sidebar,
  topBar,
  children,
}: ConnectedShellProps) {
  return (
    <div className={styles.shell}>
      <div className={styles.topBar}>
        {topBar ? <div style={{ flex: 1, minWidth: 0 }}>{topBar}</div> : null}
      </div>

      <div className={styles.body}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarInner}>{sidebar}</div>
        </aside>

        <div className={styles.main}>
          <div className={styles.mainInner}>{children}</div>
        </div>
      </div>
    </div>
  );
}
