---
title: Arrival
tags: [start]
links: [location/lighthouse, npc/maren-tolk]
read_aloud: |
  The boat grinds onto the rocks. Rain hammers the shore. Above you the lighthouse stands dark, and a single window on the ground floor shows the faint glow of a stove. The door is shut.
image: lighthouse.png
interaction:
  prompt: You stand at the lighthouse door in the storm. Who goes first, and how?
  questions:
    - { key: who, label: Who goes to the door? }
    - { key: how, label: How do they get in? }
outcomes:
  - id: knocked
    label: They knock and wait
    text: Nobody answers, but the door is not locked. Inside it is warm and empty.
    sets: [inside]
  - id: forced
    label: They force their way in
    text: The latch gives with a crack. Something below stirs, then goes still.
    sets: [inside, noisy_entry]
---
Start of the story. Both outcomes lead inside; forcing the door makes the keeper warier later.
