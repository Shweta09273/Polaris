export type { BuildingArchetype, BuildingVisual, HeightSource, VisualMaterialId } from "./archetypes";
export { classifyBuildingVisual, hashEntityId, visualVariant } from "./archetypes";
export { getBuildingMaterial, getFallbackColorMaterial, getRoofColor, getSelectionOutlineColor } from "./materials";
export { applyPoiVisual, normalizePoiKind, poiStyle } from "./poiMarkers";
export { lodFromCameraHeight, LOD_CLOSE_M, LOD_FAR_M, LOD_MID_M } from "./lod";
export { registerLandmarkAsset, resolveLandmarkAsset, PROCEDURAL_LIBRARY_NOTE } from "./assetRegistry";
