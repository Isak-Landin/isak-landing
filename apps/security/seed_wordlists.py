# apps/security/seed_wordlists.py
import os, io, hashlib
from flask import current_app
from sqlalchemy import text
from extensions import db

# Where your wordlists live in the image:
# you already ship static/wordlists/top_10k.txt & top_10m.txt
DEFAULT_10K = "static/wordlists/top_10k.txt"
DEFAULT_10M = "static/wordlists/top_10m.txt"

CHUNK = 200_000  # lines per COPY chunk; tune if needed

def _abspath(relpath: str) -> str:
    root = current_app.root_path  # works inside app context
    return os.path.join(root, relpath)

def _table_count(table: str) -> int:
    return db.session.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar() or 0

def _copy_chunk(table: str, hashes):
    """
    COPY the chunk into an UNLOGGED staging table (no constraints), then merge
    unique rows into the destination with ON CONFLICT DO NOTHING.
    This prevents duplicate-key errors from aborting COPY.
    """
    staging = f"{table}_staging"

    raw = db.engine.raw_connection()
    try:
        cur = raw.cursor()
        # 1) Create staging once; keep it small by truncating per chunk
        cur.execute(f"CREATE UNLOGGED TABLE IF NOT EXISTS {staging} (hash text)")
        cur.execute(f"TRUNCATE {staging}")
        raw.commit()

        # 2) COPY this chunk (one column) into staging
        buf = io.StringIO()
        for h in hashes:
            buf.write(h + "\n")
        buf.seek(0)
        cur.copy_expert(f"COPY {staging} (hash) FROM STDIN WITH (FORMAT csv)", buf)
        raw.commit()

        # 3) Merge into destination; ON CONFLICT keeps it idempotent
        cur.execute(f"""
            INSERT INTO {table} (hash)
            SELECT DISTINCT hash
            FROM {staging}
            WHERE hash IS NOT NULL AND hash <> ''
            ON CONFLICT DO NOTHING
        """)
        raw.commit()

        # 4) Keep staging empty between chunks (so memory stays bounded)
        cur.execute(f"TRUNCATE {staging}")
        raw.commit()
    finally:
        raw.close()


def _hash_lines(path: str):
    """
    Generator that yields SHA-256 hex of lowercased, stripped passwords.
    Skips blanks.
    """
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            pw = line.strip()
            if not pw:
                continue
            h = hashlib.sha256(pw.lower().encode("utf-8")).hexdigest()
            yield h

def _seed_file_to_table(path: str, table: str):
    # If already seeded, skip
    if _table_count(table) > 0:
        current_app.logger.info(f"[wordlist] {table} already populated — skip.")
        return

    current_app.logger.info(f"[wordlist] Seeding {table} from {path}...")
    gen = _hash_lines(path)

    # Stream in chunks to avoid RAM spikes
    batch = []
    done = 0
    try:
        while True:
            for _ in range(CHUNK - len(batch)):
                try:
                    batch.append(next(gen))
                except StopIteration:
                    break
            if not batch:
                break
            _copy_chunk(table, batch)
            done += len(batch)
            batch.clear()
            if done % 1_000_000 == 0:
                current_app.logger.info(f"[wordlist] {table}: {done:,} rows loaded...")
    except Exception as e:
        # Fallback if COPY isn't available (e.g., non-psycopg engine)
        current_app.logger.warning(f"[wordlist] COPY failed or partial ({e}); falling back to batched inserts.")
        # Insert remaining + remainder of generator in smaller batches
        def _flush_batched(items):
            if not items:
                return
            rows = [{"hash": h} for h in items]
            db.session.execute(text(f"INSERT INTO {table} (hash) VALUES (:hash) ON CONFLICT DO NOTHING"), rows)
            db.session.commit()

        # flush anything we already accumulated
        _flush_batched(batch)
        batch.clear()
        # Continue with batched inserts
        for h in gen:
            batch.append(h)
            if len(batch) >= 10_000:
                _flush_batched(batch)
                done += 10_000
                batch.clear()
        _flush_batched(batch)

    current_app.logger.info(f"[wordlist] {table} seeding complete.")

def seed_wordlists(
    path_10k: str | None = None,
    path_10m: str | None = None
):
    """
    Idempotent: loads only if tables are empty.
    Paths can be overridden with env WORDLIST_10K / WORDLIST_10M or by args.
    """
    p10k = path_10k or os.getenv("WORDLIST_10K") or DEFAULT_10K
    p10m = path_10m or os.getenv("WORDLIST_10M") or DEFAULT_10M

    # Ensure tables exist (in case this runs before create_all in a task)
    db.create_all()

    if os.path.isfile(_abspath(p10k)):
        _seed_file_to_table(_abspath(p10k), "weak_passwords_10k")
    else:
        current_app.logger.warning(f"[wordlist] 10k list not found at {p10k}; skipping.")

    if os.path.isfile(_abspath(p10m)):
        _seed_file_to_table(_abspath(p10m), "weak_passwords_10m")
    else:
        current_app.logger.warning(f"[wordlist] 10m list not found at {p10m}; skipping.")
