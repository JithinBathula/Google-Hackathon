"""Commands for running the pipeline by hand. The API in api.py does the same over HTTP."""

from collections import defaultdict
from pathlib import Path

import typer
from rich import print as rprint

from handover.models import Leaver
from handover.store import Store

app = typer.Typer(help="Knowledge handover", no_args_is_help=True)


def _store(leaver_id: str) -> Store:
    store = Store(leaver_id)
    if not store.leaver():
        raise typer.BadParameter(f"no leaver {leaver_id}; run `handover init` first")
    return store


@app.command()
def init(
    name: str = typer.Option("Maya Tan"),
    role: str = typer.Option("Events & Marketing Coordinator"),
    last_day: str = typer.Option("2026-11-06"),
) -> None:
    """Create the leaver's workspace. The id is made from the name: 'Maya Tan' -> maya-tan."""
    leaver = Leaver(id=Leaver.make_id(name), name=name, role=role, last_day=last_day)
    Store(leaver.id).save_leaver(leaver)
    rprint(f"[green]{leaver.id}[/green] created")


@app.command()
def connect(leaver_id: str) -> None:
    """Connect the leaver's Google account from the terminal (opens the browser once)."""
    import webbrowser
    from http.server import BaseHTTPRequestHandler, HTTPServer
    from urllib.parse import parse_qs, urlparse

    from handover.sources import google_auth

    store = _store(leaver_id)
    state, result = "cli", {}
    url = google_auth.authorization_url(state)

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:
            q = parse_qs(urlparse(self.path).query)
            ok = urlparse(self.path).path == google_auth.CALLBACK_PATH and q.get("state", [""])[0] == state and "code" in q
            if ok:
                result["code"] = q["code"][0]
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"Connected. You can close this tab." if ok else b"Old link. Use the latest one in the terminal.")

        def log_message(self, *args) -> None:
            pass

    port = int(urlparse(google_auth.redirect_uri()).port or 80)
    server = HTTPServer(("localhost", port), Handler)
    print(f"Open this URL and sign in as the leaver's account:\n\n{url}\n", flush=True)
    webbrowser.open(url)
    while "code" not in result:
        server.handle_request()
    server.server_close()

    leaver = store.leaver()
    leaver.email = google_auth.exchange_code(result["code"], store)
    store.save_leaver(leaver)
    rprint(f"[green]Connected as {leaver.email}[/green]")


@app.command()
def sync(leaver_id: str) -> None:
    """Read Drive and Calendar, extract what changed, consolidate, audit the gaps. Same as POST /leavers/{id}/sync."""
    from handover.pipeline import sync as run_sync

    run_sync(_store(leaver_id), log=rprint)


@app.command()
def ingest(leaver_id: str, path: Path = typer.Option(None, exists=True, help="Read a local folder instead of Drive")) -> None:
    """Only the reading step."""
    from handover.pipeline import ingest as run_ingest

    store = _store(leaver_id)
    if path:
        from handover.sources.local import read_folder

        docs = read_folder(path)
    else:
        from handover.sources.google_drive import read_drive

        docs = read_drive(store)
    changed, unchanged = run_ingest(store, docs, log=rprint)
    rprint(f"[green]{changed} documents changed, {unchanged} unchanged[/green]")


@app.command()
def extract(leaver_id: str, force: bool = typer.Option(False, help="Re-extract documents already done")) -> None:
    """Only agent 1, over documents not yet extracted."""
    from handover.llm.gemini import Gemini
    from handover.pipeline import extract as run_extract

    store = _store(leaver_id)
    rprint(f"{run_extract(store, store.leaver(), Gemini(), force=force, log=rprint)} documents extracted")


@app.command()
def consolidate(leaver_id: str) -> None:
    """Only agents 2 and 3."""
    from handover.llm.gemini import Gemini
    from handover.pipeline import consolidate_all

    store = _store(leaver_id)
    consolidate_all(store, store.leaver(), Gemini(), log=rprint)


@app.command()
def status(leaver_id: str) -> None:
    store = _store(leaver_id)
    leaver, docs = store.leaver(), store.documents()
    rprint(f"{leaver.name}, {leaver.role}, last day {leaver.last_day}, google: {leaver.email or 'not connected'}, sync: {leaver.sync.state}")
    rprint(f"documents: {len(docs)}  extracted: {sum(d.extracted for d in docs)}  raw: {len(store.raw_knowledge())} items, {len(store.raw_gaps())} gaps  merged: {len(store.knowledge())} items, {len(store.gaps())} gaps")


