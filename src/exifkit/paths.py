"""Resolving user-supplied paths (files, directories, glob patterns)."""

from __future__ import annotations

import glob
from pathlib import Path

from .fields import SUPPORTED_EXTENSIONS


def expand_paths(inputs: list[str], recursive: bool = False) -> list[Path]:
    """Turn a mix of files, directories and glob patterns into a file list.

    Directories are expanded to the supported photo/video files directly
    inside them (or recursively with ``recursive=True``). Nonexistent paths
    raise FileNotFoundError so typos fail loudly instead of being skipped.
    """
    files: list[Path] = []
    for raw in inputs:
        path = Path(raw).expanduser()
        if path.is_dir():
            pattern = "**/*" if recursive else "*"
            candidates = sorted(path.glob(pattern))
            files.extend(
                c for c in candidates
                if c.is_file() and c.suffix.lower() in SUPPORTED_EXTENSIONS
            )
        elif path.is_file():
            files.append(path)
        else:
            matches = sorted(Path(p) for p in glob.glob(str(path), recursive=True))
            file_matches = [m for m in matches if m.is_file()]
            if not file_matches:
                raise FileNotFoundError(f"No file matches {raw!r}.")
            files.extend(file_matches)

    # De-duplicate while preserving order.
    seen: set[Path] = set()
    unique: list[Path] = []
    for f in files:
        resolved = f.resolve()
        if resolved not in seen:
            seen.add(resolved)
            unique.append(f)
    return unique
