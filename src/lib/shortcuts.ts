/**
 * Atajos de teclado del reproductor y del radar. Se muestran en "Track info" y en
 * How it works; el radar no los repite en voz alta al activarse.
 */
export const PLAYER_SHORTCUTS = [
  ["Space", "Play / pause"],
  ["← →", "Previous / next frame"],
  ["S", "Sound on / off"],
  ["E", "Radar on / off: it plays the data levels around a point of the map"],
  ["D", "Describe the current frame"],
  ["Click", "Hear the place and its value on the map"],
  ["V", "Voice guide on / off"],
  ["M", "Map voice on / off"],
  ["Esc", "Close panels"],
] as const;

export const RADAR_SHORTCUTS = [
  ["E", "Turn the radar on or off"],
  ["Arrows", "Move it; when you stop, you hear the place and its level"],
  ["Shift + arrows", "Move it in bigger steps"],
  ["Enter", "Repeat where it is"],
  ["Space", "Pause or play the radar"],
  ["+ / −", "Bigger or smaller area (also the mouse wheel)"],
  ["Tab", "Reach the radar controls"],
  ["Esc", "Turn the radar off"],
] as const;
