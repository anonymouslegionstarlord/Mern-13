import tempfile
import unittest
from pathlib import Path

from timetableguard.core import ScheduleError, Session, analyze, detect_conflicts, parse_time, read_schedule, session_from_row


def session(identifier, start, end, *, day="Monday", room="R1", instructor="Teacher A", group="G1"):
    return Session(identifier, day, start, end, room, instructor, group)


class TimetableGuardTests(unittest.TestCase):
    def test_parse_time_accepts_boundaries(self):
        self.assertEqual(parse_time("00:00", "start"), 0)
        self.assertEqual(parse_time("23:59", "end"), 1439)
        with self.assertRaises(ScheduleError):
            parse_time("9:00", "start")

    def test_row_validation_rejects_reverse_range(self):
        row = {"session_id": "A", "day": "Monday", "start_time": "10:00", "end_time": "09:00", "room": "R1", "instructor": "T", "group": "G"}
        with self.assertRaisesRegex(ScheduleError, "after"):
            session_from_row(row, 2)

    def test_touching_sessions_do_not_conflict(self):
        first = session("A", 540, 600)
        second = session("B", 600, 660)
        self.assertEqual(detect_conflicts([first, second]), [])

    def test_all_shared_resources_are_reported(self):
        first = session("A", 540, 620)
        second = session("B", 600, 660)
        conflicts = detect_conflicts([first, second])
        self.assertEqual({item["resource_type"] for item in conflicts}, {"room", "instructor", "group"})
        self.assertTrue(all(item["overlap_minutes"] == 20 for item in conflicts))

    def test_different_days_do_not_conflict(self):
        first = session("A", 540, 620, day="Monday")
        second = session("B", 540, 620, day="Tuesday")
        self.assertEqual(detect_conflicts([first, second]), [])

    def test_read_schedule_rejects_duplicate_ids(self):
        text = "session_id,day,start_time,end_time,room,instructor,group\nABC,Monday,09:00,10:00,R1,T1,G1\nabc,Tuesday,09:00,10:00,R2,T2,G2\n"
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "schedule.csv"
            path.write_text(text, encoding="utf-8")
            with self.assertRaisesRegex(ScheduleError, "unique"):
                read_schedule(path)

    def test_analyze_calculates_room_hours(self):
        items = [
            session("A", 540, 600, room="Lab"),
            session("B", 610, 700, room="Lab", instructor="Teacher B", group="G2"),
            session("C", 540, 570, room="Studio", instructor="Teacher C", group="G3"),
        ]
        report = analyze(items)
        self.assertEqual(report["conflict_count"], 0)
        self.assertEqual(report["room_hours"]["Lab"], 2.5)
        self.assertEqual(report["busiest_room"], "Lab")


if __name__ == "__main__":
    unittest.main()
