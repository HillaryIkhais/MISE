"""SQLite store. Five tables: commitments, commitment_terms, evidence, events, authorities."""
from __future__ import annotations
import json
import sqlite3
from pathlib import Path
from typing import Optional

SCHEMA = """
CREATE TABLE IF NOT EXISTS commitments (
  id TEXT PRIMARY KEY,
  parent_id TEXT,
  actor_id TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  source_call_id TEXT,
  state TEXT NOT NULL,
  created_at TEXT NOT NULL,
  effective_at TEXT,
  deadline TEXT,
  fingerprint TEXT NOT NULL,
  amended_by TEXT,
  conditions_json TEXT NOT NULL DEFAULT '[]',
  evidence_requirements_json TEXT NOT NULL DEFAULT '[]',
  provenance_json TEXT NOT NULL DEFAULT '{}',
  confirmation_json TEXT NOT NULL DEFAULT '{}',
  origin TEXT NOT NULL DEFAULT 'programmatic'
);
CREATE TABLE IF NOT EXISTS commitment_terms (
  commitment_id TEXT PRIMARY KEY,
  terms_json TEXT NOT NULL,
  FOREIGN KEY(commitment_id) REFERENCES commitments(id)
);
CREATE TABLE IF NOT EXISTS evidence (
  id TEXT PRIMARY KEY,
  commitment_id TEXT NOT NULL,
  type TEXT NOT NULL,
  source TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  payload_hash TEXT NOT NULL UNIQUE,
  payload_json TEXT NOT NULL,
  FOREIGN KEY(commitment_id) REFERENCES commitments(id)
);
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  commitment_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  actor TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  previous_hash TEXT NOT NULL,
  event_hash TEXT NOT NULL,
  FOREIGN KEY(commitment_id) REFERENCES commitments(id)
);
CREATE TABLE IF NOT EXISTS authorities (
  actor_id TEXT PRIMARY KEY,
  scopes_json TEXT NOT NULL,
  valid_from TEXT,
  valid_until TEXT
);
CREATE TABLE IF NOT EXISTS used_confirmations (
  replay_key TEXT PRIMARY KEY,
  commitment_id TEXT NOT NULL,
  used_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_commitment_fingerprint ON commitments(fingerprint);
"""


