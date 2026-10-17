from csv_to_request import load_roster, roster_request, split_evenly
from evaluate import evaluate
from generate import DATA_DIR


def write_csv(tmp_path, text):
    path = tmp_path / "roster.csv"
    path.write_text(text, encoding="utf-8")
    return path


def test_same_name_is_same_member_and_blank_cells_are_ignored(tmp_path) -> None:
    path = write_csv(
        tmp_path,
        "曲名,メンバー1,メンバー2,メンバー3\n"
        "曲A,佐藤, 田中 ,\n"
        "曲B,田中,,\n"
        "ソロ,鈴木,,\n",
    )

    request = roster_request(load_roster(path), event_id="e", parts=1)

    assert request["bands"] == [{"bandId": "band-01"}, {"bandId": "band-02"}, {"bandId": "band-03"}]
    assert request["members"] == [{"memberId": f"member-00{i}"} for i in (1, 2, 3)]
    assert request["memberships"] == [
        {"bandId": "band-01", "memberId": "member-001"},
        {"bandId": "band-01", "memberId": "member-002"},
        {"bandId": "band-02", "memberId": "member-002"},
        {"bandId": "band-03", "memberId": "member-003"},
    ]
    assert request["constraints"] == [] and request["currentPlacements"] == []


def test_split_evenly() -> None:
    assert split_evenly(38, 2) == [19, 19]
    assert split_evenly(38, 3) == [13, 13, 12]


def test_roster_38_matches_solver_dev_input() -> None:
    """ソルバー開発で使っている変換（2部・行順に19組ずつ配置）と同じ中身になる。"""
    roster = load_roster(DATA_DIR / "roster_38.csv")

    request = roster_request(roster, event_id="live-event-01", parts=2, current=[19, 19])

    assert len(request["bands"]) == 38
    assert len(request["members"]) == 83
    assert len(request["memberships"]) == 201
    # IDはダミー番号と1対1（ダミー001 → member-001）。
    assert all(roster.member_names[m] == f"ダミー{m[-3:]}" for m in roster.member_names)
    current = request["currentPlacements"]
    assert current[18] == {"bandId": "band-19", "partId": "part-1", "order": 18}
    assert current[19] == {"bandId": "band-20", "partId": "part-2", "order": 0}
    placed = {"status": "feasible", "placements": current, "unassignedBandIds": []}
    assert evaluate(request, placed).integrity_errors == []
