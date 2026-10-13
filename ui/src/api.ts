import type { CheckResponse, Doc, Gap, HandoverState, InterviewAnswerResponse, InterviewState, Knowledge, Leaver } from "./types";

const BASE = import.meta.env.VITE_API_URL ?? "/api";

async function get<T>(path: string): Promise<T> {
  const r = await fetch(BASE + path);
  if (!r.ok) throw new Error(`${r.status} ${path}`);
  return r.json();
}

async function mutate<T>(path: string, init: RequestInit): Promise<T> {
  const r = await fetch(BASE + path, init);
  if (!r.ok) {
    const detail = await r.json().catch(() => null);
    throw new Error(detail?.detail ?? `${r.status} ${path}`);
  }
  return r.json();
}

export const api = {
  leaver: (id: string) => get<Leaver>(`/leavers/${id}`),
  documents: (id: string) => get<Doc[]>(`/leavers/${id}/documents`),
  knowledge: (id: string) => get<Knowledge[]>(`/leavers/${id}/knowledge`),
  gaps: (id: string) => get<Gap[]>(`/leavers/${id}/gaps`),
  sync: (id: string) => mutate<{ status: string }>(`/leavers/${id}/sync`, { method: "POST" }),
  submit: (id: string) => mutate<HandoverState>(`/leavers/${id}/submit`, { method: "POST" }),
  restart: (id: string) => mutate<HandoverState>(`/leavers/${id}/handover`, { method: "DELETE" }),
  interview: (id: string) => get<InterviewState>(`/leavers/${id}/interview`),
  startInterview: (id: string) => mutate<InterviewState>(`/leavers/${id}/interview/start`, { method: "POST" }),
  advanceInterview: (id: string) => mutate<InterviewState>(`/leavers/${id}/interview/advance`, { method: "POST" }),
  answerInterview: (id: string, body: { text?: string; audio_base64?: string; mime_type?: string }) =>
    mutate<InterviewAnswerResponse>(`/leavers/${id}/interview/answer`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    }),
  speakInterview: async (id: string, text: string) => {
    const response = await fetch(`${BASE}/leavers/${id}/interview/speak`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }),
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => null);
      throw new Error(detail?.detail ?? `${response.status} interview/speak`);
    }
    return response.blob();
  },
  check: (id: string, gapId: string, body: { text: string; question?: string; attempts: { question: string; answer: string }[] }) =>
    mutate<CheckResponse>(`/leavers/${id}/gaps/${gapId}/check`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    }),
  answer: (id: string, gapId: string, answer: string) =>
    mutate<Gap>(`/leavers/${id}/gaps/${gapId}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "answered", answer }),
    }),
  connectUrl: (id: string) => `${BASE}/auth/google/start?leaver=${id}`,
};
