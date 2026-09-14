"""Adversarial test matrix for CONTRACTOR protocol. stdlib unittest, no deps.

Covers the 19-row matrix from the spec:
missing terms, unauthorized actor, LLM-declared fulfillment, no evidence,
partial, full, late, conflict, silent mutation, amendment guards,
duplicates, invalid transitions, recovery lineage, audit tamper detection.
"""
import unittest
from datetime import datetime, timezone, timedelta
from contractor import Store, ProtocolError
from contractor import protocol
from contractor.audit import verify_chain


def iso(dt):
    return dt.isoformat()


NOW = datetime.now(timezone.utc)
FUTURE = iso(NOW + timedelta(days=1))
FUTURE2 = iso(NOW + timedelta(days=3))
PAST = iso(NOW - timedelta(hours=1))


def fresh_store():
    s = Store()
    s.upsert_authority("supplier_001", ["inventory", "delivery", "procurement"])
    s.upsert_authority("warehouse_assistant", ["inventory_receiving"])
    return s


def cand(**kw):
    base = {"actor_id": "supplier_001", "actor": "Acme Supplies", "terms": {
        "action": "deliver", "quantity": 500, "unit": "units",
        "destination": "warehouse_a", "deadline": FUTURE}}
    base["terms"].update(kw.pop("terms", {}))
    base.update(kw)
    return base


def make_active(s, **kw):
    c = protocol.propose_commitment(s, cand(**kw), "supplier_001", "Acme Supplies")
    protocol.full_activate(s, c.id)
    return c


