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
    case = PassbackCase(store, "loc_004", "Harbor Kitchen #04")
    a = case.next_action()
    r = simulate_phone(a["goal"], a["to"], scenario="requirement")
    case.execute_next(r["transcript"], r["extracted"],
                      r["extracted"]["confidence"], r["call_id"])
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
    def test_board_moves_closed_to_readytoreopen(self):
        _, case = full_recovery()
        self.assertEqual(case.state, "REINSPECTION_REQUESTED")
        r = simulate_phone(case.next_action()["goal"], case.next_action()["to"])
        last = case.execute_next(
            r["transcript"], {"reopening_date": {"date": "2026-09-12"}},
            0.96, r["call_id"], source="health_department")
        self.assertEqual(last["state"], "REOPENING_PATH_ACTIVE")
        self.assertEqual(case.state, "REOPENING_PATH_ACTIVE")

    def test_terminal_next_action_is_waiting_on_authority(self):
        store, case = full_recovery()
        r = simulate_phone(case.next_action()["goal"], case.next_action()["to"])
        case.execute_next(r["transcript"], {"reopening_date": {"date": "2026-09-12"}},
                          0.96, r["call_id"], source="health_department")
        na = case.next_action()
        self.assertTrue(na["terminal"])
        self.assertIsNone(na["to"])
        self.assertIn("authority", na["label"].lower())

    def test_order_is_strict(self):
        """You cannot skip from CLOSED to open-for-business."""
        store = PassbackStore()
        case = PassbackCase(store, "loc_005", "No-Skip")
        r = simulate_phone("x", "health_department")
        with self.assertRaises(PassbackError) as ctx:
            case.execute_next(r["transcript"], {"reopening_date": {"date": "x"}},
                              0.9, r["call_id"], source="health_department")
        self.assertEqual(ctx.exception.reason, "VIOLATION_UNSTRUCTURED")

    def test_next_action_pipeline(self):
        """Each stage tells CALL-E what to run next."""
        store, case = full_recovery()
        self.assertEqual(case.next_action()["to"], "health_department")


class TestVerifyPrimitive(unittest.TestCase):
    def test_accepted_returns_true_for_valid_evidence(self):
        v = verify_call("CLOSED",
                        "Health dept: grease trap must be serviced before reinspection.",
                        {"violation": "grease_trap", "requirement": "licensed service"},
                        0.9, "health_department")
        self.assertTrue(v["accepted"])
        self.assertEqual(v["reasons"], [])
        self.assertEqual(v["to_state"], "BLOCKER_IDENTIFIED")

    def test_rejected_returns_reasons(self):
        v = verify_call("BLOCKER_IDENTIFIED",
                        "Apex: we should probably get to it sometime.",
                        {"provider": "Apex", "window": "4:30 PM"},
                        0.8, "remediation_provider")
        self.assertFalse(v["accepted"])
        self.assertIn("PROVIDER_HEDGED", v["reasons"])
        self.assertIn("hedged", REJECT_REASONS["PROVIDER_HEDGED"].lower())


class TestEvidenceGate(unittest.TestCase):
    def test_vague_blocker_hedge_blocked(self):
        store = PassbackStore()
        case = PassbackCase(store, "loc_006", "Vague")
        with self.assertRaises(PassbackError) as ctx:
            case.execute_next(
                "Health dept: we should probably do something about the grease trap.",
                {"violation": "grease_trap", "requirement": "service"}, 0.8,
                "c1", "health_department")
        self.assertEqual(ctx.exception.reason, "BLOCKER_UNCONFIRMED")

    def test_provider_hedge_blocked(self):
        store = PassbackStore()
        case = PassbackCase(store, "loc_007", "Hedge")
        r = simulate_phone("req", "health_department", scenario="requirement")
        case.execute_next(r["transcript"], r["extracted"],
                          r["extracted"]["confidence"], r["call_id"])
        with self.assertRaises(PassbackError) as ctx:
            case.execute_next(
                "Apex: we should probably get to it sometime.",
                {"provider": "Apex", "window": "4:30 PM"}, 0.8, "c2",
                "remediation_provider")
        self.assertEqual(ctx.exception.reason, "PROVIDER_HEDGED")

    def test_window_without_clock_time_blocked(self):
        store = PassbackStore()
        case = PassbackCase(store, "loc_008", "NoClock")
        r = simulate_phone("req", "health_department", scenario="requirement")
        case.execute_next(r["transcript"], r["extracted"],
                          r["extracted"]["confidence"], r["call_id"])
        with self.assertRaises(PassbackError) as ctx:
            case.execute_next(
                "Apex: Yes, we can do it Friday. I commit.",
                {"provider": "Apex", "window": "Friday"}, 0.8, "c3",
                "remediation_provider")
        self.assertEqual(ctx.exception.reason, "UNSPECIFIED_FIX_TIME")

    def test_reopening_needs_trusted_proof(self):
        store, case = full_recovery()  # state == REINSPECTION_REQUESTED
        with self.assertRaises(PassbackError) as ctx:
            case.execute_next(
                "dept: reinspection passed, reopen soon.",
                {"reopening_date": {"date": "2026-09-12"}}, 0.9, "c4",
                source="agent_claim")
        self.assertEqual(ctx.exception.reason, "PROOF_NOT_TRUSTED")


