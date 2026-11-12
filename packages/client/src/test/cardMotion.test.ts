import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { TableRenderer } from '../components/three/TableRenderer';
import type { TableCard, TableSnapshot } from '../game/tableSnapshot';

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
    { mesh: THREE.Mesh; removing?: boolean; pendingParent?: THREE.Object3D }
  >();
  Object.assign(table, {
    scene,
    camera,
    hand,
    cards,
    droppedCards: [],
    pendingDrops: new Map(),
    defensePreview: new THREE.Group(),
    ownPreset: 'copper',
    avatars: new Map(),
    resources: new Set(),
    labels: new THREE.Group(),
    controls: { setSpectator: vi.fn(), setResultView: vi.fn() },
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
  const update = (state: TableSnapshot) => {
    table.update(state, new Set());
    // The fixture has no render loop; finish card reparenting as a settled frame would.
    for (const card of cards.values()) {
      if (!card.pendingParent) continue;
      card.pendingParent.attach(card.mesh);
      card.pendingParent = undefined;
    }
  };
  return { table, update, cards, scene, hand };
}

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
    const { update, cards, scene, hand } = fixture();
    const c = card(9);
    update(snapshot({ hand: [c] }));
    const mesh = cards.get(`card:${c.key}`)!.mesh;
    mesh.position.set(0.2, 0.5, 0);
    expect(mesh.parent).toBe(hand);
    const world = mesh.getWorldPosition(new THREE.Vector3());
    update(snapshot({ attacks: [c] }));
    expect(cards.size).toBe(1);
    expect(cards.get(`card:${c.key}`)!.mesh).toBe(mesh);
    expect(mesh.parent).toBe(scene);
    expect(mesh.getWorldPosition(new THREE.Vector3()).distanceTo(world)).toBeLessThan(0.00001);
    update(snapshot({ history: [c] }));
    expect(cards.size).toBe(1);
    expect(cards.get(`card:${c.key}`)!.mesh).toBe(mesh);
  });

  it('reattaches an exiting card if it re-enters the hand before its animation ends', () => {
    const { update, cards, hand, scene } = fixture();
    const c = card(10);
    update(snapshot({ hand: [c] }));
    const mesh = cards.get(`card:${c.key}`)!.mesh;
    update(snapshot({ discardCount: 1 }));
    expect(mesh.parent).toBe(scene);
    expect(cards.get(`card:${c.key}`)!.removing).toBe(true);
    update(snapshot({ hand: [c], discardCount: 1 }));
    expect(cards.get(`card:${c.key}`)!.mesh).toBe(mesh);
    expect(mesh.parent).toBe(hand);
    expect(cards.get(`card:${c.key}`)!.removing).toBe(false);
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

describe('the 3D hand while a 2D row shows the same cards', () => {
  type RestCard = {
    mesh: THREE.Mesh;
    motion?: object;
    deal?: object;
    carry?: object;
    pendingParent?: THREE.Object3D;
    hiddenUntil?: number;
    removing?: boolean;
    restHidden?: boolean;
  };
  const sync = (table: TableRenderer, entry: RestCard) =>
    (table as unknown as { syncRestHidden(card: RestCard): void }).syncRestHidden(entry);
  const heldCard = (hand: THREE.Group): RestCard => {
    const mesh = new THREE.Mesh();
    mesh.userData.handKey = 'Spades:9:0';
    hand.add(mesh);
    return { mesh };
  };

  it('hides cards resting in the hand and shows them again when the row goes away', () => {
    const { table, hand } = fixture();
    const entry = heldCard(hand);
    table.setRestingHandHidden(true);
    sync(table, entry);
    expect(entry.mesh.visible).toBe(false);
    table.setRestingHandHidden(false);
    sync(table, entry);
    expect(entry.mesh.visible).toBe(true);
  });

  it('draws a card while it flies and hides it once it has landed in the hand', () => {
    const { table, hand } = fixture();
    const entry = heldCard(hand);
    table.setRestingHandHidden(true);
    sync(table, entry);
    expect(entry.mesh.visible).toBe(false);
    // Played out: it leaves the hand for the table, so it must be seen travelling.
    entry.mesh.removeFromParent();
    sync(table, entry);
    expect(entry.mesh.visible).toBe(true);
    // Dealt or picked up: visible during the flight, hidden on arrival.
    hand.add(entry.mesh);
    entry.motion = {};
    sync(table, entry);
    expect(entry.mesh.visible).toBe(true);
    entry.motion = undefined;
    sync(table, entry);
    expect(entry.mesh.visible).toBe(false);
  });

  it('leaves cards that are not yours, or still waiting to appear, alone', () => {
    const { table, hand, scene } = fixture();
    table.setRestingHandHidden(true);
    const onTable = new THREE.Mesh();
    scene.add(onTable);
    onTable.userData.handKey = 'Spades:9:0';
    const tableCard: RestCard = { mesh: onTable };
    sync(table, tableCard);
    expect(onTable.visible).toBe(true);
    const waiting = heldCard(hand);
    waiting.hiddenUntil = 1000;
    waiting.mesh.visible = false;
    sync(table, waiting);
    expect(waiting.restHidden).toBeUndefined();
    expect(waiting.mesh.visible).toBe(false);
  });

  it('cannot pick a card that is not drawn', () => {
    const { table, hand, cards } = fixture();
    const entry = heldCard(hand);
    cards.set('a', entry as never);
    Object.assign(table, {
      renderer: {
        domElement: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }) },
      },
      raycaster: new THREE.Raycaster(),
    });
    const hit = () =>
      (table as unknown as { handHit(e: { clientX: number; clientY: number }): unknown }).handHit({
        clientX: 50,
        clientY: 50,
      });
    // A card straight ahead of the camera, so the ray through the screen centre hits it.
    entry.mesh.geometry = new THREE.BoxGeometry(2, 2, 0.1);
    entry.mesh.material = new THREE.MeshBasicMaterial();
    hand.position.set(0, 0, -1);
    hand.scale.setScalar(1);
    hand.updateWorldMatrix(true, true);
    entry.mesh.updateWorldMatrix(true, false);
    expect(hit()).toBeTruthy();
    entry.mesh.visible = false;
    expect(hit()).toBeUndefined();
  });
});
