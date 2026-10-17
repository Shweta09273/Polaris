# ADR-0001: Prefer geoBoundaries over GADM for commercial SaaS

- Status: Accepted
- Date: 2026-07-22

## Context

Administrative boundaries are required to define AOIs. GADM is widely used academically but restricts commercial use without a separate license.

## Decision

Default POLARIS admin-boundary connector uses geoBoundaries (CC BY 4.0).

## Consequences

- Safer commercial redistribution posture
- May have fewer admin levels than GADM in some countries
- GADM may still be used under explicit commercial license later
