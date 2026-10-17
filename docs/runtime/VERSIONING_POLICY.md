# Versioning Policy

## Axes

| Axis | Scheme | Example | Breaking when |
|---|---|---|---|
| Package format | `major.minor` | `1.0` | Magic / envelope incompatible |
| Ontology | SemVer | `1.0.0` | Entity/relation semantics change |
| Compiler | SemVer | `0.3.0` | Producer pipeline contract |
| Runtime | SemVer | `0.3.0` | Loader / mount contract |
| City package | SemVer + build | `1.0.0+20260722` | City twin content revision |

## Compatibility rules

1. **Format major** must equal runtime-supported major (`PACKAGE_FORMAT_MAJOR`).
2. **Ontology major** must match when `requireOntologyMajorMatch` is true.
3. **Runtime major** must fall within `[minRuntimeMajor, maxRuntimeMajor)`.
4. City packages with different `cityVersion` may coexist when `allowSideBySide` is true (registry keeps previousVersions).

## Signing key rotation

- HMAC: rotate `POLARIS_PACKAGE_HMAC_SECRET`; previously signed packages must be re-signed or trust dual keys (dual-key verify is M3.1).
- Ed25519: keyId in signature block selects public key from trust store (reserved).

## Deprecation

- Unsigned packages (`algorithm: none`) are development-only.
- Production deployments set `POLARIS_ALLOW_UNSIGNED_PACKAGES=false`.
