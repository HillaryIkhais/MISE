"""Acceptance test: a second client that knows NOTHING about CONTRACTOR
internals creates, evidences, evaluates and amends a commitment solely
through the public SDK + CALL-E adapter. If this passes, CONTRACTOR is
infrastructure, not a demo.

Allowed imports: contractor.sdk, contractor.Store, contractor.calle_adapter.
"""
import unittest
from datetime import datetime, timezone, timedelta

import contractor.sdk as contractor
from contractor import Store
from contractor.calle_adapter import simulate_call

# NOTE: this client file must not import contractor internals (checked below).
# The forbidden-module list lives inside the test body so the guard cannot
# trip on its own source.


class TestSdkIntegration(unittest.TestCase):
    def test_client_source_touches_no_internals(self):
        import pathlib
        import re
        src = pathlib.Path(__file__).read_text()
        imports = [line for line in src.splitlines()
                   if re.match(r"\s*(from|import)\s+contractor", line)]
        for line in imports:
            self.assertTrue(
                any(a in line for a in
                    ("contractor.sdk", "contractor.calle_adapter",
                     "from contractor import Store")),
                f"integration client touches internals: {line.strip()}")

    def test_sdk_only_lifecycle(self):
        now = datetime.now(timezone.utc)
        dl = (now + timedelta(hours=2)).replace(microsecond=0).isoformat()
        store = Store()
        store.upsert_authority("supplier_001", ["inventory", "delivery", "procurement"])

        # formation through the SDK, driven by a CALL-E result
        call = simulate_call("Acme", "confirm 100 units", scenario="vague",
                             quantity=100, deadline=dl)
        ext = call["extracted"]
        terms = {"action": "deliver", "quantity": 100, "unit": "units",
                 "destination": "warehouse_a", "deadline": dl}
        proposal = contractor.start_formation(terms, call["transcript"])
        self.assertEqual(proposal["state"], "AMBIGUOUS")
        proposal = contractor.clarify(
            proposal, terms,
            f"I confirm: exactly 100 units to warehouse A by {dl}. I commit.")
        record = contractor.confirm(
            proposal, terms,
            f"I confirm exactly 100 units to warehouse A by {dl}. I commit.",
            "supplier_001", call_id=call["call_id"])
        comm = contractor.commit(store, record, "supplier_001", "Acme Supplies",
                                 call_id=call["call_id"])
        self.assertEqual(store.get_commitment_row(comm.id)["state"], "ACTIVE")
        self.assertEqual(ext["actor_id"], "supplier_001")

        # evidence + evaluation through the SDK
        contractor.record_evidence(store, comm.id, "shipment_receipt",
                                   "warehouse_system", now.isoformat(),
                                   {"quantity": 60})
        partial = contractor.evaluate(store, comm.id, now_iso=now.isoformat())
        self.assertEqual(partial["state"], "AT_RISK")

        # formation-confirmed amendment (renegotiated deadline) through the SDK
        dl2 = (now + timedelta(days=2)).replace(microsecond=0).isoformat()
        child = contractor.amend(
            store, comm.id, dict(terms, deadline=dl2),
            f"Renegotiated and confirmed: 100 units to warehouse A by {dl2}. I commit.",
            "supplier_001", "Acme Supplies")
        self.assertEqual(child.parent_id, comm.id)
        self.assertEqual(store.get_terms(comm.id)["quantity"], 100)
        lineage = store.lineage(child.id)
        self.assertIn(comm.id, [r["id"] for r in lineage])

    def test_sdk_has_no_confirmation_manufacturer(self):
        public = [n for n in dir(contractor) if not n.startswith("_")]
        for name in public:
            self.assertNotIn("forge", name.lower())
            self.assertNotIn("bypass", name.lower())
        self.assertIn("privileged_import", public)  # audited, reasoned, unconfirmed
        store = Store()
        store.upsert_authority("supplier_001", ["procurement"])
        c = contractor.privileged_import(
            store, {"actor_id": "supplier_001",
                    "terms": {"action": "deliver", "quantity": 5, "unit": "units",
                              "destination": "warehouse_a",
                              "deadline": (datetime.now(timezone.utc)
                                           + timedelta(hours=1)).isoformat()}},
            "supplier_001", "Acme", kind="migration_import",
            reason="backfill legacy orders")
        row = store.get_commitment_row(c.id)
        self.assertEqual(row["origin"], "migration_import")
        import json
        self.assertEqual(json.loads(row["confirmation_json"]), {})


if __name__ == "__main__":
    unittest.main(verbosity=2)
