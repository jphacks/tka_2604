import os
import secrets
import time
from typing import Annotated

import ortools
from fastapi import FastAPI, Header, HTTPException
from ortools.sat.python import cp_model

# 実行先の疎通確認用。本番の計算APIの入出力は#20・#27で決める。
app = FastAPI(title="Setlist Solver")

PROBE_BANDS = ["A", "B", "C"]


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


def require_token(authorization: str | None) -> None:
    expected = os.environ.get("SOLVER_API_TOKEN")
    if not expected:
        raise HTTPException(status_code=503, detail="SOLVER_API_TOKEN is not set")
    if authorization is None or not secrets.compare_digest(
        authorization, f"Bearer {expected}"
    ):
        raise HTTPException(status_code=401, detail="invalid token")


@app.post("/probe")
def probe(
    authorization: Annotated[str | None, Header()] = None,
) -> dict[str, object]:
    """3バンドをAがCより前になるよう並べ、CP-SATが実行先で動くかを確かめる。"""
    require_token(authorization)

    model = cp_model.CpModel()
    n = len(PROBE_BANDS)
    position = {b: model.new_int_var(0, n - 1, b) for b in PROBE_BANDS}
    model.add_all_different(position.values())
    model.add(position["A"] < position["C"])
    model.minimize(position["A"])

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 5
    started = time.perf_counter()
    status = solver.solve(model)
    elapsed = time.perf_counter() - started

    order = sorted(PROBE_BANDS, key=lambda b: solver.value(position[b]))
    return {
        "status": solver.status_name(status),
        "order": order,
        "solve_seconds": round(elapsed, 4),
        "ortools_version": ortools.__version__,
    }
