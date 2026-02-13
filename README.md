# Rainodoro

> Pomodoro timer that visually fills a bucket with rain as time passes.

Quick start

- Open `index.html` in a browser (or run a simple static server):

```bash
# from the Rainodoro folder
python3 -m http.server 8000
# then open http://localhost:8000 in your browser
```

Features

- Modes: Pomodoro, Short Break, Long Break
- Start / Pause / Reset controls
- Bucket fills gradually to represent elapsed time
- Toggle rain sound (synthesized via WebAudio) or silence
 - Tasks: add/delete tasks, set a pomodoro target, and select an active task
 - Break Goals: add checkable items for short and long breaks

Notes

- Default durations are defined in `app.js` under the `modes` object.
- The rain sound uses a simple generated noise buffer and bandpass filter — no external audio files needed.
 - Tasks and break items are stored in `localStorage` so they'll persist across reloads.
 - Volume control: adjust rain loudness with the slider in the settings.
 - Pour it: when a pomodoro fills the bucket, press `Pour it` to empty the bucket and reset the timer.

License

This project is provided as-is for personal use.