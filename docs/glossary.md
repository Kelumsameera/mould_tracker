---
title: Glossary
description: Terms used in Mould Tracker and in these docs
audience: Everyone
last_verified: 2026-10-29
app_version: "web/API 2.0.0"
status: Verified (static code review)
---

# Glossary

| Term | Meaning | Code value |
|---|---|---|
| Mould / tool | One Tool ID: an injection mould or an extrusion die. | `Mould` model |
| Tool ID | Unique identifier, stored uppercase (for example `FLK19066`). Searches ignore spacing. | `toolId` |
| Tool type | Injection mould (default) or extrusion die. | `INJECTION_MOULD`, `EXTRUSION_DIE` |
| Item | A product a mould makes: Item ID, description, cavities, material, masterbatch, QAS, pictures. | `Item` model |
| Location | Machine, Production Floor, Workshop, Mould Room, Tool Room or Out of Service. | `MACHINE`, `PRODUCTION_FLOOR`, `WORKSHOP`, `MOULD_ROOM`, `TOOL_ROOM`, `OUT_OF_SERVICE` |
| Mould Room | Storage for injection moulds, organised into zones and racks. | `MOULD_ROOM` |
| Tool Room | Storage for extrusion dies. It has no racks. | `TOOL_ROOM` |
| Zone | A side of the Mould Room (for example FLK). Also used as a mould's **owner**. | `Zone.code` |
| Rack / rack location | Zone + row + number gives a location ID such as `FLK-A3`. Capacity is optional. | `Rack.locationId` |
| Awaiting rack | An imported mould in the Mould Room with no rack yet ("No rack yet"). | `awaitingRack` |
| Status | Good, Needs service, Needs repair, In service, In repair. | `GOOD`, `NEEDS_SERVICE`, `NEEDS_REPAIR`, `IN_SERVICE`, `IN_REPAIR` |
| Capable machines | Machines a mould is listed for. Other machines need an Admin override with a reason. | `capableMachines` |
| Shots / shot limit | Cycles counted while mounted. Reaching `shotsToService` makes the mould service-due. | `totalShots`, `shotsToService` |
| Workshop queue | Moulds at the Workshop plus moulds flagged elsewhere. | `/workshop` |
| Work log | Append-only record of work: repair, service, minor fix, inspection, cleaning, other. | `WorkLog` |
| Problem report | A work-log entry anyone may make. It flags the mould but never changes status or location. | `problemReported`, `openProblem` |
| Correction | A new work-log entry pointing at a wrong one. Entries are never edited. | `correctsId` |
| Out of Service | Sent outside the factory for repair with recipient, address and repair details. Super Admin only. | `OUT_OF_SERVICE` |
| Movement | One history line: created, edited, moved, status changed, deleted, restored, imported. | `Movement` |
| Audit log | Append-only who / what / before / after record of every change. | `AuditLog` |
| Override | An Admin decision to mount on a non-listed machine, or to store on another zone's rack. A reason is required. | `overrideReason` |
| Passkey | Fingerprint, face or PIN sign-in using WebAuthn. | `Passkey` |
| Private user | How a protected System Administrator appears to everyone else. | `backend/lib/accountPrivacy.js` |
| Version (optimistic lock) | A number sent with edits so the server can detect that someone else changed the mould first. | `version` |
