from __future__ import annotations

import hashlib
import json
import re
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
SOURCE_XLSX = ROOT / "AI Glossary - Dataset.xlsx"
DATA_DIR = ROOT / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
ALIASES_PATH = DATA_DIR / "aliases.json"

AR_SHEET = "English - Arabic"
FR_SHEET = "English - French"


@dataclass
class GlossaryEntry:
    english_term: str
    english_def: str | None
    arabic_term: str | None
    arabic_def: str | None
    french_term: str | None
    french_def: str | None
    aliases: list[str]
    sources: list[str]


def clean_text(value: Any) -> str | None:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    text = str(value).strip()
    if not text:
        return None
    # Normalize whitespace for consistent diffs and hashing
    return " ".join(text.split())


def read_sheet(path: Path, sheet_name: str, column_map: dict[str, str]) -> pd.DataFrame:
    df = pd.read_excel(path, sheet_name=sheet_name)
    df = df.rename(columns=column_map)
    for col in column_map.values():
        if col in df.columns:
            df[col] = df[col].apply(clean_text)
    # Drop rows without an English term
    df = df[df["english_term"].notna()]
    return df


def load_aliases() -> dict[str, list[str]]:
    if not ALIASES_PATH.exists():
        return {}

    raw = json.loads(ALIASES_PATH.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise ValueError("aliases.json must be a JSON object of term -> aliases[]")

    aliases: dict[str, list[str]] = {}
    for key, value in raw.items():
        term = clean_text(key)
        if not term:
            continue
        if isinstance(value, str):
            values = [value]
        elif isinstance(value, list):
            values = value
        else:
            continue

        cleaned: list[str] = []
        seen = set()
        for alias in values:
            alias_text = clean_text(alias)
            if not alias_text:
                continue
            alias_key = alias_text.lower()
            if alias_key in seen:
                continue
            cleaned.append(alias_text)
            seen.add(alias_key)

        if cleaned:
            aliases[term.lower()] = cleaned
    return aliases


# Patterns to catch trailing "Also called …" suffixes in EN / FR / AR.
# Each captures the quoted term name(s) so they can be added as aliases.
_ALSO_CALLED_PATTERNS = [
    # English: "Also called …" / "Also known as …"
    re.compile(
        r'\s*Also\s+(?:called|known\s+as)\s+["\u201c]?(.+?)["\u201d.]?\s*$',
        re.IGNORECASE,
    ),
    # French: "Également appelé(e) …" / "Aussi appelé(e) …" / "Egalement appelé(e) …"
    re.compile(
        r'\s*[EÉ]galement\s+appel[ée]e?\s+["\u201c«]?(.+?)["\u201d».]?\s*$',
        re.IGNORECASE,
    ),
    re.compile(
        r'\s*Aussi\s+appel[ée]e?\s+["\u201c«]?(.+?)["\u201d».]?\s*$',
        re.IGNORECASE,
    ),
    # French: "On l'appelle aussi …"
    re.compile(
        r"\s*On\s+l[\u2019']appelle\s+aussi\s+[\"\\u201c«]?(.+?)[\"\\u201d».]?\\s*$",
        re.IGNORECASE,
    ),
    # Arabic: "ويُطلق عليه/عليها أيضًا …" / "يُطلق عليه/عليها أيضًا …"
    re.compile(
        r'\s*[و]?[يُ]ُ?طلق\s+عليه[ا]?\s+أيضً?ا\s+(.+?)\s*$',
    ),
]

_SPLIT_TERMS_RE = re.compile(
    r'["\u201c\u201d«»]+|,\s*|\s+or\s+|\s+ou\s+|\s+أو\s+',
    re.IGNORECASE,
)


def strip_also_called(definition: str | None) -> tuple[str | None, list[str]]:
    """Remove a trailing 'Also called ...' clause (EN/FR/AR) and return (clean_def, extracted_aliases)."""
    if not definition:
        return definition, []

    for pattern in _ALSO_CALLED_PATTERNS:
        m = pattern.search(definition)
        if m:
            clean_def = definition[:m.start()].rstrip(' .,;\u060c')
            raw_aliases = _SPLIT_TERMS_RE.split(m.group(1))
            extracted = []
            for a in raw_aliases:
                a = a.strip(' "\u201c\u201d.()«»\u060c').strip()
                if a and len(a) > 1:
                    extracted.append(a)
            return (clean_def or None), extracted

    return definition, []


def merge_glossaries(
    ar_df: pd.DataFrame,
    fr_df: pd.DataFrame,
    aliases: dict[str, list[str]],
) -> list[GlossaryEntry]:
    merged = pd.merge(
        ar_df,
        fr_df,
        on=["english_term"],
        how="outer",
        suffixes=("_ar", "_fr"),
    )

    ar_terms = set(ar_df["english_term"].tolist())
    fr_terms = set(fr_df["english_term"].tolist())
    entries: list[GlossaryEntry] = []
    for _, row in merged.iterrows():
        english_term = row.get("english_term")
        english_def = row.get("english_def_ar") or row.get("english_def_fr")
        sources: list[str] = []
        if english_term in ar_terms:
            sources.append(AR_SHEET)
        if english_term in fr_terms:
            sources.append(FR_SHEET)

        # Strip "Also called …" suffixes → extract as aliases.
        en_def_clean, en_extra = strip_also_called(english_def)
        ar_def_clean, ar_extra = strip_also_called(row.get("arabic_def"))
        fr_def_clean, fr_extra = strip_also_called(row.get("french_def"))

        term_aliases = list(aliases.get(str(english_term).lower(), []))
        seen = {a.lower() for a in term_aliases}
        for extra in en_extra + ar_extra + fr_extra:
            if extra.lower() not in seen:
                term_aliases.append(extra)
                seen.add(extra.lower())

        entry = GlossaryEntry(
            english_term=english_term,
            english_def=en_def_clean,
            arabic_term=row.get("arabic_term"),
            arabic_def=ar_def_clean,
            french_term=row.get("french_term"),
            french_def=fr_def_clean,
            aliases=term_aliases,
            sources=sources or [],
        )
        entries.append(entry)
    return resolve_cross_references(entries)


def resolve_cross_references(entries: list[GlossaryEntry]) -> list[GlossaryEntry]:
    by_term = {e.english_term.lower(): e for e in entries}
    see_pattern = re.compile(r'^see\s+["\']?([^"\'.]+)[."\']*$', re.IGNORECASE)
    
    resolved_count = 0
    for entry in entries:
        if entry.english_def:
            match = see_pattern.match(entry.english_def.strip())
            if match:
                target_term = match.group(1).strip().lower()
                target_entry = by_term.get(target_term)
                
                if target_entry and target_entry.english_def and not see_pattern.match(target_entry.english_def):
                    entry.english_def = target_entry.english_def
                    entry.arabic_def = target_entry.arabic_def
                    entry.french_def = target_entry.french_def
                    
                    # Also append the target term as an alias since it's a cross-reference
                    if target_entry.english_term not in entry.aliases:
                        entry.aliases.append(target_entry.english_term)
                        
                    resolved_count += 1
    print(f"Resolved {resolved_count} cross-references.")
    return entries


def write_outputs(entries: list[GlossaryEntry]) -> None:
    data = [asdict(entry) for entry in entries]

    json_path = DATA_DIR / "glossary.json"
    csv_path = DATA_DIR / "glossary.csv"
    meta_path = DATA_DIR / "dataset_meta.json"

    json_text = json.dumps(data, ensure_ascii=False, indent=2)
    json_path.write_text(json_text, encoding="utf-8")

    pd.DataFrame(data).to_csv(csv_path, index=False, encoding="utf-8")

    dataset_hash = hashlib.sha256(json_text.encode("utf-8")).hexdigest()
    alias_count = sum(1 for entry in entries if entry.aliases)
    meta = {
        "dataset_hash": dataset_hash,
        "entry_count": len(entries),
        "aliases_with_entries": alias_count,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_xlsx": str(SOURCE_XLSX),
        "sheets": [AR_SHEET, FR_SHEET],
        "aliases_source": str(ALIASES_PATH) if ALIASES_PATH.exists() else None,
    }
    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> None:
    if not SOURCE_XLSX.exists():
        raise FileNotFoundError(f"Missing source file: {SOURCE_XLSX}")

    ar_df = read_sheet(
        SOURCE_XLSX,
        AR_SHEET,
        {
            "English Term": "english_term",
            "English Def.": "english_def",
            "Arabic Term": "arabic_term",
            "Arabic Def.": "arabic_def",
        },
    )
    fr_df = read_sheet(
        SOURCE_XLSX,
        FR_SHEET,
        {
            "English Term": "english_term",
            "English Def.": "english_def",
            "French Term": "french_term",
            "French Def.": "french_def",
        },
    )

    aliases = load_aliases()
    entries = merge_glossaries(ar_df, fr_df, aliases)
    write_outputs(entries)
    print(f"Wrote {len(entries)} entries to {DATA_DIR}")


if __name__ == "__main__":
    main()
