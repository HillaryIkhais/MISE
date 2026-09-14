"""Commitment Attack Lab: machine-verifiable corpus.

Every case: INPUT -> PARSED TERMS -> FORMATION STATE -> CONFIRMATION STATE
-> COMMITMENT DECISION -> REJECTION CODE.
"""
import copy
import unittest
from datetime import datetime, timezone, timedelta
from contractor import Store, ProtocolError
from contractor import protocol, formation
from contractor import policy

NOW = datetime.now(timezone.utc)
DL = (NOW + timedelta(days=1)).replace(microsecond=0).isoformat()


def fresh():
    s = Store()
    s.upsert_authority("supplier_001", ["inventory", "delivery", "procurement"])
    s.upsert_authority("clerk_002", ["inventory_receiving"])
    return s


def base_terms(**kw):
    t = {"action": "deliver", "quantity": 100, "unit": "units",
         "destination": "warehouse_a", "deadline": DL,
         "object": "bolts", "price": 250.0, "currency": "USD"}
    t.update(kw)
    return t


FULL_READBACK = (f"Yes, I confirm: exactly 100 bolts, 100 units to warehouse A "
                 f"by {DL} at 250 USD. I commit.")


def confirmed_record(terms=None, transcript=None, actor="supplier_001"):
    terms = terms or base_terms()
    p = formation.start_proposal(terms, "negotiating terms")
    return formation.mutual_confirm(p, terms, transcript or FULL_READBACK,
                                    actor_id=actor)


