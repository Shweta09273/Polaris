// POLARIS — traversal examples (read-only patterns)
// These assume Entity secondary label + specific kind labels.

// 1) What does this hospital depend on (1–3 hops)?
MATCH path = (h:Hospital {id: $hospitalId})-[:DEPENDS_ON|POWERS|SUPPLIES*1..3]-(x:Entity)
RETURN path
LIMIT 200;

// 2) Facilities made less accessible if a road is blocked
MATCH (r:RoadSegment {id: $roadId})<-[:BLOCKS]-(e:OperationalEvent)
MATCH (r)-[:CONNECTED_TO*1..4]-(access:RoadSegment)-[:SERVES]->(f:Facility)
RETURN DISTINCT f.id AS facility_id, labels(f) AS labels, e.id AS event_id;

// 3) Cascade from substation outage to buildings and pumps
MATCH (s:Substation {id: $substationId})-[:POWERS|FEEDS|CONNECTED_TO*1..6]->(c:Entity)
WHERE c:Building OR c:PumpStation OR c:Hospital OR c:TelecomTower
RETURN labels(c)[0] AS kind, c.id AS id, c.name AS name;

// 4) Drainage path to receiving waterbody
MATCH path = (d:StormDrain {id: $drainId})-[:DRAINS_INTO|FLOWS_TO*1..8]->(w)
WHERE w:Outfall OR w:Waterway OR w:Waterbody
RETURN path
LIMIT 50;

// 5) Decision evidence neighborhood
MATCH (d:Decision {id: $decisionId})-[:RECOMMENDS]->(a:Action)-[:ACTS_ON]->(t:Entity)
OPTIONAL MATCH (d)-[:EXPLAINS]->(x:Explanation)
OPTIONAL MATCH (d)-[:USES_RESOURCE]->(r)
RETURN d, a, t, x, r;

// 6) Experiment lineage
MATCH (ex:Experiment {id: $experimentId})-[:INITIALIZES]->(snap:TwinSnapshot)
OPTIONAL MATCH (ex)-[:PRODUCES_RESULT]->(res:ExperimentResult)
OPTIONAL MATCH (ex)-[:COMPARED_TO]->(base)
RETURN ex, snap, res, base;
