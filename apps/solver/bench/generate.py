"""data/の名簿CSVから計測用の入力ケースを固定seedで生成し、cases/に書き出す。

uv --directory apps/solver run python bench/generate.py

名簿の読み込みとIDの振り方はcsv_to_request.pyと共通。

各ケースは「先に正解の並び（参照配置）を作り、hard制約はそれが満たすものだけを
追加する」方法で作る。そのため、全配置できるケースではhardを満たす解が必ず存在する。
"""

import json
import random
from pathlib import Path

from csv_to_request import Roster, load_roster, roster_request
from evaluate import evaluate

BENCH_DIR = Path(__file__).parent
DATA_DIR = BENCH_DIR / "data"
CASES_DIR = BENCH_DIR / "cases"
CASE_NAMES = ["demo", "standard", "soft_conflict", "hard_conflict", "heavy"]


def build_cases() -> dict[str, dict]:
    demo = load_roster(DATA_DIR / "demo_20.csv")
    real = load_roster(DATA_DIR / "roster_38.csv")
    return {
        # デモ用。20組・2部（10/10）。
        "demo": _case("demo", demo, seed=20, capacities=[10, 10]),
        # 38組・3部（13/13/12）。実際のライブに近い掛け持ちの基準ケース。
        "standard": _case("standard", real, seed=34, capacities=[13, 13, 12]),
        # 両立しないsoftを含む。解は返り、少なくとも一方が未達成になる。
        "soft_conflict": _case(
            "soft_conflict", real, seed=34, capacities=[13, 13, 12], soft_conflict=True
        ),
        # 同じ位置を要求するhard制約が衝突し、全配置できない。
        "hard_conflict": _case(
            "hard_conflict", real, seed=34, capacities=[12, 12, 12]
        ),
        # 掛け持ち全員に2組以上の間隔を求める。探索未完了になりうる重いケース。
        "heavy": _case("heavy", real, seed=7, capacities=[13, 13, 12], member_gap=3),
    }


def _case(
    name: str,
    roster: Roster,
    *,
    seed: int,
    capacities: list[int],
    member_gap: int = 2,
    soft_conflict: bool = False,
) -> dict:
    rng = random.Random(seed)
    event_id = f"bench-{name}"
    bands = list(roster.band_names)
    label = roster.band_names.get
    order = _planted_order(rng, bands, roster.bands_of, member_gap)

    parts = [f"part-{i + 1}" for i in range(len(capacities))]
    placed_count = min(sum(capacities), len(bands))
    placed, unassigned = order[:placed_count], order[placed_count:]
    part_of = {
        band: i for i, cap in enumerate(capacities) for band in placed[sum(capacities[:i]) :][:cap]
    }

    builder = _Constraints(event_id)
    for member, member_bands in sorted(roster.bands_of.items()):
        if len(member_bands) >= 2:
            builder.add(
                f"c-gap-{member}", "min_gap_member", "hard", {"member_id": member},
                {"min_diff": member_gap, "same_part_only": False},
                f"{roster.member_names[member]}さんの出演の間は{member_gap - 1}組以上空ける",
            )

    first, last3 = placed[0], placed[-3:]
    a, b = sorted(rng.sample(placed[1:-3], 2), key=placed.index)
    late = rng.choice([band for band in placed[1:-3] if part_of[band] > 0])
    late_parts = list(range(part_of[late], len(parts)))
    builder.add(
        "c-opener", "at_position", "hard", {"band_id": first}, {"position": 0},
        f"トップバッターは{label(first)}",
    )
    builder.add(
        "c-gear", "before", "hard", {"before_band_id": a, "after_band_id": b}, {},
        f"機材の受け渡しのため{label(a)}は{label(b)}より前",
    )
    builder.add(
        "c-late", "in_range", "hard", {"band_ids": [late]},
        {"kind": "parts", "part_ids": late_parts},
        f"{label(late)}はメンバーが遅れて到着するので第{late_parts[0] + 1}部以降",
    )
    builder.add(
        "c-finale", "in_range", "hard", {"band_ids": last3},
        {"kind": "positions", "position_from": placed_count - 3, "position_to": placed_count - 1},
        f"{'・'.join(label(x) for x in last3)}は最後の3枠",
    )
    if name == "hard_conflict":
        conflict_a, conflict_b = unassigned
        builder.add(
            "c-conflict-a", "at_position", "hard", {"band_id": conflict_a},
            {"position": 0}, f"{label(conflict_a)}をトップにする",
        )
        builder.add(
            "c-conflict-b", "at_position", "hard", {"band_id": conflict_b},
            {"position": 0}, f"{label(conflict_b)}をトップにする",
        )

    # softは参照配置で満たすとは限らない。達成状況は参照配置での判定として記録する。
    busiest = sorted(roster.bands_of, key=lambda m: (-len(roster.bands_of[m]), m))[:3]
    for priority, member in zip(["high", "mid", "low"], busiest):
        builder.add(
            f"c-rest-{member}", "min_gap_member", "soft", {"member_id": member},
            {"min_diff": member_gap + 2, "same_part_only": False},
            f"{roster.member_names[member]}さんは掛け持ちが多いので{member_gap + 1}組以上空けたい",
            priority,
        )
    genre = rng.sample(bands, 3)
    builder.add(
        "c-genre", "min_gap_bands", "soft", {"band_ids": genre},
        {"min_diff": 4, "same_part_only": True},
        f"雰囲気の近い{'・'.join(label(x) for x in genre)}は部内で離したい", "mid",
    )
    x, y = rng.sample(bands, 2)
    builder.add(
        "c-friend", "before", "soft", {"before_band_id": x, "after_band_id": y}, {},
        f"{label(x)}を見てから{label(y)}の準備に入りたい", "low",
    )
    builder.add(
        "c-old", "at_position", "soft", {"band_id": y}, {"position": 0},
        f"{label(y)}をトップにしたい（取り下げ済み）", "low", enabled=False,
    )
    if soft_conflict:
        p, q = rng.sample(bands, 2)
        builder.add(
            "c-conflict-1", "before", "soft", {"before_band_id": p, "after_band_id": q}, {},
            f"{label(p)}は{label(q)}より前がいい", "high",
        )
        builder.add(
            "c-conflict-2", "before", "soft", {"before_band_id": q, "after_band_id": p}, {},
            f"{label(q)}は{label(p)}より前がいい", "mid",
        )

    request = roster_request(roster, event_id=event_id, parts=len(parts))
    request["constraints"] = builder.items
    orders = [0] * len(parts)
    placements = []
    for band in placed:
        placements.append({"bandId": band, "partId": parts[part_of[band]], "order": orders[part_of[band]]})
        orders[part_of[band]] += 1
    reference = {
        "eventId": event_id,
        "status": "partial" if unassigned else "feasible",
        "placements": placements,
        "unassignedBandIds": unassigned,
    }
    report = evaluate(request, reference)
    assert not report.integrity_errors and not report.hard_violations, (name, report)

    if unassigned:
        allowed = ["partial", "infeasible"]
    elif name == "heavy":
        allowed = ["optimal", "feasible", "unknown"]
    else:
        allowed = ["optimal", "feasible"]
    return {
        "request": request,
        "expected": {
            "allowedStatuses": allowed,
            "reference": reference,
            "referenceResults": report.results,
        },
    }


