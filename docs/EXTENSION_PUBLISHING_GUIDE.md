# Narrate — VS Code Extension Publishing Guide

> Step-by-step guide to package and publish the Narrate extension to the VS Code Marketplace.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Publisher Account Setup](#publisher-account-setup)
3. [Prepare the Extension](#prepare-the-extension)
4. [Package with vsce](#package-with-vsce)
5. [Test the VSIX Locally](#test-the-vsix-locally)
6. [Publish to Marketplace](#publish-to-marketplace)
7. [Version Management](#version-management)
8. [Extension Metadata Checklist](#extension-metadata-checklist)
9. [CI/CD Automated Publishing](#cicd-automated-publishing)
10. [Post-Publish Verification](#post-publish-verification)

---

## Prerequisites

| Requirement | How to Get It |
|---|---|
| Node.js v20+ | Already installed (v20.20.0) |
| npm | Already installed (10.8.2) |
| `@vscode/vsce` | `npm install -g @vscode/vsce` |
| Azure DevOps PAT | [Create one below](#publisher-account-setup) |
| Microsoft account | For Azure DevOps / Marketplace |

### Install vsce

```powershell
npm install -g @vscode/vsce
vsce --version    # verify
```

---

## Publisher Account Setup

### 1. Create a Visual Studio Marketplace Publisher

1. Go to [Visual Studio Marketplace Management](https://marketplace.visualstudio.com/manage).
2. Sign in with your Microsoft account.
3. Click **"Create publisher"**.
4. Publisher ID: `figchamdemb` (matches `package.json` → `"publisher": "figchamdemb"`).
5. Display Name: Your preferred display name (e.g., "Narrate").
6. Save.

### 2. Create a Personal Access Token (PAT)

1. Go to [Azure DevOps](https://dev.azure.com/).
2. Click your profile icon → **Personal Access Tokens**.
3. Click **"+ New Token"**.
4. Settings:
   - **Name**: `vsce-publish`
   - **Organization**: Select **All accessible organizations**
   - **Scopes**: Select **Custom defined**, then check **Marketplace → Manage**
   - **Expiration**: 90 days (renew before expiry)
5. Copy the token immediately — you won't see it again.

### 3. Login with vsce

```powershell
vsce login figchamdemb
# Paste your PAT when prompted
```

---

## Prepare the Extension

### Compile

```powershell
cd extension
npm install
npm run compile    # rimraf dist && tsc -p ./
```

### Verify package.json Essentials

Your `extension/package.json` already has the required fields:

```json
{
  "name": "narrate-vscode-extension",
  "displayName": "Narrate",
  "description": "Local-first code narration with prompt handoff and incremental cache.",
  "version": "0.1.0",
  "publisher": "figchamdemb",
  "engines": { "vscode": "^1.92.0" },
  "main": "./dist/extension.js",
  "categories": ["Other"]
}
```

### Add Recommended Fields Before Publishing

Update `extension/package.json` with these fields for a polished listing:

```json
{
  "icon": "resources/icon.png",
  "galleryBanner": {
    "color": "#1e1e1e",
    "theme": "dark"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/figchamdemb/PG-VSCODE-EXTENSON-PROJECT-REPO"
  },
  "bugs": {
    "url": "https://github.com/figchamdemb/PG-VSCODE-EXTENSON-PROJECT-REPO/issues"
  },
  "homepage": "https://pg-ext.addresly.com",
  "keywords": [
    "narration",
    "code-review",
    "education",
    "reading-mode",
    "licensing"
  ]
}
```

### Create an Icon

Place a 128×128 (or 256×256) PNG icon at `extension/resources/icon.png`.

### Create a .vscodeignore

Create `extension/.vscodeignore` to exclude unnecessary files from the package:

```
.vscode/**
src/**
node_modules/**
!node_modules/@types/**
tsconfig.json
**/*.ts
**/*.map
logs/**
```

### Create/Update extension/README.md

This becomes the Marketplace listing description. Include:
- What Narrate does (1-paragraph summary)
- Feature list with screenshots
- Getting started instructions
- Configuration settings
- Command palette reference
- License

---

## Package with vsce

### Build the VSIX

```powershell
cd extension
vsce package
# Output: narrate-vscode-extension-0.1.0.vsix
```

If you get warnings about missing fields, vsce will tell you exactly what to fix.

### Common Packaging Issues

| Issue | Fix |
|---|---|
| Missing `repository` | Add `repository` field to `package.json` |
| Missing `README.md` | Create `extension/README.md` with extension description |
| Missing `LICENSE` | Add a `LICENSE` or `LICENSE.md` file |
| Icon not found | Ensure icon path in `package.json` matches actual file |
| Files too large | Check `.vscodeignore` excludes `node_modules`, `src/`, etc. |

---

## Test the VSIX Locally

Before publishing, install and test the packaged VSIX:

```powershell
# Install from VSIX
code --install-extension extension/narrate-vscode-extension-0.1.0.vsix

# Or from within VS Code:
# Extensions sidebar → ⋯ menu → "Install from VSIX..."
```

Verify all commands work:
1. Open a source file
2. Run `Narrate: Toggle Reading Mode (Dev)` — narration appears
3. Run `Narrate: Open Command Help` — help sidebar opens
4. Run `Narrate: Run Command Diagnostics` — report generates

Uninstall after testing:
```powershell
code --uninstall-extension figchamdemb.narrate-vscode-extension
```

---

## Publish to Marketplace

### First Publish

```powershell
cd extension
vsce publish
```

Or publish a specific version:

```powershell
vsce publish 0.1.0
```

### Publish Pre-Release

```powershell
vsce publish --pre-release
```

### Verify on Marketplace

After publishing, your extension will be available at:

```
https://marketplace.visualstudio.com/items?itemName=figchamdemb.narrate-vscode-extension
```

It may take 5-10 minutes for the listing to appear.

---

## Version Management

### Semantic Versioning

Follow semver: `MAJOR.MINOR.PATCH`

| Version Bump | When |
|---|---|
| Patch (`0.1.0` → `0.1.1`) | Bug fixes, small improvements |
| Minor (`0.1.0` → `0.2.0`) | New features, commands |
| Major (`0.1.0` → `1.0.0`) | Breaking changes, stable release |

### Bump and Publish in One Command

```powershell
cd extension
vsce publish patch    # 0.1.0 → 0.1.1
vsce publish minor    # 0.1.0 → 0.2.0
vsce publish major    # 0.1.0 → 1.0.0
```

This auto-updates `package.json`, creates a git tag, and publishes.

---

## Extension Metadata Checklist

Before publishing, verify these items:

- [ ] `package.json` → `publisher` matches your Marketplace publisher ID
- [ ] `package.json` → `version` is correct
- [ ] `package.json` → `displayName` is user-friendly
- [ ] `package.json` → `description` is clear and concise
- [ ] `package.json` → `repository` URL is set
- [ ] `package.json` → `icon` points to a valid image
- [ ] `package.json` → `engines.vscode` specifies minimum VS Code version
- [ ] `package.json` → `categories` is set (e.g., `["Education", "Other"]`)
- [ ] `extension/README.md` has a compelling description with screenshots
- [ ] `extension/.vscodeignore` excludes source/test files
- [ ] `npm run compile` succeeds with zero errors
- [ ] VSIX installs and works in a clean VS Code instance
- [ ] All commands appear in the Command Palette
- [ ] Extension activates without errors in the Output panel

---

## CI/CD Automated Publishing

### GitHub Actions Workflow (Example)

Create `.github/workflows/publish-extension.yml`:

```yaml
name: Publish Extension
on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: cd extension && npm ci

      - name: Compile
        run: cd extension && npm run compile

      - name: Publish to Marketplace
        run: cd extension && npx @vscode/vsce publish
        env:
          VSCE_PAT: ${{ secrets.VSCE_PAT }}
```

Add your PAT as a GitHub secret named `VSCE_PAT`.

### Publish Flow

```
git tag v0.1.0
git push origin v0.1.0
# → GitHub Actions compiles + publishes automatically
```

---

## Post-Publish Verification

1. Search "Narrate" in VS Code Extensions marketplace
2. Install from marketplace on a clean machine
3. Verify activation events fire (check Output → Narrate)
4. Test core commands: reading mode, export, help
5. Check the marketplace listing for correct description, icon, and screenshots
6. Monitor the [publisher dashboard](https://marketplace.visualstudio.com/manage) for install counts and ratings

---

## Useful Links

- [VS Code Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [vsce CLI Reference](https://github.com/microsoft/vscode-vsce)
- [Marketplace Management](https://marketplace.visualstudio.com/manage)
- [Extension Manifest Reference](https://code.visualstudio.com/api/references/extension-manifest)