class TestAttackLab(unittest.TestCase):
    def test_do_the_usual_is_reference_ambiguity(self):
        p = formation.start_proposal(base_terms(), "Just do the usual, you know what I mean.")
        kinds = {i["kind"] for i in p["issues"]}
        self.assertIn("REFERENCE_AMBIGUITY", kinds)
        s = fresh()
        with self.assertRaises(ProtocolError) as cm:
            protocol.propose_from_formation(
                s, p, base_terms(), "Just do the usual.", "supplier_001", "Acme")
        self.assertEqual(cm.exception.reason, "AMBIGUITY_UNRESOLVED")

    def test_same_place_as_last_time_blocked(self):
        p = formation.start_proposal(
            dict(base_terms(), destination=None), "Same place as last time.")
        self.assertTrue(p["issues"])
        s = fresh()
        with self.assertRaises(ProtocolError):
            protocol.propose_from_formation(
                s, p, base_terms(), "Same place as last time.",
                "supplier_001", "Acme")

    def test_partial_readback_rejected(self):
        p = formation.start_proposal(base_terms(), "negotiating")
        with self.assertRaises(ProtocolError) as cm:
            formation.mutual_confirm(p, base_terms(), "Yes, 100 units. That's it.")
        self.assertEqual(cm.exception.reason, "PARTIAL_CONFIRMATION")

    def test_wrong_actor_confirmation_rejected(self):
        rec = confirmed_record()
        s = fresh()
        s.upsert_authority("impostor_9", ["procurement"])
        with self.assertRaises(ProtocolError) as cm:
            protocol.propose_commitment(
                s, {"actor_id": "impostor_9", "terms": base_terms()},
                "impostor_9", "Impostor", confirmation=rec)
        self.assertEqual(cm.exception.reason, "CONFIRMATION_ACTOR_MISMATCH")

    def test_expired_confirmation_rejected(self):
        rec = confirmed_record()
        rec["confirmed_at"] = (NOW - timedelta(hours=72)).isoformat()
        from contractor.models import sha256, canonical
        rec["terms_hash"] = sha256(canonical(rec["confirmed_terms"]))
        s = fresh()
        with self.assertRaises(ProtocolError) as cm:
            protocol.propose_commitment(
                s, {"actor_id": "supplier_001", "terms": base_terms()},
                "supplier_001", "Acme", confirmation=rec)
        self.assertEqual(cm.exception.reason, "CONFIRMATION_EXPIRED")

    def test_replayed_confirmation_rejected(self):
        rec = confirmed_record()
        s = fresh()
        c1 = protocol.propose_commitment(
            s, {"actor_id": "supplier_001", "id": "c_replay_a",
                "terms": base_terms()},
            "supplier_001", "Acme", confirmation=rec)
        self.assertTrue(c1.id)
        with self.assertRaises(ProtocolError) as cm:
            protocol.propose_commitment(
                s, {"actor_id": "supplier_001", "id": "c_replay_b",
                    "terms": base_terms()},
                "supplier_001", "Acme", confirmation=rec)
        self.assertEqual(cm.exception.reason, "CONFIRMATION_REPLAYED")

    def test_forged_confirmation_rejected(self):
        rec = confirmed_record()
        rec["confirmed_terms"] = base_terms(quantity=500)  # tampered post-gate
        s = fresh()
        with self.assertRaises(ProtocolError) as cm:
            protocol.propose_commitment(
                s, {"actor_id": "supplier_001", "terms": base_terms(quantity=500)},
                "supplier_001", "Acme", confirmation=rec)
        self.assertEqual(cm.exception.reason, "CONFIRMATION_FORGED")

    def test_currency_substitution_rejected(self):
        rec = confirmed_record()
        s = fresh()
        with self.assertRaises(ProtocolError) as cm:
            protocol.propose_commitment(
                s, {"actor_id": "supplier_001", "terms": base_terms(currency="NGN")},
                "supplier_001", "Acme", confirmation=rec)
        self.assertEqual(cm.exception.reason, "CURRENCY_SUBSTITUTED")

    def test_unit_substitution_rejected(self):
        rec = confirmed_record()
        s = fresh()
        with self.assertRaises(ProtocolError) as cm:
            protocol.propose_commitment(
                s, {"actor_id": "supplier_001", "terms": base_terms(unit="boxes")},
                "supplier_001", "Acme", confirmation=rec)
        self.assertEqual(cm.exception.reason, "UNIT_SUBSTITUTED")

    def test_evidence_for_wrong_commitment_rejected(self):
        s = fresh()
        c = protocol.propose_commitment(
            s, {"actor_id": "supplier_001", "terms": base_terms(quantity=103)},
            "supplier_001", "Acme")
        with self.assertRaises(ProtocolError) as cm:
            protocol.attach_evidence(s, c.id, "shipment_receipt", "warehouse_system",
                                     NOW.isoformat(),
                                     {"quantity": 103, "commitment_id": "c_someone_else"})
        self.assertEqual(cm.exception.reason, "EVIDENCE_COMMITMENT_MISMATCH")

    def test_condition_proof_cannot_satisfy_quantity(self):
        s = fresh()
        c = protocol.propose_commitment(
            s, {"actor_id": "supplier_001", "terms": base_terms(quantity=104)},
            "supplier_001", "Acme")
        protocol.full_activate(s, c.id)
        protocol.attach_evidence(s, c.id, "condition_proof", "warehouse_system",
                                 NOW.isoformat(),
                                 {"quantity": 104, "condition": "shipment arrived"})
        v = protocol.run_verification(s, c.id, now_iso=NOW.isoformat())
        self.assertNotEqual(s.get_commitment_row(c.id)["state"], "FULFILLED")
        self.assertIn(v["verdict"], ("AWAITING_EVIDENCE", "FULFILLMENT_BLOCKED"))

    def test_clarify_after_confirm_is_illegal(self):
        p = formation.start_proposal(base_terms(), "negotiating")
        p2 = formation.clarify(p, base_terms(), FULL_READBACK)
        self.assertEqual(p2["state"], "MUTUALLY_CONFIRMED")
        with self.assertRaises(ProtocolError) as cm:
            formation.clarify(p2, base_terms(quantity=120), "Actually make that 120.")
        self.assertEqual(cm.exception.reason, "INVALID_FORMATION_TRANSITION")

    def test_unauthorized_amendment_actor_rejected(self):
        s = fresh()
        c = protocol.propose_commitment(
            s, {"actor_id": "supplier_001", "terms": base_terms(quantity=105)},
            "supplier_001", "Acme")
        protocol.full_activate(s, c.id)
        rec = confirmed_record(terms=base_terms(quantity=105),
                               transcript="Confirmed 105 bolts, 105 units to warehouse A "
                                          f"by {DL} at 250 USD. I commit.")
        with self.assertRaises(ProtocolError) as cm:
            protocol.create_amendment(
                s, c.id, {"actor_id": "clerk_002", "terms": base_terms(quantity=106)},
                "clerk_002", "Clerk", confirmation=rec)
        self.assertIn(cm.exception.reason,
                      ("ACTOR_NOT_AUTHORIZED", "AUTHORITY_SCOPE_MISMATCH",
                       "CONFIRMATION_ACTOR_MISMATCH"))

    def test_ordinary_agent_cannot_manufacture_confirmed_obligation(self):
        # Headline: the raw path yields at most an UNCONFIRMED system
        # obligation — and the execution gate refuses payment on it.
        s = fresh()
        c = protocol.propose_commitment(
            s, {"actor_id": "supplier_001", "terms": base_terms(quantity=107)},
            "supplier_001", "Acme")
        protocol.full_activate(s, c.id)
        import json
        row = s.get_commitment_row(c.id)
        self.assertEqual(json.loads(row["confirmation_json"]), {})
        self.assertEqual(row["origin"], "programmatic")
        protocol.attach_evidence(s, c.id, "shipment_receipt", "warehouse_system",
                                 NOW.isoformat(), {"quantity": 107})
        protocol.run_verification(s, c.id, now_iso=NOW.isoformat())
        self.assertEqual(s.get_commitment_row(c.id)["state"], "FULFILLED")
        table = policy.evaluate(s, c.id, now_iso=NOW.isoformat())
        pay = table["actions"]["release_payment"]
        self.assertFalse(pay["allowed"])
        self.assertIn("UNCONFIRMED", pay["reason"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
