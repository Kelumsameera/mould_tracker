---
title: Mould registration and retirement
description: Add a mould, maintain it, soft-delete and restore it
audience: Admin, Super Admin
last_verified: 2026-10-29
app_version: "web/API 2.0.0"
status: Verified
---

# Mould registration and retirement

**Trigger:** a new mould arrives, or one is retired. **Actor:** Admin / Super Admin (`moulds.manage`).

```mermaid
flowchart TD
    A[Add mould: Tool ID, type, items] --> B{Starts at}
    B -->|Mould Room| C[Choose rack; owner zone must match or give reason]
    B -->|Tool Room / Floor / Workshop| D[Saved]
    C --> D[Saved as Good + CREATED history + audit]
    D --> E[In use...]
    E --> F{Retire?}
    F -->|On a machine| G[Refused: take it off first]
    F -->|Elsewhere| H[Delete with reason: soft delete]
    H --> I[Hidden from lists; history kept]
    I -->|Restore| D
```

**Outputs:** History `CREATED` / `DELETED` / `RESTORED`; audit `mould.created` / `mould.deleted` / `mould.restored`.
**Failure paths:** `DUPLICATE_TOOL_ID`, `RACK_REQUIRED`, `RACK_FULL`, `OWNER_MISMATCH`, `UNMOUNT_FIRST`.

Details: [Manage moulds](../user-guide/manage-moulds.md).
