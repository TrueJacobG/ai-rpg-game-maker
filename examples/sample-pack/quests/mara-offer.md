---
title: Mara's offer
tags: [side]
links:
  - npc/mara-helix
  - ending/the-purge
requires: [quest/missing-shipment]
read_aloud: |
  A black car waits at the edge of the dock. Mara Helix lowers the window and says she has a proposal.
interaction:
  prompt: Mara offers the crew a clean slate if the records reach her. What do they answer?
  questions:
    - { key: who, label: Who answers her? }
outcomes:
  - id: accept
    label: They accept her deal
    text: Mara smiles. Her clean slate is real, and so is the price.
    sets: [records_to_helix]
  - id: refuse
    label: They refuse
    text: The window rises. The crew is on their own.
---
Mara never threatens openly. She waits for the crew to come to her.
