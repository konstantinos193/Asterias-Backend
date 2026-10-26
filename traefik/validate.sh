#!/bin/bash
# Prove every route through the staged Traefik before anything is cut over.
#
# Hits Traefik on the staging TLS port with the right SNI/Host for each vhost
# and compares against what live nginx answers for the same request. Run this
# BEFORE cutover.sh. A FAIL here means do not cut over.
#
#   Usage: bash validate.sh [tls_port]
set -uo pipefail

PORT="${1:-8453}"
PASS=0
FAIL=0

# --resolve pins the hostname to loopback on the staging port, so the request
# carries the real SNI and Host header without DNS pointing anywhere new.
probe() {
    local desc="$1" host="$2" path="$3" expect="$4"
    local got
    got=$(curl -ks -o /dev/null -w '%{http_code}' \
        --resolve "${host}:${PORT}:127.0.0.1" \
        --max-time 20 "https://${host}:${PORT}${path}" 2>/dev/null)
    if [[ " $expect " == *" $got "* ]]; then
        printf '  PASS  %-46s %s\n' "$desc" "$got"
        PASS=$((PASS + 1))
    else
        printf '  FAIL  %-46s got %s, wanted one of: %s\n' "$desc" "$got" "$expect"
        FAIL=$((FAIL + 1))
    fi
}

# Same request against the live nginx on :443, for comparison.
baseline() {
    local host="$1" path="$2"
    curl -ks -o /dev/null -w '%{http_code}' \
        --resolve "${host}:443:127.0.0.1" --max-time 20 \
        "https://${host}:443${path}" 2>/dev/null
}

echo "=== 1. Routing: every vhost reaches its upstream ==="
# 200/401/404 all prove the request reached the app. 502/503/404-from-Traefik
# would mean the router or service is wrong.
probe "asterias /health"          api.asteriashome.gr /health            "200"
probe "asterias /api/rooms"       api.asteriashome.gr /api/rooms         "200 401"
probe "kyklos /"                  api.kyklosedu.gr    /                  "200 401 404"
probe "adinfinity /"              api.adinfinity.gr   /                  "200 401 404"
probe "mail-admin /"              mail.adinfinity.gr  /                  "200 401 404 302"
probe "melissourgoi /"            api.melissourgoi.dev /                 "200 401 404"

echo
echo "=== 2. Baseline: what live nginx says for the same paths ==="
for pair in "api.asteriashome.gr:/health" "api.kyklosedu.gr:/" "api.adinfinity.gr:/" "mail.adinfinity.gr:/"; do
    h="${pair%%:*}"; p="${pair#*:}"
    printf '  nginx  %-46s %s\n' "$h$p" "$(baseline "$h" "$p")"
done

echo
echo "=== 3. Security headers present ==="
HDRS=$(curl -ks -D - -o /dev/null \
    --resolve "api.asteriashome.gr:${PORT}:127.0.0.1" \
    "https://api.asteriashome.gr:${PORT}/health" 2>/dev/null)
for h in "strict-transport-security" "x-content-type-options" "x-frame-options" "referrer-policy"; do
    if grep -qi "^$h:" <<<"$HDRS"; then
        printf '  PASS  %-46s present\n' "$h"; PASS=$((PASS + 1))
    else
        printf '  FAIL  %-46s MISSING\n' "$h"; FAIL=$((FAIL + 1))
    fi
done
# These should have been stripped.
for h in "server" "x-powered-by"; do
    if grep -qi "^$h:" <<<"$HDRS"; then
        printf '  WARN  %-46s still advertised\n' "$h"
    else
        printf '  PASS  %-46s stripped\n' "$h"; PASS=$((PASS + 1))
    fi
done

echo
echo "=== 4. CrowdSec bouncer is live (not failing open silently) ==="
# The middleware is configured to fail open, which is right for availability
# but means a broken bouncer looks exactly like a working one from outside.
# This is the only way to tell the difference.
if docker exec crowdsec cscli bouncers list 2>/dev/null | grep -q '✔\|validated\|traefik'; then
    printf '  PASS  %-46s registered\n' "bouncer"
    PASS=$((PASS + 1))
