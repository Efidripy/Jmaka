#!/usr/bin/env bash
set -euo pipefail

# Jmaka instance updater (Ubuntu 24).
# The archive is validated and staged before services are stopped. Existing app
# directories are renamed to backups, and every switched instance is rolled
# back if start/readiness validation fails.

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "This updater needs sudo. Re-running with sudo..." >&2
  exec sudo -E JMAKA_ORIG_USER="${USER:-}" JMAKA_ORIG_HOME="${HOME:-}" bash "$0" "$@"
fi

INSTALL_ROOT="${JMAKA_INSTALL_ROOT:-/var/www/jmaka}"
APP_TAR=""
APP_SHA256=""
ASSUME_YES=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tar) APP_TAR="$2"; shift 2 ;;
    --sha256) APP_SHA256="$2"; shift 2 ;;
    --install-root) INSTALL_ROOT="$2"; shift 2 ;;
    --yes) ASSUME_YES=1; shift ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

have_cmd() {
  command -v "$1" >/dev/null 2>&1
}

require_cmd() {
  if ! have_cmd "$1"; then
    echo "ERROR: missing required command: $1" >&2
    exit 1
  fi
}

canonical_path() {
  realpath -m -- "$1"
}

assert_no_symlink_components() {
  python3 - "$1" <<'PY'
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
current = pathlib.Path(path.anchor)
for part in path.parts[1:]:
    current /= part
    if current.is_symlink():
        raise SystemExit(f"ERROR: symbolic link in deployment path: {current}")
PY
}

validate_install_root() {
  if [[ "$INSTALL_ROOT" != /* ]]; then
    echo "ERROR: install root must be absolute: $INSTALL_ROOT" >&2
    exit 1
  fi
  if ! [[ "$INSTALL_ROOT" =~ ^/[A-Za-z0-9._/-]+$ ]]; then
    echo "ERROR: install root contains unsupported characters." >&2
    exit 1
  fi
  assert_no_symlink_components "$INSTALL_ROOT"
  INSTALL_ROOT="$(canonical_path "$INSTALL_ROOT")"
  if [[ "$INSTALL_ROOT" == "/" ]]; then
    echo "ERROR: install root cannot be /." >&2
    exit 1
  fi
}

validate_app_dir() {
  local raw="$1"
  local canonical=""
  local base=""

  if [[ "$raw" != /* ]]; then
    echo "ERROR: appDir must be absolute: $raw" >&2
    return 1
  fi
  if ! [[ "$raw" =~ ^/[A-Za-z0-9._/-]+$ ]]; then
    echo "ERROR: appDir contains unsupported characters: $raw" >&2
    return 1
  fi
  assert_no_symlink_components "$raw"
  canonical="$(canonical_path "$raw")"
  case "$canonical" in
    "$INSTALL_ROOT"/*/app) ;;
    *)
      echo "ERROR: appDir must be $INSTALL_ROOT/<instance>/app: $canonical" >&2
      return 1
      ;;
  esac

  base="$(dirname -- "$canonical")"
  if [[ "$base" == "$INSTALL_ROOT" || "$(dirname -- "$base")" != "$INSTALL_ROOT" ]]; then
    echo "ERROR: nested or root appDir is forbidden: $canonical" >&2
    return 1
  fi
  if [[ -L "$base" || -L "$canonical" || ! -d "$canonical" ]]; then
    echo "ERROR: appDir/base must be real existing directories, not links: $canonical" >&2
    return 1
  fi

  printf '%s\n' "$canonical"
}

resolve_expected_sha256() {
  local spec="$APP_SHA256"
  local sidecar="${APP_TAR}.sha256"
  local expected=""

  if [[ -z "$spec" && -f "$sidecar" ]]; then
    spec="$sidecar"
    echo "Using SHA256 sidecar: $sidecar" >&2
  fi
  if [[ -z "$spec" ]]; then
    return 1
  fi

  if [[ -f "$spec" ]]; then
    expected="$(awk 'match($0, /[[:xdigit:]]{64}/) { print substr($0, RSTART, RLENGTH); exit }' "$spec")"
  else
    expected="$spec"
  fi
  expected="$(printf '%s' "$expected" | tr '[:upper:]' '[:lower:]')"
  if ! [[ "$expected" =~ ^[0-9a-f]{64}$ ]]; then
    echo "ERROR: invalid SHA256 value or checksum file: $spec" >&2
    return 2
  fi
  printf '%s\n' "$expected"
}

