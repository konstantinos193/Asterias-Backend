#!/usr/bin/env bash
#
# Closes the two database findings that cannot be fixed over a database
# connection, because Atlas keeps user and network management in its control
# plane:
#
#   1. the application logs in as `atlasAdmin` — full cluster admin, able to
#      drop every database on the cluster;
#   2. the IP access list contains 0.0.0.0/0, so the cluster answers the whole
#      internet and the password is the only control left.
#
# Usage:
#
#   ATLAS_PUBLIC_KEY=xxxx ATLAS_PRIVATE_KEY=yyyy ./scripts/harden-atlas.sh
#
# Key: Atlas -> Identity & Access -> Applications -> API Keys, role
# "Project Owner" on the project holding the cluster. Delete it when done; it
# is as powerful as a console login.
set -Eeuo pipefail

API="https://cloud.mongodb.com/api/atlas/v2"
ACCEPT="Accept: application/vnd.atlas.2023-01-01+json"
CTYPE="Content-Type: application/json"

APP_IP="${APP_IP:-194.99.21.157}"            # the VPS that runs the backend
DB_NAME="${DB_NAME:-asterias-homes}"
APP_USER="${APP_USER:-asterias-app}"
CLUSTER_HINT="${CLUSTER_HINT:-exjpezb}"      # identifies the right project

: "${ATLAS_PUBLIC_KEY:?set ATLAS_PUBLIC_KEY}"
: "${ATLAS_PRIVATE_KEY:?set ATLAS_PRIVATE_KEY}"

log()  { echo "[atlas] $*"; }
fail() { echo "[atlas] FAILED: $*" >&2; exit 1; }

# Atlas uses HTTP digest auth, hence --digest rather than -u alone.
api() {
  local method="$1" path="$2" body="${3:-}"
  if [[ -n "$body" ]]; then
    curl -sS --digest -u "$ATLAS_PUBLIC_KEY:$ATLAS_PRIVATE_KEY" \
      -H "$ACCEPT" -H "$CTYPE" -X "$method" "$API$path" -d "$body"
  else
    curl -sS --digest -u "$ATLAS_PUBLIC_KEY:$ATLAS_PRIVATE_KEY" \
      -H "$ACCEPT" -X "$method" "$API$path"
  fi
}

# sed against JSON is a bad idea the moment a field moves; node is already a
# dependency of this repo.
json() { node -e '
  let b = "";
  process.stdin.on("data", d => b += d).on("end", () => {
    try { process.stdout.write(eval(process.argv[1]) ?? ""); } catch (e) { process.exit(0); }
  });
' "$1"; }

# ── Which project? ────────────────────────────────────────────────────────
# This organization holds more than one project. Taking whichever the API
# lists first would create the credential somewhere harmless, report success,
# and leave the real cluster exactly as exposed as it is today. So the project
# is identified by the cluster that is actually in the connection string.
log "looking up projects"
PROJECTS="$(api GET /groups)"
echo "$PROJECTS" | grep -q '"id"' || fail "no projects returned — check the API key and its roles"

if [[ -n "${ATLAS_GROUP_ID:-}" ]]; then
  GROUP_ID="$ATLAS_GROUP_ID"
  log "using project $GROUP_ID from ATLAS_GROUP_ID"
else
  GROUP_ID=""
  for id in $(echo "$PROJECTS" | json 'JSON.parse(b).results.map(g=>g.id).join("\n")'); do
    name="$(echo "$PROJECTS" | GID="$id" json 'JSON.parse(b).results.find(g=>g.id===process.env.GID).name')"
    if api GET "/groups/$id/clusters" | grep -q "$CLUSTER_HINT"; then
      GROUP_ID="$id"
      log "matched project '$name' [$id] — it holds the $CLUSTER_HINT cluster"
      break
    fi
    log "  skipped '$name' [$id] — no $CLUSTER_HINT cluster here"
  done
  [[ -n "$GROUP_ID" ]] || fail "no project holds a cluster matching '$CLUSTER_HINT'; set ATLAS_GROUP_ID"
fi

# ── Order matters ─────────────────────────────────────────────────────────
# Allow the VPS explicitly BEFORE anything else. Removing 0.0.0.0/0 while the
# VPS is not on the list takes production offline, so that deletion is left
# for you to do by hand once the new credential is proven.
log "allowing $APP_IP"
ACL="$(api POST "/groups/$GROUP_ID/accessList" \
  "[{\"ipAddress\":\"$APP_IP\",\"comment\":\"asterias backend VPS\"}]")"
echo "$ACL" | grep -q '"error"' && log "  note: $(echo "$ACL" | json 'JSON.parse(b).detail')" || log "  allowed"

# ── A credential that can reach one database and nothing else ─────────────
# Generated with node rather than tr|head: under `set -o pipefail`, head
# closing the pipe kills tr with SIGPIPE and takes the whole script with it.
NEW_PASS="$(node -e 'process.stdout.write(require("crypto").randomBytes(48).toString("base64url").slice(0,40))')"
[[ ${#NEW_PASS} -eq 40 ]] || fail "could not generate a password"
log "creating $APP_USER with readWrite on $DB_NAME only"
RESP="$(api POST "/groups/$GROUP_ID/databaseUsers" "$(cat <<JSON
{
  "databaseName": "admin",
  "username": "$APP_USER",
  "password": "$NEW_PASS",
  "roles": [{ "databaseName": "$DB_NAME", "roleName": "readWrite" }],
  "awsIAMType": "NONE",
  "ldapAuthType": "NONE",
  "oidcAuthType": "NONE",
  "x509Type": "NONE"
}
JSON
)")"
if echo "$RESP" | grep -q '"error"'; then
  if echo "$RESP" | grep -q 'USER_ALREADY_EXISTS'; then
    fail "$APP_USER already exists — delete it in Atlas, or run again with APP_USER set to another name"
  fi
  fail "could not create the user: $(echo "$RESP" | json 'JSON.parse(b).detail' || echo "$RESP")"
fi
log "  created"

CLUSTER_HOST="$(api GET "/groups/$GROUP_ID/clusters" | json 'JSON.parse(b).results[0].connectionStrings.standardSrv.replace("mongodb+srv://","")')"
[[ -n "$CLUSTER_HOST" ]] || CLUSTER_HOST="cluster0.$CLUSTER_HINT.mongodb.net"

cat <<SUMMARY

────────────────────────────────────────────────────────────────────────
Put this in /root/asterias-backend/.env.production and redeploy:

MONGODB_URI=mongodb+srv://$APP_USER:$NEW_PASS@$CLUSTER_HOST/$DB_NAME?retryWrites=true&w=majority

Shown once. This script stores it nowhere.

Then, AFTER the site has taken a booking on the new credential:

  1. Network Access -> delete the 0.0.0.0/0 entry.
     Left in place here deliberately: removing it before the new
     credential is proven would lock production out.
  2. Database Access -> delete or rotate 'konstantinos193'. It sat in a
     world-readable file on a shared VPS. Treat it as burned.
  3. Delete the temporary API key you just used.
────────────────────────────────────────────────────────────────────────
SUMMARY