else
    printf '  FAIL  %-46s NOT registered -- chain is failing open\n' "bouncer"
    FAIL=$((FAIL + 1))
fi
# A non-zero AppSec request count proves traffic actually reached the WAF.
APPSEC=$(docker exec crowdsec cscli metrics show appsec 2>/dev/null || true)
if [ -n "$APPSEC" ]; then
    echo "$APPSEC" | head -8 | sed 's/^/        /'
else
    printf '  WARN  %-46s no appsec metrics yet\n' "appsec"
fi

echo "=== 5. WAF ruleset actually covers injection ==="
# Deliberately NOT a live probe from here. 127.0.0.1 is in the middleware's
# clientTrustedIPs, so a request from this host bypasses the bouncer and the
# WAF entirely -- a probe run locally comes back 200 and looks like a WAF
# failure when nothing is wrong. (It cost an hour to work that out once.)
#
# So this checks the thing that is actually checkable on-box: that CRS is
# installed and inband. Without CRS the WAF only knows specific bad paths and
# passes generic SQLi/XSS/traversal through.
if docker exec crowdsec cscli appsec-rules list 2>/dev/null | grep -q 'crowdsecurity/crs'; then
    printf '  PASS  %-46s installed\n' "OWASP CRS"; PASS=$((PASS + 1))
else
    printf '  FAIL  %-46s MISSING -- generic injection is unfiltered\n' "OWASP CRS"
    FAIL=$((FAIL + 1))
fi
if docker exec crowdsec sh -c 'sed -n "/^inband_rules:/,/^outofband_rules:/p" /etc/crowdsec/appsec-configs/appsec-api.yaml' 2>/dev/null | grep -q 'crowdsecurity/crs'; then
    printf '  PASS  %-46s inband (blocking)\n' "CRS mode"; PASS=$((PASS + 1))
else
    printf '  WARN  %-46s out-of-band (detect + ban, does not block)\n' "CRS mode"
fi
RULES=$(docker logs crowdsec 2>&1 | grep -oE 'Loaded [0-9]+ inband rules' | tail -1)
printf '        %s\n' "${RULES:-inband rule count unknown}"

echo
echo "=== 6. Rate limit and WAF: run these from a WORKSTATION ==="
# Same reason as above: both are bypassed from 127.0.0.1, so they cannot be
# proved from this shell. These are ready to paste.
cat <<'OUTSIDE'
        # WAF (expect 403 on each):
        for q in "id=1%20UNION%20SELECT%20NULL,version()--" \
                 "f=../../../../etc/passwd" \
                 "x=%3Cscript%3Ealert(1)%3C/script%3E"; do
          curl -ks -o /dev/null -w "%{http_code}\n" \
            "https://api.asteriashome.gr/api/rooms?$q"
        done

        # Rate limit (expect a mix of 200 and 429):
        seq 1 200 | xargs -P 50 -I{} \
          curl -ks -o /dev/null -w "%{http_code}\n" \
          https://api.asteriashome.gr/health | sort | uniq -c

        # Probing the WAF will ban your own IP for 12h. Clear it with:
        #   ssh asterias 'docker exec crowdsec cscli decisions delete --all'
        # and wait ~60s for the bouncer's stream cache to refresh.
OUTSIDE

echo
echo "=== 7. HTTP -> HTTPS redirect ==="
RED=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
    -H "Host: api.asteriashome.gr" "http://127.0.0.1:8070/health" 2>/dev/null)
if [ "$RED" = "301" ]; then
    printf '  PASS  %-46s %s\n' "redirect" "$RED"; PASS=$((PASS + 1))
else
    printf '  FAIL  %-46s got %s, wanted 301\n' "redirect" "$RED"; FAIL=$((FAIL + 1))
fi

echo
echo "==========================================="
echo "  PASS: $PASS    FAIL: $FAIL"
echo "==========================================="
[ "$FAIL" -eq 0 ] || { echo "  Do NOT cut over until these are fixed."; exit 1; }
echo "  Safe to run cutover.sh."
