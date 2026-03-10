# Code Signing Guide

This guide describes how to obtain and configure code‑signing certificates for OpenClaw Desktop on Windows and macOS.

## Why Code Signing?

- **Windows:** Without a valid Authenticode signature, users will see “Windows protected your PC” warnings. Signed builds are trusted by SmartScreen.
- **macOS:** Developer ID signature + notarization are required to run on macOS Catalina and later. Unsigned apps are blocked by Gatekeeper.

## Windows Authenticode

### 1. Obtain a certificate

**Options:**

- **Commercial CA:** DigiCert, Sectigo, GlobalSign, etc. Cost: ~$200‑$500/year.
- **Azure Key Vault:** If you use Azure, you can generate a certificate via Key Vault (supports EV certificates).
- **Open‑source / self‑signed:** Free, but users will see a warning. Suitable for internal/developer builds.

**Recommended:** Purchase a standard code‑signing certificate from a trusted CA.

### 2. Export as PFX

After purchasing, you'll receive a `.cer` (public key) and a `.pvk` (private key) or a `.pfx`/`.p12` bundle.

If you have separate `.cer` and `.pvk`, combine them into a PFX:

```powershell
pvk2pfx -pvk private.pvk -spc public.cer -pfx bundle.pfx -po password
```

Or with OpenSSL:

```bash
openssl pkcs12 -export -out certificate.pfx -inkey private.key -in certificate.crt
```

### 3. Configure electron‑builder

Store the PFX file securely (e.g., in a password manager). In CI, you can:

- **Encode as Base64:** `cat certificate.pfx | base64 -w0`
- Store the Base64 string as secret `CSC_LINK`.
- Store the PFX password as secret `CSC_KEY_PASSWORD`.

**Local build:** set environment variables:

```bash
export CSC_LINK="file:///path/to/certificate.pfx"
export CSC_KEY_PASSWORD="your‑password"
```

### 4. Self‑signed certificate (for testing)

Generate a self‑signed certificate valid for 1 year:

```bash
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=OpenClaw Desktop"
openssl pkcs12 -export -out certificate.pfx -inkey key.pem -in cert.pem -passout pass:password
```

Use with `CSC_LINK` and `CSC_KEY_PASSWORD=password`. Note: Windows will show “Unknown publisher”.

## macOS Developer ID

### 1. Prerequisites

- Apple Developer Account ($99/year).
- Xcode installed on a macOS machine (for generating certificates and notarization).

### 2. Generate certificates

1. Open Xcode → Preferences → Accounts → select your Apple ID → Manage Certificates.
2. Click “+” → “Developer ID Application”.
3. The certificate will be added to your keychain.

Alternatively, create via Apple Developer Portal:

- Go to Certificates, Identifiers & Profiles.
- Create a “Developer ID Application” certificate.
- Download and install it (double‑click).

### 3. Create App‑Specific Password

For notarization, you need an app‑specific password:

- Visit [appleid.apple.com](https://appleid.apple.com) → Sign in → Security → App‑Specific Passwords.
- Generate a new password (label: “Electron Notarization”).
- Save the password; it will be shown only once.

### 4. Configure electron‑builder

Set environment variables:

```bash
export APPLE_ID="your‑apple‑id@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx‑xxxx‑xxxx‑xxxx"
export APPLE_TEAM_ID="XXXXXXXXXX"
```

The `APPLE_TEAM_ID` can be found in Apple Developer Portal under Membership, or in Xcode’s “Team” setting.

### 5. Notarization

The build script (`build/notarize.js`) uses `electron-notarize` with `notarytool`. Ensure you have Xcode 13+ installed.

If notarization fails, check logs with:

```bash
xcrun notarytool log <submission‑id> --keychain-profile AC_PASSWORD
```

## CI/CD Integration

### GitHub Actions

Secrets to add in repository settings:

- `CSC_LINK` (Base64‑encoded PFX)
- `CSC_KEY_PASSWORD`
- `APPLE_ID`
- `APPLE_APP_SPECIFIC_PASSWORD`
- `APPLE_TEAM_ID`

### GitLab CI

Store secrets as variables (File type for PFX). Example `.gitlab-ci.yml` snippet:

```yaml
variables:
  CSC_LINK: ${CSC_LINK_BASE64}
  CSC_KEY_PASSWORD: ${CSC_KEY_PASSWORD}
  APPLE_ID: ${APPLE_ID}
  APPLE_APP_SPECIFIC_PASSWORD: ${APPLE_APP_SPECIFIC_PASSWORD}
  APPLE_TEAM_ID: ${APPLE_TEAM_ID}
```

### Local Notarization (for testing)

You can notarize a locally built `.app`:

```bash
xcrun notarytool submit ./dist/mac/OpenClaw\ Desktop.app \
  --apple-id $APPLE_ID \
  --password $APPLE_APP_SPECIFIC_PASSWORD \
  --team-id $APPLE_TEAM_ID \
  --wait
```

## Troubleshooting

### Windows: “SignTool Error: No certificates were found”

- Ensure the PFX file is valid and password correct.
- If using Base64 in CI, decode it correctly before using (electron‑builder expects a file path or a base64 string starting with `file://`? Actually `CSC_LINK` can be a base64 string without `file://` prefix; see docs).
- Try setting `CSC_LINK` to the Base64 content directly (without `file://`).

### macOS: “The operation couldn’t be completed. (SecKeychainItemImport error -25244)”

- The certificate may be missing from the keychain. Import it manually.
- Ensure you’re using a “Developer ID Application” certificate, not a “Developer ID Installer”.

### Notarization: “Invalid toolchain”

- Update Xcode Command Line Tools: `xcode-select --install`.
- Use `notarytool` (new) instead of `altool` (deprecated).

## References

- [Electron‑builder Code Signing](https://www.electron.build/code-signing)
- [Apple Notarization Guide](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- [Microsoft Authenticode](https://docs.microsoft.com/en-us/windows/win32/seccrypto/authenticode)
