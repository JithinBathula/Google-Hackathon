import type { Doc, Gap, Knowledge, Leaver } from "./types";

const BASE = import.meta.env.VITE_API_URL ?? "/api";

async function get<T>(path: string): Promise<T> {
  const r = await fetch(BASE + path);
  if (!r.ok) throw new Error(`${r.status} ${path}`);
  return r.json();
}

export const api = {
  leaver: (id: string) => get<Leaver>(`/leavers/${id}`),
  documents: (id: string) => get<Doc[]>(`/leavers/${id}/documents`),
  knowledge: (id: string) => get<Knowledge[]>(`/leavers/${id}/knowledge`),
  gaps: (id: string) => get<Gap[]>(`/leavers/${id}/gaps`),
  sync: (id: string) => fetch(`${BASE}/leavers/${id}/sync`, { method: "POST" }),
  answer: (id: string, gapId: string, answer: string) =>
    fetch(`${BASE}/leavers/${id}/gaps/${gapId}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "answered", answer }),
    }).then((r) => r.json() as Promise<Gap>),
  connectUrl: (id: string) => `${BASE}/auth/google/start?leaver=${id}`,
};
