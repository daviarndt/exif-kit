"""Parsing helpers and tag builders shared by the CLI and interactive mode.

Everything here is pure (no ExifTool calls), which keeps it easy to unit
test. Functions either parse forgiving human input into ExifTool's formats
or build lists of ExifTool tag arguments for engine.write().
"""

from __future__ import annotations

import re
from datetime import datetime
from pathlib import Path

VIDEO_EXTENSIONS = {".mp4", ".mov", ".m4v", ".avi", ".mkv", ".mts", ".m2ts"}

IMAGE_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".tif", ".tiff", ".heic", ".heif", ".webp",
    # RAW formats
    ".dng", ".cr2", ".cr3", ".nef", ".nrw", ".arw", ".raf", ".orf",
    ".rw2", ".pef", ".srw", ".x3f", ".3fr", ".fff", ".iiq", ".gpr",
}

SUPPORTED_EXTENSIONS = IMAGE_EXTENSIONS | VIDEO_EXTENSIONS

# Accepted input formats for dates (seconds optional in the datetime forms).
_DATETIME_FORMATS = [
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%d %H:%M",
    "%Y-%m-%dT%H:%M:%S",
    "%Y-%m-%dT%H:%M",
    "%Y:%m:%d %H:%M:%S",
    "%Y:%m:%d %H:%M",
    "%Y-%m-%d",
    "%Y:%m:%d",
    "%d/%m/%Y %H:%M:%S",
    "%d/%m/%Y %H:%M",
    "%d/%m/%Y",
]

_SHIFT_UNITS = {
    "y": "years",
    "mo": "months",
    "d": "days",
    "h": "hours",
    "m": "minutes",
    "s": "seconds",
}

_SHIFT_TOKEN = re.compile(r"(\d+)\s*(mo|y|d|h|m|s)", re.IGNORECASE)


def is_video(path: Path | str) -> bool:
    return Path(path).suffix.lower() in VIDEO_EXTENSIONS


def parse_datetime(text: str) -> str:
    """Parse a human-friendly date/time into ExifTool's ``YYYY:MM:DD HH:MM:SS``.

    Accepts ISO-style dates ("2024-06-01 14:30"), EXIF-style dates
    ("2024:06:01 14:30:00"), bare dates (time defaults to 00:00:00) and
    "DD/MM/YYYY" forms.
    """
    cleaned = text.strip()
    for fmt in _DATETIME_FORMATS:
        try:
            parsed = datetime.strptime(cleaned, fmt)
            return parsed.strftime("%Y:%m:%d %H:%M:%S")
        except ValueError:
            continue
    raise ValueError(
        f"Could not understand the date {text!r}. "
        'Try formats like "2024-06-01", "2024-06-01 14:30" or "01/06/2024 14:30".'
    )


def parse_shift(text: str) -> tuple[str, str]:
    """Parse a time shift like "+2h", "-30m" or "+1d 2h30m".

    Returns ``(operator, shift)`` where operator is ``"+="`` or ``"-="`` and
    shift is ExifTool's ``Y:M:D H:M:S`` format.
    """
    cleaned = text.strip().replace(",", " ")
    if not cleaned:
        raise ValueError("Empty shift expression.")

    sign = "+"
    if cleaned[0] in "+-":
        sign = cleaned[0]
        cleaned = cleaned[1:].strip()

    matches = _SHIFT_TOKEN.findall(cleaned)
    consumed = _SHIFT_TOKEN.sub("", cleaned).strip()
    if not matches or consumed:
        raise ValueError(
            f"Could not understand the shift {text!r}. "
            'Use units y, mo, d, h, m, s — for example "+2h", "-30m" or "+1d 2h30m".'
        )

    amounts = {unit: 0 for unit in _SHIFT_UNITS.values()}
    for value, unit in matches:
        amounts[_SHIFT_UNITS[unit.lower()]] += int(value)

    shift = (
        f"{amounts['years']}:{amounts['months']}:{amounts['days']} "
        f"{amounts['hours']}:{amounts['minutes']}:{amounts['seconds']}"
    )
    return (f"{sign}=", shift)


def parse_coordinates(text: str) -> tuple[float, float]:
    """Parse "lat, lon" (as copied from Google/Apple Maps) into floats."""
    cleaned = text.strip().replace(";", ",")
    parts = [p for p in re.split(r"[,\s]+", cleaned) if p]
    if len(parts) != 2:
        raise ValueError(
            f"Could not understand the coordinates {text!r}. "
            'Paste them as "latitude, longitude", e.g. "-23.5505, -46.6333".'
        )
    try:
        lat, lon = float(parts[0]), float(parts[1])
    except ValueError as exc:
        raise ValueError(f"Coordinates must be decimal numbers, got {text!r}.") from exc
    validate_coordinates(lat, lon)
    return lat, lon


def validate_coordinates(lat: float, lon: float) -> None:
    if not -90 <= lat <= 90:
        raise ValueError(f"Latitude must be between -90 and 90 (got {lat}).")
    if not -180 <= lon <= 180:
        raise ValueError(f"Longitude must be between -180 and 180 (got {lon}).")


def gps_tags(
    lat: float,
    lon: float,
    altitude: float | None = None,
    video: bool = False,
) -> list[str]:
    """Build ExifTool arguments to write a GPS position."""
    validate_coordinates(lat, lon)
    tags = [
        f"-GPSLatitude={abs(lat)}",
        f"-GPSLatitudeRef={'N' if lat >= 0 else 'S'}",
        f"-GPSLongitude={abs(lon)}",
        f"-GPSLongitudeRef={'E' if lon >= 0 else 'W'}",
    ]
    if altitude is not None:
        tags.append(f"-GPSAltitude={abs(altitude)}")
        tags.append(f"-GPSAltitudeRef={'Below' if altitude < 0 else 'Above'} Sea Level")
    if video:
        # QuickTime-based containers (MP4/MOV) carry location in a single tag.
        coords = f"{lat}, {lon}"
        if altitude is not None:
            coords += f", {altitude}"
        tags.append(f"-GPSCoordinates={coords}")
    return tags


def gps_remove_tags(video: bool = False) -> list[str]:
    """Build ExifTool arguments to delete all GPS information."""
    tags = ["-GPS:all="]
    if video:
        tags.append("-GPSCoordinates=")
    return tags


def capture_date_tags(exif_datetime: str) -> list[str]:
    """Set the capture (taken) date: DateTimeOriginal + CreateDate."""
    return [
        f"-DateTimeOriginal={exif_datetime}",
        f"-CreateDate={exif_datetime}",
    ]


def modify_date_tags(exif_datetime: str) -> list[str]:
    """Set the edit/modification date stored in metadata."""
    return [f"-ModifyDate={exif_datetime}"]


def all_dates_tags(exif_datetime: str) -> list[str]:
    """Set DateTimeOriginal, CreateDate and ModifyDate at once."""
    return [f"-AllDates={exif_datetime}"]


def shift_tags(operator: str, shift: str) -> list[str]:
    """Shift all dates forward or backward (e.g. timezone fixes)."""
    return [f"-AllDates{operator}{shift}"]


def sync_file_date_tags() -> list[str]:
    """Make the filesystem modification date match the capture date."""
    return ["-FileModifyDate<DateTimeOriginal"]
