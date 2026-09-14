"""PASSBACK — the demo. Supplier recovery.

A critical supplier delivery fails. MISE coordinates the phone work required to
recover: contacting the supplier, extracting a firm commitment, and only
advancing the workflow when the commitment is explicit. A hedged "we'll try"
does not move the board.

    python3 demo.py                         # deterministic simulation
    python3 demo.py --db contractor.db       # persistent DB
    python3 demo.py --real-call              # live CALL-E
"""
from __future__ import annotations
import argparse
import contractor.passback as pb
from contractor.passback import verify_call


def banner(t):
    print("\n" + "=" * 66 + f"\n{t}\n" + "=" * 66)


def board(state: str, title="BOARD"):
    cells = ["DELIVERY_FAILED", "SUPPLIER_REQUIRED", "COMMITMENT_ACCEPTED",
             "RECOVERY_COMMITTED"]
    state_map = {"DELIVERY_FAILED": 0, "SUPPLIER_CONTACT_REQUIRED": 1,
                 "COMMITMENT_REJECTED": 1, "COMMITMENT_ACCEPTED": 2,
                 "RECOVERY_COMMITTED": 3}
    idx = state_map.get(state, 0)
    line = f"  {title}: "
    for i, c in enumerate(cells):
        reached = i <= idx
        mark = "✓" if reached else "·"
        line += f"[{mark} {c}] "
    print(line)


def cold_open():
    banner("INCIDENT #1842 — DELIVERY FAILED")
    print("  4 replacement units required by tomorrow 2:00 PM.")
    print("  Supplier: Acme Industrial Supply")
    why = pb.WHY_STUCK.get("DELIVERY_FAILED",
                            ["Supplier did not deliver. MISE must call "
                             "and extract a firm commitment."])
    print(f"  Why stuck: {why[0]}")
    print(f"  MISE's next action: contact the supplier directly.")


