import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch
from urllib.error import URLError
from apiprobe.cli import load_plan
from apiprobe.models import Check
from apiprobe.runner import run_check, run_plan

class Response:
    status=200
    def __init__(self,body=b'{"status":"ok"}'): self.body=body
    def read(self,limit=-1): return self.body[:limit]
    def __enter__(self): return self
    def __exit__(self,*args): return False

class APIProbeTests(unittest.TestCase):
    def test_validates_url_method_and_status(self):
        with self.assertRaisesRegex(ValueError,"URL"): Check("Bad","ftp://host",200).validate()
        with self.assertRaisesRegex(ValueError,"method"): Check("Bad","https://example.com",200,method="TRACE").validate()
        with self.assertRaisesRegex(ValueError,"expected_status"): Check("Bad","https://example.com",99).validate()

    @patch("apiprobe.runner.urlopen",return_value=Response())
    def test_passes_status_and_content_check(self,mock_open):
        result=run_check(Check("Health","https://example.com/health",200,contains="ok"))
        self.assertTrue(result["passed"]); self.assertEqual(result["status"],200); mock_open.assert_called_once()

    @patch("apiprobe.runner.urlopen",return_value=Response(b"no match"))
    def test_fails_missing_content(self,_):
        self.assertFalse(run_check(Check("Health","https://example.com",200,contains="ready"))["passed"])

    @patch("apiprobe.runner.urlopen",side_effect=URLError("offline"))
    def test_network_error_becomes_result(self,_):
        result=run_check(Check("Health","https://example.com",200)); self.assertFalse(result["passed"]); self.assertIn("offline",result["error"])

    @patch("apiprobe.runner.urlopen",return_value=Response())
    def test_plan_summary(self,_):
        report=run_plan([Check("One","https://example.com",200),Check("Two","https://example.com",201)])
        self.assertEqual(report["summary"],{"total":2,"passed":1,"failed":1})

    def test_loads_plan_and_rejects_unknown_fields(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/"plan.json"; path.write_text(json.dumps([{"name":"Health","url":"https://example.com","expected_status":200}]),encoding="utf-8")
            self.assertEqual(len(load_plan(path)),1)
            path.write_text(json.dumps([{"name":"Health","url":"https://example.com","expected_status":200,"secret":True}]),encoding="utf-8")
            with self.assertRaisesRegex(ValueError,"unknown"): load_plan(path)

    def test_empty_plan_is_rejected(self):
        with self.assertRaisesRegex(ValueError,"at least one"): run_plan([])

if __name__=="__main__": unittest.main()

