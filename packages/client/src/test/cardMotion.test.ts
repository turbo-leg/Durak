import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { TableRenderer } from '../components/three/TableRenderer';
import type { TableCard, TableSeat, TableSnapshot } from '../game/tableSnapshot';
import { TABLE_TOP } from '../components/three/CharacterSpace';
import {
  DRAW_BACK_MS,
  DRAW_SLIDE_MS,
  DRAW_TAKE_MS,
  PICKUP_TAKE_MS,
} from '../character/animations/registry';

const card = (rank: number): TableCard => ({
  key: `Spades:${rank}:0`,
  suit: 'Spades',
  rank,
  isJoker: false,
});
const snapshot = (parts: Partial<TableSnapshot> = {}): TableSnapshot => ({
  signature: '',
  hand: [],
  attacks: [],
  history: [],
  seats: [],
  huzur: card(7),
  deckCount: 0,
  discardCount: 0,
  canSelect: true,
  ...parts,
});

// Exercise the real scene-update logic without allocating a WebGL context.
function fixture() {
  const table = Object.create(TableRenderer.prototype) as TableRenderer;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  const hand = new THREE.Group();
  camera.add(hand);
  scene.add(camera);
  hand.position.set(0, -1, -2);
  hand.scale.setScalar(0.5);
  const cards = new Map<
    string,
    { mesh: THREE.Mesh; removing?: boolean; home: { parent: THREE.Object3D } }
  >();
  Object.assign(table, {
    scene,
    camera,
    hand,
    cards,
    ownPreset: 'copper',
    avatars: new Map(),
    resources: new Set(),
    labels: new THREE.Group(),
    labelSprites: new Map(),
    dealt: 0,
    controls: { setSpectator: vi.fn() },
    cardGeometry: new THREE.BoxGeometry(0.82, 0.035, 1.2),
    heldGeometry: new THREE.BoxGeometry(0.82, 0.015, 1.2),
    edge: new THREE.MeshStandardMaterial(),
    back: new THREE.MeshStandardMaterial(),
    face: () => new THREE.MeshStandardMaterial(),
    label: vi.fn(),
    requestFrame: vi.fn(),
    reducedMotion: { matches: false },
    renderer: { capabilities: { getMaxAnisotropy: () => 16 } },
  });
  const update = (state: TableSnapshot) => table.update(state, new Set());
  // One drawn frame at `time` (ms): every card moved as the render loop moves it.
  const frame = (time: number) => {
    const stepper = table as unknown as {
      step: (id: string, card: unknown, now: number, reduced: boolean) => boolean;
    };
    for (const [id, item] of [...cards]) stepper.step.call(table, id, item, time, false);
    scene.updateMatrixWorld(true);
  };
  return { table, update, frame, cards, scene, hand };
}

const world = (mesh: THREE.Mesh) => mesh.getWorldPosition(new THREE.Vector3());
const clock = (time: number) => vi.spyOn(performance, 'now').mockReturnValue(time);

/** A seated peer: a fan to hold cards and a palm that reaches the table centre. */
function peer(table: TableRenderer, palm: THREE.Vector3) {
  const rig = {
    presetId: 'copper',
    root: new THREE.Group(),
    fan: new THREE.Group(),
    update: vi.fn(),
    setGesture: vi.fn(),
    act: vi.fn(() => 'L'),
    react: vi.fn(),
    held: vi.fn(() => ({ position: palm.clone(), quaternion: new THREE.Quaternion() })),
    animate: () => false,
    dispose: vi.fn(),
  };
  (table as unknown as { avatars: Map<string, unknown>; scene: THREE.Scene }).avatars.set(
    'peer',
    rig,
  );
  (table as unknown as { scene: THREE.Scene }).scene.add(rig.root.add(rig.fan));
  return rig;
}
const seated = (count: number, played = 0): TableSeat => ({
  id: 'peer',
  name: 'Peer',
  count,
  played,
  active: true,
  escaped: false,
});

afterEach(() => vi.restoreAllMocks());

