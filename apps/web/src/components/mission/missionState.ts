/**
 * Mission Control application state contract (V1).
 *
 * MissionControl.tsx is the SSOT hub. Panels (TwinCanvas, MissionIntelligence,
 * Selected object, HUD) react to these fields via props/refs — no parallel stores.
 *
 * Do not invent a second state tree. Extend this contract when wiring new panels.
 */

export type MissionAppState = {
  currentCitySlug: string | null;
  currentCityDisplayName: string | null;
  viewerReady: boolean;
  currentExperimentKind: string | null;
  currentExperimentResultId: string | null;
  currentTimelineFrameIndex: number;
  currentLayers: {
    buildings: boolean;
    roads: boolean;
    water: boolean;
    vegetation: boolean;
    pois: boolean;
    experiment: boolean;
  };
  currentSelection: Record<string, unknown> | null;
  currentEpicenter: { lon: number; lat: number } | null;
  currentMissionBriefId: string | null;
  telemetry: {
    fps: number;
    headingDeg: number;
    heightM: number;
    lon: number;
    lat: number;
    scaleM: number;
  };
};
