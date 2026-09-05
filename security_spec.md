# Security Specification - TaskManagement

## Data Invariants
1. A **Project** must have an `ownerId` and at least one member in `memberIds`.
2. An **Epic** must belong to a valid `projectId`.
3. A **Task** must belong to a valid `projectId`.
4. Access to **Epics** and **Tasks** is restricted to users who are members of the parent **Project**.
5. Only the **Project** owner or members can add/remove other members (based on application logic, currently simple membership).
6. **Tasks** can only have statuses: 'To Do', 'Progress', 'Review', 'Done'.

## The "Dirty Dozen" Payloads

1. **Identity Spoofing**: Attempt to create a project with an `ownerId` that is not the current user.
2. **Resource Poisoning**: Attempt to create a project with a 2KB name string.
3. **Membership Bypass**: Attempt to read tasks of a project where the user is not in `memberIds`.
4. **Orphaned Epic**: Attempt to create an epic without a `projectId`.
5. **Orphaned Task**: Attempt to create a task without a `projectId`.
6. **State Shortcutting**: Attempt to update a task with an invalid status like 'Archived'.
7. **Cross-Project Poisoning**: Attempt to create a task in Project A but set `projectId` field to Project B.
8. **Immutability Breach**: Attempt to change the `projectId` of an existing task.
9. **Shadow Field Injection**: Attempt to create a task with an unwhitelisted field `isAdmin: true`.
10. **PII Leak**: Attempt to read another user's profile if not signed in (though profiles are public in this app, we should still check auth).
11. **Malicious ID**: Attempt to create a project with ID `../forbidden`.
12. **Timestamp Fraud**: Attempt to create a task with a client-provided `createdAt` from 1970.

## Test Runner (Conceptual)
The `firestore.rules.test.ts` would verify these scenarios by simulating requests with `request.auth` and comparing against `firestore.rules`.