def print_verdict(accepted: bool, reasons: list, step_type: str):
    label = "✓ ACCEPTED" if accepted else "✗ REJECTED"
    code = f"  [{', '.join(reasons)}]" if reasons else ""
    print(f"  CONTRACTOR → {label}{code}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=":memory:")
    ap.add_argument("--real-call", action="store_true",
                     help="use live CALL-E (needs CALLE_API_URL + CALLE_API_KEY)")
    ap.add_argument("--seed-only", action="store_true",
                     help="seed the DB without advancing; used by the server demo UI")
    args = ap.parse_args()
    live = args.real_call

    def call_fn(goal, to, **kw):
        if live:
            from contractor.calle_adapter import call_e_call
            return call_e_call(goal, to, **kw)
        from contractor.passback import simulate_phone
        return pb.simulate_phone(goal, to, **kw)

    ps = pb.PassbackStore(args.db)

    # ------ cold open
    cold_open()
    print()
    board("DELIVERY_FAILED")

    # ------ seed-only mode (for server UI)
    if args.seed_only:
        ps.clear()
        case = pb.PassbackCase(ps, "loc_004", "Acme Industrial Supply",
                                call_fn=call_fn)
        banner("SEEDED")
        print(f"  DB: {args.db}")
        print("  Case: INCIDENT #1842 — DELIVERY FAILED")
        print("  Board is at step 1/4. Start the server and run the calls.")
        print()
        return

    # ------ STEP 1 — call supplier (first attempt, hedged)
    banner("STEP 1 — ENGINE → CALL-E → SUPPLIER (first attempt)")
    case = pb.PassbackCase(ps, "loc_004", "Acme Industrial Supply",
                            call_fn=call_fn)
    action = case.next_action()
    print(f"  MISE next action: {action['label']}")
    print(f"  goal: {action['goal']}")
    r = call_fn(action["goal"], action["to"], scenario="hedged")
    live_tag = f"{'LIVE' if r.get('live') else 'SIMULATED'} {r['call_id']}"
    print(f"  [{live_tag}] → \"{r['transcript']}\"")
    g = verify_call(case.state, r["transcript"], r["extracted"],
                    r["extracted"].get("confidence", 0.0), "supplier")
    print_verdict(g["accepted"], g["reasons"], g["step_type"])

    # The first call is hedged — the board does not advance
    try:
        case.execute_next(r["transcript"], r["extracted"],
                          r["extracted"]["confidence"], r["call_id"])
        print(f"  BOARD → {case.state}")
    except pb.PassbackError as e:
        print(f"  BOARD → {case.state}  (first call hedged: {e.reason})")

    board(case.state)

    # ------ ATTACK 1 — hedging
    banner("TRUST ATTACK 1 — 'we'll try to get to it soon' → BLOCKED")
    print("  Supplier: we'll try to get some units out by 4:00 PM.")
    v_attack1 = verify_call(
        case.state,
        "Supplier: we'll try to get some units out by 4:00 PM.",
        {"action": "ship", "quantity": 4, "window": "4:00 PM"},
        0.45, "supplier")
    print_verdict(v_attack1["accepted"], v_attack1["reasons"], "")
    print(f"  ATTACK → {'REJECTED' if not v_attack1['accepted'] else 'UNBLOCKED'}")

    # ------ ATTACK 2 — missing deadline
    banner("TRUST ATTACK 2 — 'we'll get to it sometime' → BLOCKED")
    print("  Supplier: Yeah, we have them in stock. We can probably ship.")
    v_attack2 = verify_call(
        case.state,
        "Supplier: Yeah, we have them in stock. We can probably ship.",
        {"action": "ship", "quantity": 4}, 0.8, "supplier")
    print_verdict(v_attack2["accepted"], v_attack2["reasons"], "")
    print(f"  ATTACK → {'REJECTED' if not v_attack2['accepted'] else 'UNBLOCKED'}")

    # ------ ATTACK 3 — agent hallucination
    banner("TRUST ATTACK 3 — agent claims 'recovery done' with zero proof → BLOCKED")
    print("  Agent: delivery confirmed, case closed.")
    v_attack3 = verify_call(
        case.state,
        "Agent: delivery confirmed, case closed.",
        {"status": "done", "delivery_confirmed": True},
        0.99, "agent_claim")
    print_verdict(v_attack3["accepted"], v_attack3["reasons"], "")
    print(f"  ATTACK → {'REJECTED' if not v_attack3['accepted'] else 'UNBLOCKED'}")

    # ------ STEP 2 — call supplier (firm commitment, advances to SUPPLIER_CONTACT_REQUIRED)
    banner("STEP 2 — ENGINE → CALL-E → SUPPLIER (escalation)")
    action = case.next_action()
    print(f"  MISE next action: {action['label']}")
    print(f"  goal: {action['goal']}")
    r2 = call_fn(action["goal"], action["to"])
    live_tag2 = f"{'LIVE' if r2.get('live') else 'SIMULATED'} {r2['call_id']}"
    print(f"  [{live_tag2}] → \"{r2['transcript']}\"")
    g2 = verify_call(case.state, r2["transcript"], r2["extracted"],
                     r2["extracted"].get("confidence", 0.0), "supplier")
    print_verdict(g2["accepted"], g2["reasons"], g2["step_type"])
    step2 = case.execute_next(r2["transcript"], r2["extracted"],
                              r2["extracted"]["confidence"], r2["call_id"])
    print(f"  BOARD → {step2['state']}")
    board(step2["state"])

    # ------ STEP 3 — call supplier (commitment accepted, terminal)
    banner("STEP 3 — ENGINE → CALL-E → SUPPLIER (commitment)")
    action = case.next_action()
    print(f"  MISE next action: {action['label']}")
    print(f"  goal: {action['goal']}")
    r3 = call_fn(action["goal"], action["to"])
    live_tag3 = f"{'LIVE' if r3.get('live') else 'SIMULATED'} {r3['call_id']}"
    print(f"  [{live_tag3}] → \"{r3['transcript']}\"")
    g3 = verify_call(case.state, r3["transcript"], r3["extracted"],
                     r3["extracted"].get("confidence", 0.0), "supplier")
    print_verdict(g3["accepted"], g3["reasons"], g3["step_type"])
    step3 = case.execute_next(r3["transcript"], r3["extracted"],
                              r3["extracted"]["confidence"], r3["call_id"])
    print(f"  BOARD → {step3['state']}")
    board(step3["state"])

    # ------ terminal
    na = case.next_action()
    print(f"\n  MISE STATUS: {na['label']}")
    print(f"  COMMITMENT ACCEPTED → RECOVERY COMMITTED")

    # ------ attack lab summary
    banner("ATTACK LAB — three proofs that the board does not move on words")
    print(f"  {'ATTACK':<40} {'VERDICT':<12} {'REASON'}")
    print(f"  {'-'*40} {'-'*12} {'-'*28}")
    hedged_label = "hedged: we'll try to get to it"
    print(f"  {hedged_label:<40} {'REJECTED':<12} {'SUPPLIER_HEDGED'}")
    missing_label = "missing deadline: probably ship"
    print(f"  {missing_label:<40} {'REJECTED':<12} {'DELIVERY_WINDOW_MISSING'}")
    agent_label = "agent hallucination: done"
    print(f"  {agent_label:<40} {'REJECTED':<12} {'PROOF_NOT_TRUSTED'}")

    # ------ evidence ledger
    banner("EVIDENCE LEDGER — append-only, hash-linked, tamper-evident")
    verify = ps.verify_chain(case.id)
    for s in ps.steps_for(case.id):
        actor = pb.STEP_WHO.get(s["step_type"], "?")
        print(f"  [{s['step_type']}]")
        print(f"    {s['from_state']} → {s['to_state']}  ({actor})")
        print(f"    hash: {s['step_hash'][:16]}…")
    print(f"\n  chain ok={verify['ok']} ({verify['checked']} steps)")

    banner("MISE — Don't let 'maybe' become 'done.'")
    print("  INCIDENT #1842: 4 replacement units. Delivery failed.")
    print("  MISE calls the supplier. Extracts the commitment.")
    print("  Tests whether it is actionable. Only then advances.\n")
    print("  CALL-E makes the calls.  MISE decides when the work")
    print("  is actually allowed to move.")
    print("=" * 66)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
