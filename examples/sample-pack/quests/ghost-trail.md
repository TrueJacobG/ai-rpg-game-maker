---
title: The ghost trail
tags: [main]
links:
  - culprit/ghost-auditor
  - ending/the-audit
requires: [auditor_key_traced]
read_aloud: |
  The key leads to a drowned apartment block where a man in an old auditor coat waits, as if he expected visitors.
interaction:
  prompt: Tomas Rue studies the crew. What do they say to earn his trust?
  questions:
    - { key: who, label: Who speaks for the crew? }
    - { key: promise, label: What do they promise him? }
outcomes:
  - id: trusted
    label: Tomas trusts the crew
    text: Tomas hands over the records and asks them to publish everything.
    sets: [records_to_tomas]
  - id: betrayed
    label: The crew takes the records for Helix
    text: Tomas understands too late. The records leave the block in a Helix van.
    sets: [records_to_helix]
---
Tomas Rue speaks only to people who show they are not working for Helix. If the crew wears Helix colours he runs.
