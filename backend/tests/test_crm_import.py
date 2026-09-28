from app.services.crm_import import (
    ImportRow,
    build_row,
    normalize_channel_url,
    normalize_status,
    parse_ping,
    split_feedback,
)


def test_status_aliases_cover_every_spelling_from_the_sheet():
    assert normalize_status("ПРОДАЖА") == "sale"
    assert normalize_status("старая продажа") == "sale"
    assert normalize_status("ФОЛЛОУ АП") == "follow_up"
    assert normalize_status("ФОЛЛОУ АП НЕ СКОРО") == "follow_up"
    assert normalize_status("НЕ ОТВЕЧАЕТ") == "no_answer"
    assert normalize_status("НЕ АКТУАЛЕН") == "not_actual"
    assert normalize_status("НЕ АКТУАЛЬНО") == "not_actual"
    assert normalize_status("ПОКА НЕ АКТУАЛЬНО") == "not_actual"
    assert normalize_status("ПРОДАЖА ОТМЕНА") == "not_actual"
    assert normalize_status("Не релевант") == "irrelevant"
    assert normalize_status("НЕ Релевантно") == "irrelevant"
    assert normalize_status("НЕ РЕЛЕВАНТЕН") == "irrelevant"
    assert normalize_status("ДУПЛИКАТ") == "duplicate"
    assert normalize_status("Дубликат") == "duplicate"
    assert normalize_status("ФЕЙК") == "fake"


def test_status_ignores_case_spacing_and_trailing_comment():
    assert normalize_status("  продажа  ") == "sale"
    assert normalize_status("ФОЛЛОУ    АП") == "follow_up"
    # A status with a comment glued to it: the status is the first part.
    assert normalize_status("старая продажа///уже не платил") == "sale"


def test_unknown_status_stays_unset():
    assert normalize_status("") is None
    assert normalize_status(None) is None
    assert normalize_status("что-то новое") is None


def test_feedback_splits_into_entries_oldest_first():
    assert split_feedback("Выслал имейл") == ["Выслал имейл"]
    assert split_feedback("написал///молчит///закрываю") == [
        "написал",
        "молчит",
        "закрываю",
    ]
    assert split_feedback("  a  ///   ///  b ") == ["a", "b"]
    assert split_feedback("") == []
    assert split_feedback(None) == []


def test_ping_dates_are_converted_to_iso():
    assert parse_ping("31-7-2026") == "2026-07-31"
    assert parse_ping("2-8-2026") == "2026-08-02"
    assert parse_ping("1-9-2026") == "2026-09-01"


def test_unparseable_ping_is_dropped():
    assert parse_ping("") is None
    assert parse_ping("скоро") is None
    assert parse_ping("2026-07-31") is None  # already ISO: not the sheet format
    assert parse_ping("32-7-2026") is None


def test_channel_url_only_accepts_links():
    assert (
        normalize_channel_url("https://youtube.com/@boriscpt")
        == "https://youtube.com/@boriscpt"
    )
    assert normalize_channel_url("youtube.com/@boriscpt") is None
    assert normalize_channel_url("") is None


def test_build_row_maps_the_sheet_columns():
    row = build_row(
        {
            "Name": " Ирина Никитина ",
            "email": " Lead@Example.COM ",
            "Telegram": "@liansk",
            "СТАТУС": "ФОЛЛОУ АП",
            "ФИДБЕК": "написал///жду ответа",
            "Следующий ПИНГ": "31-7-2026",
            "": "https://youtube.com/@boriscpt",
        }
    )

    assert row == ImportRow(
        email="lead@example.com",
        name="Ирина Никитина",
        telegram="@liansk",
        channelUrl="https://youtube.com/@boriscpt",
        status="follow_up",
        statusRaw="ФОЛЛОУ АП",
        nextPingAt="2026-07-31",
        notes=["написал", "жду ответа"],
    )
    assert row.identifiable is True
    assert row.unknown_status is False


def test_row_without_contacts_is_not_identifiable():
    row = build_row({"Name": "", "email": "", "Telegram": "", "ФИДБЕК": "что-то"})

    assert row.identifiable is False


def test_unknown_status_is_flagged_but_raw_is_kept():
    row = build_row({"Name": "X", "СТАТУС": "надо подумать"})

    assert row.status is None
    assert row.statusRaw == "надо подумать"
    assert row.unknown_status is True
