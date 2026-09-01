import * as THREE from "three";
import { sanitizeNodeName } from "./roomBase";
import { LIBRARY, type LibraryBook } from "./roomLibrary";
import { createSurfaceMaterial } from "./roomSurface";

/**
 * The shelf, rebuilt out of the reader's own books.
 *
 * The capture came with ten books on the wall shelf, twenty meshes in all — `bookN` and
 * `bookN outer` — and their spines are baked art belonging to whoever modelled the room.
 * They are furniture. The reference site's shelf is a reading timeline whose books are
 * *generated from data*, which is the whole reason its shelf is worth clicking, and that
 * is what this builds: one box per entry in `roomLibrary.ts`, each with a spine that
 * carries its real title.
 *
 * Fourth object in the room to be replaced rather than dressed, after the deck, the
 * drawable board and the basketball, and it follows the same three rules those set.
 *
 * ## Hidden, never deleted
 *
 * `roomPlatter.ts` has the reason: the geometry is baked into the capture and its
 * lightmap, so hiding *is* the retirement. Both halves of every book go — the `outer`
 * meshes are the covers and the plain ones the page blocks, and leaving either standing
 * puts a ghost book in the row. They are also kept out of the hotspot table for the
 * reason that file gives about the captured deck: hidden geometry still answers a
 * raycast, and an invisible book would eat the click meant for a real one.
 *
 * ## Measured, not typed
 *
 * Where the row starts and ends, how deep a book is, and what the books stand on all come
 * off the captured meshes on the way out. Ten books became eight; the run they occupied
 * is re-divided rather than re-typed, so the shelf stays right if the capture is
 * re-exported or the list grows.
 */

/** Both halves of every captured book. */
const RETIRED_BOOK_NODES = Array.from({ length: 10 }, (_, index) => [
  `book${index + 1}`,
  `book${index + 1} outer`,
]).flat();

export type ShelfSlot = {
  /** What the books stand on. */
  baseY: number;
  /** Centre of the book depth — the axis the spine faces along. */
  centreX: number;
  /** Front to back of a book: the spine is the face at `centreX + depth / 2`. */
  depth: number;
  /** The run along Z the ten books occupied, outermost face to outermost face. */
  minZ: number;
  maxZ: number;
};

/**
 * Hide the captured books and report the run they leave behind.
 *
 * Returns `null` if the capture no longer has them, which is the signal not to build a
 * shelf for a shelf that is not there.
 */
export function retireCapturedBooks(model: any): ShelfSlot | null {
  const nodes = RETIRED_BOOK_NODES
    .map((name) => model.getObjectByName(sanitizeNodeName(name)))
    .filter(Boolean);
  if (nodes.length === 0) return null;

  const bounds = new THREE.Box3();
  nodes.forEach((node: any) => bounds.expandByObject(node));
  nodes.forEach((node: any) => { node.visible = false; });

  const size = bounds.getSize(new THREE.Vector3());
  const centre = bounds.getCenter(new THREE.Vector3());
  return {
    baseY: bounds.min.y,
    centreX: centre.x,
    depth: size.x,
    minZ: bounds.min.z,
    maxZ: bounds.max.z,
  };
}

/** The page block, shared by every book: one cream, three edges. */
const PAGE_COLOUR = "#d9d2c0";

/**
 * A spine, drawn.
 *
 * Chinese titles are set the way a Chinese spine sets them — characters stacked down the
 * spine, not a rotated line — and anything else is rotated a quarter turn, which is what
 * a Latin spine does. The author's name sits at the foot in the same ink at half the size.
 *
 * The canvas is cut to the spine's own aspect rather than a fixed size, so a thick book
 * and a thin one get the same stroke weight instead of the thin one's type being squeezed.
 */
