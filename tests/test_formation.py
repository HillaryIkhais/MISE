"""Formation attack lab: the agent cannot manufacture, widen, mutate, or
prematurely complete a commitment the counterparty never mutually confirmed.

Invariant under test: Committed Terms ⊆ Mutually Confirmed Terms.
"""
import unittest
from datetime import datetime, timezone, timedelta
from contractor import Store, ProtocolError
from contractor import protocol, formation

NOW = datetime.now(timezone.utc)
FUTURE = (NOW + timedelta(days=1)).isoformat()
FUTURE_EXACT = (NOW + timedelta(days=1)).replace(microsecond=0).isoformat()


def fresh():
    s = Store()
    s.upsert_authority("supplier_001", ["inventory", "delivery", "procurement"])
    s.upsert_authority("buyer_001", ["procurement"])
    return s


def crisp_terms(qty=100):
    return {"action": "deliver", "quantity": qty, "unit": "units",
            "destination": "warehouse_a", "deadline": FUTURE_EXACT}


YES = "Yes, I confirm. I commit to deliver 100 units to warehouse A."


class TestFormation(unittest.TestCase):
    def test_01_hedged_promise_blocked(self):
        # "Yeah, Friday should be fine" never becomes a commitment
        p = formation.start_proposal(
            {"action": "deliver", "quantity": 100, "unit": "units",
             "destination": "warehouse_a", "deadline": "Friday"},
            "Yeah, Friday should be fine.")
        self.assertEqual(p["state"], "AMBIGUOUS")
        self.assertTrue(p["questions"])
        s = fresh()
        with self.assertRaises(ProtocolError) as cm:
            protocol.propose_from_formation(
                s, p, crisp_terms(), "Yeah, Friday should be fine.",
                "supplier_001", "Acme")
        self.assertEqual(cm.exception.reason, "AMBIGUITY_UNRESOLVED")

    def test_02_agent_drops_condition_rejected(self):
        s = fresh()
        t = ("Yes, I confirm 100 units. I can deliver 100 Friday "
             "if the shipment arrives.")
        p = formation.start_proposal(crisp_terms(), t)
        conds = formation.extract_conditions(t)
        self.assertTrue(conds)
        record = formation.mutual_confirm(p, crisp_terms(), "Yes, I confirm 100 units to warehouse A.")
        # agent commits without the condition -> dropped
        with self.assertRaises(ProtocolError) as cm:
            protocol.propose_commitment(
                s, {"actor_id": "supplier_001", **{"terms": crisp_terms()}},
                "supplier_001", "Acme", conditions=[], confirmation=record)
        self.assertEqual(cm.exception.reason, "CONDITION_DROPPED")

    def test_03_quantity_widened_rejected(self):
        s = fresh()
        p = formation.start_proposal(crisp_terms(), YES)
        record = formation.mutual_confirm(p, crisp_terms(), YES)
        wide = crisp_terms(qty=120)
        with self.assertRaises(ProtocolError) as cm:
            protocol.propose_commitment(
                s, {"actor_id": "supplier_001", "terms": wide},
                "supplier_001", "Acme", confirmation=record)
        self.assertEqual(cm.exception.reason, "QUANTITY_WIDENED")

    def test_04_deadline_widened_rejected(self):
        s = fresh()
        p = formation.start_proposal(crisp_terms(), YES)
        record = formation.mutual_confirm(p, crisp_terms(), YES)
        early = dict(crisp_terms())
        early["deadline"] = (NOW + timedelta(hours=1)).replace(microsecond=0).isoformat()
        with self.assertRaises(ProtocolError) as cm:
            protocol.propose_commitment(
                s, {"actor_id": "supplier_001", "terms": early},
                "supplier_001", "Acme", confirmation=record)
        self.assertIn(cm.exception.reason, ("DEADLINE_WIDENED", "DEADLINE_SHIFTED"))

    def test_05_maybe_never_commits(self):
        p = formation.start_proposal(crisp_terms(), "Maybe, we'll see. I might.")
        kinds = {i["kind"] for i in p["issues"]}
        self.assertTrue(kinds & {"UNCERTAIN", "NO_EXPLICIT_CONFIRMATION"})
        s = fresh()
        with self.assertRaises(ProtocolError):
            protocol.propose_from_formation(
                s, p, crisp_terms(), "Maybe, we'll see.",
                "supplier_001", "Acme")

    def test_06_conditional_recorded_not_confirmed(self):
        s = fresh()
        t = ("Yes, I confirm 100 units to warehouse A, "
             "if the inbound shipment arrives Thursday.")
        p = formation.start_proposal(crisp_terms(), "supplier discussing shipment")
        record = formation.mutual_confirm(p, crisp_terms(), t)
        self.assertTrue(record["conditions"])
        c = protocol.propose_commitment(
            s, {"actor_id": "supplier_001", "terms": crisp_terms()},
            "supplier_001", "Acme", conditions=record["conditions"],
            confirmation=record)
        protocol.full_activate(s, c.id)
        self.assertEqual(s.get_commitment_row(c.id)["state"], "CONDITIONAL")
        # quantity evidence alone cannot fulfill a conditional obligation
        protocol.attach_evidence(s, c.id, "shipment_receipt", "warehouse_system",
                                 NOW.isoformat(), {"quantity": 100})
        v = protocol.run_verification(s, c.id, now_iso=NOW.isoformat())
        self.assertEqual(v["fulfillment"], "BLOCKED_CONDITIONAL")
        # untrusted condition claim does not resolve either
        with self.assertRaises(ProtocolError) as cm:
            protocol.resolve_conditions(s, c.id)
        self.assertEqual(cm.exception.reason, "CONDITIONS_UNMET")
        # trusted condition proof resolves -> ACTIVE
        protocol.attach_evidence(s, c.id, "condition_proof", "carrier_scan",
                                 NOW.isoformat(),
                                 {"condition": record["conditions"][0]})
        self.assertEqual(protocol.resolve_conditions(s, c.id), "ACTIVE")

    def test_07_counterparty_contradiction_detected(self):
        p = formation.start_proposal(crisp_terms(), YES)
        with self.assertRaises(ProtocolError) as cm:
            formation.mutual_confirm(p, crisp_terms(), "Actually I can only do 60 units.")
        self.assertEqual(cm.exception.reason, "CONVERSATION_CONFLICT")

    def test_08_clarification_loop_converges(self):
        p = formation.start_proposal(
            {"action": "deliver", "quantity": 100, "unit": "units",
             "destination": "warehouse_a", "deadline": "Friday"},
            "Yeah, Friday should be fine.")
        self.assertEqual(p["state"], "AMBIGUOUS")
        p2 = formation.clarify(
            p, crisp_terms(),
            "I confirm: exactly 100 units to warehouse A, "
            f"deadline {FUTURE_EXACT}. I commit.")
        self.assertEqual(p2["state"], "MUTUALLY_CONFIRMED")
        s = fresh()
        c = protocol.propose_from_formation(
            s, p2, crisp_terms(),
            f"I confirm exactly 100 units, deadline {FUTURE_EXACT}, I commit.",
            "supplier_001", "Acme")
        self.assertEqual(c.confirmation["terms_hash"],
                         formation.sha256(formation.canonical(crisp_terms())))

    def test_09_imprecise_deadline_needs_clock_time(self):
        issues = formation.detect_ambiguity(
            {"action": "deliver", "quantity": 100, "unit": "units",
             "destination": "warehouse_a", "deadline": "Friday"},
            "Yes I confirm Friday delivery.")
        self.assertTrue(any(i["kind"] == "IMPRECISE" for i in issues))

    def test_10_stale_evidence_ignored(self):
        s = fresh()
        c = protocol.propose_commitment(
            s, {"actor_id": "supplier_001", "terms": crisp_terms()},
            "supplier_001", "Acme")
        protocol.full_activate(s, c.id)
        # replay a receipt from last week against today's obligation
        old = (NOW - timedelta(days=7)).isoformat()
        protocol.attach_evidence(s, c.id, "shipment_receipt", "warehouse_system",
                                 old, {"quantity": 100})
        v = protocol.run_verification(s, c.id, now_iso=NOW.isoformat())
        self.assertEqual(v.get("stale_ignored"), 1)
        self.assertNotEqual(s.get_commitment_row(c.id)["state"], "FULFILLED")

    def test_11_recovery_cannot_erase_breach(self):
        s = fresh()
        c = protocol.propose_commitment(
            s, {"actor_id": "supplier_001",
                "terms": dict(crisp_terms(), quantity=101)},
            "supplier_001", "Acme")
        protocol.full_activate(s, c.id)
        protocol.attach_evidence(s, c.id, "shipment_receipt", "warehouse_system",
                                 NOW.isoformat(), {"quantity": 30})
        protocol.run_verification(s, c.id,
                                  now_iso=(NOW + timedelta(days=2)).isoformat())
        self.assertEqual(s.get_commitment_row(c.id)["state"], "BREACHED")
        child = protocol.create_amendment(
            s, c.id, {"actor_id": "supplier_001",
                      "terms": dict(crisp_terms(), quantity=71)},
            "supplier_001", "Acme")
        # parent untouched: still breached, original quantity intact
        parent = s.get_commitment_row(c.id)
        self.assertEqual(parent["state"], "BREACHED")
        self.assertEqual(s.get_terms(c.id)["quantity"], 101)
        self.assertEqual(child.parent_id, c.id)

    def test_12_unauthorized_formation_actor_rejected(self):
        s = Store()  # no authorities at all
        p = formation.start_proposal(crisp_terms(), YES)
        with self.assertRaises(ProtocolError) as cm:
            protocol.propose_from_formation(
                s, p, crisp_terms(), YES, "stranger_99", "Stranger")
        self.assertEqual(cm.exception.reason, "ACTOR_NOT_AUTHORIZED")

    def test_13_provenance_stapled(self):
        s = fresh()
        p = formation.start_proposal(crisp_terms(), YES)
        prov = {"quantity": {"source": "call transcript 00:42",
                             "confidence": 0.97, "verbatim": "one hundred units"},
                "deadline": {"source": "read-back confirmation", "confidence": 0.99}}
        record = formation.mutual_confirm(p, crisp_terms(), YES)
        c = protocol.propose_commitment(
            s, {"actor_id": "supplier_001", "terms": crisp_terms()},
            "supplier_001", "Acme", provenance=prov, confirmation=record)
        self.assertEqual(c.provenance["quantity"]["confidence"], 0.97)

    def test_14_evidence_requirements_carried_to_amendment(self):
        import json
        s = fresh()
        reqs = [{"type": "shipment_receipt", "source_class": "trusted",
                 "field": "quantity", "rule": "sum >= quantity"},
                {"type": "photo_proof", "source_class": "trusted",
                 "field": "delivery", "rule": "required"}]
        c = protocol.propose_commitment(
            s, {"actor_id": "supplier_001",
                "terms": dict(crisp_terms(), quantity=102)},
            "supplier_001", "Acme", evidence_requirements=reqs)
        protocol.full_activate(s, c.id)
        protocol.attach_evidence(s, c.id, "shipment_receipt", "warehouse_system",
                                 NOW.isoformat(), {"quantity": 10})
        protocol.run_verification(s, c.id,
                                  now_iso=(NOW + timedelta(days=2)).isoformat())
        child = protocol.create_amendment(
            s, c.id, {"actor_id": "supplier_001",
                      "terms": dict(crisp_terms(), quantity=92)},
            "supplier_001", "Acme")
        row = s.get_commitment_row(child.id)
        self.assertEqual(json.loads(row["evidence_requirements_json"]), reqs)

    def test_15_exact_match_passes_gate(self):
        s = fresh()
        p = formation.start_proposal(crisp_terms(), YES)
        c = protocol.propose_from_formation(
            s, p, crisp_terms(), YES, "supplier_001", "Acme")
        protocol.full_activate(s, c.id)
        self.assertEqual(s.get_commitment_row(c.id)["state"], "ACTIVE")


if __name__ == "__main__":
    unittest.main(verbosity=2)
