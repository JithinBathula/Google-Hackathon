"""Commands: ingest from Drive, extract per document, consolidate across documents, show what was found."""

from collections import defaultdict
from pathlib import Path

import typer
from rich import print as rprint

from handover.store import Store

app = typer.Typer(help="Knowledge handover", no_args_is_help=True)


@app.command()
def ingest(
    name: str,
    source: str = typer.Option("google", "--from", help="'google' (the connected account's Drive + Calendar) or 'local' (a folder, for tests)"),
    path: Path = typer.Option(None, exists=True, help="Folder to read, for --from local"),
    folder: str = typer.Option(None, help="Only this Drive folder, for --from google"),
) -> None:
    """Read every document into .data/<name>/documents.json. Unchanged documents are skipped."""
    if source == "google":
        from handover.sources.google_drive import read_drive

        docs = read_drive(folder)
    elif path:
        from handover.sources.local import read_folder

        docs = read_folder(path)
    else:
        raise typer.BadParameter("--from local needs --path")

    store = Store(name)
    new = unchanged = 0
    for doc in docs:
        old = store.get_document(doc.id)
        if old and old.content_hash == doc.content_hash:
            unchanged += 1
            continue
        store.save_document(doc)
        new += 1
        rprint(f"  + {doc.path}")
    rprint(f"[green]{new} documents ingested, {unchanged} unchanged[/green]")


LEAVER = typer.Option("Maya Tan")
ROLE = typer.Option("Events & Marketing Coordinator")
TODAY = typer.Option("2026-10-09", help="The story's 'today'")
LAST_DAY = typer.Option("2026-11-06")


@app.command()
def extract(
    name: str,
    leaver: str = LEAVER,
    role: str = ROLE,
    today: str = TODAY,
    last_day: str = LAST_DAY,
    limit: int = typer.Option(0, help="Only this many documents (0 = all)"),
    force: bool = typer.Option(False, help="Re-extract documents already done"),
) -> None:
    """Agent 1, the extractor: run Gemini over each document that hasn't been extracted yet (raw layer)."""
    from handover.extract import extract_document
    from handover.llm.gemini import Gemini

    store, gemini = Store(name), Gemini()
    todo = [d for d in store.documents() if force or not d.extracted]
    todo.sort(key=lambda d: d.path)
    if limit:
        todo = todo[:limit]
    for i, doc in enumerate(todo, 1):
        try:
            r = extract_document(doc, gemini, store, leaver, role, today, last_day)
            rprint(f"[{i}/{len(todo)}] {doc.path}: {len(r.items)} items, {len(r.gaps)} gaps")
        except Exception as e:
            rprint(f"[red][{i}/{len(todo)}] {doc.path}: {e}[/red]")


@app.command()
def consolidate(name: str, leaver: str = LEAVER, role: str = ROLE, today: str = TODAY, last_day: str = LAST_DAY) -> None:
    """Agents 2 and 3: merge the raw layer into one item per real thing with links, then audit and rank the gaps."""
    from handover.audit_gaps import audit_gaps
    from handover.consolidate import consolidate as run_consolidate
    from handover.llm.gemini import Gemini

    store, gemini = Store(name), Gemini()
    rprint("[bold]consolidator[/bold]")
    knowledge, contradictions = run_consolidate(store, gemini, leaver, role, today, last_day, log=rprint)
    rprint("[bold]gap auditor[/bold]")
    gaps = audit_gaps(store, gemini, knowledge, contradictions, leaver, role, today, last_day, log=rprint)
    rprint(f"[green]{len(knowledge)} knowledge items, {len(gaps)} gaps[/green]")


@app.command()
def show(
    name: str,
    doc: str = typer.Option(None, help="Only items with a source in this document (path substring)"),
    raw: bool = typer.Option(False, help="Show the raw per-document layer instead of the merged one"),
) -> None:
    """Print the knowledge and gaps, grouped by type, items with the most sources first."""
    store = Store(name)
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
def trace(name: str, item_id: str, corpus: Path = typer.Option(None, help="Local folder, if the documents came from one")) -> None:
    """Show one knowledge item or gap, and the exact place in the source document it came from."""
    store = Store(name)
    item = next((x for x in store.raw_knowledge() + store.raw_gaps() if x.id == item_id), None)
    if not item:
        raise typer.BadParameter(f"no item {item_id}; IDs look like <document>-k0 or <document>-g0")
    doc = store.get_document(item.document_id)
    rprint(item.model_dump_json(indent=2))
    rprint(f"\n[bold]source:[/bold] {doc.path}  ({doc.author or '-'}, {doc.modified_at.date() if doc.modified_at else '-'})")
    file = corpus / doc.path if corpus else None
    text = file.read_text() if file and file.exists() else doc.text
    i = text.find(item.quote[:40])
    if i < 0:
        rprint("[yellow]quote not found verbatim in the source[/yellow]")
        return
    line = text[:i].count("\n") + 1
    rprint(f"[bold]line {line}:[/bold]")
    rprint("…" + text[max(0, i - 150) : i] + "[green]" + text[i : i + len(item.quote)] + "[/green]" + text[i + len(item.quote) : i + len(item.quote) + 100] + "…")


@app.command()
def connect() -> None:
    """Connect the leaver's Google account (opens the browser once). Token is kept in .secrets/."""
    from handover.sources.google_auth import connect as run_connect

    email = run_connect()
    rprint(f"[green]Connected as {email}[/green]")


@app.command("seed-google")
def seed_google(corpus: Path = typer.Option(..., exists=True, help="Folder with _manifest.json files and calendar.json")) -> None:
    """Put a local folder into the connected Google account's Drive and Calendar (re-runnable). The demo data
    lives in Maya's Drive now; this is only for seeding another test account."""
    from handover.sources.seed_google import seed

    links = seed(corpus, log=rprint)
    rprint(f"[green]seeded {len(links)} files[/green]")


@app.command()
def status(name: str) -> None:
    store = Store(name)
    docs = store.documents()
    rprint(f"documents: {len(docs)}  extracted: {sum(d.extracted for d in docs)}  raw: {len(store.raw_knowledge())} items, {len(store.raw_gaps())} gaps  merged: {len(store.knowledge())} items, {len(store.gaps())} gaps")


if __name__ == "__main__":
    app()
