"""Property test: Committed Terms ⊆ Mutually Confirmed Terms, universally.

Generates thousands of deterministic (seeded) term mutations and asserts the
formation gate rejects every single escalation — widening, narrowing,
deadline shifts, destination/object/unit/price/currency changes, dropped or
added conditions — while the exact match always passes.

Run: python3 -m unittest tests.test_properties -v
"""
import random
import unittest
from contractor import formation
from contractor.models import ProtocolError

SEED = 20260910
N_CASES = 5000

BASE = {"action": "deliver", "quantity": 100, "unit": "units",
        "destination": "warehouse_a", "deadline": "2026-09-11T16:00:00+00:00",
        "object": "bolts", "price": 250.0, "currency": "USD"}
BASE_CONDS = ["if the inbound shipment arrives thursday"]


def mutate(rng: random.Random) -> tuple[dict, dict, str]:
    """Return (confirmed, committed, mutation_kind)."""
    confirmed = dict(BASE, conditions=list(BASE_CONDS))
    committed = dict(BASE, conditions=list(BASE_CONDS))
    kind = rng.choice(["qty_up", "qty_down", "deadline_early", "deadline_late",
                       "destination", "unit", "object", "price", "currency",
                       "drop_condition", "add_condition", "action", "exact"])
    if kind == "qty_up":
        committed["quantity"] = 100 + rng.randint(1, 500)
    elif kind == "qty_down":
        committed["quantity"] = rng.randint(1, 99)
    elif kind == "deadline_early":
        committed["deadline"] = "2026-09-10T09:00:00+00:00"
    elif kind == "deadline_late":
        committed["deadline"] = "2026-09-20T16:00:00+00:00"
    elif kind == "destination":
        committed["destination"] = rng.choice(["warehouse_b", "dock_7", ""])
    elif kind == "unit":
        committed["unit"] = rng.choice(["boxes", "pallets", "kg"])
    elif kind == "object":
        committed["object"] = rng.choice(["nuts", "washers", "screws"])
    elif kind == "price":
        committed["price"] = round(rng.uniform(0, 9999), 2)
    elif kind == "currency":
        committed["currency"] = rng.choice(["NGN", "EUR", "GBP", "JPY"])
    elif kind == "drop_condition":
        committed["conditions"] = []
    elif kind == "add_condition":
        committed["conditions"] = list(BASE_CONDS) + ["if the moon is full"]
    elif kind == "action":
        committed["action"] = rng.choice(["collect", "inspect", "deliver_partial"])
    return confirmed, committed, kind


class TestNonWideningProperty(unittest.TestCase):
    def test_no_mutation_ever_escalates_confirmation(self):
        rng = random.Random(SEED)
        evaluated = 0
        blocked: dict[str, int] = {}
        violations: list[str] = []
        for _ in range(N_CASES):
            confirmed, committed, kind = mutate(rng)
            evaluated += 1
            try:
                formation.check_non_widening(confirmed, committed)
            except ProtocolError as e:
                blocked[e.reason] = blocked.get(e.reason, 0) + 1
                continue
            if kind != "exact":
                violations.append(f"{kind} passed the gate")
        print(f"\nproperty: {evaluated} mutations evaluated, "
              f"{sum(blocked.values())} blocked, {len(violations)} violations")
        print("blocked-by: " + ", ".join(f"{k}={v}" for k, v in sorted(blocked.items())))
        self.assertEqual(violations, [])
        self.assertEqual(evaluated, N_CASES)

    def test_exact_match_always_passes(self):
        rng = random.Random(SEED + 1)
        for _ in range(500):
            confirmed = dict(BASE, conditions=list(BASE_CONDS))
            committed = dict(BASE, conditions=list(BASE_CONDS))
            # float/int equivalence must not false-positive
            if rng.random() < 0.5:
                committed["quantity"] = 100.0
            formation.check_non_widening(confirmed, committed)


if __name__ == "__main__":
    unittest.main(verbosity=2)
