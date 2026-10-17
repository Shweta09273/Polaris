"""
Connector template — copy this package for each data source.

Rules:
- Never invent geometries or attributes.
- Always return Provenance-compatible metadata.
- If credentials or data are missing, fail closed with a clear error.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol


@dataclass(frozen=True)
class BBox:
    min_lon: float
    min_lat: float
    max_lon: float
    max_lat: float
    crs: str = "EPSG:4326"


@dataclass(frozen=True)
class ConnectorManifest:
    id: str
    display_name: str
    license: str
    attribution: str
    homepage: str
    access_mode: str
    requires_credentials: bool
    credential_env_keys: tuple[str, ...]
    update_cadence: str
    notes: str


class DatasetConnector(Protocol):
    manifest: ConnectorManifest

    def discover(self, bbox: BBox) -> dict[str, Any]:
        """Return availability without downloading payloads."""

    def fetch(self, bbox: BBox) -> dict[str, Any]:
        """Fetch real source objects for the AOI."""

    def validate(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Schema/license validation before publish."""


MANIFEST = ConnectorManifest(
    id="template.example",
    display_name="Template Connector",
    license="Unknown-Needs-Review",
    attribution="Replace with real attribution",
    homepage="https://example.invalid",
    access_mode="api",
    requires_credentials=False,
    credential_env_keys=(),
    update_cadence="unknown",
    notes="Replace this template. Do not ship as a live connector.",
)


class TemplateConnector:
    manifest = MANIFEST

    def discover(self, bbox: BBox) -> dict[str, Any]:
        return {
            "available": False,
            "reason": "Template connector is not a data source.",
        }

    def fetch(self, bbox: BBox) -> dict[str, Any]:
        raise NotImplementedError("Template connector cannot fetch data.")

    def validate(self, payload: dict[str, Any]) -> dict[str, Any]:
        return {"ok": False, "errors": ["Template connector cannot validate data."]}
