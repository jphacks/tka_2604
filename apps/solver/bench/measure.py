"""各ケースを /solve へ送り、時間・status・hard違反・soft達成・判定の不一致を記録する。

SOLVER_API_TOKEN=local uv --directory apps/solver run python bench/measure.py \
    --url http://127.0.0.1:8000 --repeat 5 --out bench/results/local.jsonl

時間はBEから見た往復（HTTP含む）。初解までの時間はAPIの返却に含まれないため測らない。
"""

import argparse
import json
import os
import statistics
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from evaluate import evaluate
from generate import CASE_NAMES, CASES_DIR


def solve(url: str, token: str, payload: dict, timeout: float) -> tuple[int, dict]:
    request = urllib.request.Request(
        f"{url.rstrip('/')}/solve",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as error:
        return error.code, json.loads(error.read() or b"{}")


def measure_case(name: str, request: dict, expected: dict, status_code: int, body: dict, seconds: float) -> dict:
    record = {"case": name, "httpStatus": status_code, "seconds": round(seconds, 3)}
    if status_code != 200:
        record.update(status=None, ok=False, problems=[f"HTTP {status_code}: {body.get('error')}"])
        return record
    report = evaluate(request, body)
    problems = [*report.integrity_errors, *report.mismatches]
    if body.get("status") not in expected["allowedStatuses"]:
        problems.append(f"status {body.get('status')} は想定外（許容: {expected['allowedStatuses']}）")
    problems += [f"hard違反: {cid}" for cid in report.hard_violations]
    record.update(
        status=body.get("status"),
        unassigned=len(body.get("unassignedBandIds") or []),
        hardViolations=len(report.hard_violations),
        softMet=report.soft_met,
        softTotal=report.soft_total,
        ok=not problems,
        problems=problems,
    )
    return record


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--url", default=os.environ.get("SOLVER_URL", "http://127.0.0.1:8000"))
    parser.add_argument("--case", action="append", choices=CASE_NAMES, help="省略時は全ケース")
    parser.add_argument("--repeat", type=int, default=1)
    parser.add_argument("--timeout", type=float, default=330, help="Vercelの上限300秒より長く待つ")
    parser.add_argument("--label", default="", help="local / vercel など実行先の区別")
    parser.add_argument("--out", type=Path, help="結果をJSON Linesで追記する")
    args = parser.parse_args()
    token = os.environ.get("SOLVER_API_TOKEN", "")

    commit = subprocess.run(
        ["git", "rev-parse", "--short", "HEAD"], capture_output=True, text=True, check=False
    ).stdout.strip()
    meta = {"label": args.label, "url": args.url, "commit": commit,
            "at": datetime.now(timezone.utc).isoformat(timespec="seconds")}

    records = []
    for name in args.case or CASE_NAMES:
        request = json.loads((CASES_DIR / f"{name}.request.json").read_text())
        expected = json.loads((CASES_DIR / f"{name}.expected.json").read_text())
        for run in range(args.repeat):
            started = time.perf_counter()
            try:
                code, body = solve(args.url, token, request, args.timeout)
            except (urllib.error.URLError, TimeoutError) as error:
                code, body = 0, {"error": str(error)}
            record = {**meta, "run": run + 1,
                      **measure_case(name, request, expected, code, body, time.perf_counter() - started)}
            records.append(record)
            print(json.dumps(record, ensure_ascii=False), file=sys.stderr)

    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        with args.out.open("a") as f:
            f.writelines(json.dumps(r, ensure_ascii=False) + "\n" for r in records)

    print("| ケース | 回数 | status | 秒 p50 | 秒 最大 | hard違反 | soft達成 | 問題 |")
    print("| --- | --- | --- | --- | --- | --- | --- | --- |")
    for name in args.case or CASE_NAMES:
        rs = [r for r in records if r["case"] == name]
        secs = [r["seconds"] for r in rs]
        statuses = ",".join(sorted({str(r["status"]) for r in rs}))
        soft = ",".join(sorted({f"{r['softMet']}/{r['softTotal']}" for r in rs if "softMet" in r})) or "-"
        hard = max((r.get("hardViolations", 0) for r in rs), default=0)
        bad = sum(not r["ok"] for r in rs)
        print(f"| {name} | {len(rs)} | {statuses} | {statistics.median(secs):.2f} | {max(secs):.2f} "
              f"| {hard} | {soft} | {bad} |")
    return 0 if all(r["ok"] for r in records) else 1


if __name__ == "__main__":
    sys.exit(main())
