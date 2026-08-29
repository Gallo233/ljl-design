/**
 * One flag shared between the room's terminal and everything that owns keys or scroll.
 *
 * The terminal lives in the 3D room, but while it is up it owns the keyboard: arrows
 * must not step the reel, up/down must not move between sections, space must not
 * scroll. The scroll driver and the stage both read this instead of reaching into the
 * scene graph.
 */

let active = false;

export const setRoomTerminalActive = (on: boolean) => {
  active = on;
};

export const isRoomTerminalActive = () => active;
