// POLARIS — graph reasoning patterns (declarative; not ML)

// R1: Mark buildings vulnerable to flood if overlapping active floodplain
MATCH (b:Building)-[:LOCATED_IN|OVERLAPS]-(f:Floodplain)
WHERE f.inundation_depth_m IS NOT NULL AND f.inundation_depth_m > 0
MERGE (b)-[v:VULNERABLE_TO]->(h:HazardType {hazard_key: 'flood'})
SET v.confidence = 0.7, v.method = 'spatial_overlap', v.updated_at = datetime();

// R2: Create CASCADES_TO from power line to served buildings when faulted
MATCH (p:PowerLine {fault_status: 'fault'})-[:POWERS|FEEDS*1..4]->(b:Building)
MERGE (p)-[c:CASCADES_TO]->(b)
SET c.reason = 'electrical_fault', c.updated_at = datetime();

// R3: Road closure affects hospitals within 3 hops of serving roads
MATCH (ev:OperationalEvent {event_type: 'road_closure'})-[:BLOCKS]->(r:RoadSegment)
MATCH (r)-[:CONNECTED_TO*0..3]-(r2:RoadSegment)-[:SERVES]->(h:Hospital)
MERGE (ev)-[:AFFECTS_ENTITY {derived: true}]->(h)
SET h.access_risk = coalesce(h.access_risk, 0) + 1;

// R4: PumpStation offline elevates flood risk in its DrainageBasin
MATCH (p:PumpStation)
WHERE p.pumps_online = 0 OR p.power_status = 'offline'
MATCH (p)-[:LOCATED_IN|PROTECTS]->(b:DrainageBasin)
MATCH (b)<-[:LOCATED_IN]-(x:Entity)
MERGE (p)-[:CASCADES_TO {reason:'pump_offline'}]->(x);

// R5: Decision completeness gate (query for invalid decisions)
MATCH (d:Decision)
WHERE NOT (d)-[:EXPLAINS]->(:Explanation)
   OR NOT (d)-[:RECOMMENDS]->(:Action)
RETURN d.id AS invalid_decision, 'missing_explanation_or_action' AS reason;
