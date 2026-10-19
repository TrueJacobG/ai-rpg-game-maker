# Playtest checklist

A short first session to find out whether everything works on your real devices. Do it with the sample pack first, then with your own story.

**Needed:** a deployed game ([deploy.md](deploy.md)), a laptop, a tablet with Chrome, and a phone. An Anthropic key is only needed for step 8.

## Set up

1. Import a story, for example `npm run pack:import -- examples/sample-pack --url https://<your address>`.
2. Laptop: open `/master` and log in.
3. In **Characters** press "Add the pack's characters". Click a character: a QR code appears. Scan it with the phone; the sheet should open.
4. Press "Pair a tablet" in the **Tablet** panel. On the tablet open `/prompter` in Chrome, enter the 6-digit code, pick the speech language and allow the microphone (or tap "Enable microphone"). Use landscape and tap "Full screen".

## Run it

1. **Decision.** Pick a template (for example Escape) and start it. The tablet should show DEBATE with the question and its slots.
2. **Microphone.** Press "Open the microphone". The tablet should show a red frame and a big LISTENING banner. Say a sentence. The words should appear on the tablet and on the laptop within a second or two.
3. **Review.** Press "Close the microphone", tick the slots that were covered and press "Accept and continue", or "Another try" to send the players back. The accepted decision appears in "Story so far".
4. **Roll.** In "Roll by stats" choose a character, a stat and a difficulty. The result appears on the tablet.
5. **Hit points.** Press -5 on a character in **Party**. The phone should update within about 15 seconds, or immediately when the phase changes.
6. **Plot.** Mark a quest or culprit as Found.
7. **Break.** Start a break and end it.
8. **Assistant** (needs the key). Press "What next?". Check that the answer fits your story and note the token line under it.

## What to look for

- Does the speech recognition understand your language, and how long does the text take to appear?
- Does the tablet keep its screen on? If it sleeps, does it reconnect by itself when it wakes?
- Does the red LISTENING screen really only appear while the microphone is open?
- Do the layouts work on the tablet and the phone?
- What did the first assistant answer cost?

If a step fails and the screen does not explain why, run `npx wrangler tail` in `apps/worker`, repeat the step and read the output. Note what you did, what you expected and what happened, and open an issue.
