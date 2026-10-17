"""名簿CSVを /solve のリクエストJSON（制約なし）に変換する。

uv --directory apps/solver run python bench/csv_to_request.py bench/data/roster_38.csv \
    --parts 2 --current > roster_38.request.json

CSVは「曲名,メンバー1,…,メンバー7」の形式（1行目は見出し、1行1バンド）。
- バンドIDは行順に band-01…、メンバーIDは初出順に member-001… を振る。
- 同じ名前は同じ人として扱う（CSVでは同名の別人を区別できない）。空欄・前後の空白は無視する。
- 部はpart-1…で、--currentならCSVの行順に各部へ詰めた配置を currentPlacements に入れる。
名前はリクエストに含めない。制約は空配列で、必要なら別途追加する。
"""

import argparse
import csv
import json
import sys
from dataclasses import dataclass
from pathlib import Path


@dataclass
class Roster:
    band_names: dict[str, str]  # band_id -> 曲名
    member_names: dict[str, str]  # member_id -> 名前
    members_of: dict[str, list[str]]  # band_id -> member_ids（CSVの並び順）

    @property
    def bands_of(self) -> dict[str, list[str]]:
        result: dict[str, list[str]] = {m: [] for m in self.member_names}
        for band, members in self.members_of.items():
            for m in members:
                result[m].append(band)
        return result


def load_roster(path: Path) -> Roster:
    band_names: dict[str, str] = {}
    member_ids: dict[str, str] = {}
    members_of: dict[str, list[str]] = {}
    with path.open(newline="", encoding="utf-8-sig") as f:
        rows = [row for row in list(csv.reader(f))[1:] if row and row[0].strip()]
    for i, row in enumerate(rows, start=1):
        band = f"band-{i:02d}"
        band_names[band] = row[0].strip()
        members_of[band] = []
        for name in filter(None, (cell.strip() for cell in row[1:])):
            member = member_ids.setdefault(name, f"member-{len(member_ids) + 1:03d}")
            if member not in members_of[band]:
                members_of[band].append(member)
    return Roster(band_names, {v: k for k, v in member_ids.items()}, members_of)


def split_evenly(total: int, parts: int) -> list[int]:
    """totalをparts個に分ける。割り切れない分は前の部から1つずつ多くする。"""
    return [total // parts + (1 if i < total % parts else 0) for i in range(parts)]


def roster_request(
    roster: Roster, *, event_id: str, parts: int, current: list[int] | None = None
) -> dict:
    """名簿からリクエストを作る。currentを渡すと、行順に各部へその組数ずつ配置する。"""
    part_ids = [f"part-{i + 1}" for i in range(parts)]
    placements = []
    if current is not None:
        bands = iter(roster.band_names)
        for part_id, count in zip(part_ids, current):
            placements += [
                {"bandId": band, "partId": part_id, "order": order}
                for order, band in zip(range(count), bands)
            ]
    return {
        "eventId": event_id,
        "parts": [{"partId": p, "sortOrder": i} for i, p in enumerate(part_ids)],
        "bands": [{"bandId": band} for band in roster.band_names],
        "members": [{"memberId": m} for m in roster.member_names],
        "memberships": [
            {"bandId": band, "memberId": m}
            for band, members in roster.members_of.items()
            for m in members
        ],
        "constraints": [],
        "currentPlacements": placements,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("csv", type=Path)
    parser.add_argument("--event-id", default="live-event-01")
    parser.add_argument("--parts", type=int, default=1, help="部の数")
    parser.add_argument("--current", action="store_true", help="行順の配置をcurrentPlacementsに入れる")
    args = parser.parse_args()
    if args.parts < 1:
        parser.error("--partsは1以上")

    roster = load_roster(args.csv)
    current = split_evenly(len(roster.band_names), args.parts) if args.current else None
    request = roster_request(roster, event_id=args.event_id, parts=args.parts, current=current)
    json.dump(request, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