class TestMatrix(unittest.TestCase):
    def test_01_missing_quantity_reject(self):
        s = fresh_store()
        c = cand(terms={"quantity": None})
        with self.assertRaises(ProtocolError) as cm:
            protocol.propose_commitment(s, c, "supplier_001", "Acme")
        self.assertEqual(cm.exception.reason, "INVALID_COMMITMENT")

    def test_02_missing_deadline_reject(self):
        s = fresh_store()
        c = cand(terms={"deadline": None})
        with self.assertRaises(ProtocolError):
            protocol.propose_commitment(s, c, "supplier_001", "Acme")

    def test_03_missing_actor_reject(self):
        s = fresh_store()
        c = cand()
        del c["actor_id"]
        with self.assertRaises(ProtocolError):
            protocol.propose_commitment(s, c, "supplier_001", "Acme")

    def test_04_unauthorized_actor_reject(self):
        s = fresh_store()
        with self.assertRaises(ProtocolError) as cm:
            protocol.propose_commitment(s, cand(), "warehouse_assistant",
                                        "Asst", required_scope="procurement")
        self.assertEqual(cm.exception.reason, "AUTHORITY_SCOPE_MISMATCH")

    def test_05_llm_declares_fulfilled_rejected(self):
        s = fresh_store()
        c = make_active(s)
        # agent claim becomes untrusted evidence; verification must BLOCK, not fulfill
        out = protocol.agent_claim_fulfilled(s, c.id, "Supplier says everything delivered")
        self.assertNotEqual(s.get_commitment_row(c.id)["state"], "FULFILLED")
        self.assertIn(out["verdict"]["verdict"],
                      ("FULFILLMENT_BLOCKED", "UNRESOLVED_CONFLICT", "AWAITING_EVIDENCE"))

    def test_06_no_evidence_before_deadline_stays_active(self):
        s = fresh_store()
        c = make_active(s)
        v = protocol.run_verification(s, c.id, now_iso=iso(NOW))
        self.assertEqual(v["state"], "ACTIVE")

    def test_07_partial_300_of_500_breach_after_deadline(self):
        s = fresh_store()
        c = make_active(s)
        protocol.attach_evidence(s, c.id, "shipment_receipt", "warehouse_system",
                                 iso(NOW), {"quantity": 300})
        v = protocol.run_verification(s, c.id,
                                      now_iso=iso(NOW + timedelta(days=2)))
        self.assertEqual(v["next_state"], "BREACHED")
        self.assertEqual(s.get_commitment_row(c.id)["state"], "BREACHED")

    def test_08_full_500_of_500_fulfilled(self):
        s = fresh_store()
        c = make_active(s)
        protocol.attach_evidence(s, c.id, "shipment_receipt", "warehouse_system",
                                 iso(NOW), {"quantity": 500})
        v = protocol.run_verification(s, c.id, now_iso=iso(NOW))
        self.assertEqual(v["next_state"], "FULFILLED")
        self.assertEqual(s.get_commitment_row(c.id)["state"], "FULFILLED")

    def test_09_evidence_after_deadline_expired(self):
        s = fresh_store()
        c = make_active(s)
        late = iso(_parse(FUTURE) + timedelta(minutes=8))
        protocol.attach_evidence(s, c.id, "shipment_receipt", "warehouse_system",
                                 late, {"quantity": 500})
        v = protocol.run_verification(s, c.id,
                                      now_iso=iso(_parse(FUTURE) + timedelta(hours=1)))
        self.assertEqual(v["next_state"], "EXPIRED")

    def test_10_conflicting_evidence_blocks(self):
        s = fresh_store()
        c = make_active(s)
        protocol.attach_evidence(s, c.id, "shipment_receipt", "warehouse_system",
                                 iso(NOW), {"quantity": 300})
        protocol.attach_evidence(s, c.id, "phone_claim", "supplier_claim",
                                 iso(NOW), {"quantity": 500})
        v = protocol.run_verification(s, c.id,
                                      now_iso=iso(NOW + timedelta(days=2)))
        self.assertEqual(v["verdict"], "UNRESOLVED_CONFLICT")
        self.assertEqual(v["fulfillment"], "BLOCKED")

    def test_11_silent_quantity_mutation_rejected(self):
        s = fresh_store()
        c = make_active(s)
        with self.assertRaises(ProtocolError) as cm:
            protocol.update_terms(s, c.id, quantity=300)
        self.assertEqual(cm.exception.reason, "IMMUTABLE_OBLIGATION")
        self.assertEqual(s.get_terms(c.id)["quantity"], 500)

    def test_12_amendment_after_fulfillment_rejected(self):
        s = fresh_store()
        c = make_active(s)
        protocol.attach_evidence(s, c.id, "shipment_receipt", "warehouse_system",
                                 iso(NOW), {"quantity": 500})
        protocol.run_verification(s, c.id, now_iso=iso(NOW))
        with self.assertRaises(ProtocolError) as cm:
            protocol.create_amendment(s, c.id, cand(terms={"quantity": 100}), "supplier_001", "Acme")
        self.assertEqual(cm.exception.reason, "AMENDMENT_FORBIDDEN")

    def test_13_amendment_after_cancellation_rejected(self):
        s = fresh_store()
        c = protocol.propose_commitment(s, cand(), "supplier_001", "Acme")
        protocol.cancel(s, c.id, "buyer")
        with self.assertRaises(ProtocolError):
            protocol.create_amendment(s, c.id, cand(terms={"quantity": 100}), "supplier_001", "Acme")

    def test_14_duplicate_evidence_rejected(self):
        s = fresh_store()
        c = make_active(s)
        obs = iso(NOW)
        protocol.attach_evidence(s, c.id, "shipment_receipt", "warehouse_system",
                                 obs, {"quantity": 300})
        with self.assertRaises(ProtocolError) as cm:
            protocol.attach_evidence(s, c.id, "shipment_receipt", "warehouse_system",
                                     obs, {"quantity": 300})
        self.assertEqual(cm.exception.reason, "DUPLICATE_EVIDENCE")

    def test_15_duplicate_commitment_rejected(self):
        s = fresh_store()
        make_active(s)
        with self.assertRaises(ProtocolError) as cm:
            protocol.propose_commitment(s, cand(), "supplier_001", "Acme")
        self.assertEqual(cm.exception.reason, "DUPLICATE_COMMITMENT")

    def test_16_invalid_state_transition_rejected(self):
        s = fresh_store()
        c = protocol.propose_commitment(s, cand(terms={"quantity": 501}), "supplier_001", "Acme")
        with self.assertRaises(ProtocolError) as cm:
            protocol.lock(s, c.id)  # DRAFT -> ACTIVE skips NEGOTIATED/CONFIRMED
        self.assertEqual(cm.exception.reason, "INVALID_STATE_TRANSITION")

    def test_17_recovery_creates_new_obligation(self):
        s = fresh_store()
        c = make_active(s, terms={"quantity": 502})
        protocol.attach_evidence(s, c.id, "shipment_receipt", "warehouse_system",
                                 iso(NOW), {"quantity": 300})
        protocol.run_verification(s, c.id, now_iso=iso(NOW + timedelta(days=2)))
        self.assertEqual(s.get_commitment_row(c.id)["state"], "BREACHED")
        child = protocol.create_amendment(
            s, c.id, cand(terms={"quantity": 202, "deadline": FUTURE2}),
            "supplier_001", "Acme Supplies")
        self.assertNotEqual(child.id, c.id)
        self.assertEqual(child.parent_id, c.id)

    def test_18_new_obligation_preserves_parent(self):
        s = fresh_store()
        c = make_active(s, terms={"quantity": 503})
        protocol.attach_evidence(s, c.id, "shipment_receipt", "warehouse_system",
                                 iso(NOW), {"quantity": 300})
        protocol.run_verification(s, c.id, now_iso=iso(NOW + timedelta(days=2)))
        child = protocol.create_amendment(
            s, c.id, cand(terms={"quantity": 203, "deadline": FUTURE2}),
            "supplier_001", "Acme")
        lin = protocol.get_lineage(s, child.id)
        ids = [r["id"] for r in lin]
        self.assertIn(c.id, ids)
        self.assertIn(child.id, ids)
        # parent terms untouched
        self.assertEqual(s.get_terms(c.id)["quantity"], 503)

    def test_19_audit_chain_tamper_detected(self):
        s = fresh_store()
        c = make_active(s)
        ok = verify_chain(s, c.id)
        self.assertTrue(ok["ok"])
        # tamper: rewrite an event payload directly in SQL
        s.execute("UPDATE events SET payload_json='{}' WHERE commitment_id=?", (c.id,))
        bad = verify_chain(s, c.id)
        self.assertFalse(bad["ok"])


def _parse(ts: str):
    from datetime import datetime as _dt
    return _dt.fromisoformat(ts)


if __name__ == "__main__":
    unittest.main(verbosity=2)
