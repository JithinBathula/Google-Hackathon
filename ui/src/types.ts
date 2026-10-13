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
  demo_hint?: string | null; demo_answer?: string | null;
}

export interface Doc { id: string; title: string; path: string; kind: string; author: string | null; modified_at: string | null; url: string | null; extracted: boolean }

export interface HandoverState {
  status: "draft" | "reviewing" | "needs_answers" | "complete" | "error";
  submitted_at: string | null; reviewed_at: string | null; completed_at: string | null;
  answers: { gap_id: string; question: string; answer: string }[];
  remaining_gap_ids: string[]; rounds: number; error: string | null;
}

export interface InterviewChapter {
  id: string; date: string | null; title: string; narrative: string;
  knowledge_ids: string[]; gap_ids: string[];
}

export interface InterviewTurn {
  gap_id: string; question: string; transcript: string; captured_answer: string | null;
  sufficient: boolean; assistant_message: string; created_at: string;
}

export interface InterviewState {
  status: "not_started" | "in_progress" | "complete" | "error";
  phase: "ready" | "narrating" | "asking" | "complete" | "error";
  timeline: InterviewChapter[]; current_item: number; current_gap_id: string | null;
  current_question: string | null; turns: InterviewTurn[]; started_at: string | null;
  completed_at: string | null; error: string | null;
}

export interface InterviewAnswerResponse {
  interview: InterviewState; assistant_message: string; gap: Gap | null;
}

export interface Leaver {
  id: string; name: string; role: string; last_day: string; email: string | null; connected: boolean;
  documents: number; knowledge: number; gaps: number;
  sync: { state: "idle" | "running" | "done" | "error"; step: string | null; started_at: string | null; finished_at: string | null; error: string | null };
  handover: HandoverState;
}

export interface CheckResponse { sufficient: boolean; message: string; follow_up: string | null; gap: Gap }
