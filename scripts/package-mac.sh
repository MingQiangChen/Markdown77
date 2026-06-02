#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="$(node -p "require('${ROOT_DIR}/package.json').version")"
STAMP="$(date +%Y%m%d-%H%M%S)"
RELEASE_DIR="${ROOT_DIR}/release/Markdown77-mac-${VERSION}-${STAMP}"
APP_PATH="${RELEASE_DIR}/Markdown77.app"
ELECTRON_APP="${ROOT_DIR}/apps/desktop/node_modules/electron/dist/Electron.app"
APP_RESOURCES="${APP_PATH}/Contents/Resources/app"

if [[ ! -d "${ELECTRON_APP}" ]]; then
  echo "Electron.app not found. Run npm install first." >&2
  exit 1
fi

if [[ ! -d "${ROOT_DIR}/apps/desktop/dist" || ! -d "${ROOT_DIR}/apps/desktop/dist-electron" ]]; then
  echo "Build output not found. Run npm run build first." >&2
  exit 1
fi

mkdir -p "${RELEASE_DIR}"
cp -R "${ELECTRON_APP}" "${APP_PATH}"
mkdir -p "${APP_RESOURCES}"
cp -R "${ROOT_DIR}/apps/desktop/dist" "${APP_RESOURCES}/dist"
cp -R "${ROOT_DIR}/apps/desktop/dist-electron" "${APP_RESOURCES}/dist-electron"
cp "${ROOT_DIR}/apps/desktop/package.json" "${APP_RESOURCES}/package.json"

/usr/libexec/PlistBuddy -c "Set :CFBundleName Markdown77" "${APP_PATH}/Contents/Info.plist" || true
/usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName Markdown77" "${APP_PATH}/Contents/Info.plist" || true
/usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier com.markdown77.desktop" "${APP_PATH}/Contents/Info.plist" || true
/usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString ${VERSION}" "${APP_PATH}/Contents/Info.plist" || true
/usr/libexec/PlistBuddy -c "Set :CFBundleVersion ${VERSION}" "${APP_PATH}/Contents/Info.plist" || true

(
  cd "${RELEASE_DIR}"
  zip -qry "Markdown77-mac-${VERSION}.zip" "Markdown77.app"
)

echo "APP_PATH=${APP_PATH}"
echo "ZIP_PATH=${RELEASE_DIR}/Markdown77-mac-${VERSION}.zip"
