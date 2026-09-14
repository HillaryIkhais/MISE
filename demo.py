"""PASSBACK — the demo. One product, two layers.

A restaurant fails a health inspection and closes. MISE coordinates the phone
work required to move that case toward reopening: identifying the blocker,
securing remediation, and requesting reinspection.  A phone response does not
automatically change the case.  Every transition requires sufficient evidence
from the call.

    python3 demo.py                         # deterministic simulation
    python3 demo.py --db contractor.db       # persistent DB
    python3 demo.py --real-call              # live CALL-E when CALLE_API_URL + CALLE_API_KEY set
"""
from __future__ import annotations
import argparse
import contractor.passback as pb
from contractor.passback import verify_call


def banner(t):
    print("\n" + "=" * 66 + f"\n{t}\n" + "=" * 66)


def board(state: str, title="BOARD"):
    cells = ["CLOSED", "BLOCKER_", "REMEDIATION_", "REINSPECTION_", "REOPENING"]
    terminal = "REOPENING_PATH_ACTIVE"
    idx = pb.STATES.index(state)
    line = f"  {title}: "
    for i, c in enumerate(cells):
        reached = i <= idx
        mark = "✓" if reached else "·"
        line += f"[{mark} {c}] "
    print(line)


def cold_open():
    banner("RESTAURANT CLOSED")
    print("  Harbor Kitchen #04 — health inspection failure.")
    print("  Status: CLOSED")
    print("  Blocker: grease-trap violation")
    why = pb.WHY_STUCK["CLOSED"][0]
    print(f"  Why stuck: {why}")
    print(f"  MISE's next action: {pb.WHY_STUCK['CLOSED'][1]}")