class Store:
    def __init__(self, path: str = ":memory:"):
        self.path = path
        self.conn = sqlite3.connect(path)
        self.conn.row_factory = sqlite3.Row
        self.conn.executescript(SCHEMA)
        # keep single connection; WAL not needed for hackathon scale
        self.conn.execute("PRAGMA foreign_keys = ON")
        # migrate pre-10/10 databases lacking formation columns
        cols = {r["name"] for r in
                self.conn.execute("PRAGMA table_info(commitments)").fetchall()}
        for col, default in (
            ("conditions_json", "'[]'"),
            ("evidence_requirements_json", "'[]'"),
            ("provenance_json", "'{}'"),
            ("confirmation_json", "'{}'"),
            ("origin", "'programmatic'"),
        ):
            if col not in cols:
                self.conn.execute(
                    f"ALTER TABLE commitments ADD COLUMN {col} TEXT NOT NULL DEFAULT {default}")
        self.conn.commit()

    @classmethod
    def at(cls, path: str | Path) -> "Store":
        return cls(str(path))

    # -- generic helpers
    def execute(self, sql: str, params: tuple = ()):
        cur = self.conn.execute(sql, params)
        self.conn.commit()
        return cur

    def fetchone(self, sql: str, params: tuple = ()):
        return self.conn.execute(sql, params).fetchone()

    def fetchall(self, sql: str, params: tuple = ()):
        return self.conn.execute(sql, params).fetchall()

    # -- commitments
    def insert_commitment(self, c) -> None:
        self.execute(
            "INSERT INTO commitments(id,parent_id,actor_id,actor_name,source_call_id,"
            "state,created_at,effective_at,deadline,fingerprint,amended_by,"
            "conditions_json,evidence_requirements_json,provenance_json,confirmation_json,origin)"
            " VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (c.id, c.parent_id, c.actor_id, c.actor_name, c.source_call_id,
             c.state, c.created_at, c.effective_at, c.deadline, c.fingerprint,
             c.amended_by, json.dumps(getattr(c, "conditions", [])),
             json.dumps(getattr(c, "evidence_requirements", [])),
             json.dumps(getattr(c, "provenance", {})),
             json.dumps(getattr(c, "confirmation", {})),
             getattr(c, "origin", "programmatic")),
        )
        self.execute(
            "INSERT INTO commitment_terms(commitment_id,terms_json) VALUES(?,?)",
            (c.id, json.dumps(c.terms)),
        )

    def get_commitment_row(self, cid: str):
        return self.fetchone("SELECT * FROM commitments WHERE id=?", (cid,))

    def get_terms(self, cid: str) -> dict:
        row = self.fetchone(
            "SELECT terms_json FROM commitment_terms WHERE commitment_id=?", (cid,))
        return json.loads(row["terms_json"]) if row else {}

    def update_state(self, cid: str, new_state: str) -> None:
        self.execute("UPDATE commitments SET state=? WHERE id=?", (new_state, cid))

    def set_amended_by(self, parent_id: str, child_id: str) -> None:
        self.execute("UPDATE commitments SET amended_by=? WHERE id=?",
                     (child_id, parent_id))

    def fingerprint_exists(self, fp: str) -> bool:
        row = self.fetchone("SELECT id FROM commitments WHERE fingerprint=?", (fp,))
        return row is not None

    def list_commitments(self):
        return self.fetchall("SELECT * FROM commitments ORDER BY created_at")

    def lineage(self, cid: str) -> list:
        """Walk parent chain up, then collect children down (one level chains)."""
        chain = []
        cur = cid
        seen = set()
        while cur and cur not in seen:
            seen.add(cur)
            row = self.get_commitment_row(cur)
            if not row:
                break
            chain.append(dict(row))
            cur = row["parent_id"]
        chain.reverse()
        # descend: children of cid (and grandchildren recursively)
        def children(pid: str):
            out = []
            for r in self.fetchall("SELECT * FROM commitments WHERE parent_id=?", (pid,)):
                d = dict(r)
                out.append(d)
                out.extend(children(d["id"]))
            return out
        root_children = []
        if chain:
            # find descendants of the original queried node
            root_children = children(cid)
        return chain + root_children

    # -- evidence
    def insert_evidence(self, e) -> None:
        self.execute(
            "INSERT INTO evidence(id,commitment_id,type,source,observed_at,"
            "payload_hash,payload_json) VALUES(?,?,?,?,?,?,?)",
            (e.id, e.commitment_id, e.type, e.source, e.observed_at,
             e.payload_hash, json.dumps(e.payload)),
        )

    def evidence_for(self, cid: str):
        return self.fetchall(
            "SELECT * FROM evidence WHERE commitment_id=? ORDER BY observed_at", (cid,))

    def payload_hash_exists(self, ph: str) -> bool:
        return self.fetchone("SELECT id FROM evidence WHERE payload_hash=?", (ph,)) is not None

    def confirmation_replayed(self, replay_key: str) -> bool:
        return self.fetchone("SELECT replay_key FROM used_confirmations WHERE replay_key=?",
                             (replay_key,)) is not None

    def consume_confirmation(self, replay_key: str, commitment_id: str, used_at: str) -> None:
        self.execute("INSERT INTO used_confirmations(replay_key,commitment_id,used_at)"
                     " VALUES(?,?,?)", (replay_key, commitment_id, used_at))

    # -- events
    def last_hash(self, cid: str) -> str:
        from .models import GENESIS_HASH
        rows = self.fetchall(
            "SELECT event_hash FROM events WHERE commitment_id=? ORDER BY timestamp, rowid",
            (cid,))
        return rows[-1]["event_hash"] if rows else GENESIS_HASH

    def insert_event(self, ev) -> None:
        self.execute(
            "INSERT INTO events(id,commitment_id,event_type,timestamp,actor,"
            "payload_json,previous_hash,event_hash) VALUES(?,?,?,?,?,?,?,?)",
            (ev.id, ev.commitment_id, ev.event_type, ev.timestamp, ev.actor,
             json.dumps(ev.payload), ev.previous_hash, ev.event_hash),
        )

    def events_for(self, cid: str):
        return self.fetchall(
            "SELECT * FROM events WHERE commitment_id=? ORDER BY timestamp, rowid", (cid,))

    def all_events(self):
        return self.fetchall("SELECT * FROM events ORDER BY timestamp, rowid")

    # -- authorities
    def upsert_authority(self, actor_id: str, scopes: list, valid_from=None, valid_until=None):
        self.execute(
            "INSERT INTO authorities(actor_id,scopes_json,valid_from,valid_until)"
            " VALUES(?,?,?,?) ON CONFLICT(actor_id) DO UPDATE SET"
            " scopes_json=excluded.scopes_json, valid_from=excluded.valid_from,"
            " valid_until=excluded.valid_until",
            (actor_id, json.dumps(scopes), valid_from, valid_until),
        )

    def get_authority(self, actor_id: str):
        return self.fetchone("SELECT * FROM authorities WHERE actor_id=?", (actor_id,))