verify_bundle_checksum() {
  local expected=""
  local actual=""

  if [[ -z "$APP_SHA256" && ! -f "${APP_TAR}.sha256" ]]; then
    echo "ERROR: SHA256 is required; pass --sha256 or provide ${APP_TAR}.sha256." >&2
    exit 1
  fi
  expected="$(resolve_expected_sha256)"
  actual="$(sha256sum -- "$APP_TAR" | awk '{print $1}')"
  if [[ "$actual" != "$expected" ]]; then
    echo "ERROR: bundle SHA256 mismatch." >&2
    echo "  expected: $expected" >&2
    echo "  actual:   $actual" >&2
    exit 1
  fi
  echo "Bundle SHA256 verified: $actual"
}

safe_extract_bundle() {
  local archive="$1"
  local destination="$2"

  python3 - "$archive" "$destination" <<'PY'
import os
import pathlib
import shutil
import sys
import tarfile

archive, destination = sys.argv[1], sys.argv[2]
destination_path = pathlib.Path(destination).resolve()
max_entries = 100_000
max_total_size = 8 * 1024 * 1024 * 1024

with tarfile.open(archive, mode="r:gz") as bundle:
    members = bundle.getmembers()
    if not members or len(members) > max_entries:
        raise SystemExit("ERROR: bundle is empty or contains too many entries")

    total_size = 0
    validated = []
    for member in members:
        name = member.name
        path = pathlib.PurePosixPath(name)
        if (
            not name
            or name.startswith(("/", "\\"))
            or "\\" in name
            or any(part in ("", ".", "..") for part in path.parts)
            or (path.parts and ":" in path.parts[0])
        ):
            raise SystemExit(f"ERROR: unsafe bundle path: {name!r}")
        if not (member.isfile() or member.isdir()):
            raise SystemExit(f"ERROR: links and special archive entries are forbidden: {name!r}")

        target = (destination_path / pathlib.Path(*path.parts)).resolve()
        if target != destination_path and destination_path not in target.parents:
            raise SystemExit(f"ERROR: bundle entry escapes staging directory: {name!r}")

        if member.isfile():
            total_size += member.size
            if total_size > max_total_size:
                raise SystemExit("ERROR: uncompressed bundle exceeds 8 GiB safety limit")
        validated.append((member, target))

    for member, target in validated:
        if member.isdir():
            target.mkdir(parents=True, exist_ok=True)
            os.chmod(target, member.mode & 0o755 or 0o755)
            continue

        target.parent.mkdir(parents=True, exist_ok=True)
        source = bundle.extractfile(member)
        if source is None:
            raise SystemExit(f"ERROR: cannot read bundle entry: {member.name!r}")
        flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
        if hasattr(os, "O_NOFOLLOW"):
            flags |= os.O_NOFOLLOW
        fd = os.open(target, flags, member.mode & 0o755 or 0o644)
        with source, os.fdopen(fd, "wb") as output:
            shutil.copyfileobj(source, output)
PY

  if [[ ! -f "$destination/Jmaka.Api.dll" ]]; then
    echo "ERROR: bundle root does not contain Jmaka.Api.dll." >&2
    return 1
  fi
}

health_url() {
  local port="$1"
  local base_path="$2"
  local path="/health/ready"
  if [[ "$base_path" != "/" ]]; then
    path="${base_path%/}/health/ready"
  fi
  printf 'http://127.0.0.1:%s%s\n' "$port" "$path"
}

