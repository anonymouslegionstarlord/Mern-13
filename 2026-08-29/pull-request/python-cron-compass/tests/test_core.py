import contextlib
import io
import json
import unittest
from datetime import datetime, timezone

from croncompass.cli import main, parse_start
from croncompass.core import CronError, next_runs, parse_cron


class CronCompassTests(unittest.TestCase):
    def test_wildcard_list_range_and_step_parsing(self):
        schedule = parse_cron("*/15 9-17 1,15 * *")
        self.assertEqual(schedule.minute.values, frozenset({0, 15, 30, 45}))
        self.assertIn(12, schedule.hour.values)
        self.assertEqual(schedule.day_of_month.values, frozenset({1, 15}))

    def test_month_and_weekday_aliases(self):
        schedule = parse_cron("0 8 * JAN,APR MON-FRI")
        self.assertEqual(schedule.month.values, frozenset({1, 4}))
        self.assertEqual(schedule.day_of_week.values, frozenset({1, 2, 3, 4, 5}))

    def test_sunday_accepts_zero_and_seven(self):
        zero = parse_cron("0 8 * * 0")
        seven = parse_cron("0 8 * * 7")
        self.assertEqual(zero.day_of_week.values, seven.day_of_week.values)
        self.assertTrue(seven.matches(datetime(2026, 8, 30, 8, 0)))

    def test_invalid_field_count_values_ranges_and_steps(self):
        with self.assertRaisesRegex(CronError, "five"):
            parse_cron("* * * *")
        with self.assertRaisesRegex(CronError, "between"):
            parse_cron("60 * * * *")
        with self.assertRaisesRegex(CronError, "range"):
            parse_cron("* 17-9 * * *")
        with self.assertRaisesRegex(CronError, "greater"):
            parse_cron("*/0 * * * *")

    def test_day_of_month_and_weekday_use_cron_or_semantics(self):
        schedule = parse_cron("0 9 13 * FRI")
        self.assertTrue(schedule.matches(datetime(2026, 9, 13, 9, 0)))
        self.assertTrue(schedule.matches(datetime(2026, 9, 18, 9, 0)))
        self.assertFalse(schedule.matches(datetime(2026, 9, 14, 9, 0)))

    def test_next_runs_are_strictly_after_start(self):
        schedule = parse_cron("*/20 * * * *")
        runs = next_runs(schedule, datetime(2026, 8, 29, 10, 20, 40), 3)
        self.assertEqual(runs, [
            datetime(2026, 8, 29, 10, 40),
            datetime(2026, 8, 29, 11, 0),
            datetime(2026, 8, 29, 11, 20),
        ])

    def test_weekday_preview(self):
        schedule = parse_cron("30 9 * * MON-FRI")
        runs = next_runs(schedule, datetime(2026, 8, 28, 10, 0), 2)
        self.assertEqual(runs, [datetime(2026, 8, 31, 9, 30), datetime(2026, 9, 1, 9, 30)])

    def test_count_validation(self):
        schedule = parse_cron("* * * * *")
        with self.assertRaisesRegex(CronError, "1 to 50"):
            next_runs(schedule, datetime(2026, 1, 1), 0)
        with self.assertRaisesRegex(CronError, "1 to 50"):
            next_runs(schedule, datetime(2026, 1, 1), 51)

    def test_fixed_offset_is_preserved(self):
        start = parse_start("2026-08-29T09:00:00+05:30")
        runs = next_runs(parse_cron("30 9 * * *"), start, 1)
        self.assertEqual(runs[0].utcoffset(), start.utcoffset())

    def test_cli_json_workflow(self):
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            code = main(["0 10 * * MON", "--start", "2026-08-29T09:00:00Z", "--count", "2", "--format", "json"])
        report = json.loads(output.getvalue())
        self.assertEqual(code, 0)
        self.assertEqual(report["next_runs"], ["2026-08-31T10:00+00:00", "2026-09-07T10:00+00:00"])

    def test_invalid_iso_start_is_rejected(self):
        with self.assertRaisesRegex(CronError, "ISO"):
            parse_start("not-a-date")


if __name__ == "__main__":
    unittest.main()
