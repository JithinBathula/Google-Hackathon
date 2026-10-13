"""The handover knowledge base as an MCP server, so a successor can use it from any LLM tool (Claude, Gemini CLI,
Cursor, ...). It reads the same store as the UI: Firestore on Cloud Run. Served at /mcp (streamable HTTP)."""

from mcp.server.mcpserver import MCPServer
from mcp.server.transport_security import TransportSecuritySettings

from handover.ask import answer_line, ask, knowledge_line
from handover.store import Store, list_leavers, open_store

mcp = MCPServer(
    name="handover",
    title="Handover knowledge base",
    instructions="Everything a departing teammate knew about their work: decisions and why, rules, people, unfinished "
                 "work, lessons, and the leaver's own answers. Call list_handovers first to get a leaver_id.",
)


def _store(leaver_id: str) -> Store:
    store = open_store(leaver_id)
    if not store.leaver():
        raise ValueError(f"no handover for {leaver_id}; call list_handovers")
    return store


@mcp.tool()
def list_handovers() -> list[dict]:
    """The handovers in this workspace: who is leaving, their role and last day."""
    return [{"leaver_id": leaver.id, "name": leaver.name, "role": leaver.role, "last_day": leaver.last_day}
            for leaver in list_leavers()]


@mcp.tool()
def search_knowledge(leaver_id: str, query: str, limit: int = 8) -> list[str]:
    """Keyword search over the leaver's knowledge and answers. Returns one line per match, with its id."""
    store = _store(leaver_id)
    words = [w for w in query.lower().split() if len(w) > 2]
    lines = [knowledge_line(k) for k in store.knowledge()]
    lines += [answer_line(g) for g in store.gaps() if g.status == "answered" and g.answer]
    scored = sorted(((sum(line.lower().count(w) for w in words), line) for line in lines), key=lambda p: -p[0])
    return [line for score, line in scored[:limit] if score > 0]


@mcp.tool()
def get_item(leaver_id: str, item_id: str) -> dict:
    """One record in full: details, reason, sources with quotes, links, and the leaver's answers about it."""
    store = _store(leaver_id)
    item = next((k for k in store.knowledge() if k.id == item_id), None)
    if not item:
        gap = store.get_gap(item_id)
        if not gap:
            raise ValueError(f"no item {item_id}")
        return gap.model_dump(exclude={"demo_hint", "demo_answer"})
    titles = {d.id: d.title for d in store.documents()}
    told = [g for g in store.gaps() if item.id in g.knowledge_ids and g.status == "answered" and g.answer]
    return {
        **item.model_dump(exclude={"sources"}),
        "sources": [{"document": titles.get(s.document_id, s.document_id), "quote": s.quote} for s in item.sources],
        "leaver_answers": [{"question": g.question, "answer": g.answer} for g in told],
    }


@mcp.tool()
def open_work(leaver_id: str) -> list[dict]:
    """Unfinished work, soonest due first, with owner (None means nobody is named)."""
    items = [k for k in _store(leaver_id).knowledge() if k.type == "unfinished"]
    return [{"id": k.id, "title": k.title, "details": k.details, "due": k.due, "owner": k.owner}
            for k in sorted(items, key=lambda k: k.due or "9999")]


@mcp.tool()
def ask_handover(leaver_id: str, question: str) -> dict:
    """Ask a question in plain language. Gemini answers from the knowledge base only and cites record ids."""
    return ask(_store(leaver_id), question).model_dump()


# Cloud Run serves it on its own *.run.app host, so the localhost-only DNS-rebinding check doesn't apply
mcp_app = mcp.streamable_http_app(
    streamable_http_path="/mcp", stateless_http=True, json_response=True,
    transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=False),
)
