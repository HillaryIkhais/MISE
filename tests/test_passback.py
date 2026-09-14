"""PASSBACK case engine tests: recovery loop + evidence-gated transitions."""
import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from contractor.passback import (
    PassbackStore, PassbackCase, simulate_phone, PassbackError,
    verify_call, STATES, WHY_STUCK, STEP_WHO, REJECT_REASONS,
)


def full_recovery(store=None):
    store = store or PassbackStore()
    case = PassbackCase(store, "loc_004", "Torque Precision")
    a = case.next_action()
    r = simulate_phone(a["goal"], a["to"])
    case.execute_next(r["transcript"], r["extracted"],
                      r["extracted"]["confidence"], r["call_id"])
    a = case.next_action()
    r = simulate_phone(a["goal"], a["to"])
    case.execute_next(r["transcript"], r["extracted"],
                      r["extracted"]["confidence"], r["call_id"])
    return store, case


class TestRecoveryLoop(unittest.TestCase):
    def test_board_moves_to_recovery_committed(self):
        _, case = full_recovery()
        self.assertEqual(case.state, "COMMITMENT_ACCEPTED")
        na = case.next_action()
        self.assertTrue(na["terminal"])

    def test_terminal_next_action_has_no_to(self):
        store, case = full_recovery()
        na = case.next_action()
        self.assertTrue(na["terminal"])
        self.assertIsNone(na["to"])

    def test_order_is_strict(self):
        """You cannot skip from DELIVERY_FAILED to COMMITMENT_ACCEPTED."""
        store = PassbackStore()
        case = PassbackCase(store, "loc_005", "No-Skip")
        # Try to advance with invalid commitment — should fail
        with self.assertRaises(PassbackError) as ctx:
            case.execute_next(
                "Supplier: we'll try...",
                {"action": "ship", "quantity": 4, "window": None}, 0.45,
                "c1", "supplier")
        self.assertEqual(ctx.exception.reason, "DELIVERY_WINDOW_MISSING")

    def test_next_action_pipeline(self):
        """After full recovery, next action is terminal."""
        store, case = full_recovery()
        na = case.next_action()
        self.assertTrue(na["terminal"])


class TestVerifyPrimitive(unittest.TestCase):
    def test_accepted_returns_true_for_valid_evidence(self):
        v = verify_call("DELIVERY_FAILED",
                        "Supplier: Yes. We have 4 units. We'll ship today. "
                        "Arrive tomorrow by 2:00 PM. PO-1842.",
                        {"action": "ship", "quantity": 4, "window": "tomorrow by 2:00 PM",
                         "reference": "PO-1842"},
                        0.97, "supplier")
        self.assertTrue(v["accepted"])
        self.assertEqual(v["reasons"], [])
        self.assertEqual(v["to_state"], "SUPPLIER_CONTACT_REQUIRED")

    def test_rejected_returns_reasons(self):
        v = verify_call("SUPPLIER_CONTACT_REQUIRED",
                        "Supplier: we'll try to get them out by 4:00 PM.",
                        {"action": "ship", "quantity": 4, "window": "4:00 PM"},
                        0.45, "supplier")
        self.assertFalse(v["accepted"])
        self.assertIn("SUPPLIER_HEDGED", v["reasons"])
        self.assertIn("hedged", REJECT_REASONS["SUPPLIER_HEDGED"].lower())


class TestEvidenceGate(unittest.TestCase):
    def test_supplier_hedge_blocked(self):
        store = PassbackStore()
        case = PassbackCase(store, "loc_006", "Hedge")
        with self.assertRaises(PassbackError) as ctx:
            case.execute_next(
                "Supplier: we should probably get to it by 4:00 PM.",
                {"action": "ship", "quantity": 4, "window": "4:00 PM"}, 0.8, "c2",
                "supplier")
        self.assertEqual(ctx.exception.reason, "SUPPLIER_HEDGED")

    def test_missing_window_blocked(self):
        store = PassbackStore()
        case = PassbackCase(store, "loc_007", "NoWindow")
        with self.assertRaises(PassbackError) as ctx:
            case.execute_next(
                "Supplier: Yes, we can do it Friday. I commit.",
                {"action": "ship", "quantity": 4, "window": "Friday"}, 0.8, "c3",
                "supplier")
        self.assertEqual(ctx.exception.reason, "UNSPECIFIED_DELIVERY_TIME")

    def test_unstructured_incident_blocked(self):
        store = PassbackStore()
        case = PassbackCase(store, "loc_008", "Unstructured")
        with self.assertRaises(PassbackError) as ctx:
            case.execute_next(
                "Supplier: yeah we might have some.",
                {"action": "ship"}, 0.9, "c4", "supplier")
        self.assertEqual(ctx.exception.reason, "DELIVERY_WINDOW_MISSING")


