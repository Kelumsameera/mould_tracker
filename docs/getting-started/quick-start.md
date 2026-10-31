---
title: 5-minute quick start
description: Find a mould, read its state, and take your first action
audience: New users (any role)
last_verified: 2026-10-29
app_version: "web/API 2.0.0"
status: Verified (static code review); untested on a running instance
---

# 5-minute quick start

**Goal:** find a mould, understand where it is and what state it is in, and do one thing your role allows.

## Before you begin

You are signed in ([First login](first-login.md)).

## Steps

1. **Find it.** On **Find a mould**, type part of a Tool ID, an Item ID, a product description, a machine code or a rack (for example `FLK A3`).
   *Checkpoint:* the result count updates ("1 mould" / "N moulds").
2. **Read the card.** The status badge shows the condition (Good / Needs service / …). The location line shows the machine, rack, Production Floor, Workshop, Tool Room or Out of Service.
3. **Open it.** Tap the card. Check **Items made by this mould**, **Shots**, and **History**.
4. **Take your first action**, depending on your role:

| Role | Try this | Doc |
|---|---|---|
| Production Supervisor | **Report a problem** with a short description | [Report a problem](../user-guide/report-a-problem.md) |
| Mould Technician | **Mount on a machine** (choose a machine listed for the mould) | [Move a mould](../user-guide/move-a-mould.md) |
| Mould Maker | Open **Workshop queue** and **Change status** on a mould at the Workshop | [Workshop queue](../user-guide/workshop-queue.md) |
| Admin | **Add mould** with one item | [Manage moulds](../user-guide/manage-moulds.md) |

5. **Confirm.** A success message appears, the card updates, and a new line appears in **History**.

## Expected result

You can locate any mould in under 30 seconds and see the actions available to you.

## Troubleshooting

- *"…can only go to the Workshop"*: the mould is not Good. Only Good moulds may be mounted or stored.
- *"…already has …; take it off first"*: the machine is occupied. Move that mould off first.
- More in [Troubleshooting](../support/troubleshooting.md).

## First-day checklist

- [ ] Signed in and changed password
- [ ] Language set (EN / සිං)
- [ ] Found three moulds by Tool ID, Item ID and rack
- [ ] Opened a mould's history
- [ ] Performed one action allowed for your role
- [ ] *(Optional)* Installed the app (**Install app**) or added a passkey
