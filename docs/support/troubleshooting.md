---
title: Troubleshooting
description: Symptom, cause, check, fix and escalation for common problems
audience: All users; support
last_verified: 2026-10-29
app_version: "web/API 2.0.0"
status: Verified (messages taken from source)
---

# Troubleshooting

| Message / symptom | Cause | Fix | Escalate to |
|---|---|---|---|
| "Invalid email or password" | Wrong credentials or disabled account | Retry; check caps lock | Admin |
| "Too many authentication attempts…" | 40 attempts in 10 min | Wait 10 minutes | — |
| "Invalid or expired session" / sent to sign-in | Session expired, user disabled | Sign in again | Admin |
| "You do not have permission to do this" | Role or custom access | Ask someone with the right role | Admin / System Administrator |
| "…is needs repair; it can only go to the Workshop" (`NOT_GOOD`) | Only Good moulds leave the Workshop | Send to Workshop, fix, mark Good | Technician / Maker |
| "…already has X; take it off first" (`MACHINE_OCCUPIED`) | One mould per machine | Move X off first | Supervisor |
| "…is not listed for INJ-03" (`NOT_CAPABLE`) | Machine not in capable machines | Choose a listed machine, or an Admin overrides with a reason | Admin |
| "…has reached its shot limit…" (`SERVICE_DUE`) | Shots ≥ limit | Service at the Workshop | Technician |
| "Rack FLK-A3 is full" (`RACK_FULL`) | Capacity reached | Choose another rack | Super Admin (capacity) |
| "…belongs to FLK, not CCI; give a reason…" (`OWNER_MISMATCH`) | Owner zone ≠ rack zone | Use own zone, or give a reason | — |
| "Remarks are required…" | Workshop / Out of Service moves and status changes | Enter remarks | — |
| "Send … to the Workshop before changing its status" | Status changes only at the Workshop | Move first | — |
| "…was changed by someone else. Refresh and try again." (`STALE`) | Concurrent edit | Reload and redo | — |
| "Take … off the machine before deleting it" | Delete on a machine | Unmount first | — |
| "…entries match; narrow the filters to 5000 or fewer" | Export cap | Narrow the date range | — |
| "Upload is too large" / "Photos must be JPEG, PNG or WebP" | Photo size/type | Use a smaller JPEG/PNG/WebP | — |
| "The work time cannot be in the future" | Device clock / date field | Fix the date | — |
| "Offline — cannot reach server" | Network / server down | Check Wi-Fi/LAN; retry | IT |
| Passkey button disabled | No trusted HTTPS configuration | Use password | IT |
| Certificate warning on a device | Factory CA not trusted | Install the CA (`deploy/LOCAL-HTTPS.md`) | IT |
