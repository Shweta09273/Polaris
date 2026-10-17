# Resource Model

**Canonical source:** `packages/ontology/src/resources.ts`

---

## 1. Purpose

Resources are **deployable capacity**: vehicles, crews, equipment, stockpiles, shelter beds.

---

## 2. Resource classes

Ambulance, Fire Engine, Fire Ladder, Rescue Truck, Police Unit, Mobile Command, Pump, Generator, Water Tanker, Sandbag Stock, Medical Team, Engineering Team, Shelter Bed, Fuel, Boat, Drone, Heavy Equipment, Comms Kit, Field Hospital Module.

Each maps to a default `EntityKind` (`VehicleResource`, `Crew`, `EquipmentItem`, `Stockpile`, `ShelterCapacity`).

---

## 3. Lifecycle of use

```
availability: available → reserved → deployed → available
                 ↘ maintenance / out_of_service
```

Supporting objects:

- `ResourceCapacity` — amount/unit/usable  
- `ResourceScheduleWindow` — time-boxed state  
- `ResourceDeployment` — en_route / on_scene / returning / completed  

---

## 4. Graph relations

| Relation | Use |
|---|---|
| STAGED_AT | Home depot/station |
| DEPLOYED_TO | Incident/facility/AOI |
| ALLOCATED_TO | Reservation against decision/incident |
| CREWED_BY | Vehicle↔crew |
| EQUIPPED_WITH | Vehicle/facility↔equipment |
| STORED_AT | Stockpile location |
| CONSUMES | Consumable drawdown |
| USES_RESOURCE | Decision/Action link |

---

## 5. Business rules

- Availability `unknown` is explicit  
- No PII on Crew — unit IDs only  
- Consumables must decrement stock  
- Do not fabricate fleet counts; require partner/agency feeds for live availability  

---

## 6. Scheduling & deployment

Decisions allocate resources (`ALLOCATED_TO` / `USES_RESOURCE`). Deployments record ETA and status for mission-control timelines. Evaluation later compares planned vs actual utilization.