wait_for_application() {
  local svc="$1"
  local port="$2"
  local base_path="$3"
  local auth_user="$4"
  local auth_password="$5"
  local url=""
  local response=""
  local curl_config=""
  local -a curl_args=(--fail --silent --show-error --max-time 2)

  if ! [[ "$port" =~ ^[0-9]+$ ]] || (( port < 1 || port > 65535 )); then
    echo "ERROR: invalid port for $svc: $port" >&2
    return 1
  fi
  url="$(health_url "$port" "$base_path")"
  if [[ -n "$auth_password" ]]; then
    curl_config="$(mktemp)"
    chmod 0600 "$curl_config"
    printf 'user = "%s:%s"\n' "$auth_user" "$auth_password" >"$curl_config"
    curl_args=(--config "$curl_config" "${curl_args[@]}")
  fi

  for _attempt in $(seq 1 30); do
    if ! systemctl is-active --quiet "$svc"; then
      sleep 1
      continue
    fi
    if response="$(curl "${curl_args[@]}" "$url" 2>/dev/null)" \
      && printf '%s' "$response" | grep -q '"version"'; then
      if [[ -n "$curl_config" ]]; then rm -f -- "$curl_config"; fi
      echo "Readiness check passed: $url"
      return 0
    fi
    sleep 1
  done
  if [[ -n "$curl_config" ]]; then rm -f -- "$curl_config"; fi
  echo "ERROR: readiness check failed after 30 seconds: $url" >&2
  return 1
}

rollback_instance() {
  local svc="$1"
  local app_dir="$2"
  local backup_dir="$3"
  local was_active="$4"

  echo "Rolling back $svc ..." >&2
  systemctl stop "$svc" >/dev/null 2>&1 || true
  rm -rf -- "$app_dir"
  if [[ ! -d "$backup_dir" ]]; then
    echo "ERROR: rollback backup missing: $backup_dir" >&2
    return 1
  fi
  mv -- "$backup_dir" "$app_dir"
  if [[ "$was_active" -eq 1 ]]; then
    systemctl start "$svc" || {
      echo "ERROR: old version could not be restarted for $svc" >&2
      return 1
    }
  fi
}

require_cmd systemctl
require_cmd realpath
require_cmd python3
require_cmd sha256sum
require_cmd curl
validate_install_root

echo "=== Jmaka updater (instances via systemd jmaka-*.service) ==="

