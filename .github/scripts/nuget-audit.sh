#!/usr/bin/env bash
# Fails on any vulnerable NuGet package not listed in .github/nuget-audit-allowlist.txt.
# Allowlist line format: <package>|<resolved version>|<GHSA id>. See ADR-0002.
set -euo pipefail

audit_file="${RUNNER_TEMP:-/tmp}/nuget-vulnerability-audit.json"
allowlist="$(dirname "$0")/../nuget-audit-allowlist.txt"

dotnet list Jmaka.slnx package --vulnerable --include-transitive --format json > "${audit_file}"

found="$(jq -r '[.. | objects | select(has("vulnerabilities") and has("id")) | . as $p | $p.vulnerabilities[] | "\($p.id)|\($p.resolvedVersion)|\(.advisoryurl | split("/") | last)"] | unique | .[]' "${audit_file}")"

if [[ -z "${found}" ]]; then
  echo "NuGet audit: no vulnerable packages."
  exit 0
fi

accepted="$(tr -d '' < "${allowlist}" | grep -vE '^\s*(#|$)' || true)"
unexpected="$(printf '%s
' "${found}" | grep -Fxv -f <(printf '%s
' "${accepted}") || true)"

echo "NuGet audit: accepted advisories still present (ADR-0002):"
printf '%s
' "${found}" | grep -Fx -f <(printf '%s
' "${accepted}") | sed 's/^/  /' || true

if [[ -n "${unexpected}" ]]; then
  echo "NuGet audit FAILED: new or unaccepted advisories:" >&2
  printf '%s
' "${unexpected}" | sed 's/^/  /' >&2
  exit 1
fi
