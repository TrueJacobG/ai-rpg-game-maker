# Playtest checklist

A short first session to find out whether everything works on your real devices. Do it with the sample pack first, then with your own story.

**Needed:** a deployed game ([deploy.md](deploy.md)), a laptop, a tablet with Chrome, and a phone. An Anthropic key is only needed for step 8.

## Set up

1. Import a story, for example `npm run pack:import -- examples/sample-pack --url https://<your address>`.
2. Laptop: open `/master` and log in.
3. On the Dashboard tab, in **Characters**, press "Add the pack's characters". Click a character: a QR code appears. Scan it with the phone; the sheet should open.
4. On the Dashboard tab press "Pair a tablet" in the **Tablet** panel. On the tablet open `/prompter` in Chrome, enter the 6-digit code, pick the speech language and allow the microphone (or tap "Enable microphone"). Use landscape and tap "Full screen".

## Run it

1. **Scene.** On the Story tab open "The missing shipment". The text appears and the tablet shows its picture.
2. **Interaction.** Press "Start the interaction". The tablet should show INTERACTION with the question and its two prompts.
3. **Microphone.** Press "Open the microphone". The tablet should show a red frame and a big LISTENING banner. Say a sentence such as "Kira goes in first and checks the lock". The words should appear on the tablet and on the laptop within a second or two.
4. **Reading.** Press "Close the microphone". The console should show what it understood for each question and suggest an outcome (needs the key, step 8). If something is missing, press "Ask the players again": the tablet highlights what is missing.
5. **Confirm.** Tap an outcome. The next scenes unlock and the decision appears in the Dashboard under "Story so far".
6. **Dice.** Roll your own die, then enter a player's real roll and press "Note it". Both appear in the log.
7. **Hit points and plot.** On the Dashboard press -5 on a character in **Party**. The phone should update within about 15 seconds. Mark a quest or culprit as Found in **Plot**.
8. **Assistant** (needs the key). Press "What next?". Check that the answer fits your story and note the token line under it.

## What to look for

- Does the speech recognition understand your language, and how long does the text take to appear?
- Does the tablet keep its screen on? If it sleeps, does it reconnect by itself when it wakes?
- Does the red LISTENING screen really only appear while the microphone is open?
- Do the layouts work on the tablet and the phone?
- What did the first assistant answer cost?

If a step fails and the screen does not explain why, run `npx wrangler tail` in `apps/worker`, repeat the step and read the output. Note what you did, what you expected and what happened, and open an issue.
