export type KnowledgeType = "decision" | "unfinished" | "rule" | "background" | "lesson";

export interface Source { raw_id: string; document_id: string; quote: string }
export interface Link { type: string; target_id: string }

export interface Knowledge {
  id: string; type: KnowledgeType; title: string; details: string;
  why: string | null; who: string[]; when: string | null;
  kind: "person" | "organisation" | "thing" | null; working_notes: string | null;
  due: string | null; owner: string | null;
  sources: Source[]; links: Link[];
}

export interface Gap {
  id: string; question: string; why_it_matters: string; sources: Source[];
  knowledge_ids: string[]; priority: number; status: "open" | "answered" | "dropped"; answer: string | null;
}

export interface Doc { id: string; title: string; path: string; kind: string; author: string | null; modified_at: string | null; url: string | null; extracted: boolean }

export interface Leaver {
  id: string; name: string; role: string; last_day: string; email: string | null; connected: boolean;
  documents: number; knowledge: number; gaps: number;
  sync: { state: "idle" | "running" | "done" | "error"; step: string | null; started_at: string | null; finished_at: string | null; error: string | null };
}