function spineArt(book: LibraryBook): HTMLCanvasElement {
  const aspect = book.height / book.thickness;
  const width = 128;
  const height = Math.round(width * aspect);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d")!;

  context.fillStyle = book.spine;
  context.fillRect(0, 0, width, height);

  // The cloth edge every hardback has where the cover wraps the board.
  context.fillStyle = "rgba(0,0,0,.22)";
  context.fillRect(0, 0, 4, height);
  context.fillRect(width - 4, 0, 4, height);

  // Head and tail bands, which is what stops a spine reading as a coloured stick.
  context.fillStyle = "rgba(255,255,255,.10)";
  context.fillRect(6, 10, width - 12, 3);
  context.fillRect(6, height - 13, width - 12, 3);

  context.fillStyle = book.ink;
  context.textAlign = "center";
  context.textBaseline = "middle";

  const latin = !/[一-鿿]/.test(book.title);
  // A share of the spine's own width, not a fixed size. A thin book gets smaller type
  // than a thick one, which is what a real shelf does; a flat cap made `窄门` — two
  // characters on the thinnest spine here — the one title on the shelf you could not read.
  const titleSize = Math.round(width * 0.52);

  if (latin) {
    context.save();
    context.translate(width / 2, height * 0.42);
    context.rotate(Math.PI / 2);
    context.font = `600 ${titleSize}px ui-monospace, Menlo, monospace`;
    context.fillText(book.title, 0, 0);
    context.restore();
  } else {
    // Stacked, top down, starting a little below the head band.
    const characters = [...book.title];
    const step = Math.min(titleSize * 1.12, (height * 0.62) / Math.max(1, characters.length));
    const start = height * 0.30 - ((characters.length - 1) * step) / 2;
    context.font = `600 ${Math.round(step * 0.86)}px "Songti SC", "Noto Serif SC", serif`;
    characters.forEach((character, index) => {
      context.fillText(character, width / 2, start + index * step);
    });
  }

  // The author, at the foot, quiet.
  context.save();
  context.globalAlpha = 0.72;
  const authorCharacters = [...book.author];
  const authorSize = Math.round(width * 0.2);
  const authorStep = authorSize * 1.08;
  const authorStart = height - 26 - (authorCharacters.length - 1) * authorStep;
  context.font = `500 ${authorSize}px "Songti SC", "Noto Serif SC", serif`;
  authorCharacters.forEach((character, index) => {
    context.fillText(character, width / 2, authorStart + index * authorStep);
  });
  context.restore();

  return canvas;
}

export type ShelfRig = {
  /**
   * Add this to the room. Authored with its origin at the shelf's own corner — the depth
   * centre, the surface the books stand on, and the end of the run — so the caller only
   * has to convert that one point into the room's space.
   */
  group: any;
  /** Every book mesh, tagged in `userData.libraryBook` with its id. */
  bookNodes: any[];
  dispose: () => void;
};

export function createRoomBookshelf(slot: ShelfSlot): ShelfRig {
  const geometries: any[] = [];
  const materials: any[] = [];
  const textures: any[] = [];

  const texture = (canvas: HTMLCanvasElement) => {
    const made = new THREE.CanvasTexture(canvas);
    // Deliberately no `colorSpace`: sampled raw, to sit in the same space as the bake.
    made.anisotropy = 8;
    textures.push(made);
    return made;
  };

  const surface = (options: Parameters<typeof createSurfaceMaterial>[0]) => {
    const material = createSurfaceMaterial(options);
    materials.push(material);
    return material;
  };

  const group = new THREE.Group();
  group.name = "about-room-bookshelf";

  // Paper, not paint: no highlight to speak of and no rim, or the fore-edge glows.
  const pages = surface({ color: PAGE_COLOUR, gloss: 6, specular: 0.03, rim: 0.02 });

  /*
   * Lay the row out inside the run the ten captured books occupied.
   *
   * The gap is what is left over after the eight books, divided evenly and capped — a
   * shelf with eight books where ten stood is a shelf with a little air in it, not a
   * shelf whose books have been spread to the ends like a shop display.
   */
  const run = slot.maxZ - slot.minZ;
  const occupied = LIBRARY.reduce((total, book) => total + book.thickness, 0);
  const gap = Math.min(0.06, Math.max(0, (run - occupied) / Math.max(1, LIBRARY.length - 1)));
  const rowLength = occupied + gap * (LIBRARY.length - 1);
  // Left-aligned against the end the captured row started at, the way books actually sit.
  let cursor = 0;

  const bookNodes: any[] = [];
  LIBRARY.forEach((book) => {
    const geometry = new THREE.BoxGeometry(slot.depth, book.height, book.thickness);
    geometries.push(geometry);

    /*
     * Six faces, three materials. `BoxGeometry` groups them [+x, −x, +y, −y, +z, −z]:
     * +x is the spine, because the shelf's wall is at low x and the room is viewed from
     * high x; −x is the fore-edge and ±y the head and tail, all page; ±z are the covers.
     */
    const spine = surface({ map: texture(spineArt(book)), gloss: 14, specular: 0.09, rim: 0.05 });
    const cover = surface({ color: book.cover, gloss: 12, specular: 0.07, rim: 0.04 });
    const mesh = new THREE.Mesh(geometry, [spine, pages, pages, pages, cover, cover]);

    mesh.name = `about-room-book-${book.id}`;
    mesh.userData.libraryBook = book.id;
    mesh.position.set(0, book.height / 2, cursor + book.thickness / 2);
    cursor += book.thickness + gap;

    group.add(mesh);
    bookNodes.push(mesh);
  });

  if (process.env.NODE_ENV !== "production" && rowLength > run + 0.001) {
    console.warn(
      `[about-room] the shelf's ${LIBRARY.length} books run ${rowLength.toFixed(2)} units`
      + ` where the capture left ${run.toFixed(2)}; they have outgrown the board`,
    );
  }

  return {
    group,
    bookNodes,
    dispose: () => {
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      textures.forEach((entry) => entry.dispose());
    },
  };
}
