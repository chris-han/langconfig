import json
import time
import unittest
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


BASE_URL = "http://127.0.0.1:8766"
REPO_ROOT = Path("/home/chris/repo/unicell")
FIXTURE_DIR = REPO_ROOT / "openchamber" / "contracts" / "langconfig-fixtures"


def http_json(method: str, path: str, payload: dict | None = None):
    data = None
    headers = {}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(f"{BASE_URL}{path}", data=data, headers=headers, method=method)
    with urllib.request.urlopen(request) as response:
        body = response.read().decode("utf-8")
        return json.loads(body) if body else None


class MinimalImportContractTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        health = http_json("GET", "/health")
        if health.get("status") != "ok":
            raise RuntimeError(f"Minimal backend unhealthy: {health}")

        cls.project_id = cls._ensure_project("Semantier C2C Import Test")

    @classmethod
    def _ensure_project(cls, name: str) -> int:
        projects = http_json("GET", "/api/projects/")
        existing = next((project for project in projects if project["name"] == name), None)
        if existing:
            return existing["id"]

        created = http_json(
            "POST",
            "/api/projects/",
            {
                "name": name,
                "description": "Project for minimal import contract tests",
                "configuration": {"default_model": "gpt-4o"},
            },
        )
        return created["id"]

    def _import_fixture(self, fixture_name: str, name_prefix: str) -> tuple[dict, dict]:
        fixture_path = FIXTURE_DIR / fixture_name
        fixture = json.loads(fixture_path.read_text(encoding="utf-8"))
        unique_name = f"{name_prefix} {int(time.time() * 1000)}"
        result = http_json(
            "POST",
            "/api/workflows/import",
            {
                "config": fixture,
                "project_id": self.project_id,
                "name_override": unique_name,
                "create_custom_tools": True,
            },
        )
        return fixture, result

    def _find_workflow(self, workflow_id: int) -> dict:
        workflows = http_json("GET", "/api/workflows/")
        workflow = next((item for item in workflows if item["id"] == workflow_id), None)
        self.assertIsNotNone(workflow, f"Workflow {workflow_id} not found in /api/workflows/")
        return workflow

    def test_imports_minimal_fixture(self):
        fixture, result = self._import_fixture("c2c_minimal.langconfig.json", "C2C Minimal Contract Test")
        self.assertEqual(result["status"], "imported")
        self.assertIn("workflow_id", result)

        workflow = self._find_workflow(result["workflow_id"])
        self.assertEqual(workflow["project_id"], self.project_id)
        self.assertEqual(workflow["description"], fixture["workflow"]["description"])
        self.assertEqual(len(workflow["configuration"]["nodes"]), 3)
        self.assertEqual(len(workflow["configuration"]["edges"]), 2)
        self.assertIn("semantier_context", workflow["configuration"])

    def test_imports_rich_fixture(self):
        fixture, result = self._import_fixture("c2c_rich.langconfig.json", "C2C Rich Contract Test")
        self.assertEqual(result["status"], "imported")
        self.assertIn("workflow_id", result)

        workflow = self._find_workflow(result["workflow_id"])
        self.assertEqual(workflow["project_id"], self.project_id)
        self.assertEqual(workflow["strategy_type"], fixture["workflow"]["strategy_type"])
        self.assertEqual(len(workflow["configuration"]["nodes"]), 5)
        self.assertEqual(len(workflow["configuration"]["edges"]), 5)
        self.assertTrue(workflow["configuration"]["memory_enabled"])
        self.assertEqual(workflow["configuration"]["max_iterations"], 8)
        self.assertIn("semantier_context", workflow["configuration"])


if __name__ == "__main__":
    unittest.main()
