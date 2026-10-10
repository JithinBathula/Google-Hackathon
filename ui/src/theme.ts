import type { Knowledge } from "./types";

export const COLORS: Record<string, string> = {
  decision: "#e9b44c",
  rule: "#a78bfa",
  unfinished: "#f97066",
  lesson: "#5ad19a",
  person: "#5cc8ff",
  organisation: "#3d8bfd",
  thing: "#8d93a1",
  gap: "#ff7ab6",
};

export const LABELS: Record<string, string> = {
  decision: "Decision", rule: "Rule", unfinished: "Unfinished", lesson: "Lesson",
  person: "Person", organisation: "Organisation", thing: "Thing", gap: "Question",
};

export const LINK_LABELS: Record<string, string> = {
  decided_by: "decided by", owned_by: "owned by", about: "about", blocks: "blocks", follows: "follows", supersedes: "supersedes", asks: "asks about",
};

export function colorOf(k: Knowledge): string {
  return COLORS[k.type === "background" ? k.kind ?? "thing" : k.type];
}
export function labelOf(k: Knowledge): string {
  return LABELS[k.type === "background" ? k.kind ?? "thing" : k.type];
}
