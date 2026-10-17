"""Solverの返却を入力と突き合わせ、整合性と制約ごとの判定を独立に確かめる。

計測と回帰確認の基準で、Solver本体の評価（#25）とは別に保つ。判定は
docs/schema.mdとBE - Solver API設計に従う。
- 全体位置は部順に、実際に配置したバンドを連結した順番（0始まり）。
- 未配置の対象を含み結果が決まらない条件はunchecked。配置済みだけで違反が
  確定するならhardはviolated、softはunmetとする。
"""

from dataclasses import dataclass, field
from itertools import combinations

PLACED_STATUSES = {"optimal", "feasible", "partial"}
EMPTY_STATUSES = {"infeasible", "unknown"}


@dataclass
class Report:
    integrity_errors: list[str] = field(default_factory=list)
    # met / unmet / violated / disabled / unchecked
    results: dict[str, str] = field(default_factory=dict)
    mismatches: list[str] = field(default_factory=list)
    soft_met: int = 0
    soft_total: int = 0

    @property
    def hard_violations(self) -> list[str]:
        return [k for k, v in self.results.items() if v == "violated"]


def evaluate(request: dict, response: dict) -> Report:
    report = Report()
    status = response.get("status")
    soft = [c for c in request["constraints"] if c["enabled"] and c["hardness"] == "soft"]
    report.soft_total = len(soft)

    if status in EMPTY_STATUSES:
        for key in ("placements", "unassignedBandIds", "constraintResults"):
            if response.get(key) is not None:
                report.integrity_errors.append(f"{status}では{key}をnullにする")
        return report
    if status not in PLACED_STATUSES:
        report.integrity_errors.append(f"未知のstatus: {status}")
        return report

    positions, part_of = _check_placements(request, response, report)
    if report.integrity_errors:
        return report

    bands_of_member: dict[str, list[str]] = {}
    for m in request["memberships"]:
        bands_of_member.setdefault(m["memberId"], []).append(m["bandId"])

    for c in request["constraints"]:
        cid = c["constraint_id"]
        if not c["enabled"]:
            report.results[cid] = "disabled"
            continue
        satisfied = _judge(c, positions, part_of, bands_of_member, request)
        if satisfied is None:
            report.results[cid] = "unchecked"
        elif satisfied:
            report.results[cid] = "met"
        else:
            report.results[cid] = "violated" if c["hardness"] == "hard" else "unmet"
    report.soft_met = sum(report.results[c["constraint_id"]] == "met" for c in soft)

    returned = response.get("constraintResults")
    if returned is not None:
        got = {r["constraintId"]: r["status"] for r in returned}
        for cid, expected in report.results.items():
            if got.get(cid) != expected:
                report.mismatches.append(f"{cid}: solver={got.get(cid)}, expected={expected}")
        for cid in got.keys() - report.results.keys():
            report.mismatches.append(f"{cid}: 入力にない制約")
    return report


def _check_placements(request: dict, response: dict, report: Report):
    errors = report.integrity_errors
    status = response["status"]
    placements = response.get("placements") or []
    unassigned = response.get("unassignedBandIds")
    if unassigned is None:
        errors.append("配置を返す場合はunassignedBandIdsを配列にする")
        unassigned = []
    if status in {"optimal", "feasible"} and unassigned:
        errors.append(f"{status}では全バンドを配置する")
    if status == "partial" and (not placements or not unassigned):
        errors.append("partialでは配置と未配置を1件以上ずつ返す")

    parts = sorted(request["parts"], key=lambda p: p["sortOrder"])
    part_index = {p["partId"]: i for i, p in enumerate(parts)}
    band_ids = [b["bandId"] for b in request["bands"]]
    seen = [p["bandId"] for p in placements] + list(unassigned)
    for band in sorted(set(band_ids) | set(seen)):
        n = seen.count(band)
        if band not in band_ids:
            errors.append(f"{band}: 入力にないバンド")
        elif n != 1:
            errors.append(f"{band}: {n}回含まれる（配置と未配置で1回ずつにする）")

    orders: dict[str, list[int]] = {}
    for p in placements:
        if p["partId"] not in part_index:
            errors.append(f"{p['partId']}: 入力にない部")
        orders.setdefault(p["partId"], []).append(p["order"])
    for part_id, values in orders.items():
        if sorted(values) != list(range(len(values))):
            errors.append(f"{part_id}: orderは0からの連番にする（{sorted(values)}）")
    if errors:
        return {}, {}

    ordered = sorted(placements, key=lambda p: (part_index[p["partId"]], p["order"]))
    positions = {p["bandId"]: i for i, p in enumerate(ordered)}
    part_of = {p["bandId"]: part_index[p["partId"]] for p in placements}
    return positions, part_of


def _judge(c, positions, part_of, bands_of_member, request) -> bool | None:
    """満たすならTrue、違反が確定したらFalse、未配置のため決まらなければNone。"""
    t, p = c["targets"], c["params"]
    kind = c["type"]
    if kind in {"min_gap_member", "min_gap_bands"}:
        bands = bands_of_member.get(t["member_id"], []) if kind == "min_gap_member" else t["band_ids"]
        placed = [b for b in bands if b in positions]
        for a, b in combinations(placed, 2):
            if p["same_part_only"] and part_of[a] != part_of[b]:
                continue
            if abs(positions[a] - positions[b]) < p["min_diff"]:
                return False
        return True if len(placed) == len(bands) else None
    if kind == "before":
        a, b = t["before_band_id"], t["after_band_id"]
        if a not in positions or b not in positions:
            return None
        return positions[a] < positions[b]
    if kind == "at_position":
        band = t["band_id"]
        return None if band not in positions else positions[band] == p["position"]
    if kind == "in_range":
        if p["kind"] == "positions":
            inside = lambda b: p["position_from"] <= positions[b] <= p["position_to"]  # noqa: E731
        else:
            inside = lambda b: part_of[b] in p["part_ids"]  # noqa: E731
        placed = [b for b in t["band_ids"] if b in positions]
        if not all(inside(b) for b in placed):
            return False
        return True if len(placed) == len(t["band_ids"]) else None
    if kind == "count":
        targets = t["band_ids"]
        complete = all(b in positions for b in targets)
        if p["scope"] == "per_part":
            groups = [[i] for i in range(len(request["parts"]))]
        else:
            groups = [p["part_ids"]]
        for group in groups:
            n = sum(1 for b in targets if b in positions and part_of[b] in group)
            if n > p["max"] or (complete and n < p["min"]):
                return False
        return True if complete else None
    raise ValueError(f"未知のtype: {kind}")
