from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from scripts.harness.aggregate_evidence import aggregate_reports


def verification_report(
    *,
    status: str = "passed",
    head: str = "abc",
    tree: str = "tree",
    task: bool = False,
    dirty: bool = False,
) -> dict:
    return {
        "status": status,
        "git": {
            "head_sha": head,
            "head_tree_sha": tree,
            "working_tree_dirty": dirty,
        },
        "task_id": "TASK-999" if task else None,
        "task_contract": (
            {"task_id": "TASK-999", "sha256": "digest"} if task else None
        ),
        "checks": [{"id": "check", "status": "passed"}],
        "manual_checks": [],
    }


class AggregateEvidenceTests(unittest.TestCase):
    def write(self, directory: Path, name: str, report: dict) -> Path:
        path = directory / name
        path.write_text(json.dumps(report), encoding="utf-8")
        return path

    def test_passes_reports_for_one_head_tree_and_required_task(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            paths = [
                self.write(root, "backend.json", verification_report()),
                self.write(root, "task.json", verification_report(task=True)),
                self.write(root, "runtime.json", {"status": "passed"}),
            ]
            aggregate = aggregate_reports(paths, required_task_id="TASK-999")

        self.assertEqual("passed", aggregate["status"])
        self.assertEqual("abc", aggregate["head_sha"])
        self.assertEqual("tree", aggregate["head_tree_sha"])
        self.assertEqual("digest", aggregate["task_contract_sha256"])

    def test_marks_mismatched_git_identity_as_stale(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            paths = [
                self.write(root, "one.json", verification_report()),
                self.write(
                    root,
                    "two.json",
                    verification_report(head="other", tree="other-tree"),
                ),
            ]
            aggregate = aggregate_reports(paths)

        self.assertEqual("stale", aggregate["status"])

    def test_failed_and_missing_task_evidence_block_gate(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            failed = self.write(
                root, "failed.json", verification_report(status="failed")
            )
            self.assertEqual("failed", aggregate_reports([failed])["status"])

            passed = self.write(root, "passed.json", verification_report())
            self.assertEqual(
                "incomplete",
                aggregate_reports([passed], required_task_id="TASK-999")["status"],
            )

    def test_manual_required_is_preserved(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = self.write(
                Path(directory),
                "manual.json",
                verification_report(status="manual_required", task=True),
            )
            aggregate = aggregate_reports([path], required_task_id="TASK-999")

        self.assertEqual("manual_required", aggregate["status"])

    def test_missing_required_report_blocks_gate(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = self.write(
                Path(directory), "backend.json", verification_report()
            )
            aggregate = aggregate_reports(
                [path], required_report_names=["backend.json", "frontend.json"]
            )

        self.assertEqual("incomplete", aggregate["status"])
        self.assertEqual(["frontend.json"], aggregate["missing_reports"])

    def test_dirty_evidence_is_stale(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = self.write(
                Path(directory), "dirty.json", verification_report(dirty=True)
            )
            aggregate = aggregate_reports([path])

        self.assertEqual("stale", aggregate["status"])
        self.assertEqual([str(path.resolve())], aggregate["dirty_reports"])


if __name__ == "__main__":
    unittest.main()
