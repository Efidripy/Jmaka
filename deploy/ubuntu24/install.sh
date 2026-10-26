#!/usr/bin/env bash
set -euo pipefail

# If started without sudo, re-run with sudo automatically.
# We keep the original user HOME so the tarball can be stored in the user's directory.
if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "This installer needs sudo. Re-running with sudo..."
  # Preserve the original user's HOME for defaults (~) and file access.
  exec sudo -E JMAKA_ORIG_USER="${USER:-}" JMAKA_ORIG_HOME="${HOME:-}" bash "$0" "$@"
fi

# Jmaka Ubuntu 24 installer (wizard-friendly)
# What it does:
# - installs ASP.NET Core Runtime 10 into /opt/dotnet (if missing)
# - unpacks the app bundle to /var/www/jmaka/<name>/app
# - stores data in /var/www/jmaka/<name>/storage (upload/upload-original/resized/preview/split/split3/data)
# - creates and starts a systemd service listening on 127.0.0.1:<port>
# - can print OR write an nginx snippet/vhost file (optional)
#
# Usage:
# - interactive (recommended for first time):
#     sudo bash deploy/ubuntu24/install.sh
# - non-interactive:
#     sudo bash deploy/ubuntu24/install.sh --name a --port 5010 --tar /var/www/jmaka/_bundles/jmaka.tar.gz --domain a.example.com --path-prefix /

# Identify original (non-root) user/home (important when running via sudo)
ORIG_USER="${JMAKA_ORIG_USER:-${SUDO_USER:-${USER:-}}}"
ORIG_HOME="${JMAKA_ORIG_HOME:-""}"
if [[ -z "$ORIG_HOME" && -n "$ORIG_USER" ]]; then
  ORIG_HOME="$(getent passwd "$ORIG_USER" | cut -d: -f6 || true)"
fi
if [[ -z "$ORIG_HOME" ]]; then
  ORIG_HOME="/root"
fi

NAME="jmaka"
PORT="5010"
# Default tarball location: user's home, so it can be downloaded without root.
APP_TAR="${ORIG_HOME}/jmaka.tar.gz"
BASE_DIR=""
INSTALL_ROOT="${JMAKA_INSTALL_ROOT:-/var/www/jmaka}"
APP_SHA256=""
AUTH_USERNAME="jmaka"
AUTH_PASSWORD=""
AUTH_PASSWORD_GENERATED=0

# Optional interactive mode (for non-technical users)
INTERACTIVE=0

# Nginx integration
NGINX_ACTION="print"   # none|print|write-snippet|write-vhost
NGINX_DOMAIN=""
PATH_PREFIX="/"        # / or /something/
TLS_LISTEN_PORT="443"  # 443, 7443, etc
TLS_PROXY_PROTOCOL="0" # 0/1
SSL_CERT=""
SSL_KEY=""
ENABLE_NGINX_SITE="0"  # 0/1 (only for write-vhost)
RELOAD_NGINX="0"       # 0/1

prompt_default() {
  local __var="$1"; shift
  local __prompt="$1"; shift
  local __default="$1"; shift

  local __val=""
  read -r -p "${__prompt} [${__default}]: " __val
  if [[ -z "${__val}" ]]; then
    __val="${__default}"
  fi
  printf -v "${__var}" '%s' "${__val}"
}

sanitize_instance_name() {
  # systemd unit names and Linux paths are much safer with ASCII only.
  # Keep: a-z, 0-9, dash. Convert to lowercase, replace anything else with dash, trim dashes.
  local raw="$1"

  # Lowercase (ASCII only)
  raw="$(printf '%s' "$raw" | tr '[:upper:]' '[:lower:]')"

  # Replace non [a-z0-9-] with '-'
  raw="$(printf '%s' "$raw" | sed -E 's/[^a-z0-9-]+/-/g')"

  # Trim leading/trailing '-'
  raw="$(printf '%s' "$raw" | sed -E 's/^-+//; s/-+$//')"

  # Collapse multiple '-'
  raw="$(printf '%s' "$raw" | sed -E 's/-{2,}/-/g')"

  # Limit length
  raw="$(printf '%s' "$raw" | cut -c1-40)"

  echo "$raw"
}

ensure_safe_instance_name() {
  local before="$NAME"
  local after
  after="$(sanitize_instance_name "$before")"

  if [[ -z "$after" ]]; then
    echo "ERROR: instance name is empty or invalid. Use latin letters/numbers, e.g. jmaka-test" >&2
    exit 1
  fi

  if [[ "$after" != "$before" ]]; then
    echo "NOTE: instance name normalized: '$before' -> '$after'" >&2
    NAME="$after"
  fi
}

