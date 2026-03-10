# Build & Release Guide

This document describes how to build, sign, and release OpenClaw Desktop for Windows, macOS, and Linux.

## Prerequisites

- Node.js 18+ and npm
- Git
- For Windows builds: Wine (on Linux/macOS) for cross‑compilation, or a Windows machine
- For macOS builds: macOS with Xcode (for signing/notarization) or a macOS machine
- For Linux builds: any Linux distribution with required libraries

## Project Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Ensure all required assets exist (see [Assets](#assets) section).

## Configuration

The build is configured via `electron-builder.json`. Key settings:

- `appId`: `openclaw.desktop`
- `productName`: `OpenClaw Desktop`
- Output directory: `dist/`
- Build resources: `build/`

Platform‑specific settings are defined under `win`, `mac`, and `linux` keys.

## Assets

The following assets must be present in the `assets/` folder:

| Platform  | File                 | Required sizes                                 |
| --------- | -------------------- | ---------------------------------------------- |
| Windows   | `icon.ico`           | 16×16, 32×32, 48×48, 64×64, 128×128, 256×256   |
| macOS     | `icon.icns`          | 16×16, 32×32, 64×64, 128×128, 256×256, 512×512 |
| Linux     | `icon.png`           | 256×256 (scalable)                             |
| macOS DMG | `dmg-background.png` | 540×380 (optional)                             |

If assets are missing, electron‑builder will use a default Electron icon.

**To generate icons:** use a tool like [electron-icon-builder](https://www.npmjs.com/package/electron-icon-builder) or an online converter.

Example using `electron-icon-builder`:

```bash
npx electron-icon-builder --input=assets/icon.png --output=assets
```

## Building

### Local development build (no signing)

```bash
npm run build
```

This builds for the current platform only.

### Platform‑specific builds

```bash
# Windows (NSIS, MSI, portable)
npm run build:win

# macOS (DMG, PKG)
npm run build:mac

# Linux (AppImage, deb, rpm, snap)
npm run build:linux
```

### Distribution builds (clean, no publishing)

```bash
npm run dist          # all platforms
npm run dist:win      # Windows only
npm run dist:linux    # Linux only
npm run dist:mac      # macOS only
```

Artifacts will be placed in `dist/`.

## Code Signing

### Windows (Authenticode)

1. Obtain a code‑signing certificate from a trusted CA (DigiCert, Sectigo, etc.).
2. Export the certificate as a PFX file (`.pfx`) or install it in the system store.
3. Set environment variables:
   ```bash
   export CSC_LINK="file:///path/to/certificate.pfx"
   export CSC_KEY_PASSWORD="your‑certificate‑password"
   ```
4. The build will automatically sign the executables.

**Open‑source alternative:** Use a self‑signed certificate (users will see a security warning). Generate a self‑signed cert with:

```bash
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes
```

Then convert to PFX:

```bash
openssl pkcs12 -export -out certificate.pfx -inkey key.pem -in cert.pem
```

### macOS (Developer ID)

1. Enroll in the Apple Developer Program ($99/year).
2. Generate a Developer ID Application certificate via Xcode or Apple Developer portal.
3. Create an App‑Specific Password for notarization.
4. Set environment variables:
   ```bash
   export APPLE_ID="your‑apple‑id@example.com"
   export APPLE_APP_SPECIFIC_PASSWORD="xxxx‑xxxx‑xxxx‑xxxx"
   export APPLE_TEAM_ID="XXXXXXXXXX"
   ```
5. The build will sign and notarize the app automatically (via `notarize.js`).

**Note:** Notarization is required for macOS Catalina and later. Without it, the app will be blocked by Gatekeeper.

### Linux

Code signing is not required for Linux packages. You may optionally sign the AppImage with GPG (not covered here).

## CI/CD Pipeline

### GitHub Actions

A sample workflow `.github/workflows/build.yml` is provided. It builds for all three platforms on every push to `main` and creates a release draft when a tag is pushed.

**Secrets required in the repository:**

- `CSC_LINK` (Base64‑encoded PFX file for Windows)
- `CSC_KEY_PASSWORD`
- `APPLE_ID`
- `APPLE_APP_SPECIFIC_PASSWORD`
- `APPLE_TEAM_ID`

**Trigger:**

- Push to `main` → build artifacts, run tests, upload artifacts as workflow run output.
- Tag `v*` → same, plus create a draft release with all installers attached.

### GitLab CI / Jenkins

Similar setup; refer to electron‑builder documentation for multi‑platform CI examples.

## Release Process

1. Update version in `package.json`.
2. Commit and tag with `vX.Y.Z`.
3. Push tag to trigger CI release.
4. CI will build, sign, notarize (if credentials provided), and create a draft release on GitHub.
5. Manually review the draft release, add release notes, and publish.

## Troubleshooting

### “Icon not found”

- Ensure the `assets/` folder exists with required icon files.
- If you don't have icons, remove the `icon` keys from `electron-builder.json` (default Electron icon will be used).

### Windows signing fails

- Verify that `CSC_LINK` points to a valid PFX file (Base64 encoded in CI).
- Ensure `CSC_KEY_PASSWORD` is correct.

### macOS notarization fails

- Check that the Apple ID credentials are correct.
- Ensure the app is signed with a Developer ID certificate (not a development certificate).
- View logs with `xcrun notarytool log <submission‑id> --keychain-profile AC_PASSWORD`.

### Linux AppImage fails to run

- Ensure `FUSE` is installed (or run with `--appimage-extract-and-run`).
- For snap builds, the `snapcraft` tool must be installed.

### Build takes too long / large size

- Check `asarUnpack` list; exclude large modules that aren't needed at runtime.
- Use `npm prune --production` before packaging.
- Consider using `electron-builder`’s compression settings.

## Advanced Configuration

- Modify `electron-builder.json` to add/remove target formats.
- Custom NSIS scripts can be placed in `build/installer.nsh`.
- Custom entitlements for macOS in `build/entitlements.mac.plist`.
- Hook scripts: `build/notarize.js`, `build/afterAll.js`.

## References

- [electron‑builder documentation](https://www.electron.build/)
- [Code Signing for Windows](https://www.electron.build/code-signing)
- [Mac App Notarization](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- [GitHub Actions for Electron](https://www.electron.build/configuration/publish#github-releases)
