# exif-kit

A friendly command-line toolkit for photographers and filmmakers to **inspect and edit photo/video metadata** — EXIF, GPS location, capture dates and more.

Works with JPEG, PNG, TIFF, HEIC, all major RAW formats (CR2/CR3, NEF, ARW, DNG, RAF, ORF...) and video containers (MP4, MOV, AVI...), powered by the battle-tested [ExifTool](https://exiftool.org).

```
$ exifkit show IMG_4021.CR3
┌────────────────────────────┬─────────────────────────┐
│ File                       │ IMG_4021.CR3            │
│ Camera                     │ Canon EOS R6            │
│ Lens                       │ RF 35mm F1.8            │
│ ISO                        │ 400                     │
│ Aperture                   │ f/2.8                   │
│ Shutter                    │ 1/250s                  │
│ Taken (DateTimeOriginal)   │ 2024:06:01 14:30:00     │
│ GPS                        │ -23.550500, -46.633300  │
└────────────────────────────┴─────────────────────────┘
```

## Features

- 📷 **Inspect** — clean, curated summary of what matters (camera, exposure, dates, GPS), or every tag with `--all`
- 📍 **GPS editing** — set location by pasting coordinates straight from Google/Apple Maps; remove GPS for privacy
- 🕑 **Date editing** — fix capture dates, modification dates, or **shift all dates** to fix a wrong camera clock/timezone
- 📋 **Copy metadata** between files (e.g. restore metadata after an export stripped it)
- 🧹 **Strip everything** for privacy-safe sharing
- 🧭 **Interactive mode** — just run `exifkit` and follow the menus; zero flags to memorize
- 🛟 **Safe by default** — every edit keeps a backup of the original file unless you pass `--no-backup`

## Installation

exif-kit needs two things: [ExifTool](https://exiftool.org) (the metadata engine) and Python 3.10+.

```bash
# 1. Install ExifTool
brew install exiftool            # macOS
sudo apt install libimage-exiftool-perl   # Debian/Ubuntu

# 2. Install exif-kit (pipx recommended — keeps it isolated)
pipx install git+https://github.com/daviarndt/exif-kit.git

# ...or with plain pip
pip install git+https://github.com/daviarndt/exif-kit.git
```

Verify everything is ready:

```bash
exifkit doctor
```

## Usage

### Interactive mode (easiest)

Just run it bare and follow the menus:

```bash
exifkit
```

### Direct commands

```bash
# Inspect metadata (curated summary)
exifkit show photo.jpg
exifkit show *.CR3                  # globs work
exifkit show ~/Photos/trip -r       # whole folders, recursively
exifkit show photo.jpg --all        # every tag
exifkit show photo.jpg --json       # machine-readable

# Set GPS location — paste coordinates straight from a maps app
exifkit gps photo.jpg --coords "-23.5505, -46.6333"
exifkit gps *.jpg --lat -23.5505 --lon -46.6333 --alt 760
exifkit gps clip.mp4 --coords "48.8566, 2.3522"   # videos too
exifkit gps photo.jpg --remove       # delete GPS data

# Edit dates
exifkit date photo.jpg --taken "2024-06-01 14:30"    # capture date
exifkit date photo.jpg --modified "2024-06-02 10:00" # edit date
exifkit date *.NEF --all "2024-06-01 14:30"          # all dates at once
exifkit date *.jpg --shift "+2h"                     # camera clock was 2h behind
exifkit date *.jpg --shift "-1d 30m"                 # shift back 1 day 30 min
exifkit date photo.jpg --taken "2024-06-01" --sync-file  # also sync file mtime

# Copy all metadata from one file to another
exifkit copy original.CR3 exported.jpg

# Strip ALL metadata (privacy)
exifkit strip photo.jpg
```

### Backups

Every write keeps the untouched original next to the edited file with an `_original` suffix (e.g. `photo.jpg_original`). Once you're happy with an edit, delete the backups — or skip them entirely with `--no-backup`.

## Supported formats

| Type   | Formats |
|--------|---------|
| Images | JPEG, PNG, TIFF, HEIC/HEIF, WebP |
| RAW    | DNG, CR2, CR3 (Canon), NEF/NRW (Nikon), ARW (Sony), RAF (Fujifilm), ORF (Olympus), RW2 (Panasonic), PEF (Pentax), and more |
| Video  | MP4, MOV, M4V, AVI, MKV, MTS/M2TS |

Anything ExifTool understands can be read; write support follows ExifTool's [supported formats](https://exiftool.org/#supported).

## Development

```bash
git clone https://github.com/daviarndt/exif-kit.git
cd exif-kit
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
pytest
```

See [HANDOVER.md](HANDOVER.md) for architecture notes and the project work plan.

## License

[MIT](LICENSE)