mapfile -t UNIT_NAMES < <(systemctl list-unit-files 'jmaka-*' --no-legend 2>/dev/null | awk '{print $1}' | grep '\.service$' || true)
if [[ ${#UNIT_NAMES[@]} -eq 0 ]]; then
  echo "No Jmaka instances found (jmaka-*.service in systemd)." >&2
  exit 1
fi

INSTANCE_NAMES=()
INSTANCE_APPDIRS=()
INSTANCE_PORTS=()
INSTANCE_BASEPATHS=()
INSTANCE_VERSIONS=()
INSTANCE_AUTH_USERS=()
INSTANCE_AUTH_PASSWORDS=()

for svc_name in "${UNIT_NAMES[@]}"; do
  uf="$(systemctl show -p FragmentPath --value "$svc_name" 2>/dev/null || true)"
  if [[ -z "$uf" || ! -f "$uf" ]]; then
    continue
  fi

  env_lines="$(grep -E '^Environment=' "$uf" || true)"
  storage_root_line="$(printf '%s\n' "$env_lines" | grep -m1 'JMAKA_STORAGE_ROOT=' || true)"
  storage_root="${storage_root_line#*JMAKA_STORAGE_ROOT=}"
  storage_root="${storage_root%\"}"
  storage_root="${storage_root#\"}"

  app_dir=""
  if [[ -n "$storage_root" ]]; then
    app_dir="$(dirname -- "$storage_root")/app"
  fi

  asp_urls_line="$(printf '%s\n' "$env_lines" | grep -m1 'ASPNETCORE_URLS=' || true)"
  asp_urls="${asp_urls_line#*ASPNETCORE_URLS=}"
  asp_urls="${asp_urls%\"}"
  asp_urls="${asp_urls#\"}"
  port="$(printf '%s\n' "$asp_urls" | sed -nE 's@.*:([0-9]+)$@\1@p')"

  base_path_line="$(printf '%s\n' "$env_lines" | grep -m1 'JMAKA_BASE_PATH=' || true)"
  base_path="${base_path_line#*JMAKA_BASE_PATH=}"
  base_path="${base_path%\"}"
  base_path="${base_path#\"}"
  [[ -z "$base_path" ]] && base_path="/"

  auth_user=""
  auth_password=""
  env_file_line="$(grep -m1 -E '^EnvironmentFile=' "$uf" || true)"
  env_file="${env_file_line#EnvironmentFile=}"
  env_file="${env_file#-}"
  env_file="${env_file%\"}"
  env_file="${env_file#\"}"
  if [[ -n "$env_file" && "$env_file" == /* && -f "$env_file" && ! -L "$env_file" ]]; then
    auth_user="$(sed -n 's/^JMAKA_AUTH_USERNAME=//p' "$env_file" | tail -n 1)"
    auth_password="$(sed -n 's/^JMAKA_AUTH_PASSWORD=//p' "$env_file" | tail -n 1)"
  fi

  version="unknown"
  if [[ -n "$app_dir" && -f "$app_dir/wwwroot/index.html" ]]; then
    version="$(grep -m1 -o 'Jmaka [0-9.]\+' "$app_dir/wwwroot/index.html" 2>/dev/null | sed 's/^Jmaka //' || true)"
    [[ -z "$version" ]] && version="unknown"
  fi

  INSTANCE_NAMES+=("$svc_name")
  INSTANCE_APPDIRS+=("$app_dir")
  INSTANCE_PORTS+=("$port")
  INSTANCE_BASEPATHS+=("$base_path")
  INSTANCE_VERSIONS+=("$version")
  INSTANCE_AUTH_USERS+=("$auth_user")
  INSTANCE_AUTH_PASSWORDS+=("$auth_password")
done

if [[ ${#INSTANCE_NAMES[@]} -eq 0 ]]; then
  echo "No readable Jmaka service definitions found." >&2
  exit 1
fi

echo "Detected instances:"
for i in "${!INSTANCE_NAMES[@]}"; do
  printf " [%d] service='%s', appDir='%s', port=%s, path='%s', version=%s\n" \
    "$((i + 1))" "${INSTANCE_NAMES[$i]}" "${INSTANCE_APPDIRS[$i]}" \
    "${INSTANCE_PORTS[$i]:-?}" "${INSTANCE_BASEPATHS[$i]}" "${INSTANCE_VERSIONS[$i]}"
done

SELECTED_INDEXES=()
if [[ ${#INSTANCE_NAMES[@]} -eq 1 ]]; then
  ans="Y"
  if [[ "$ASSUME_YES" -ne 1 ]]; then
    read -r -p "Update this single instance? [Y/n]: " ans
    ans="${ans:-Y}"
  fi
  if [[ ! "$ans" =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
  fi
  SELECTED_INDEXES=(0)
else
  echo
  echo "Enter instance number to update (e.g. 1), or 'a' to update ALL."
  read -r -p "Your choice: " choice
  if [[ "$choice" =~ ^[Aa]$ ]]; then
    for i in "${!INSTANCE_NAMES[@]}"; do SELECTED_INDEXES+=("$i"); done
  elif [[ "$choice" =~ ^[0-9]+$ ]] && (( choice >= 1 && choice <= ${#INSTANCE_NAMES[@]} )); then
    SELECTED_INDEXES=("$((choice - 1))")
  else
    echo "Invalid choice." >&2
    exit 1
  fi
fi

ORIG_HOME="${JMAKA_ORIG_HOME:-${HOME:-/root}}"
default_tar="${ORIG_HOME}/jmaka.tar.gz"
if [[ -z "$APP_TAR" ]]; then
  read -r -p "Path to new bundle (.tar.gz) [${default_tar}]: " APP_TAR
  APP_TAR="${APP_TAR:-$default_tar}"
fi
if [[ "$APP_TAR" == "~" ]]; then APP_TAR="$ORIG_HOME"; fi
if [[ "${APP_TAR:0:1}" == "~" && "${APP_TAR:1:1}" == "/" ]]; then APP_TAR="${ORIG_HOME}/${APP_TAR:2}"; fi
if [[ ! -f "$APP_TAR" ]]; then
  echo "Bundle file not found: $APP_TAR" >&2
  exit 1
fi
APP_TAR="$(realpath -- "$APP_TAR")"
verify_bundle_checksum

for idx in "${SELECTED_INDEXES[@]}"; do
  INSTANCE_APPDIRS[idx]="$(validate_app_dir "${INSTANCE_APPDIRS[$idx]}")"
  if ! [[ "${INSTANCE_PORTS[$idx]}" =~ ^[0-9]+$ ]]; then
    echo "ERROR: invalid/missing ASPNETCORE_URLS port in ${INSTANCE_NAMES[$idx]}" >&2
    exit 1
  fi
  if [[ -z "${INSTANCE_AUTH_PASSWORDS[$idx]}" ]]; then
    echo "ERROR: ${INSTANCE_NAMES[$idx]} has no root-only JMAKA_AUTH_PASSWORD EnvironmentFile; refusing a fail-open update." >&2
    echo "Run the hardened installer once to provision credentials, then retry." >&2
    exit 1
  fi
done

echo
echo "Using validated bundle: $APP_TAR"
if [[ "$ASSUME_YES" -ne 1 ]]; then
  read -r -p "Proceed with update? [Y/n]: " go
  go="${go:-Y}"
  if [[ ! "$go" =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
  fi
fi

STAGING_DIRS=()
BACKUP_DIRS=()
WAS_ACTIVE=()
SWITCHED_INDEXES=()

cleanup_staging() {
  local stage
  for stage in "${STAGING_DIRS[@]:-}"; do
    if [[ -n "$stage" && -d "$stage" ]]; then rm -rf -- "$stage"; fi
  done
}
trap cleanup_staging EXIT

echo "Staging and validating all selected instances before stopping services..."
for idx in "${SELECTED_INDEXES[@]}"; do
  base_dir="$(dirname -- "${INSTANCE_APPDIRS[$idx]}")"
  stage="$(mktemp -d "${base_dir}/.app.stage.XXXXXX")"
  STAGING_DIRS[idx]="$stage"
  safe_extract_bundle "$APP_TAR" "$stage"
  chown -R root:root "$stage"
  chmod -R a=rX "$stage"
done

update_failed=0
failed_idx=""
for idx in "${SELECTED_INDEXES[@]}"; do
  svc="${INSTANCE_NAMES[$idx]}"
  app_dir="${INSTANCE_APPDIRS[$idx]}"
  stage="${STAGING_DIRS[$idx]}"
  backup_dir="${app_dir}.bak-$(date +%Y%m%d-%H%M%S)-$$-${idx}"
  BACKUP_DIRS[idx]="$backup_dir"

  was_active=0
  if systemctl is-active --quiet "$svc"; then was_active=1; fi
  WAS_ACTIVE[idx]="$was_active"

  echo "=== Updating $svc (appDir=$app_dir) ==="
  if [[ "$was_active" -eq 1 ]] && ! systemctl stop "$svc"; then
    echo "ERROR: service stop failed: $svc" >&2
    update_failed=1
    failed_idx="$idx"
    break
  fi

  echo "Creating mandatory backup by rename: $backup_dir"
  if ! mv -- "$app_dir" "$backup_dir"; then
    echo "ERROR: backup creation failed; update aborted for $svc" >&2
    if [[ "$was_active" -eq 1 ]]; then systemctl start "$svc" || true; fi
    update_failed=1
    failed_idx="$idx"
    break
  fi

  if ! mv -- "$stage" "$app_dir"; then
    echo "ERROR: staged app switch failed for $svc" >&2
    rollback_instance "$svc" "$app_dir" "$backup_dir" "$was_active" || true
    update_failed=1
    failed_idx="$idx"
    break
  fi
  STAGING_DIRS[idx]=""
  SWITCHED_INDEXES+=("$idx")

  if ! systemctl start "$svc" \
    || ! wait_for_application "$svc" "${INSTANCE_PORTS[$idx]}" "${INSTANCE_BASEPATHS[$idx]}" \
      "${INSTANCE_AUTH_USERS[$idx]}" "${INSTANCE_AUTH_PASSWORDS[$idx]}"; then
    update_failed=1
    failed_idx="$idx"
    break
  fi
  echo "Updated $svc; rollback backup retained at $backup_dir"
done

if [[ "$update_failed" -eq 1 ]]; then
  echo "Update failed at instance index $failed_idx; rolling back every switched instance." >&2
  for ((i=${#SWITCHED_INDEXES[@]} - 1; i >= 0; i--)); do
    idx="${SWITCHED_INDEXES[$i]}"
    rollback_instance \
      "${INSTANCE_NAMES[$idx]}" \
      "${INSTANCE_APPDIRS[$idx]}" \
      "${BACKUP_DIRS[$idx]}" \
      "${WAS_ACTIVE[$idx]}" || true
  done
  exit 1
fi

echo "All requested instances passed readiness validation."
