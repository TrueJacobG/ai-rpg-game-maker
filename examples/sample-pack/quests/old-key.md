---
title: The old key
tags: [side]
links:
  - location/dock-7
  - quest/ghost-trail
requires: [char:auditor_key]
read_aloud: |
  The relic in your pocket hums as you pass the vault. It was made for this lock, and the lock has not been changed in two years.
outcomes:
  - id: opens
    label: The key opens the vault
    text: Inside there is a trace of who used a key like this one last, and where they went.
    sets: [auditor_key_traced]
    image: vault.png
---
Only available to a character who started with the old auditor key. It gives the crew the same lead as inspecting the dock, by another road.
