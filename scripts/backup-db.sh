#!/usr/bin/env bash
#
# Nightly dump of the Atlas database to local disk.
#
# Why this exists: the cluster is on a tier with no automated backups, and the
# application credential can drop the database outright. Access control decides
# who gets in; a backup is the only thing that gets the bookings back once
# somebody has. Treat the output as a full copy of guest PII — it is.
#
# Installed as a systemd timer; see backup-db.service / backup-db.timer.
set -Eeuo pipefail
umask 077

ENV_FILE="${ENV_FILE:-/root/asterias-backend/.env.production}"
BACKUP_DIR="${BACKUP_DIR:-/root/backups/asterias}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
MONGO_IMAGE="${MONGO_IMAGE:-mongo:7.0}"

log() { echo "[$(date -Is)] $*"; }
fail() { log "FAILED: $*"; exit 1; }

[[ -r "$ENV_FILE" ]] || fail "cannot read $ENV_FILE"

# Pull only the one value, without sourcing the file: it holds Stripe and SMTP
# secrets that have no business in this process's environment.
MONGODB_URI="$(grep -E '^MONGODB_URI=' "$ENV_FILE" | head -1 | cut -d= -f2- | sed -e 's/^"//' -e "s/^'//" -e 's/"$//' -e "s/'$//")"
[[ -n "$MONGODB_URI" ]] || fail "no MONGODB_URI in $ENV_FILE"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
NAME="asterias-homes-$STAMP.archive.gz"
ARCHIVE="$BACKUP_DIR/$NAME"

log "dumping to $ARCHIVE"

# --archive + --gzip gives one restorable file. The URI goes in on stdin rather
# than argv so it never appears in `ps` output or the journal.
printf '%s' "$MONGODB_URI" | docker run --rm -i \
  -v "$BACKUP_DIR:/backup" \
  "$MONGO_IMAGE" \
  bash -c "read -r uri; exec mongodump --uri=\"\$uri\" --archive=/backup/$NAME --gzip --quiet" \
  || fail "mongodump returned non-zero"

[[ -s "$ARCHIVE" ]] || fail "archive is empty"
chmod 600 "$ARCHIVE"

SIZE="$(du -h "$ARCHIVE" | cut -f1)"
log "wrote $ARCHIVE ($SIZE)"

# Prove the archive parses before trusting it. A dump that cannot be read back
# is not a backup, and finding that out mid-restore is too late. --dryRun needs
# a cluster to resolve namespaces against, so it gets the URI the same way;
# nothing is written to the database.
if ! printf '%s' "$MONGODB_URI" | docker run --rm -i \
      -v "$BACKUP_DIR:/backup" \
      "$MONGO_IMAGE" \
      bash -c "read -r uri; exec mongorestore --uri=\"\$uri\" --archive=/backup/$NAME --gzip --dryRun --quiet" >/dev/null 2>&1; then
  fail "archive failed its restore check — $ARCHIVE is not trustworthy"
fi
log "restore check passed (dry run, nothing written)"

DELETED="$(find "$BACKUP_DIR" -name 'asterias-homes-*.archive.gz' -mtime "+$RETENTION_DAYS" -print -delete | wc -l)"
log "pruned $DELETED archive(s) older than $RETENTION_DAYS days"
log "done; $(find "$BACKUP_DIR" -name 'asterias-homes-*.archive.gz' | wc -l) archive(s) on disk"
