/**
 * Canonical relationship vocabulary (Neo4j relationship types).
 * Names are stable API contracts — do not rename lightly; version instead.
 */

export const RELATION_TYPES = [
  // Structural / spatial
  "LOCATED_IN",
  "CONTAINS",
  "ADJACENT_TO",
  "OVERLAPS",
  "BOUND_BY",
  "PART_OF",
  "COMPOSED_OF",
  "CONNECTED_TO",
  "INTERSECTS",

  // Network topology
  "FLOWS_TO",
  "DRAINS_INTO",
  "FEEDS",
  "SUPPLIES",
  "POWERS",
  "TRANSMITS",
  "ROUTES_TO",

  // Service / function
  "SERVES",
  "SERVED_BY",
  "PROVIDES",
  "REQUIRES",
  "SUPPORTS",
  "ENABLES",
  "PROTECTS",
  "GUARDS",
  "TREATS",
  "EDUCATES",

  // Dependency / cascade
  "DEPENDS_ON",
  "CRITICAL_FOR",
  "BLOCKS",
  "CONSTRAINS",
  "AFFECTS",
  "IMPACTS",
  "CASCADES_TO",
  "EXPOSES",
  "VULNERABLE_TO",
  "MITIGATES",

  // Control / ownership
  "OWNED_BY",
  "OPERATED_BY",
  "CONTROLLED_BY",
  "MANAGED_BY",
  "GOVERNED_BY",
  "REGULATED_BY",
  "FUNDED_BY",
  "ASSIGNED_TO",

  // Observation / evidence
  "MONITORED_BY",
  "OBSERVED_BY",
  "MEASURES",
  "DERIVED_FROM",
  "EVIDENCED_BY",
  "VERSION_OF",

  // Event dynamics
  "TRIGGERED_BY",
  "TRIGGERS",
  "CAUSED_BY",
  "CAUSES",
  "OCCURS_IN",
  "AFFECTS_ENTITY",
  "TERMINATES",
  "SUPERSEDES",

  // Resources / logistics
  "DEPLOYED_TO",
  "STAGED_AT",
  "CONSUMES",
  "ALLOCATED_TO",
  "CREWED_BY",
  "EQUIPPED_WITH",
  "STORED_AT",

  // Decision / experiment
  "RECOMMENDS",
  "ACTS_ON",
  "USES_RESOURCE",
  "EXPECTED_TO",
  "EVALUATED_BY",
  "EXPLAINS",
  "COMPARED_TO",
  "INITIALIZES",
  "MUTATES",
  "PRODUCES_RESULT",

  // Temporal
  "PRECEDES",
  "FOLLOWS",
  "DURING",
  "VALID_DURING",
] as const;

export type RelationType = (typeof RELATION_TYPES)[number];

export type RelationArity = "1:1" | "1:N" | "N:1" | "N:M";
export type RelationDirectionality = "directed" | "undirected" | "bidirectional_pair";

export interface RelationSpec {
  readonly type: RelationType;
  readonly description: string;
  readonly arity: RelationArity;
  readonly directionality: RelationDirectionality;
  readonly inverse?: RelationType;
  readonly cascadeRelevant: boolean;
  readonly allowedDomainHints: readonly string[];
}

