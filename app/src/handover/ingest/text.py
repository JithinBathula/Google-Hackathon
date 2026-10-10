"""Undo Google Drive's Markdown export quirks: bold-wrapped headings, quote prefixes on list items,
backslash-escaped punctuation, emails wrapped in mailto links."""

import re

_ESCAPES = re.compile(r"\\([\\`*_{}\[\]()#+\-.!|<>~=&])")
_MAILTO = re.compile(r"\[([^\]]+)\]\(mailto:[^)]+\)")
_BOLD_HEADING = re.compile(r"^(#{1,6})\s+\*\*(.+?)\*\*\s*$")


def clean_markdown(md: str) -> str:
    lines = []
    for line in md.replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        line = re.sub(r"^> ?", "", line).rstrip()
        line = _ESCAPES.sub(r"\1", line)
        line = _MAILTO.sub(r"\1", line)
        m = _BOLD_HEADING.match(line)
        lines.append(f"{m.group(1)} {m.group(2)}" if m else line)
    return re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip()
