from __future__ import annotations

import hashlib
import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
CONFIG = ROOT / "scripts/harness/config"
INDEX_PATH = CONFIG / "user-facing-text-inventory-index.json"
ALLOWLIST_PATH = CONFIG / "user-facing-text-allowlist.json"
DUPLICATES_PATH = CONFIG / "user-facing-text-duplicates.json"


def load(path: Path) -> dict:
    return json.loads(path.read_text())


class UserFacingTextInventoryTests(unittest.TestCase):
    def test_inventory_shards_match_index_and_use_stable_fingerprints(self) -> None:
        index = load(INDEX_PATH)
        self.assertEqual("accepted", index["review_status"])
        self.assertEqual("TASK-165", index["task"])
        self.assertEqual(
            "dfe9501775ba9e7ffdb4cf320b585ff82aabb72d",
            index["source_commit"],
        )
        self.assertEqual(2760, index["summary"]["entry_count"])
        self.assertEqual(3159, index["summary"]["occurrence_count"])
        self.assertEqual(191, index["summary"]["cross_owner_duplicate_groups"])
        self.assertEqual(0, index["summary"]["proposed_allowlist_entries"])
        valid_categories = set(index["valid_categories"])
        entry_count = 0
        occurrence_count = 0

        for shard_metadata in index["inventory_files"]:
            shard_path = ROOT / shard_metadata["path"]
            shard = load(shard_path)
            self.assertEqual(shard_metadata["slice"], shard["slice"])
            self.assertEqual(index["source_commit"], shard["source_commit"])
            self.assertEqual(shard_metadata["entry_count"], len(shard["entries"]))
            self.assertEqual(shard_metadata["occurrence_count"], sum(
                entry["occurrences"] for entry in shard["entries"]
            ))
            for entry in shard["entries"]:
                self.assertIn(entry["category"], valid_categories)
                self.assertNotEqual("unclassified", entry["category"])
                self.assertEqual(
                    "sha256:" + hashlib.sha256(entry["value"].encode()).hexdigest(),
                    entry["fingerprint"],
                )
                self.assertTrue((ROOT / entry["path"]).is_file())
                self.assertEqual("accepted", entry["review_status"])
                self.assertTrue(entry["owner"])
                self.assertTrue(entry["reason"])
            entry_count += len(shard["entries"])
            occurrence_count += sum(entry["occurrences"] for entry in shard["entries"])

        self.assertEqual(index["summary"]["entry_count"], entry_count)
        self.assertEqual(index["summary"]["occurrence_count"], occurrence_count)

    def test_allowlist_is_empty_until_review_proves_an_irreducible_exception(self) -> None:
        allowlist = load(ALLOWLIST_PATH)
        self.assertEqual("accepted", allowlist["review_status"])
        self.assertEqual(0, allowlist["entry_count"])
        self.assertEqual([], allowlist["entries"])
        self.assertEqual(
            ["path", "fingerprint", "category", "reason", "owner_task"],
            allowlist["required_entry_fields"],
        )

    def test_cross_owner_duplicate_report_references_inventory_locations(self) -> None:
        duplicates = load(DUPLICATES_PATH)
        self.assertEqual(duplicates["group_count"], len(duplicates["groups"]))
        self.assertGreater(duplicates["group_count"], 0)
        for group in duplicates["groups"]:
            self.assertGreater(len(group["owners"]), 1)
            self.assertGreater(len(group["locations"]), 1)
            self.assertEqual("accepted", group["review_status"])
            for location in group["locations"]:
                self.assertTrue((ROOT / location["path"]).is_file())


if __name__ == "__main__":
    unittest.main()
