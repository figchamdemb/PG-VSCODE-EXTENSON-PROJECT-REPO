# Narrate Flow Check

UTC: 2026-03-19T09:23:39.6739998Z

- PASS: 5
- FAIL: 0

## PASS - Package command wiring

```text
All required command IDs are declared in contributes.commands. VS Code auto-generated activation is in use; redundant onCommand entries are not required.
```

## PASS - Extension runtime registration

```text
Command registrations and narrate:// provider registration found.
```

## PASS - Core flow source files

```text
All core flow source files exist.
```

## PASS - Extension compile

```text
> narrate-vscode-extension@0.1.0 compile
> npm run clean && tsc -p ./


> narrate-vscode-extension@0.1.0 clean
> rimraf dist
```

## PASS - Runtime interaction surface

```text
All mode state exports, scheme provider, render pipeline, and interaction checks validated.
```