class TestLedger(unittest.TestCase):
    def test_append_only_hash_chain(self):
        store, case = full_recovery()
        steps = store.steps_for(case.id)
        self.assertEqual(len(steps), 3)
        self.assertEqual(steps[0]["step_type"], "health_department_requirement")
        prev = "GENESIS"
        for s in steps:
            self.assertEqual(s["previous_hash"], prev)
            prev = s["step_hash"]
        self.assertTrue(store.verify_chain(case.id)["ok"])

    def test_immutability_tamper(self):
        store, case = full_recovery()
        conn = store.conn
        conn.execute(
            "UPDATE passback_steps SET from_state='REOPENING_PATH_ACTIVE' "
            "WHERE case_id=?", (case.id,))
        conn.commit()
        self.assertFalse(store.verify_chain(case.id)["ok"])

    def test_bound_to_case_and_order(self):
        store, case = full_recovery()
        self.assertEqual(store.get_case(case.id)["state"], "REINSPECTION_REQUESTED")
        self.assertEqual([s["to_state"] for s in store.steps_for(case.id)],
                         ["BLOCKER_IDENTIFIED", "REMEDIATION_BOOKED",
                          "REINSPECTION_REQUESTED"])


class TestMetadata(unittest.TestCase):
    def test_states_and_why_stuck_cover_all(self):
        self.assertEqual(len(STATES), 5)
        self.assertEqual(len(WHY_STUCK), 5)
        for s in STATES:
            self.assertIn(s, WHY_STUCK)

    def test_step_who_for_all_types(self):
        for t in ["health_department_requirement", "provider_commitment",
                   "reinspection_requested", "reopening_confirmed"]:
            self.assertIn(t, STEP_WHO)


class TestCallContract(unittest.TestCase):
    def test_next_action_informs_call(self):
        store = PassbackStore()
        case = PassbackCase(store, "loc_010", "Contract")
        a = case.next_action()
        self.assertEqual(a["to"], "health_department")


class TestOpenAndRunNext(unittest.TestCase):
    def test_open_loads_existing_case_without_new_row(self):
        store = PassbackStore()
        case = PassbackCase(store, "loc_011", "Re-open")
        r = simulate_phone("req", "health_department", scenario="requirement")
        case.execute_next(r["transcript"], r["extracted"],
                          r["extracted"]["confidence"], r["call_id"])
        cid = case.id
        n_before = len(store.list_cases())
        reopened = PassbackCase.open(store, cid)
        self.assertEqual(reopened.id, cid)
        self.assertEqual(reopened.state, "BLOCKER_IDENTIFIED")
        self.assertIn(reopened.location_name, "Re-open")
        self.assertEqual(len(store.list_cases()), n_before)  # no duplicate row

    def test_run_next_executes_one_full_transition(self):
        store = PassbackStore()
        case = PassbackCase(store, "loc_012", "Run-next")
        out = case.run_next(scenario="requirement")
        self.assertEqual(out["state"], "BLOCKER_IDENTIFIED")
        self.assertEqual(len(store.steps_for(case.id)), 1)
        self.assertEqual(out["step"]["step_type"], "health_department_requirement")

    def test_run_next_blocked_leaves_ledger_untouched(self):
        store = PassbackStore()
        case = PassbackCase(store, "loc_013", "Blocked-runnext")
        a = case.next_action()
        r = simulate_phone(a["goal"], a["to"], scenario="requirement")
        case.execute_next(r["transcript"], r["extracted"],
                          r["extracted"]["confidence"], r["call_id"])
        with self.assertRaises(PassbackError) as ctx:
            case.run_next(transcript="Apex: we should probably get to it sometime.",
                          structured={"provider": "Apex", "window": "4:30 PM"},
                          confidence=0.8, source="remediation_provider")
        self.assertEqual(ctx.exception.reason, "PROVIDER_HEDGED")
        self.assertEqual(len(store.steps_for(case.id)), 1)  # nothing appended
        self.assertEqual(case.state, "BLOCKER_IDENTIFIED")

    def test_run_next_terminal_raises(self):
        store, case = full_recovery()
        r = simulate_phone(case.next_action()["goal"], case.next_action()["to"])
        case.execute_next(r["transcript"], {"reopening_date": {"date": "2026-09-12"}},
                          0.96, r["call_id"], source="health_department")
        with self.assertRaises(PassbackError) as ctx:
            case.run_next()
        self.assertEqual(ctx.exception.reason, "TERMINAL")


if __name__ == "__main__":
    unittest.main()
