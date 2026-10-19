---
title: The old lantern
tags: [side]
links: [location/lighthouse]
requires: [inside, char:lantern]
read_aloud: |
  Your own storm lantern flares as you pass the stairs. Its handle fits the strange brass ring on the lamp-room door: this lighthouse used the same make.
interaction:
  prompt: The lantern's handle matches the lock. What do the players try?
  questions:
    - { key: who, label: Who tries it? }
outcomes:
  - id: opened
    label: The lantern opens the door
    text: With a twist and a click, the lamp-room door swings open.
    sets: [has_lamp_key]
---
Only for a character who began with the lantern. A shortcut to the lamp room.
