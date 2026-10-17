import os
import secrets
import time
from typing import Annotated

import ortools
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from ortools.sat.python import cp_model

from solver import solve_request
from solver_input import SolveRequest
from solver_output import ErrorDetail, ErrorResponse, SolveResponse

# FastAPI entry point for health, deployment probe, and scheduling requests.
app = FastAPI(title="Setlist Solver")

PROBE_BANDS = ["A", "B", "C"]


def _validation_error(errors: list[dict[str, object]]) -> ErrorResponse:
    details = []
    for error in errors:
        location = [str(item) for item in error.get("loc", [])]
        if location and location[0] == "body":
            location = location[1:]
        details.append(
            ErrorDetail(
                path=".".join(location),
                reason=str(error.get("msg", "入力が不正です")),
            )
        )
    return ErrorResponse(
        error={
            "code": "invalid_input",
            "message": "リクエストの入力が不正です",
            "details": details,
        }
    )


@app.exception_handler(RequestValidationError)
async def handle_request_validation_error(
    _request: Request, exc: RequestValidationError
) -> JSONResponse:
    return JSONResponse(status_code=422, content=_validation_error(exc.errors()).model_dump())


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


@app.post("/solve", response_model=SolveResponse)
def solve(
    request: SolveRequest,
    authorization: Annotated[str | None, Header()] = None,
) -> SolveResponse | JSONResponse:
    """Validate a scheduling request, run CP-SAT, and return its result."""
    require_token(authorization)
    try:
        return solve_request(request)
    except Exception:
        return JSONResponse(
            status_code=500,
            content=ErrorResponse(
                error={
                    "code": "solver_internal_error",
                    "message": "ソルバー内部でエラーが発生しました",
                    "details": [],
                }
            ).model_dump(),
        )