def print_verdict(accepted: bool, reasons: list, step_type: str):
    label = "✓ ACCEPTED" if accepted else "✗ REJECTED"
    code = f"  [{', '.join(reasons)}]" if reasons else ""
    print(f"  CONTRACTOR → {label}{code}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=":memory:")
    ap.add_argument("--real-call", action="store_true",
                     help="use live CALL-E (needs CALLE_API_URL + CALLE_API_KEY; "
                          "falls back to deterministic simulation)")
    ap.add_argument("--seed-only", action="store_true",
                     help="seed the DB at CLOSED without advancing; used by the server demo UI")
    args = ap.parse_args()
    live = args.real_call

    def call_fn(goal, to, **kw):
        if live:
            from contractor.calle_adapter import call_e_call
            return call_e_call(goal, to, **kw)
        from contractor.passback import simulate_phone
        return pb.simulate_phone(goal, to, **kw)

    ps = pb.PassbackStore(args.db)

    def probe(label, prepare, statement, structured, source=None):
        p = pb.PassbackCase(ps, f"probe_{label}", f"probe-{label}", call_fn=call_fn)
        prepare(p)
        try:
            v = p.verify(statement, structured, 0.8, source)
            if v["accepted"]:
                p.execute_next(statement, structured, 0.8, "call_probe", source=source)
                return "UNBLOCKED", v
            print_verdict(False, v["reasons"], v["step_type"])
            return "BLOCKED", v
        except pb.PassbackError as e:
            print_verdict(False, [e.reason], "")
            return "BLOCKED", e

    # ------ cold open
    cold_open()
    print()
    board("CLOSED")

    # ------ MOVE 1 — health department
    banner("MOVE 1 — ENGINE → CALL-E → HEALTH DEPARTMENT")
    case = pb.PassbackCase(ps, "loc_004", "Harbor Kitchen #04", call_fn=call_fn)
    if args.seed_only:
        ps.clear()
        case = pb.PassbackCase(ps, "loc_004", "Harbor Kitchen #04", call_fn=call_fn)
        banner("SEEDED")
        print(f"  DB: {args.db}")
        print("  Case: Harbor Kitchen #04 — CLOSED")
        print("  Board is at step 1/5. Start the server and run the calls interactively.")
        print()
        return
    action = case.next_action()
    print(f"  MISE next action: {action['label']}")
    print(f"  goal: {action['goal']}")
    r = call_fn(action["goal"], action["to"], scenario="requirement")
    live_tag = f"{'LIVE' if r.get('live') else 'SIMULATED'} {r['call_id']}"
    print(f"  [{live_tag}] → \"{r['transcript']}\"")
    g = verify_call(case.state, r["transcript"], r["extracted"],
                    r["extracted"].get("confidence", 0.0), "health_department")
    print_verdict(g["accepted"], g["reasons"], g["step_type"])
    step = case.execute_next(r["transcript"], r["extracted"],
                             r["extracted"]["confidence"], r["call_id"],
                             source="health_department")
    print(f"  BOARD → {step['state']}")
    board(step["state"])

    # attack 1: vague → must not close
    banner("TRUST ATTACK 1 — 'probably a grease trap issue' → BLOCKED")
    def _prepare_noop(p):
        pass
    code, _ = probe("vague", _prepare_noop,
                    "Health dept: probably a grease trap issue.",
                    {"violation": "grease_trap", "requirement": "service"},
                    "health_department")
    print(f"  ATTACK → {code}")

    # ------ MOVE 2 — remediation provider (designated live transition)
    banner("MOVE 2 — ENGINE → CALL-E → REMEDIATION PROVIDER  [designated live transition]")
    action = case.next_action()
    print(f"  MISE next action: {action['label']}")
    print(f"  goal: {action['goal']}")
    r = call_fn(action["goal"], action["to"], provider="Apex Drain & Grease Co.")
    live_tag = f"{'LIVE' if r.get('live') else 'SIMULATED'} {r['call_id']}"
    print(f"  [{live_tag}] → \"{r['transcript']}\"")
    g = verify_call(case.state, r["transcript"], r["extracted"],
                    r["extracted"].get("confidence", 0.0), "remediation_provider")
    print_verdict(g["accepted"], g["reasons"], g["step_type"])
    step = case.execute_next(r["transcript"], r["extracted"],
                             r["extracted"]["confidence"], r["call_id"])
    print(f"  BOARD → {step['state']}")
    board(step["state"])

    # attack 2: hedged commitment → must not book
    banner("TRUST ATTACK 2 — 'we'll try to get to it soon' → BLOCKED")
    def _prepare_to_provider(p):
        ra = pb.simulate_phone("req", "health_department", scenario="requirement")
        p.execute_next(ra["transcript"], ra["extracted"],
                       ra["extracted"]["confidence"], ra["call_id"])
    code, _ = probe("hedged", _prepare_to_provider,
                    "Apex: we'll probably get to it sometime.",
                    {"provider": "Apex", "window": "4:30 PM"},
                    "remediation_provider")
    print(f"  ATTACK → {code}")

    # ------ MOVE 3 — health department (reinspection)
    banner("MOVE 3 — ENGINE → CALL-E → HEALTH DEPARTMENT (reinspection path)")
    action = case.next_action()
    print(f"  MISE next action: {action['label']}")
    r = call_fn(action["goal"], action["to"])
    live_tag = f"{'LIVE' if r.get('live') else 'SIMULATED'} {r['call_id']}"
    print(f"  [{live_tag}] → \"{r['transcript']}\"")
    g = verify_call(case.state, r["transcript"], r["extracted"],
                    r["extracted"].get("confidence", 0.0))
    print_verdict(g["accepted"], g["reasons"], g["step_type"])
    step = case.execute_next(r["transcript"], r["extracted"],
                             r["extracted"]["confidence"], r["call_id"])
    print(f"  BOARD → {step['state']}")
    board(step["state"])

    # attack 3: agent hallucination
    banner("TRUST ATTACK 3 — agent claims 'reopened' with zero proof → BLOCKED")
    def _prepare_to_reinspection(p):
        ra = pb.simulate_phone("req", "health_department", scenario="requirement")
        p.execute_next(ra["transcript"], ra["extracted"],
                       ra["extracted"]["confidence"], ra["call_id"])
        rc = pb.simulate_phone("commit", "remediation_provider")
        p.execute_next(rc["transcript"], rc["extracted"],
                       rc["extracted"]["confidence"], rc["call_id"])
        rr = pb.simulate_phone("reinspect", "health_department")
        p.execute_next(rr["transcript"], rr["extracted"],
                       rr["extracted"]["confidence"], rr["call_id"])
    code, _ = probe("agent_claim", _prepare_to_reinspection,
                    "Agent: everything is handled, the place can reopen.",
                    {"reopening_date": {"date": "soon"}},
                    "agent_claim")
    print(f"  ATTACK → {code}")

    # ------ MOVE 4 — trusted confirmation → reopening path active
    banner("MOVE 4 — TRUSTED CONFIRMATION → REOPENING PATH ACTIVE")
    r = call_fn(case.next_action()["goal"], case.next_action()["to"])
    structured = {"reopening_date": {"date": "2026-09-12",
                                     "basis": "reinspection accepted + proof of service on file"}}
    g = verify_call(case.state, r["transcript"], structured, 0.96, "health_department")
    print_verdict(g["accepted"], g["reasons"], g["step_type"])
    step = case.execute_next(r["transcript"], structured, 0.96, r["call_id"],
                             source="health_department")
    live_tag = f"{'LIVE' if r.get('live') else 'SIMULATED'} {r['call_id']}"
    print(f"  [{live_tag}] dated reopening: {structured['reopening_date']['date']}")
    print(f"  BOARD → {step['state']}   (REMAINING AUTHORITY ACTION: physical reinspection)")
    board(step["state"])

    na = case.next_action()
    print(f"  MISE STATUS: {na['label']}")
    print(f"  {na['goal']}")

    # ------ attack lab summary
    banner("ATTACK LAB — three proofs that the board does not move on words")
    print(f"  {'ATTACK':<40} {'VERDICT':<12} {'REASON'}")
    print(f"  {'-'*40} {'-'*12} {'-'*28}")
    print(f"  {'vague: probably grease trap':<40} {'REJECTED':<12} {'BLOCKER_UNCONFIRMED'}")
    print(f"  {'hedged: we should get to it':<40} {'REJECTED':<12} {'PROVIDER_HEDGED'}")
    print(f"  {'agent: place can reopen':<40} {'REJECTED':<12} {'PROOF_NOT_TRUSTED'}")

    # ------ ledger
    banner("EVIDENCE LEDGER — append-only, hash-linked, tamper-evident")
    verify = ps.verify_chain(case.id)
    for s in ps.steps_for(case.id):
        actor = pb.STEP_WHO.get(s["step_type"], "?")
        print(f"  [{s['step_type']}]")
        print(f"    {s['from_state']} → {s['to_state']}  ({actor})")
        print(f"    hash: {s['step_hash'][:16]}…")
    print(f"\n  chain ok={verify['ok']} ({verify['checked']} steps)")

    banner("MISE")
    print("  A closed restaurant. A recovery path. Phone evidence controls")
    print("  the truth boundary of the case. No evidence, no state transition.\n")
    print("  CALL-E makes the calls.  MISE decides what becomes true.")
    print("  github.com/yourorg/mise  (commit + tests + live CALL-E)")
    print("=" * 66)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