def _planted_order(rng: random.Random, bands, bands_of, gap: int) -> list[str]:
    """掛け持ちメンバーの出演がgap未満にならない並びを、乱択の貪欲法で探す。"""
    members_of = {band: [m for m, v in bands_of.items() if band in v] for band in bands}
    load = {band: sum(len(bands_of[m]) for m in members_of[band]) for band in bands}
    for _ in range(10_000):
        order: list[str] = []
        last_seen: dict[str, int] = {}
        remaining = list(bands)
        while remaining:
            i = len(order)
            ok = [
                band for band in remaining
                if all(i - last_seen.get(m, -gap) >= gap for m in members_of[band])
            ]
            if not ok:
                break
            # 掛け持ちの多いバンドを優先すると行き詰まりにくい。
            band = max(ok, key=lambda bd: load[bd] * rng.random())
            order.append(band)
            remaining.remove(band)
            for m in members_of[band]:
                last_seen[m] = i
        if not remaining:
            return order
    raise RuntimeError("参照配置が見つからない。member_gapを見直す")


class _Constraints:
    def __init__(self, event_id: str) -> None:
        self.event_id = event_id
        self.items: list[dict] = []

    def add(self, cid, type_, hardness, targets, params, source_text, priority=None, enabled=True):
        self.items.append({
            "schema_version": "1.0.0",
            "constraint_id": cid,
            "event_id": self.event_id,
            "source_text": source_text,
            "type": type_,
            "hardness": hardness,
            "priority": priority if hardness == "soft" else None,
            "enabled": enabled,
            "targets": targets,
            "params": params,
        })


def main() -> None:
    CASES_DIR.mkdir(exist_ok=True)
    for old in CASES_DIR.glob("*.json"):
        old.unlink()
    for name, case in build_cases().items():
        for kind in ("request", "expected"):
            path = CASES_DIR / f"{name}.{kind}.json"
            path.write_text(json.dumps(case[kind], ensure_ascii=False, indent=2) + "\n")
            print(f"wrote {path.relative_to(BENCH_DIR.parent)}")


if __name__ == "__main__":
    main()
