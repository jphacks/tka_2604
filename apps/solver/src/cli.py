"""Run the Solver with local JSON files until the HTTP adapter is connected."""

import argparse
import sys
from pathlib import Path

from pydantic import ValidationError

from solver import solve_request
from solver_input import load_request
from solver_output import ErrorDetail, ErrorPayload, ErrorResponse, write_response

LOCAL_DATA_DIR = Path(__file__).resolve().parents[1] / "local-data"


def main() -> int:
    parser = argparse.ArgumentParser(description="出演順を計算してJSONに保存します")
    parser.add_argument(
        "--input", type=Path, default=LOCAL_DATA_DIR / "solver_request.json"
    )
    parser.add_argument(
        "--output", type=Path, default=LOCAL_DATA_DIR / "solver_result.json"
    )
    args = parser.parse_args()
    if args.input.resolve() == args.output.resolve():
        parser.error("入力ファイルと出力ファイルは別にしてください")

    try:
        request = load_request(args.input)
        response = solve_request(request)
    except ValidationError as exc:
        details = [
            ErrorDetail(
                path="/" + "/".join(str(part) for part in error["loc"]),
                reason=error["msg"],
            )
            for error in exc.errors(include_url=False)
        ]
        response = ErrorResponse(
            error=ErrorPayload(
                code="invalid_input", message="入力データが不正です。", details=details
            )
        )
        exit_code = 2
    except Exception as exc:
        response = ErrorResponse(
            error=ErrorPayload(
                code="solver_internal_error",
                message="出演順の計算に失敗しました。",
                details=[],
            )
        )
        print(f"Solver error: {exc}", file=sys.stderr)
        exit_code = 1
    else:
        exit_code = 0

    write_response(args.output, response)
    print(f"結果を出力しました: {args.output}")
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
