# Instrument samples (VCSL)

Samples from the **Versilian Community Sample Library** by Versilian Studios
(<https://github.com/sgossner/VCSL>), released under **CC0 1.0** (public domain).

Each folder is one instrument:

- `n<midi>.mp3`: a pitched note (MIDI number); the player re-pitches it to nearby notes.
- `h<n>.mp3`: an unpitched hit, chosen at random.

The files were trimmed (leading silence removed, short fade-out), peak-normalized
to -3 dBFS and converted to mono MP3 at 96 kbps. `sources.json` lists the original
VCSL path of every file. To add an instrument, add its files here and list its notes
in `src/lib/sound/samples.ts`.