class TestLedger(unittest.TestCase):
    def test_append_only_hash_chain(self):
        store, case = full_recovery()
        steps = store.steps_for(case.id)
        self.assertEqual(len(steps), 2)
        self.assertEqual(steps[0]["step_type"], "supplier_commitment")
        prev = "GENESIS"
        for s in steps:
            self.assertEqual(s["previous_hash"], prev)
            prev = s["step_hash"]
        self.assertTrue(store.verify_chain(case.id)["ok"])

    def test_immutability_tamper(self):
        store, case = full_recovery()
        conn = store.conn
        conn.execute(
            "UPDATE passback_steps SET from_state='RECOVERY_COMMITTED' "
            "WHERE case_id=?", (case.id,))
        conn.commit()
        self.assertFalse(store.verify_chain(case.id)["ok"])

    def test_bound_to_case_and_order(self):
        store, case = full_recovery()
        self.assertEqual(store.get_case(case.id)["state"], "COMMITMENT_ACCEPTED")
        self.assertEqual([s["to_state"] for s in store.steps_for(case.id)],
                         ["SUPPLIER_CONTACT_REQUIRED", "COMMITMENT_ACCEPTED"])


class TestMetadata(unittest.TestCase):
    def test_states_and_why_stuck_cover_all(self):
        self.assertEqual(len(STATES), 5)
        self.assertEqual(len(WHY_STUCK), 5)
        for s in STATES:
            self.assertIn(s, WHY_STUCK)

    def test_step_who_for_all_types(self):
        for t in ["supplier_commitment"]:
            self.assertIn(t, STEP_WHO)


class TestCallContract(unittest.TestCase):
    def test_next_action_informs_call(self):
        store = PassbackStore()
        case = PassbackCase(store, "loc_010", "Contract")
        a = case.next_action()
        self.assertEqual(a["to"], "supplier")


class TestOpenAndRunNext(unittest.TestCase):
    def test_open_loads_existing_case_without_new_row(self):
        store = PassbackStore()
        case = PassbackCase(store, "loc_011", "Re-open")
        r = simulate_phone("req", "supplier")
        case.execute_next(r["transcript"], r["extracted"],
                          r["extracted"]["confidence"], r["call_id"])
        cid = case.id
        n_before = len(store.list_cases())
        reopened = PassbackCase.open(store, cid)
        self.assertEqual(reopened.id, cid)
        self.assertEqual(reopened.state, "SUPPLIER_CONTACT_REQUIRED")
        self.assertIn(reopened.location_name, "Re-open")
        self.assertEqual(len(store.list_cases()), n_before)  # no duplicate row

    def test_run_next_executes_one_full_transition(self):
        store = PassbackStore()
        case = PassbackCase(store, "loc_012", "Run-next")
        out = case.run_next()
        self.assertEqual(out["state"], "SUPPLIER_CONTACT_REQUIRED")
        self.assertEqual(len(store.steps_for(case.id)), 1)
        self.assertEqual(out["step"]["step_type"], "supplier_commitment")

    def test_run_next_blocked_leaves_ledger_untouched(self):
        store = PassbackStore()
        case = PassbackCase(store, "loc_013", "Blocked-runnext")
        a = case.next_action()
        r = simulate_phone(a["goal"], a["to"])
        case.execute_next(r["transcript"], r["extracted"],
                          r["extracted"]["confidence"], r["call_id"])
        with self.assertRaises(PassbackError) as ctx:
            case.run_next(transcript="Supplier: we should probably get to it by 4:00 PM.",
                          structured={"action": "ship", "quantity": 4, "window": "4:00 PM"},
                          confidence=0.45, source="supplier")
        self.assertEqual(ctx.exception.reason, "SUPPLIER_HEDGED")
        self.assertEqual(len(store.steps_for(case.id)), 1)  # nothing appended
        self.assertEqual(case.state, "SUPPLIER_CONTACT_REQUIRED")

    def test_run_next_terminal_raises(self):
        store, case = full_recovery()
        with self.assertRaises(PassbackError) as ctx:
            case.run_next()
        self.assertEqual(ctx.exception.reason, "TERMINAL")


if __name__ == "__main__":
    unittest.main()
