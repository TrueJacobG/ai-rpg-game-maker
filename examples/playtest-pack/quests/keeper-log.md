---
title: The keeper's journal
tags: [clue]
links: [npc/maren-tolk, location/lighthouse]
requires: [inside]
read_aloud: |
  On the desk lies the keeper's journal, open. The last entries are shaky: the lens cracked, the key moved "where the sea can't find it", and a line underlined twice, "Nobody must know."
image: lighthouse.png
interaction:
  prompt: The journal hints at a hidden key. Who reads it, and where do they look for the key?
  questions:
    - { key: who, label: Who searches? }
    - { key: where, label: Where do they look? }
outcomes:
  - id: found_key
    label: They work out where the key is
    text: Behind the stove-side tile, wrapped in oilcloth, lies a small brass key.
    sets: [has_lamp_key]
  - id: no_luck
    label: They find nothing
    text: The tiles are cold and the rooms are bare. The cellar door in the floor is the only place left.
---
Alternative route to the key. If it fails, the cellar still works.
