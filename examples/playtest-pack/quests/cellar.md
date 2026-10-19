---
title: The cellar
tags: [clue]
links: [npc/maren-tolk]
requires: [inside]
image: cellar.png
read_aloud: |
  The cellar door is bolted from below. You hear breathing and the scrape of a chair.
interaction:
  prompt: Someone is hiding in the cellar. What do the players say through the door?
  questions:
    - { key: who, label: Who speaks? }
    - { key: what, label: What do they say? }
outcomes:
  - id: trusted
    label: Maren opens up and gives the key
    text: The old keeper unbolts the door, grey and trembling, and presses the brass key into your hand.
    sets: [has_lamp_key, keeper_safe]
  - id: refused
    label: Maren will not come out
    text: Maren shouts through the door that she broke the light and wants nothing more said about it. She stays below.
---
Be kind and unhurried and she opens. Threats or noise (noisy_entry) make her refuse.
