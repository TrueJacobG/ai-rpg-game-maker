---
title: The missing shipment
tags: [main]
links:
  - location/dock-7
  - culprit/ghost-auditor
read_aloud: |
  Rain hammers the flooded planks of Dock 7. At the far end, the vault door stands closed, and not a scratch on it. Whoever took the debt records had a key.
image: dock-7.png
interaction:
  prompt: The crew arrives at the vault. Who steps forward, and what do they look at first?
  questions:
    - { key: who, label: Who steps forward? }
    - { key: how, label: What do they examine? }
outcomes:
  - id: found_key
    label: They find the auditor key trace
    text: The lock log shows a valid auditor key, registered to a man who died two years ago.
    sets: [auditor_key_traced]
    image: vault.png
  - id: nothing
    label: They find nothing useful
    text: The dock workers clam up. Mara Helix's people are already watching the crew.
---
The crew is hired to find the vanished debt records.

Beats:
1. Inspect Dock 7 and find that the vault was opened with a valid auditor key.
2. Trace the key to a retired auditor who officially died two years ago.
3. Decide who gets the records: Helix Dynamics or the people they bind.
