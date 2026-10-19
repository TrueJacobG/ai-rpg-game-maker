---
title: The lamp room
tags: [finale]
links: [ending/the-light, ending/the-dark, location/lighthouse]
requires: [has_lamp_key]
read_aloud: |
  At the top of the tower the great lens lies before you, cracked from edge to edge. The lamp still works. Out on the black water, far away, a ship's lights are moving toward the rocks.
image: lamp.png
interaction:
  prompt: The ship is minutes away. What do the players do with the cracked lamp?
  questions:
    - { key: who, label: Who works the lamp? }
    - { key: plan, label: What is their plan? }
outcomes:
  - id: light_it
    label: They light the cracked lamp
    text: The beam is weak and scattered, but it reaches the sea.
    sets: [lighthouse_lit]
  - id: smash_it
    label: They destroy the lamp and leave the light dark
    text: The glass shatters across the floor. The sea goes black.
    sets: [lamp_broken]
---
The decision that picks the ending.
