"""Thin wrapper around the ExifTool command-line application.

All metadata reads and writes go through this module. It shells out to
``exiftool`` (which must be installed separately, e.g. via Homebrew) and
exposes a small, typed surface to the rest of the package.
"""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path
from typing import Sequence

INSTALL_HINT = (
    "exif-kit needs ExifTool to read and write metadata.\n"
    "Install it with:\n\n"
    "    brew install exiftool          (macOS)\n"
    "    sudo apt install libimage-exiftool-perl   (Debian/Ubuntu)\n\n"
    "More options: https://exiftool.org/install.html"
)


class ExifToolError(RuntimeError):
    """ExifTool returned a non-zero exit code or unusable output."""


class ExifToolNotFound(ExifToolError):
    """The exiftool binary is not on PATH."""


def find_exiftool() -> str:
    """Return the path to the exiftool binary, or raise ExifToolNotFound."""
    exe = shutil.which("exiftool")
    if not exe:
        raise ExifToolNotFound(INSTALL_HINT)
    return exe


def exiftool_version() -> str:
    result = _run(["-ver"])
    return result.stdout.strip()


def _run(args: Sequence[str]) -> subprocess.CompletedProcess[str]:
    exe = find_exiftool()
    result = subprocess.run(
        [exe, *args],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        message = result.stderr.strip() or result.stdout.strip() or "unknown error"
        raise ExifToolError(message)
    return result


def read(paths: Sequence[Path | str], numeric: bool = True) -> list[dict]:
    """Read metadata for one or more files as a list of tag dictionaries.

    With ``numeric=True`` values come back machine-readable (e.g. GPS as
    signed decimals, exposure as raw numbers) so callers control formatting.
    """
    args = ["-j", "-q"]
    if numeric:
        args.append("-n")
    args.extend(str(p) for p in paths)
    result = _run(args)
    if not result.stdout.strip():
        return []
    return json.loads(result.stdout)


def write(
    paths: Sequence[Path | str],
    tag_args: Sequence[str],
    backup: bool = True,
) -> str:
    """Apply tag assignments to files and return ExifTool's summary line.

    ``tag_args`` are raw ExifTool tag arguments such as
    ``-DateTimeOriginal=2024:06:01 12:00:00`` or ``-AllDates+=0:0:0 2:0:0``.
    When ``backup`` is True, ExifTool keeps the untouched file next to the
    edited one with an ``_original`` suffix.
    """
    args: list[str] = ["-q", "-P"]  # -P preserves the file's mtime
    if not backup:
        args.append("-overwrite_original")
    args.extend(tag_args)
    args.extend(str(p) for p in paths)
    result = _run(args)
    return result.stdout.strip()


def copy_metadata(
    source: Path | str,
    targets: Sequence[Path | str],
    backup: bool = True,
) -> str:
    """Copy all writable metadata from ``source`` onto each target file."""
    args: list[str] = ["-q", "-P", "-TagsFromFile", str(source), "-all:all"]
    if not backup:
        args.append("-overwrite_original")
    args.extend(str(p) for p in targets)
    result = _run(args)
    return result.stdout.strip()


def strip_metadata(paths: Sequence[Path | str], backup: bool = True) -> str:
    """Remove all metadata from the given files (privacy-safe export)."""
    args: list[str] = ["-q", "-all="]
    if not backup:
        args.append("-overwrite_original")
    args.extend(str(p) for p in paths)
    result = _run(args)
    return result.stdout.strip()