require_root() {
  if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    echo "ERROR: please run as root (use sudo)." >&2
    exit 1
  fi
}

expand_user_path() {
  # Expands ~ and ~/... using the ORIGINAL user's home (not /root).
  local p="$1"
  if [[ "$p" == "~" ]]; then
    echo "$ORIG_HOME"
    return
  fi
  if [[ "${p:0:1}" == "~" && "${p:1:1}" == "/" ]]; then
    echo "$ORIG_HOME/${p:2}"
    return
  fi
  echo "$p"
}

have_cmd() {
  command -v "$1" >/dev/null 2>&1
}

require_cmd() {
  local c="$1"
  if ! have_cmd "$c"; then
    echo "ERROR: missing required command: $c" >&2
    exit 1
  fi
}

canonical_path() {
  realpath -m -- "$1"
}

assert_no_symlink_components() {
  python3 - "$1" <<'PY'
import os
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

validate_install_paths() {
  local raw_install_root="$INSTALL_ROOT"
  local raw_base_dir="$BASE_DIR"
  if [[ "$INSTALL_ROOT" != /* || "$BASE_DIR" != /* ]]; then
    echo "ERROR: install root and base dir must be absolute paths." >&2
    exit 1
  fi

  if ! [[ "$raw_install_root" =~ ^/[A-Za-z0-9._/-]+$ && "$raw_base_dir" =~ ^/[A-Za-z0-9._/-]+$ ]]; then
    echo "ERROR: deployment paths may contain only letters, digits, dot, underscore, dash and slash." >&2
    exit 1
  fi
  assert_no_symlink_components "$raw_install_root"
  assert_no_symlink_components "$raw_base_dir"

  INSTALL_ROOT="$(canonical_path "$INSTALL_ROOT")"
  BASE_DIR="$(canonical_path "$BASE_DIR")"

  if [[ "$INSTALL_ROOT" == "/" ]]; then
    echo "ERROR: install root cannot be /." >&2
    exit 1
  fi

  case "$BASE_DIR" in
    "$INSTALL_ROOT"/*) ;;
    *)
      echo "ERROR: base dir must be below install root: $INSTALL_ROOT" >&2
      exit 1
      ;;
  esac

  if [[ -L "$BASE_DIR" || -L "$BASE_DIR/app" ]]; then
    echo "ERROR: base dir and app dir must not be symbolic links." >&2
    exit 1
  fi
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
    exit 1
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
  local path="/health/ready"
  if [[ "$BASE_PATH_ENV" != "/" ]]; then
    path="${BASE_PATH_ENV}/health/ready"
  fi
  printf 'http://127.0.0.1:%s%s\n' "$PORT" "$path"
}

wait_for_application() {
  local url
  local response=""
  local curl_config=""
  local -a curl_args=()
  url="$(health_url)"

  curl_config="$(mktemp)"
  chmod 0600 "$curl_config"
  printf 'user = "%s:%s"\n' "$AUTH_USERNAME" "$AUTH_PASSWORD" >"$curl_config"
  curl_args=(--config "$curl_config" --fail --silent --show-error --max-time 2)

  for _attempt in $(seq 1 30); do
    if response="$(curl "${curl_args[@]}" "$url" 2>/dev/null)" \
      && printf '%s' "$response" | grep -q '"version"'; then
      rm -f -- "$curl_config"
      echo "Readiness check passed: $url"
      return 0
    fi
    sleep 1
  done

  rm -f -- "$curl_config"
  echo "ERROR: readiness check failed after 30 seconds: $url" >&2
  return 1
}

read_env_value() {
  local file="$1"
  local key="$2"
  sed -n "s/^${key}=//p" "$file" | tail -n 1
}

prepare_auth_credentials() {
  local existing_user=""
  local existing_password=""

  if [[ -f "$AUTH_ENV_FILE" && ! -L "$AUTH_ENV_FILE" ]]; then
    existing_user="$(read_env_value "$AUTH_ENV_FILE" JMAKA_AUTH_USERNAME)"
    existing_password="$(read_env_value "$AUTH_ENV_FILE" JMAKA_AUTH_PASSWORD)"
  fi

  if [[ -z "$AUTH_USERNAME" ]]; then AUTH_USERNAME="${existing_user:-jmaka}"; fi
  if [[ -z "$AUTH_PASSWORD" && -n "$existing_password" ]]; then
    AUTH_PASSWORD="$existing_password"
  fi
  if [[ -z "$AUTH_PASSWORD" ]]; then
    AUTH_PASSWORD="$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')"
    AUTH_PASSWORD_GENERATED=1
  fi

  if ! [[ "$AUTH_USERNAME" =~ ^[A-Za-z0-9._-]{1,64}$ ]]; then
    echo "ERROR: auth username must match [A-Za-z0-9._-] and be <= 64 chars." >&2
    exit 1
  fi
  if ! [[ "$AUTH_PASSWORD" =~ ^[A-Za-z0-9._~-]{20,128}$ ]]; then
    echo "ERROR: auth password must be 20-128 URL-safe characters." >&2
    exit 1
  fi

  AUTH_ENV_STAGING="$(mktemp "${AUTH_ENV_DIR}/.${SERVICE_NAME}.env.XXXXXX")"
  chmod 0600 "$AUTH_ENV_STAGING"
  printf 'JMAKA_AUTH_USERNAME=%s\nJMAKA_AUTH_PASSWORD=%s\n' \
    "$AUTH_USERNAME" "$AUTH_PASSWORD" >"$AUTH_ENV_STAGING"
}

detect_platform() {
  # Prints a short banner and performs basic sanity checks.
  if [[ -f /etc/os-release ]]; then
    # shellcheck disable=SC1091
    . /etc/os-release
    echo "Detected OS: ${PRETTY_NAME:-unknown}"

    if [[ "${ID:-}" != "ubuntu" ]]; then
      echo "WARNING: this installer is designed for Ubuntu 24+." >&2
    fi

    # Best-effort check; allow 24.04+.
    if [[ -n "${VERSION_ID:-}" ]]; then
      case "${VERSION_ID}" in
        24.*) : ;;
        25.*|26.*) : ;;
        *) echo "WARNING: VERSION_ID=${VERSION_ID}; expected Ubuntu 24+. Proceeding anyway." >&2 ;;
      esac
    fi
  else
    echo "WARNING: cannot detect OS (/etc/os-release not found)." >&2
  fi
}

ensure_packages() {
  # Minimal packages for this installer and port detection.
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get install -y ca-certificates curl tar iproute2 ffmpeg python3
}

ensure_nginx_if_needed() {
  if [[ "$RELOAD_NGINX" -ne 1 && "$NGINX_ACTION" != "write-snippet" && "$NGINX_ACTION" != "write-vhost" ]]; then
    return 0
  fi

  if have_cmd nginx; then
    return 0
  fi

  echo "Nginx is not installed but nginx automation/reload was requested. Installing nginx..."
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get install -y nginx
}

normalize_path_prefix() {
  local p="$1"
  if [[ -z "$p" ]]; then
    p="/"
  fi
  if [[ "${p:0:1}" != "/" ]]; then
    p="/${p}"
  fi
  if [[ "$p" != "/" && "${p: -1}" != "/" ]]; then
    p="${p}/"
  fi
  echo "$p"
}

list_used_tcp_ports() {
  # Sorted unique list of LISTEN tcp ports (IPv4 + IPv6)
  # NOTE: requires `ss` (iproute2), which exists on Ubuntu by default.
  if command -v ss >/dev/null 2>&1; then
    ss -lntH 2>/dev/null \
      | awk '{print $4}' \
      | awk -F':' '{print $NF}' \
      | sed 's/\[//g; s/\]//g' \
      | grep -E '^[0-9]+$' \
      | sort -n \
      | uniq
  fi
}

is_port_used() {
  local p="$1"
  if [[ -z "$p" ]]; then return 1; fi
  list_used_tcp_ports | awk -v port="$p" '$1==port {found=1} END{exit found?0:1}'
}

print_used_ports_hint() {
  local ports
  ports="$(list_used_tcp_ports | tr '\n' ' ' | sed 's/[[:space:]]\+/ /g' | sed 's/[[:space:]]$//')"
  echo "Used TCP listen ports on this server:"
  if [[ -z "$ports" ]]; then
    echo "  (could not detect)"
  else
    echo "  $ports"
  fi
  echo "Choose a free port for Jmaka (recommended range: 5000-5999)."
}

suggest_free_port() {
  # Suggest first free port in range [5000..5999]
  local p
  for p in $(seq 5000 5999); do
    if ! is_port_used "$p"; then
      echo "$p"
      return 0
    fi
  done
  return 1
}

require_root

detect_platform

if [[ $# -eq 0 ]]; then
  INTERACTIVE=1
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    --interactive) INTERACTIVE=1; shift 1;;
    --name) NAME="$2"; shift 2;;
    --port) PORT="$2"; shift 2;;
    --tar) APP_TAR="$2"; shift 2;;
    --base-dir) BASE_DIR="$2"; shift 2;;
    --install-root) INSTALL_ROOT="$2"; shift 2;;
    --sha256) APP_SHA256="$2"; shift 2;;
    --auth-username) AUTH_USERNAME="$2"; shift 2;;
    --auth-password) AUTH_PASSWORD="$2"; shift 2;;

    --domain) NGINX_DOMAIN="$2"; shift 2;;
    --path-prefix) PATH_PREFIX="$2"; shift 2;;

    --nginx-action) NGINX_ACTION="$2"; shift 2;;
    --tls-listen-port) TLS_LISTEN_PORT="$2"; shift 2;;
    --tls-proxy-protocol) TLS_PROXY_PROTOCOL="$2"; shift 2;;
    --ssl-cert) SSL_CERT="$2"; shift 2;;
    --ssl-key) SSL_KEY="$2"; shift 2;;
    --enable-nginx-site) ENABLE_NGINX_SITE=1; shift 1;;
    --reload-nginx) RELOAD_NGINX=1; shift 1;;

    *) echo "Unknown arg: $1"; exit 2;;
  esac
done

if [[ "$INTERACTIVE" -eq 1 ]]; then
  echo "Interactive setup:"
  prompt_default NAME "Instance name (latin letters/numbers recommended)" "$NAME"
  ensure_safe_instance_name

  print_used_ports_hint
  _suggested_port=""
  _suggested_port="$(suggest_free_port || true)"
  if [[ -n "${_suggested_port}" ]]; then
    echo "Suggested free port: ${_suggested_port}"
    PORT="${_suggested_port}"
  else
    echo "WARNING: could not find a free port in 5000-5999; you must pick manually." >&2
  fi

  while true; do
    prompt_default PORT "Local port (127.0.0.1:PORT)" "$PORT"

    if ! [[ "$PORT" =~ ^[0-9]+$ ]]; then
      echo "Port must be a number." >&2
      continue
    fi
    if [[ "$PORT" -lt 1024 ]]; then
      echo "Ports below 1024 are not recommended. Use 5000-5999." >&2
      continue
    fi
    if is_port_used "$PORT"; then
      echo "Port $PORT is already in use. Choose another." >&2
      continue
    fi
    break
  done

prompt_default APP_TAR "Path to app bundle (.tar.gz)" "$APP_TAR"
  APP_TAR="$(expand_user_path "$APP_TAR")"
  prompt_default BASE_DIR "Base dir for this instance" "${BASE_DIR:-/var/www/jmaka/${NAME}}"
  prompt_default NGINX_DOMAIN "Domain/subdomain" "${NGINX_DOMAIN:-example.com}"
  prompt_default PATH_PREFIX "Path prefix (use / for root, or /jmaka/)" "${PATH_PREFIX}"
  prompt_default TLS_LISTEN_PORT "Nginx TLS listen port (443, 7443, ...)" "${TLS_LISTEN_PORT}"

  echo "Use proxy_protocol on the listen line?"
  echo "  0) no"
  echo "  1) yes"
  read -r -p "Choose [0-1] (default ${TLS_PROXY_PROTOCOL}): " _pp
  if [[ -n "${_pp}" ]]; then TLS_PROXY_PROTOCOL="${_pp}"; fi

  # Default LetsEncrypt paths for convenience
  if [[ -z "$SSL_CERT" ]]; then
    SSL_CERT="/etc/letsencrypt/live/${NGINX_DOMAIN}/fullchain.pem"
  fi
  if [[ -z "$SSL_KEY" ]]; then
    SSL_KEY="/etc/letsencrypt/live/${NGINX_DOMAIN}/privkey.pem"
  fi
  prompt_default SSL_CERT "ssl_certificate" "$SSL_CERT"
  prompt_default SSL_KEY "ssl_certificate_key" "$SSL_KEY"

  echo "Nginx automation:"
  echo "  1) Just PRINT config/snippet (recommended)"
  echo "  2) WRITE snippet file (/etc/nginx/snippets/jmaka-<name>.conf)"
  echo "  3) WRITE full vhost file (/etc/nginx/sites-available/jmaka-<name>.conf)"
  echo "  4) None"
  read -r -p "Choose [1-4] (default 1): " _na
  if [[ -z "${_na}" ]]; then _na="1"; fi
  case "${_na}" in
    1) NGINX_ACTION="print";;
    2) NGINX_ACTION="write-snippet";;
    3) NGINX_ACTION="write-vhost";;
    4) NGINX_ACTION="none";;
    *) NGINX_ACTION="print";;
  esac

  if [[ "$NGINX_ACTION" == "write-vhost" ]]; then
    echo "Enable this site (symlink to sites-enabled)?"
    read -r -p "Enable? [y/N]: " _en
    if [[ "${_en}" =~ ^[Yy]$ ]]; then ENABLE_NGINX_SITE=1; fi
  fi

  echo "Reload nginx after changes?"
  read -r -p "Reload nginx? [y/N]: " _rn
  if [[ "${_rn}" =~ ^[Yy]$ ]]; then RELOAD_NGINX=1; fi
fi

PATH_PREFIX="$(normalize_path_prefix "$PATH_PREFIX")"
APP_TAR="$(expand_user_path "$APP_TAR")"

if [[ -z "$NAME" ]]; then
  echo "ERROR: --name is required" >&2
  exit 1
fi

ensure_safe_instance_name

# Default base dir is /var/www/jmaka/<name> (one directory per instance)
if [[ -z "$BASE_DIR" ]]; then
  BASE_DIR="/var/www/jmaka/${NAME}"
fi

validate_install_paths

if ! [[ "$PORT" =~ ^[0-9]+$ ]]; then
  echo "ERROR: --port must be a number" >&2
  exit 1
fi

if [[ "$PORT" -lt 1024 ]]; then
  echo "ERROR: ports below 1024 are not recommended. Use 5000-5999." >&2
  exit 1
fi

if is_port_used "$PORT"; then
  echo "ERROR: port $PORT is already in use (pick another)." >&2
  exit 1
fi

if [[ ! -f "$APP_TAR" ]]; then
  echo "ERROR: app bundle not found at: $APP_TAR" >&2
  echo "Download it first (recommended) to: ${ORIG_HOME}/jmaka.tar.gz" >&2
  exit 1
fi

ensure_packages
require_cmd realpath
require_cmd sha256sum
require_cmd python3
verify_bundle_checksum

# service user (shared for all instances)
if ! id -u jmaka >/dev/null 2>&1; then
  useradd --system --home /var/lib/jmaka --create-home --shell /usr/sbin/nologin jmaka
fi

# Install .NET ASP.NET Core Runtime 10 into /opt/dotnet (no apt dependency)
DOTNET_DIR="/opt/dotnet"
if [[ ! -x "$DOTNET_DIR/dotnet" ]]; then
  require_cmd curl

  mkdir -p "$DOTNET_DIR"
  curl -fsSL https://dot.net/v1/dotnet-install.sh -o /tmp/dotnet-install.sh
  chmod +x /tmp/dotnet-install.sh
  /tmp/dotnet-install.sh --channel 10.0 --runtime aspnetcore --install-dir "$DOTNET_DIR"
fi

APP_DIR="${BASE_DIR}/app"
DATA_DIR="${BASE_DIR}/storage"

mkdir -p "$BASE_DIR" "$DATA_DIR"

# Pre-create storage subfolders (helps when migrating existing installs and avoids permissions surprises)
mkdir -p \
  "$DATA_DIR/upload" \
  "$DATA_DIR/upload-original" \
  "$DATA_DIR/preview" \
  "$DATA_DIR/split" \
  "$DATA_DIR/split3" \
  "$DATA_DIR/oknofix" \
  "$DATA_DIR/oknoscale" \
  "$DATA_DIR/edits" \
  "$DATA_DIR/edits-preview" \
  "$DATA_DIR/video" \
  "$DATA_DIR/video-out" \
  "$DATA_DIR/resized" \
  "$DATA_DIR/data"

# Storage must be writable by the service user.
chown -R jmaka:jmaka "$DATA_DIR"
chmod -R u+rwX,go-rwx "$DATA_DIR"

STAGING_DIR="$(mktemp -d "${BASE_DIR}/.app.stage.XXXXXX")"
UNIT_STAGING=""
AUTH_ENV_STAGING=""
cleanup_staging() {
  if [[ -n "${STAGING_DIR:-}" && -d "$STAGING_DIR" ]]; then
    rm -rf -- "$STAGING_DIR"
  fi
  if [[ -n "${UNIT_STAGING:-}" && -f "$UNIT_STAGING" ]]; then
    rm -f -- "$UNIT_STAGING"
  fi
  if [[ -n "${AUTH_ENV_STAGING:-}" && -f "$AUTH_ENV_STAGING" ]]; then
    rm -f -- "$AUTH_ENV_STAGING"
  fi
}
trap cleanup_staging EXIT

echo "Validating and extracting bundle into staging: $STAGING_DIR"
safe_extract_bundle "$APP_TAR" "$STAGING_DIR"
chown -R root:root "$STAGING_DIR"
chmod -R a=rX "$STAGING_DIR"

escape_systemd_unit_name() {
  # Legacy helper (no longer used): we now keep unit names human-readable,
  # e.g. jmaka-myinstance.service instead of jmaka\x2dmyinstance.service.
  local raw="$1"
  if have_cmd systemd-escape; then
    systemd-escape "$raw"
  else
    echo "$raw"
  fi
}

# Human-readable service name: jmaka-<name>.service (без systemd-escape)
SERVICE_NAME="jmaka-${NAME}"
SERVICE_UNIT="${SERVICE_NAME}.service"
SERVICE_UNIT_PATH="/etc/systemd/system/${SERVICE_UNIT}"
AUTH_ENV_DIR="/etc/jmaka"
AUTH_ENV_FILE="${AUTH_ENV_DIR}/${SERVICE_NAME}.env"
mkdir -p "$AUTH_ENV_DIR"
chown root:root "$AUTH_ENV_DIR"
chmod 0700 "$AUTH_ENV_DIR"
prepare_auth_credentials

# Base path for app: "/" or "/jmaka" (without trailing slash)
BASE_PATH_ENV="/"
if [[ "$PATH_PREFIX" != "/" ]]; then
  BASE_PATH_ENV="${PATH_PREFIX%/}"
fi

UNIT_STAGING="$(mktemp "/etc/systemd/system/.${SERVICE_UNIT}.XXXXXX")"
cat >"$UNIT_STAGING" <<EOF
[Unit]
Description=Jmaka API (${NAME})
After=network-online.target
Wants=network-online.target

[Service]
WorkingDirectory=${APP_DIR}
ExecStart=${DOTNET_DIR}/dotnet ${APP_DIR}/Jmaka.Api.dll
Restart=always
RestartSec=10
KillSignal=SIGINT
User=jmaka
Group=jmaka
UMask=0077
Environment=ASPNETCORE_ENVIRONMENT=Production
Environment=ASPNETCORE_URLS=http://127.0.0.1:${PORT}
Environment=DOTNET_ROOT=${DOTNET_DIR}
Environment=DOTNET_PRINT_TELEMETRY_MESSAGE=false
Environment=DOTNET_SKIP_FIRST_TIME_EXPERIENCE=true
Environment=JMAKA_STORAGE_ROOT=${DATA_DIR}
Environment=JMAKA_BASE_PATH=${BASE_PATH_ENV}
EnvironmentFile=${AUTH_ENV_FILE}
NoNewPrivileges=true
PrivateDevices=true
PrivateTmp=true
ProtectControlGroups=true
ProtectHome=true
ProtectKernelModules=true
ProtectKernelTunables=true
ProtectSystem=strict
RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6
RestrictRealtime=true
RestrictSUIDSGID=true
LockPersonality=true
CapabilityBoundingSet=
AmbientCapabilities=
ReadWritePaths=${DATA_DIR}

[Install]
WantedBy=multi-user.target
EOF

require_cmd systemctl
APP_BACKUP=""
UNIT_BACKUP=""
AUTH_ENV_BACKUP=""
HAD_EXISTING_UNIT=0
HAD_EXISTING_AUTH_ENV=0

if [[ -e "$APP_DIR" ]]; then
  if [[ ! -d "$APP_DIR" || -L "$APP_DIR" ]]; then
    echo "ERROR: existing app path is not a safe directory: $APP_DIR" >&2
    exit 1
  fi
fi

if [[ -f "$SERVICE_UNIT_PATH" ]]; then
  HAD_EXISTING_UNIT=1
  UNIT_BACKUP="${SERVICE_UNIT_PATH}.bak-$(date +%Y%m%d-%H%M%S)-$$"
  cp -a -- "$SERVICE_UNIT_PATH" "$UNIT_BACKUP"
  if systemctl is-active --quiet "$SERVICE_UNIT"; then
    systemctl stop "$SERVICE_UNIT"
  fi
fi

if [[ -f "$AUTH_ENV_FILE" && ! -L "$AUTH_ENV_FILE" ]]; then
  HAD_EXISTING_AUTH_ENV=1
  AUTH_ENV_BACKUP="${AUTH_ENV_FILE}.bak-$(date +%Y%m%d-%H%M%S)-$$"
  cp -a -- "$AUTH_ENV_FILE" "$AUTH_ENV_BACKUP"
elif [[ -e "$AUTH_ENV_FILE" ]]; then
  echo "ERROR: unsafe credentials path: $AUTH_ENV_FILE" >&2
  exit 1
fi

if [[ -e "$APP_DIR" ]]; then
  APP_BACKUP="${APP_DIR}.bak-$(date +%Y%m%d-%H%M%S)-$$"
  echo "Creating mandatory app backup by rename: $APP_BACKUP"
  if ! mv -- "$APP_DIR" "$APP_BACKUP"; then
    echo "ERROR: mandatory app backup failed." >&2
    if [[ "$HAD_EXISTING_UNIT" -eq 1 ]]; then systemctl start "$SERVICE_UNIT" || true; fi
    exit 1
  fi
fi

mv -- "$STAGING_DIR" "$APP_DIR"
STAGING_DIR=""
install -o root -g root -m 0644 "$UNIT_STAGING" "$SERVICE_UNIT_PATH"
rm -f -- "$UNIT_STAGING"
install -o root -g root -m 0600 "$AUTH_ENV_STAGING" "$AUTH_ENV_FILE"
rm -f -- "$AUTH_ENV_STAGING"

rollback_install() {
  echo "Deployment failed; rolling back ${SERVICE_UNIT}..." >&2
  systemctl stop "$SERVICE_UNIT" >/dev/null 2>&1 || true
  rm -rf -- "$APP_DIR"
  if [[ -n "$APP_BACKUP" && -d "$APP_BACKUP" ]]; then
    mv -- "$APP_BACKUP" "$APP_DIR"
  fi
  if [[ "$HAD_EXISTING_UNIT" -eq 1 && -f "$UNIT_BACKUP" ]]; then
    mv -- "$UNIT_BACKUP" "$SERVICE_UNIT_PATH"
  else
    rm -f -- "$SERVICE_UNIT_PATH"
  fi
  if [[ "$HAD_EXISTING_AUTH_ENV" -eq 1 && -f "$AUTH_ENV_BACKUP" ]]; then
    mv -- "$AUTH_ENV_BACKUP" "$AUTH_ENV_FILE"
  else
    rm -f -- "$AUTH_ENV_FILE"
  fi
  systemctl daemon-reload || true
  if [[ "$HAD_EXISTING_UNIT" -eq 1 ]]; then
    systemctl start "$SERVICE_UNIT" || true
  else
    systemctl disable "$SERVICE_UNIT" >/dev/null 2>&1 || true
  fi
}

if ! systemctl daemon-reload \
  || ! systemctl enable "$SERVICE_UNIT" \
  || ! systemctl start "$SERVICE_UNIT" \
  || ! wait_for_application; then
  rollback_install
  exit 1
fi

if [[ -n "$UNIT_BACKUP" ]]; then
  rm -f -- "$UNIT_BACKUP"
fi
if [[ -n "$AUTH_ENV_BACKUP" ]]; then
  rm -f -- "$AUTH_ENV_BACKUP"
fi

echo ""
echo "OK. Service started: ${SERVICE_UNIT} (listening on 127.0.0.1:${PORT})"
echo "Installed to: ${BASE_DIR}"
echo "  app:     ${APP_DIR}"
echo "  storage: ${DATA_DIR}"
echo "Status: systemctl status ${SERVICE_UNIT} --no-pager"
echo "Logs:   journalctl -u ${SERVICE_UNIT} -n 200 --no-pager"
echo "Credentials file (root-only): ${AUTH_ENV_FILE}"
if [[ "$AUTH_PASSWORD_GENERATED" -eq 1 ]]; then
  echo "Generated username: ${AUTH_USERNAME}"
  echo "Generated password (shown once): ${AUTH_PASSWORD}"
else
  echo "Existing or explicitly supplied credentials retained."
fi
echo "Rotate credentials by editing ${AUTH_ENV_FILE} as root, then restart ${SERVICE_UNIT}."
nginx_snippet() {
  if [[ "$PATH_PREFIX" == "/" ]]; then
    cat <<NGINX
client_max_body_size 1600m;
client_body_timeout 60s;
location / {
    proxy_redirect off;
    proxy_intercept_errors off;
    proxy_pass         http://127.0.0.1:${PORT};
    proxy_http_version 1.1;
    proxy_set_header   Upgrade \$http_upgrade;
    proxy_set_header   Connection keep-alive;
    proxy_set_header   Host \$host;
    proxy_cache_bypass \$http_upgrade;
    proxy_set_header   X-Real-IP \$remote_addr;
    proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto \$scheme;
}
NGINX
  else
    local prefix="${PATH_PREFIX%/}"
    local prefix_slash="${prefix}/"
    cat <<NGINX
client_max_body_size 1600m;
client_body_timeout 60s;
location ${prefix} {
    return 301 ${prefix_slash};
}

location ${prefix_slash} {
    proxy_redirect off;
    proxy_intercept_errors off;

    # App is configured with JMAKA_BASE_PATH=${prefix}
    # so we MUST pass the full URI including the prefix to the upstream.
    # Therefore NO trailing slash in proxy_pass here.
    proxy_pass         http://127.0.0.1:${PORT};

    proxy_http_version 1.1;
    proxy_set_header   Upgrade \$http_upgrade;
    proxy_set_header   Connection keep-alive;
    proxy_set_header   Host \$host;
    proxy_cache_bypass \$http_upgrade;
    proxy_set_header   X-Real-IP \$remote_addr;
    proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto \$scheme;
}
NGINX
  fi
}

write_nginx_snippet_file() {
  ensure_nginx_if_needed
  local snippet_path="/etc/nginx/snippets/jmaka-${NAME}.conf"
  echo "Writing nginx snippet: ${snippet_path}"
  mkdir -p /etc/nginx/snippets
  nginx_snippet >"${snippet_path}"
}

write_nginx_vhost_file() {
  ensure_nginx_if_needed

  if [[ -z "$SSL_CERT" || -z "$SSL_KEY" ]]; then
    echo "ERROR: ssl cert/key paths are required for write-vhost." >&2
    exit 1
  fi
  if [[ ! -f "$SSL_CERT" ]]; then
    echo "WARNING: ssl_certificate does not exist: $SSL_CERT" >&2
  fi
  if [[ ! -f "$SSL_KEY" ]]; then
    echo "WARNING: ssl_certificate_key does not exist: $SSL_KEY" >&2
  fi

  local vhost_path="/etc/nginx/sites-available/jmaka-${NAME}.conf"
  echo "Writing nginx vhost: ${vhost_path}"
  mkdir -p /etc/nginx/sites-available

  local listen_line="listen ${TLS_LISTEN_PORT} ssl http2"
  local listen_line_v6="listen [::]:${TLS_LISTEN_PORT} ssl http2"
  if [[ "$TLS_PROXY_PROTOCOL" == "1" ]]; then
    listen_line="${listen_line} proxy_protocol"
    listen_line_v6="${listen_line_v6} proxy_protocol"
  fi

  cat >"${vhost_path}" <<EOF
server {
    server_tokens off;

    server_name ${NGINX_DOMAIN};
    ${listen_line};
    ${listen_line_v6};

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!eNULL:!MD5:!DES:!RC4:!ADH:!SSLv3:!EXP:!PSK:!DSS;

    ssl_certificate ${SSL_CERT};
    ssl_certificate_key ${SSL_KEY};

    # Optional hardening (matches your style)
    if (\$host !~* ^(.+\.)?${NGINX_DOMAIN//./\.}\$ ) { return 444; }

    include /etc/nginx/snippets/jmaka-${NAME}.location.conf;
}
EOF

  # location snippet file (kept separate so you can reuse it inside existing vhosts too)
  local loc_path="/etc/nginx/snippets/jmaka-${NAME}.location.conf"
  echo "Writing nginx location snippet: ${loc_path}"
  nginx_snippet >"${loc_path}"
}

maybe_enable_site() {
  if [[ "$ENABLE_NGINX_SITE" -ne 1 ]]; then
    return 0
  fi
  local vhost_path="/etc/nginx/sites-available/jmaka-${NAME}.conf"
  local link_path="/etc/nginx/sites-enabled/jmaka-${NAME}.conf"
  echo "Enabling site: ${link_path} -> ${vhost_path}"
  mkdir -p /etc/nginx/sites-enabled
  ln -sf "${vhost_path}" "${link_path}"
}

maybe_reload_nginx() {
  if [[ "$RELOAD_NGINX" -ne 1 ]]; then
    return 0
  fi

  ensure_nginx_if_needed
  require_cmd nginx
  require_cmd systemctl

  echo "Reloading nginx..."
  nginx -t
  systemctl reload nginx
}

echo ""
case "$NGINX_ACTION" in
  none)
    ;;
  print)
    echo "Nginx config to paste (domain: ${NGINX_DOMAIN}, prefix: ${PATH_PREFIX})"
    echo "Paste this INSIDE the existing server block."
    echo "IMPORTANT: If you paste into a big config, put it ABOVE a catch-all 'location /' block."
    echo ""
    nginx_snippet
    ;;
  write-snippet)
    write_nginx_snippet_file
    maybe_reload_nginx
    echo ""
    echo "Now include it in your server block: include /etc/nginx/snippets/jmaka-${NAME}.conf;"
    echo "(Place the include above any catch-all location /)"
    ;;
  write-vhost)
    write_nginx_vhost_file
    maybe_enable_site
    maybe_reload_nginx
    echo ""
    echo "Vhost created: /etc/nginx/sites-available/jmaka-${NAME}.conf"
    if [[ "$ENABLE_NGINX_SITE" -ne 1 ]]; then
      echo "To enable: ln -s /etc/nginx/sites-available/jmaka-${NAME}.conf /etc/nginx/sites-enabled/jmaka-${NAME}.conf"
      echo "Then: nginx -t && systemctl reload nginx"
    fi
    ;;
  *)
    echo "Unknown NGINX_ACTION: $NGINX_ACTION" >&2
    ;;
esac