@app.command()
def show(
    leaver_id: str,
    doc: str = typer.Option(None, help="Only items with a source in this document (path substring)"),
    raw: bool = typer.Option(False, help="Show the raw per-document layer instead of the merged one"),
) -> None:
    """Print the knowledge and gaps, grouped by type, items with the most sources first."""
    store = _store(leaver_id)
    docs = {d.id: d for d in store.documents()}
    if raw:
        _show_raw(store, docs, doc)
        return
    items = [k for k in store.knowledge() if not doc or any(doc in docs[s.document_id].path for s in k.sources)]
    gaps = [g for g in store.gaps() if not doc or any(doc in docs[s.document_id].path for s in g.sources)]
    titles = {k.id: k.title for k in store.knowledge()}

    by_type = defaultdict(list)
    for k in items:
        by_type[k.type].append(k)
    for t in ("background", "decision", "rule", "unfinished", "lesson"):
        rprint(f"\n[bold]{t.upper()} ({len(by_type[t])})[/bold]")
        for k in sorted(by_type[t], key=lambda k: -len(k.sources)):
            extra = {f: getattr(k, f) for f in ("why", "kind", "working_notes", "due", "owner") if getattr(k, f)}
            if t in ("decision", "rule") and not k.why:
                extra["why"] = "[yellow]not stated[/yellow]"
            rprint(f"  • {k.title}  [dim]{len(k.sources)} source{'s' if len(k.sources) > 1 else ''} [{k.id}][/dim]\n        {k.details}")
            for f, v in extra.items():
                rprint(f"        {f}: {v}")
            for link in k.links:
                rprint(f"        [dim]{link.type} → {titles.get(link.target_id, link.target_id)}[/dim]")
    rprint(f"\n[bold]GAPS ({len(gaps)})[/bold]")
    for g in sorted(gaps, key=lambda g: -g.priority):
        about = ", ".join(titles.get(i, i) for i in g.knowledge_ids)
        status = "" if g.status == "open" else f" [{g.status}]"
        rprint(f"  {'!' * g.priority:5} {g.question}{status}  [dim]{len(g.sources)} source{'s' if len(g.sources) > 1 else ''} [{g.id}][/dim]\n        {g.why_it_matters}" + (f"\n        [dim]about: {about}[/dim]" if about else ""))


def _show_raw(store: Store, docs: dict, doc: str | None) -> None:
    items = [k for k in store.raw_knowledge() if not doc or doc in docs[k.document_id].path]
    gaps = [g for g in store.raw_gaps() if not doc or doc in docs[g.document_id].path]
    by_type = defaultdict(list)
    for k in items:
        by_type[k.type].append(k)
    for t in ("background", "decision", "rule", "unfinished", "lesson"):
        rprint(f"\n[bold]{t.upper()} ({len(by_type[t])})[/bold]")
        for k in by_type[t]:
            why = f"\n    why: {k.why}" if k.why else ("\n    why: [yellow]not stated[/yellow]" if t in ("decision", "rule") else "")
            rprint(f"  • {k.title}  [dim]({docs[k.document_id].path}) [{k.id}][/dim]\n    {k.details}{why}")
    rprint(f"\n[bold]GAPS ({len(gaps)})[/bold]")
    for g in gaps:
        rprint(f"  ? {g.question}  [dim]({docs[g.document_id].path}) [{g.id}][/dim]\n    {g.why_it_matters}")


@app.command()
def trace(leaver_id: str, item_id: str) -> None:
    """Show one raw item or raw gap and the exact place in its document it came from."""
    store = _store(leaver_id)
    item = next((x for x in store.raw_knowledge() + store.raw_gaps() if x.id == item_id), None)
    if not item:
        raise typer.BadParameter(f"no raw item {item_id}; IDs look like <document>-k0 or <document>-g0")
    doc = store.get_document(item.document_id)
    rprint(item.model_dump_json(indent=2))
    rprint(f"\n[bold]source:[/bold] {doc.path}  ({doc.author or '-'}, {doc.modified_at.date() if doc.modified_at else '-'})  {doc.url or ''}")
    i = doc.text.find(item.quote[:40])
    if i < 0:
        rprint("[yellow]quote not found verbatim in the source[/yellow]")
        return
    rprint(f"[bold]line {doc.text[:i].count(chr(10)) + 1}:[/bold]")
    rprint("…" + doc.text[max(0, i - 150) : i] + "[green]" + doc.text[i : i + len(item.quote)] + "[/green]" + doc.text[i + len(item.quote) : i + len(item.quote) + 100] + "…")


@app.command("seed-google")
def seed_google(leaver_id: str, corpus: Path = typer.Option(..., exists=True, help="Folder with _manifest.json files and calendar.json")) -> None:
    """Put a local folder into the leaver's Drive and Calendar (re-runnable). Only for setting up a new demo account."""
    from handover.sources.seed_google import seed

    links = seed(_store(leaver_id), corpus, log=rprint)
    rprint(f"[green]seeded {len(links)} files[/green]")


if __name__ == "__main__":
    app()