export const RELATION_SPECS: readonly RelationSpec[] = [
  { type: "LOCATED_IN", description: "Entity spatially or administratively resides in a container.", arity: "N:M", directionality: "directed", inverse: "CONTAINS", cascadeRelevant: false, allowedDomainHints: ["spatial", "administrative", "buildings"] },
  { type: "CONTAINS", description: "Container includes child entities.", arity: "1:N", directionality: "directed", inverse: "LOCATED_IN", cascadeRelevant: false, allowedDomainHints: ["spatial", "administrative"] },
  { type: "ADJACENT_TO", description: "Shares a boundary or topological neighbor relation.", arity: "N:M", directionality: "undirected", cascadeRelevant: true, allowedDomainHints: ["spatial", "land_use", "transportation"] },
  { type: "OVERLAPS", description: "Geometries or jurisdictions partially intersect.", arity: "N:M", directionality: "undirected", cascadeRelevant: true, allowedDomainHints: ["spatial", "policy", "disasters"] },
  { type: "BOUND_BY", description: "Delimited by a boundary feature.", arity: "N:M", directionality: "directed", cascadeRelevant: false, allowedDomainHints: ["administrative", "spatial"] },
  { type: "PART_OF", description: "Component membership in an aggregate.", arity: "N:1", directionality: "directed", inverse: "COMPOSED_OF", cascadeRelevant: true, allowedDomainHints: ["infrastructure", "buildings", "transportation"] },
  { type: "COMPOSED_OF", description: "Aggregate composed of parts.", arity: "1:N", directionality: "directed", inverse: "PART_OF", cascadeRelevant: true, allowedDomainHints: ["infrastructure", "buildings"] },
  { type: "CONNECTED_TO", description: "Network adjacency (roads, pipes, cables, rails).", arity: "N:M", directionality: "undirected", cascadeRelevant: true, allowedDomainHints: ["transportation", "utilities", "energy", "water", "communication"] },
  { type: "INTERSECTS", description: "Crosses or meets at a junction without containment.", arity: "N:M", directionality: "undirected", cascadeRelevant: true, allowedDomainHints: ["transportation", "spatial"] },

  { type: "FLOWS_TO", description: "Directed material/energy/flow along a network.", arity: "N:M", directionality: "directed", cascadeRelevant: true, allowedDomainHints: ["water", "drainage", "energy", "transportation"] },
  { type: "DRAINS_INTO", description: "Hydrologic or sewer drainage destination.", arity: "N:M", directionality: "directed", cascadeRelevant: true, allowedDomainHints: ["drainage", "water", "natural_features"] },
  { type: "FEEDS", description: "Upstream source feeds a downstream consumer/node.", arity: "N:M", directionality: "directed", cascadeRelevant: true, allowedDomainHints: ["energy", "water", "utilities"] },
  { type: "SUPPLIES", description: "Provides commodity or service capacity to a consumer.", arity: "N:M", directionality: "directed", cascadeRelevant: true, allowedDomainHints: ["utilities", "energy", "water", "resources"] },
  { type: "POWERS", description: "Electrical (or equivalent) power provision.", arity: "N:M", directionality: "directed", cascadeRelevant: true, allowedDomainHints: ["energy", "buildings", "infrastructure"] },
  { type: "TRANSMITS", description: "Carries signal or power over distance.", arity: "N:M", directionality: "directed", cascadeRelevant: true, allowedDomainHints: ["energy", "communication"] },
  { type: "ROUTES_TO", description: "Scheduled or logical routing endpoint.", arity: "N:M", directionality: "directed", cascadeRelevant: true, allowedDomainHints: ["transportation"] },

  { type: "SERVES", description: "Functional service coverage from provider to beneficiary.", arity: "N:M", directionality: "directed", inverse: "SERVED_BY", cascadeRelevant: true, allowedDomainHints: ["healthcare", "emergency", "public_services", "education", "utilities"] },
  { type: "SERVED_BY", description: "Inverse of SERVES.", arity: "N:M", directionality: "directed", inverse: "SERVES", cascadeRelevant: true, allowedDomainHints: ["population", "buildings"] },
  { type: "PROVIDES", description: "Offers a capability or amenity.", arity: "N:M", directionality: "directed", cascadeRelevant: false, allowedDomainHints: ["public_services", "resources"] },
  { type: "REQUIRES", description: "Hard prerequisite dependency.", arity: "N:M", directionality: "directed", cascadeRelevant: true, allowedDomainHints: ["buildings", "infrastructure", "resources"] },
  { type: "SUPPORTS", description: "Soft enabling dependency.", arity: "N:M", directionality: "directed", cascadeRelevant: true, allowedDomainHints: ["infrastructure", "communication"] },
  { type: "ENABLES", description: "Makes an operation possible.", arity: "N:M", directionality: "directed", cascadeRelevant: true, allowedDomainHints: ["policy", "infrastructure"] },
  { type: "PROTECTS", description: "Reduces hazard exposure for a protected entity.", arity: "N:M", directionality: "directed", cascadeRelevant: true, allowedDomainHints: ["emergency", "security", "infrastructure"] },
  { type: "GUARDS", description: "Security presence protecting an asset/area.", arity: "N:M", directionality: "directed", cascadeRelevant: false, allowedDomainHints: ["security"] },
  { type: "TREATS", description: "Healthcare service relationship.", arity: "N:M", directionality: "directed", cascadeRelevant: false, allowedDomainHints: ["healthcare"] },
  { type: "EDUCATES", description: "Education service relationship.", arity: "N:M", directionality: "directed", cascadeRelevant: false, allowedDomainHints: ["education"] },

  { type: "DEPENDS_ON", description: "Operational dependence; failure propagates.", arity: "N:M", directionality: "directed", cascadeRelevant: true, allowedDomainHints: ["*"] },
  { type: "CRITICAL_FOR", description: "Marked critical upstream for a mission function.", arity: "N:M", directionality: "directed", cascadeRelevant: true, allowedDomainHints: ["*"] },
  { type: "BLOCKS", description: "Prevents access, flow, or operation.", arity: "N:M", directionality: "directed", cascadeRelevant: true, allowedDomainHints: ["events", "construction", "transportation"] },
  { type: "CONSTRAINS", description: "Limits capacity, timing, or policy options.", arity: "N:M", directionality: "directed", cascadeRelevant: true, allowedDomainHints: ["policy", "resources"] },
  { type: "AFFECTS", description: "General influence without claiming causation certainty.", arity: "N:M", directionality: "directed", cascadeRelevant: true, allowedDomainHints: ["events", "environment", "weather"] },
  { type: "IMPACTS", description: "Quantified or assessed impact link.", arity: "N:M", directionality: "directed", cascadeRelevant: true, allowedDomainHints: ["disasters", "decision", "experiment"] },
  { type: "CASCADES_TO", description: "Explicit cascade edge for multi-hop failure paths.", arity: "N:M", directionality: "directed", cascadeRelevant: true, allowedDomainHints: ["*"] },
  { type: "EXPOSES", description: "Creates or increases exposure to a hazard.", arity: "N:M", directionality: "directed", cascadeRelevant: true, allowedDomainHints: ["disasters", "environment"] },
  { type: "VULNERABLE_TO", description: "Entity vulnerability toward a hazard/event type.", arity: "N:M", directionality: "directed", cascadeRelevant: true, allowedDomainHints: ["buildings", "infrastructure", "population"] },
  { type: "MITIGATES", description: "Reduces likelihood or severity of an adverse effect.", arity: "N:M", directionality: "directed", cascadeRelevant: true, allowedDomainHints: ["policy", "infrastructure", "resources"] },

  { type: "OWNED_BY", description: "Legal ownership.", arity: "N:1", directionality: "directed", cascadeRelevant: false, allowedDomainHints: ["government", "economy", "buildings"] },
  { type: "OPERATED_BY", description: "Day-to-day operator.", arity: "N:1", directionality: "directed", cascadeRelevant: false, allowedDomainHints: ["utilities", "transportation", "emergency"] },
  { type: "CONTROLLED_BY", description: "Command/control authority.", arity: "N:1", directionality: "directed", cascadeRelevant: true, allowedDomainHints: ["government", "security", "emergency"] },
  { type: "MANAGED_BY", description: "Administrative management responsibility.", arity: "N:1", directionality: "directed", cascadeRelevant: false, allowedDomainHints: ["government", "public_services"] },
  { type: "GOVERNED_BY", description: "Subject to a governing body.", arity: "N:1", directionality: "directed", cascadeRelevant: false, allowedDomainHints: ["administrative", "government"] },
  { type: "REGULATED_BY", description: "Subject to a policy/regulation.", arity: "N:M", directionality: "directed", cascadeRelevant: true, allowedDomainHints: ["policy"] },
  { type: "FUNDED_BY", description: "Financial sponsor.", arity: "N:M", directionality: "directed", cascadeRelevant: false, allowedDomainHints: ["economy", "government"] },
  { type: "ASSIGNED_TO", description: "Task/resource assignment.", arity: "N:M", directionality: "directed", cascadeRelevant: false, allowedDomainHints: ["resources", "decision"] },

  { type: "MONITORED_BY", description: "Sensor or agency monitors entity.", arity: "N:M", directionality: "directed", cascadeRelevant: false, allowedDomainHints: ["observation"] },
  { type: "OBSERVED_BY", description: "Observation of an entity/state.", arity: "N:M", directionality: "directed", cascadeRelevant: false, allowedDomainHints: ["observation"] },
  { type: "MEASURES", description: "Instrument measures a quantity of an entity.", arity: "N:M", directionality: "directed", cascadeRelevant: false, allowedDomainHints: ["observation", "environment", "weather"] },
  { type: "DERIVED_FROM", description: "Lineage from source dataset/entity.", arity: "N:M", directionality: "directed", cascadeRelevant: false, allowedDomainHints: ["twin_meta"] },
  { type: "EVIDENCED_BY", description: "Claim supported by observation/dataset.", arity: "N:M", directionality: "directed", cascadeRelevant: false, allowedDomainHints: ["decision", "observation"] },
  { type: "VERSION_OF", description: "Entity/state version lineage.", arity: "N:1", directionality: "directed", cascadeRelevant: false, allowedDomainHints: ["twin_meta", "time"] },

  { type: "TRIGGERED_BY", description: "Event triggered by cause.", arity: "N:M", directionality: "directed", cascadeRelevant: true, allowedDomainHints: ["events", "disasters"] },
  { type: "TRIGGERS", description: "Cause triggers subsequent event.", arity: "N:M", directionality: "directed", cascadeRelevant: true, allowedDomainHints: ["events"] },
  { type: "CAUSED_BY", description: "Causal attribution (with confidence on edge).", arity: "N:M", directionality: "directed", cascadeRelevant: true, allowedDomainHints: ["events", "disasters"] },
  { type: "CAUSES", description: "Forward causal link.", arity: "N:M", directionality: "directed", cascadeRelevant: true, allowedDomainHints: ["events"] },
  { type: "OCCURS_IN", description: "Event occurs in place/AOI.", arity: "N:M", directionality: "directed", cascadeRelevant: false, allowedDomainHints: ["events", "spatial"] },
  { type: "AFFECTS_ENTITY", description: "Event affects a specific entity instance.", arity: "N:M", directionality: "directed", cascadeRelevant: true, allowedDomainHints: ["events"] },
  { type: "TERMINATES", description: "Condition/event ends another event.", arity: "N:M", directionality: "directed", cascadeRelevant: false, allowedDomainHints: ["events"] },
  { type: "SUPERSEDES", description: "Newer record replaces prior.", arity: "1:1", directionality: "directed", cascadeRelevant: false, allowedDomainHints: ["twin_meta", "policy"] },

  { type: "DEPLOYED_TO", description: "Resource deployed to location/incident.", arity: "N:M", directionality: "directed", cascadeRelevant: false, allowedDomainHints: ["resources", "emergency"] },
  { type: "STAGED_AT", description: "Resource staged at facility/depot.", arity: "N:1", directionality: "directed", cascadeRelevant: false, allowedDomainHints: ["resources"] },
  { type: "CONSUMES", description: "Resource consumption of stock/fuel/time.", arity: "N:M", directionality: "directed", cascadeRelevant: false, allowedDomainHints: ["resources"] },
  { type: "ALLOCATED_TO", description: "Reservation of resource capacity.", arity: "N:M", directionality: "directed", cascadeRelevant: false, allowedDomainHints: ["resources", "decision"] },
  { type: "CREWED_BY", description: "Asset operated by crew/team.", arity: "N:M", directionality: "directed", cascadeRelevant: false, allowedDomainHints: ["resources"] },
  { type: "EQUIPPED_WITH", description: "Asset carries equipment.", arity: "1:N", directionality: "directed", cascadeRelevant: false, allowedDomainHints: ["resources"] },
  { type: "STORED_AT", description: "Stockpile location.", arity: "N:1", directionality: "directed", cascadeRelevant: false, allowedDomainHints: ["resources"] },

  { type: "RECOMMENDS", description: "Decision recommends an action set.", arity: "1:N", directionality: "directed", cascadeRelevant: false, allowedDomainHints: ["decision"] },
  { type: "ACTS_ON", description: "Action targets entities.", arity: "N:M", directionality: "directed", cascadeRelevant: false, allowedDomainHints: ["decision"] },
  { type: "USES_RESOURCE", description: "Action/decision consumes resources.", arity: "N:M", directionality: "directed", cascadeRelevant: false, allowedDomainHints: ["decision", "resources"] },
  { type: "EXPECTED_TO", description: "Links to expected outcome node.", arity: "1:N", directionality: "directed", cascadeRelevant: false, allowedDomainHints: ["decision", "experiment"] },
  { type: "EVALUATED_BY", description: "Decision/experiment evaluation record.", arity: "N:1", directionality: "directed", cascadeRelevant: false, allowedDomainHints: ["decision", "experiment"] },
  { type: "EXPLAINS", description: "Explanation artifact for a decision.", arity: "1:1", directionality: "directed", cascadeRelevant: false, allowedDomainHints: ["decision"] },
  { type: "COMPARED_TO", description: "Baseline or alternative comparison.", arity: "N:M", directionality: "directed", cascadeRelevant: false, allowedDomainHints: ["experiment"] },
  { type: "INITIALIZES", description: "Experiment initializes from a twin state.", arity: "N:1", directionality: "directed", cascadeRelevant: false, allowedDomainHints: ["experiment"] },
  { type: "MUTATES", description: "Experiment action mutates entity state variables.", arity: "N:M", directionality: "directed", cascadeRelevant: false, allowedDomainHints: ["experiment"] },
  { type: "PRODUCES_RESULT", description: "Experiment produces a result package.", arity: "1:1", directionality: "directed", cascadeRelevant: false, allowedDomainHints: ["experiment"] },

  { type: "PRECEDES", description: "Temporal ordering before.", arity: "N:M", directionality: "directed", inverse: "FOLLOWS", cascadeRelevant: false, allowedDomainHints: ["time", "events"] },
  { type: "FOLLOWS", description: "Temporal ordering after.", arity: "N:M", directionality: "directed", inverse: "PRECEDES", cascadeRelevant: false, allowedDomainHints: ["time", "events"] },
  { type: "DURING", description: "Occurs within a time interval.", arity: "N:M", directionality: "directed", cascadeRelevant: false, allowedDomainHints: ["time"] },
  { type: "VALID_DURING", description: "Fact/state validity interval.", arity: "N:1", directionality: "directed", cascadeRelevant: false, allowedDomainHints: ["time", "twin_meta"] },
];

export function isRelationType(value: string): value is RelationType {
  return (RELATION_TYPES as readonly string[]).includes(value);
}
