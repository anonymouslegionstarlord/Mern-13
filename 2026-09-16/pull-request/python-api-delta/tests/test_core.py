from __future__ import annotations

import json
from pathlib import Path
import tempfile
import unittest

from apidelta.cli import main
from apidelta.core import SpecError, compare_files, compare_specs, load_spec


def operation(*, parameters=None, request_body=None, responses=None, deprecated=False):
    value = {
        "responses": responses or {"200": {"description": "ok"}},
    }
    if parameters is not None:
        value["parameters"] = parameters
    if request_body is not None:
        value["requestBody"] = request_body
    if deprecated:
        value["deprecated"] = True
    return value


def spec(paths):
    return {"openapi": "3.0.3", "info": {"title": "x", "version": "1"}, "paths": paths}


class CompareTests(unittest.TestCase):
    def codes(self, report):
        return [item.code for item in report.findings]

    def test_removed_path_is_breaking(self):
        report = compare_specs(spec({"/pets": {"get": operation()}}), spec({}))
        self.assertEqual(report.breaking_count, 1)
        self.assertIn("path-removed", self.codes(report))

    def test_added_path_is_non_breaking(self):
        report = compare_specs(spec({}), spec({"/health": {"get": operation()}}))
        self.assertEqual(report.breaking_count, 0)
        self.assertIn("path-added", self.codes(report))

    def test_removed_and_added_operations(self):
        report = compare_specs(
            spec({"/pets": {"get": operation()}}),
            spec({"/pets": {"post": operation()}}),
        )
        self.assertEqual(self.codes(report), ["operation-removed", "operation-added"])

    def test_new_required_parameter_is_breaking(self):
        required = [{"name": "tenant", "in": "header", "required": True}]
        report = compare_specs(
            spec({"/pets": {"get": operation()}}),
            spec({"/pets": {"get": operation(parameters=required)}}),
        )
        self.assertIn("parameter-required", self.codes(report))

    def test_new_optional_parameter_is_non_breaking(self):
        optional = [{"name": "limit", "in": "query", "required": False}]
        report = compare_specs(
            spec({"/pets": {"get": operation()}}),
            spec({"/pets": {"get": operation(parameters=optional)}}),
        )
        self.assertEqual(report.breaking_count, 0)
        self.assertIn("parameter-added", self.codes(report))

    def test_request_body_becoming_required_is_breaking(self):
        report = compare_specs(
            spec({"/pets": {"post": operation(request_body={"required": False})}}),
            spec({"/pets": {"post": operation(request_body={"required": True})}}),
        )
        self.assertIn("request-body-required", self.codes(report))

    def test_removed_success_response_is_breaking(self):
        report = compare_specs(
            spec({"/pets": {"get": operation(responses={"200": {"description": "ok"}})}}),
            spec({"/pets": {"get": operation(responses={"204": {"description": "ok"}})}}),
        )
        self.assertIn("success-response-removed", self.codes(report))
        self.assertIn("success-response-added", self.codes(report))

    def test_json_response_type_change_is_breaking(self):
        def response(kind):
            return {"description": "ok", "content": {"application/json": {"schema": {"type": kind}}}}
        report = compare_specs(
            spec({"/pets": {"get": operation(responses={"200": response("array")})}}),
            spec({"/pets": {"get": operation(responses={"200": response("object")})}}),
        )
        self.assertIn("response-type-changed", self.codes(report))

    def test_reference_parameters_are_ignored(self):
        referenced = [{"$ref": "#/components/parameters/tenant"}]
        report = compare_specs(
            spec({"/pets": {"get": operation()}}),
            spec({"/pets": {"get": operation(parameters=referenced)}}),
        )
        self.assertEqual(report.findings, ())

    def test_deprecated_operation_is_informational(self):
        report = compare_specs(
            spec({"/pets": {"get": operation()}}),
            spec({"/pets": {"get": operation(deprecated=True)}}),
        )
        self.assertEqual(report.info_count, 1)
        self.assertIn("operation-deprecated", self.codes(report))


class InputAndCliTests(unittest.TestCase):
    def test_invalid_openapi_document_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            filename = Path(directory) / "bad.json"
            filename.write_text(json.dumps({"swagger": "2.0", "paths": {}}), encoding="utf-8")
            with self.assertRaises(SpecError):
                load_spec(filename)

    def test_compare_files_and_json_cli(self):
        with tempfile.TemporaryDirectory() as directory:
            baseline = Path(directory) / "baseline.json"
            current = Path(directory) / "current.json"
            baseline.write_text(json.dumps(spec({})), encoding="utf-8")
            current.write_text(json.dumps(spec({"/health": {"get": operation()}})), encoding="utf-8")
            report = compare_files(baseline, current)
            self.assertEqual(report.current_operations, 1)
            self.assertEqual(main([str(baseline), str(current), "--format", "json"]), 0)

    def test_cli_failure_and_override_for_breaking_change(self):
        with tempfile.TemporaryDirectory() as directory:
            baseline = Path(directory) / "baseline.json"
            current = Path(directory) / "current.json"
            baseline.write_text(json.dumps(spec({"/pets": {"get": operation()}})), encoding="utf-8")
            current.write_text(json.dumps(spec({})), encoding="utf-8")
            self.assertEqual(main([str(baseline), str(current)]), 1)
            self.assertEqual(main([str(baseline), str(current), "--allow-breaking"]), 0)


if __name__ == "__main__":
    unittest.main()

