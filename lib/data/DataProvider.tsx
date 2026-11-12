"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AppData } from "./AppData";
import { createFakeData } from "./fakeData";
import { createHttpData } from "./httpData";

type Ctx = { data: AppData; version: number; refresh: () => void };

const DataContext = createContext<Ctx | null>(null);

let clientData: AppData | null = null;

function makeClientData(): AppData {
  if (process.env.NEXT_PUBLIC_DATA_MODE === "live") return createHttpData();
  return createFakeData(window.localStorage, () => new Date());
}

/** Lazily creates the client data source on first use (never during server render). */
function lazyData(): AppData {
  return new Proxy({} as AppData, {
    get(_t, prop: keyof AppData) {
      if (!clientData) clientData = makeClientData();
      const fn = clientData[prop] as (...a: unknown[]) => unknown;
      return (...args: unknown[]) => fn.apply(clientData, args);
    },
  });
}

export function DataProvider({ children, data }: { children: ReactNode; data?: AppData }) {
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  const value = useMemo(() => ({ data: data ?? lazyData(), version, refresh }), [data, version, refresh]);
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useAppData(): AppData {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useAppData must be used inside <DataProvider>");
  return ctx.data;
}

/** Call refresh() after a mutation; every useLoad re-runs. */
export function useRefresh(): () => void {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useRefresh must be used inside <DataProvider>");
  return ctx.refresh;
}

/** Load something from AppData; re-runs whenever any screen mutates data. */
export function useLoad<T>(fn: (d: AppData) => Promise<T>, deps: unknown[] = []): T | undefined {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useLoad must be used inside <DataProvider>");
  const [value, setValue] = useState<T>();
  useEffect(() => {
    let alive = true;
    fn(ctx.data).then((v) => alive && setValue(v));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.data, ctx.version, ...deps]);
  return value;
}
