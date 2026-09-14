"""CALL-E → CONTRACTOR → mock order system — the hero reference integration.

The order system makes real decisions from CONTRACTOR's verdicts. When
CONTRACTOR says BLOCK, the order system refuses; when it says ALLOW, it acts.
The agent's word is never the gate; the protocol is.

Run: python3 examples/order_fulfillment.py
"""
from __future__ import annotations
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from contractor import Contractor, Store
from contractor.calle_adapter import simulate_call

NOW = datetime.now(timezone.utc)
DL = (NOW + timedelta(hours=2)).replace(microsecond=0).isoformat()


class OrderSystem:
    def __init__(self, contractor: Contractor):
        self.contractor = contractor
        self.dispatched: list[str] = []
        self.payments: list[str] = []

    def try_dispatch(self, cid: str) -> dict:
        gate = self.contractor.evaluate(cid)["actions"]["dispatch"]
        if not gate["allowed"]:
            return {"executed": False, "gate": gate["reason"]}
        self.dispatched.append(cid)
        return {"executed": True, "gate": gate["reason"]}

    def try_pay(self, cid: str) -> dict:
        gate = self.contractor.evaluate(cid)["actions"]["release_payment"]
        if not gate["allowed"]:
            return {"executed": False, "gate": gate["reason"]}
        self.payments.append(cid)
        return {"executed": True, "gate": gate["reason"]}


def main() -> int:
    c = Contractor(Store())
    c.register_authority("supplier_001", ["inventory", "delivery", "procurement"])
    orders = OrderSystem(c)

    print("=" * 60)
    print("CALL-E: arranging 100 units for Friday (real call in production)")
    print("=" * 60)

    # the call happens; supplier hedges
    call = simulate_call("Acme Supplies", "Arrange 100 units for Friday",
                         scenario="vague", quantity=100, deadline=DL)
    terms = {"action": "deliver", "quantity": 100, "unit": "units",
             "destination": "warehouse_a", "deadline": DL}
    print(f"\nhuman said: {call['transcript'].split(': ')[-1]}")
    session = c.form("Arrange 100 units for Friday", "Acme Supplies",
                     terms=terms, transcript=call["transcript"])
    print(f"CONTRACTOR: {session['state']} — no commitment created")
    for q in session["questions"]:
        print(f"  clarify → {q}")

    # read-back converges
    session = c.clarify(
        session,
        f"I confirm: exactly 100 units to warehouse A by {DL}. I commit.",
        terms=terms)
    print(f"\nafter read-back: {session['state']}")
    record = c.confirm(
        session,
        f"I confirm exactly 100 units to warehouse A by {DL}. I commit.",
        "supplier_001", call_id=call["call_id"])
    comm = c.commit(record, "supplier_001", "Acme Supplies",
                    call_id=call["call_id"])
    print(f"COMMITMENT #{comm.id}: {c.commitment(comm.id)['state']} — locked")

    # downstream attempts to act pre-proof
    print("\norder system asks CONTRACTOR:")
    print("  dispatch (pre-evidence):", orders.try_dispatch(comm.id)["gate"])
    print("  pay      (pre-evidence):", orders.try_pay(comm.id))

    # qualifying evidence arrives
    c.record_evidence(comm.id, "shipment_receipt", "warehouse_system",
                      payload={"quantity": 100})
    d = c.evaluate(comm.id)
    print(f"\nwarehouse receipt: 100/100 → {d['verdict']} → {d['state']}")
    print("  pay (post-proof):", orders.try_pay(comm.id))
    assert comm.id in orders.payments and comm.id in orders.dispatched

    print("\nOK: downstream actions gated by the protocol, not the agent.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())