describe('card identity across presentation zones', () => {
  it('loads standard artwork if a high-resolution upgrade fails', () => {
    const { table } = fixture();
    const requests: {
      url: string;
      loaded: (texture: THREE.Texture<HTMLImageElement>) => void;
      failed: () => void;
    }[] = [];
    vi.spyOn(THREE.TextureLoader.prototype, 'load').mockImplementation(
      (url, loaded, _progress, failed) => {
        requests.push({
          url,
          loaded: (texture) => loaded?.(texture),
          failed: () => failed?.(new Error('offline')),
        });
        return new THREE.Texture();
      },
    );
    const fallback = new THREE.Texture();
    const dispose = vi.spyOn(fallback, 'dispose');
    const material = new THREE.MeshStandardMaterial({ map: fallback });
    const loader = table as unknown as {
      loadFaceArt: (card: TableCard, material: THREE.MeshStandardMaterial, high: boolean) => void;
    };
    loader.loadFaceArt(card(9), material, false);
    loader.loadFaceArt(card(9), material, true);
    requests[1]!.failed();
    expect(requests[2]!.url).not.toContain('high-resolution');
    const art = new THREE.Texture(document.createElement('img'));
    requests[2]!.loaded(art);
    expect(material.map).toBe(art);
    expect(dispose).toHaveBeenCalledOnce();
    expect(material.userData.highResolutionFailed).toBe(true);
  });
  it('moves the same mesh from hand to attack to defended history without a deck duplicate', () => {
    const { update, frame, cards, scene, hand } = fixture();
    const c = card(9);
    clock(0);
    update(snapshot({ hand: [c] }));
    const mesh = cards.get(`card:${c.key}`)!.mesh;
    expect(mesh.parent).toBe(hand);
    const before = world(mesh);
    update(snapshot({ attacks: [c] }));
    expect(cards.size).toBe(1);
    expect(cards.get(`card:${c.key}`)!.mesh).toBe(mesh);
    expect(cards.get(`card:${c.key}`)!.home.parent).toBe(scene);
    // Setting off changes its frame but not where it is.
    frame(0);
    expect(mesh.parent).toBe(scene);
    expect(world(mesh).distanceTo(before)).toBeLessThan(0.00001);
    update(snapshot({ history: [c] }));
    expect(cards.size).toBe(1);
    expect(cards.get(`card:${c.key}`)!.mesh).toBe(mesh);
  });

  it('sets off from rest and lands exactly, with no frame jumping ahead', () => {
    const { update, frame, cards } = fixture();
    const c = card(9);
    clock(0);
    update(snapshot({ hand: [c] }));
    update(snapshot({ attacks: [c] }));
    const mesh = cards.get(`card:${c.key}`)!.mesh;
    const path: THREE.Vector3[] = [];
    for (let t = 0; t <= 1000; t += 16) {
      frame(t);
      path.push(world(mesh));
    }
    const steps = path.slice(1).map((point, i) => point.distanceTo(path[i]!));
    const total = steps.reduce((sum, d) => sum + d, 0);
    expect(total).toBeGreaterThan(0.1);
    // Speed builds up: the first frame is a small fraction, never most of the way.
    expect(steps[0]!).toBeLessThan(total * 0.03);
    expect(Math.max(...steps)).toBeLessThan(total * 0.12);
    const home = cards.get(`card:${c.key}`)!.home as unknown as { position: THREE.Vector3 };
    expect(path.at(-1)!.distanceTo(home.position)).toBeLessThan(1e-6);
  });

  it('keeps a card that re-enters the hand before its exit ends, and lands it there', () => {
    const { update, frame, cards, hand } = fixture();
    const c = card(10);
    clock(0);
    update(snapshot({ hand: [c] }));
    const mesh = cards.get(`card:${c.key}`)!.mesh;
    update(snapshot({ discardCount: 1 }));
    expect(cards.get(`card:${c.key}`)!.removing).toBe(true);
    frame(100);
    update(snapshot({ hand: [c], discardCount: 1 }));
    expect(cards.get(`card:${c.key}`)!.mesh).toBe(mesh);
    expect(cards.get(`card:${c.key}`)!.removing).toBe(false);
    frame(120);
    frame(2000);
    expect(mesh.parent).toBe(hand);
  });

  it('leaves a picked-up pile on the table until the hand reaches it', () => {
    const { table, update, frame, cards } = fixture();
    const palm = new THREE.Vector3(0.5, 0.4, 1);
    const rig = peer(table, palm);
    const [a, b] = [card(9), card(10)];
    clock(0);
    update(snapshot({ attacks: [a], history: [b], seats: [seated(3)] }));
    const meshes = [a, b].map((c) => cards.get(`card:${c.key}`)!.mesh);
    const start = meshes.map(world);
    update(snapshot({ seats: [seated(5)] }));
    expect(rig.act).toHaveBeenCalledWith('pickup', expect.anything(), 0);
    // The two new fan cards wait, unseen, for the cards that fill them.
    const added = [3, 4].map((n) => cards.get(`seat:peer:${n}`)!.mesh);
    expect(added.every((mesh) => !mesh.visible)).toBe(true);
    for (let t = 0; t < PICKUP_TAKE_MS; t += 16) frame(t);
    meshes.forEach((mesh, i) => expect(world(mesh).distanceTo(start[i]!)).toBeLessThan(1e-6));
    for (let t = PICKUP_TAKE_MS; t < 3000; t += 16) frame(t);
    expect(meshes.every((mesh) => !mesh.parent)).toBe(true);
    expect(added.every((mesh) => mesh.visible)).toBe(true);
  });

  it('deals drawn cards out of the deck one at a time', () => {
    const { update, frame, cards } = fixture();
    clock(0);
    const self = { preset: 'copper', played: 0 };
    update(snapshot({ hand: [card(7)], deckCount: 10, self }));
    const drawn = [card(8), card(9), card(10)];
    update(snapshot({ hand: [card(7), ...drawn], deckCount: 7, self }));
    const meshes = drawn.map((c) => cards.get(`card:${c.key}`)!.mesh);
    const shown: number[] = [];
    for (let t = 0; t < 3000; t += 16) {
      frame(t);
      meshes.forEach((mesh, i) => {
        if (mesh.visible && shown[i] === undefined) shown[i] = t;
      });
    }
    expect(shown[0]).toBeGreaterThanOrEqual(DRAW_TAKE_MS);
    expect(shown[1]! - shown[0]!).toBeGreaterThan(80);
    expect(shown[2]! - shown[1]!).toBeGreaterThan(80);
  });

  it('takes drawn cards off the deck in the hand, then lets them into the fan one by one', () => {
    const { table, update, frame, cards, hand } = fixture();
    const palm = new THREE.Vector3(-1, 0.6, 2);
    // The local player's own body: its free hand reaches the deck for the draw.
    Object.assign(table, {
      firstHands: {
        root: new THREE.Group(),
        setCardCount: vi.fn(),
        setGesture: vi.fn(),
        act: vi.fn(() => 'L'),
        held: vi.fn(() => ({ position: palm.clone(), quaternion: new THREE.Quaternion() })),
      },
    });
    clock(0);
    const self = { preset: 'copper', played: 0 };
    update(snapshot({ hand: [card(7)], deckCount: 10, self }));
    const drawn = [card(8), card(9), card(10)];
    update(snapshot({ hand: [card(7), ...drawn], deckCount: 7, self }));
    const meshes = drawn.map((c) => cards.get(`card:${c.key}`)!.mesh);
    const landed: number[] = [];
    for (let t = 0; t < 3000; t += 16) {
      frame(t);
      // Unseen until slid off the deck, flat on the felt on the way, in the hand once it has
      // closed on them.
      if (t < DRAW_SLIDE_MS) expect(meshes.some((mesh) => mesh.visible)).toBe(false);
      if (t >= DRAW_SLIDE_MS + 100 && t < DRAW_SLIDE_MS + 200)
        meshes.forEach((mesh) => expect(world(mesh).y).toBeLessThan(TABLE_TOP + 0.02));
      if (t >= DRAW_TAKE_MS && t < DRAW_BACK_MS)
        meshes.forEach((mesh) => expect(world(mesh).distanceTo(palm)).toBeLessThan(1e-6));
      meshes.forEach((mesh, i) => {
        if (mesh.parent === hand && landed[i] === undefined) landed[i] = t;
      });
    }
    expect(landed[0]).toBeGreaterThan(DRAW_BACK_MS);
    expect(landed[1]! - landed[0]!).toBeGreaterThan(80);
    expect(landed[2]! - landed[1]!).toBeGreaterThan(80);
  });

  it('retains existing history meshes when the fourteen-card display window advances', () => {
    const { update, cards } = fixture();
    const history = Array.from({ length: 18 }, (_, i) => card(i + 7));
    update(snapshot({ history: history.slice(0, 16) }));
    const retained = cards.get(`card:${history[8]!.key}`)!.mesh;
    update(snapshot({ history }));
    expect(cards.get(`card:${history[8]!.key}`)!.mesh).toBe(retained);
    expect(cards.size).toBe(14);
    expect([...cards.values()].some((c) => c.removing)).toBe(false);
  });
});
