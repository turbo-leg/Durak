import * as THREE from 'three';
import {
  FACE,
  FINGERS,
  HAND,
  LID_OPEN,
  SIDES,
  SKELETON,
  SKULL,
  SOCKETS,
  bindPosition,
  type Side,
} from './spec.ts';

/**
 * Builds the Durak character from the contract in spec.ts: a skeleton, a skinned body,
 * a head (hidden in first person) and one mesh per hair style. Everything shares one
 * vertex-coloured material; each vertex records its region so appearances recolour it.
 */

export const REGIONS = [
  'skin',
  'shirt',
  'trousers',
  'shoes',
  'hair',
  'eyeWhite',
  'iris',
  'lip',
  'belt',
  'pupil',
  'mouth',
] as const;
export type Region = (typeof REGIONS)[number];
export const HAIR_STYLES = 8;

export interface Appearance {
  skin: string;
  hair: string;
  shirt: string;
  trousers?: string;
  shoes?: string;
  hairStyle: number;
  /** Lip colour; a shade of the skin unless given. */
  lip?: string;
}

export const DEFAULT_APPEARANCE: Appearance = {
  skin: '#d9ac8a',
  hair: '#49392d',
  shirt: '#648698',
  hairStyle: 0,
};

export function regionColors(look: Appearance): Record<Region, THREE.Color> {
  const skin = new THREE.Color(look.skin);
  return {
    skin,
    shirt: new THREE.Color(look.shirt),
    trousers: new THREE.Color(look.trousers ?? '#2b3440'),
    shoes: new THREE.Color(look.shoes ?? '#1f1c1b'),
    hair: new THREE.Color(look.hair),
    eyeWhite: new THREE.Color('#f0e9db'),
    iris: new THREE.Color('#5a4232'),
    lip: look.lip ? new THREE.Color(look.lip) : skin.clone().multiplyScalar(0.68),
    belt: new THREE.Color('#2a1f19'),
    pupil: new THREE.Color('#110d0b'),
    mouth: new THREE.Color('#3a1715'),
  };
}

type Weights = [string, number][];
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const smooth = (x: number) => {
  const t = THREE.MathUtils.clamp(x * 0.5 + 0.5, 0, 1);
  return t * t * (3 - 2 * t);
};

/** Accumulates one skinned mesh's vertices, weights, regions and triangles. */
class Builder {
  positions: number[] = [];
  weights: Weights[] = [];
  regions: number[] = [];
  indices: number[] = [];
  /** A point inside the solid each vertex belongs to, used to face triangles outward. */
  private inside: THREE.Vector3[] = [];

  vertex(p: THREE.Vector3, weights: Weights, region: Region, inside = p) {
    this.inside.push(inside.clone());
    this.positions.push(p.x, p.y, p.z);
    this.weights.push(weights);
    this.regions.push(REGIONS.indexOf(region));
    return this.positions.length / 3 - 1;
  }

  /** Quads between consecutive rings of equal size; rings are vertex index arrays. */
  stitch(a: number[], b: number[], closed = true) {
    const n = a.length;
    for (let i = 0; i < (closed ? n : n - 1); i++) {
      const j = (i + 1) % n;
      this.indices.push(a[i]!, b[i]!, b[j]!, a[i]!, b[j]!, a[j]!);
    }
  }

  fan(ring: number[], centre: number, reverse = false) {
    for (let i = 0; i < ring.length; i++) {
      const j = (i + 1) % ring.length;
      if (reverse) this.indices.push(centre, ring[j]!, ring[i]!);
      else this.indices.push(centre, ring[i]!, ring[j]!);
    }
  }

  /** A smooth tube along joints; weights blend between neighbouring bones at each joint. */
  tube(
    nodes: { at: THREE.Vector3; r: number | [number, number]; bone: string }[],
    options: {
      region: Region | ((s: number, length: number) => Region);
      up: THREE.Vector3;
      parent?: string;
      sides?: number;
      steps?: number;
      band?: number;
      capStart?: boolean;
      capEnd?: boolean;
    },
  ) {
    const sides = options.sides ?? 8;
    const steps = options.steps ?? 3;
    const arc = [0];
    for (let i = 1; i < nodes.length; i++)
      arc.push(arc[i - 1]! + nodes[i]!.at.distanceTo(nodes[i - 1]!.at));
    const length = arc.at(-1)!;
    const radius = (r: number | [number, number]) => (typeof r === 'number' ? [r, r] : r);
    const ringAt = (span: number, t: number) => {
      const a = nodes[span]!;
      const b = nodes[span + 1]!;
      const centre = a.at.clone().lerp(b.at, t);
      const [ra, rb] = [radius(a.r), radius(b.r)];
      const r = [THREE.MathUtils.lerp(ra[0]!, rb[0]!, t), THREE.MathUtils.lerp(ra[1]!, rb[1]!, t)];
      // Average directions at joints so the surface does not crease.
      let tangent = b.at.clone().sub(a.at).normalize();
      if (t === 0 && span > 0)
        tangent
          .add(
            a.at
              .clone()
              .sub(nodes[span - 1]!.at)
              .normalize(),
          )
          .normalize();
      if (t === 1 && span + 2 < nodes.length)
        tangent = tangent.add(nodes[span + 2]!.at.clone().sub(b.at).normalize()).normalize();
      const s = THREE.MathUtils.lerp(arc[span]!, arc[span + 1]!, t);
      return { centre, r, tangent, s, span };
    };
    const weightsAt = (span: number, s: number): Weights => {
      const own = nodes[span]!.bone;
      const before = span > 0 ? nodes[span - 1]!.bone : options.parent;
      const after = span + 2 < nodes.length ? nodes[span + 1]!.bone : undefined;
      const bandStart = (options.band ?? 1.4) * radius(nodes[span]!.r)[0]!;
      const bandEnd = (options.band ?? 1.4) * radius(nodes[span + 1]!.r)[0]!;
      const a = before ? smooth((s - arc[span]!) / bandStart) : 1;
      const b = after ? smooth((s - arc[span + 1]!) / bandEnd) : 0;
      const result: Weights = [[own, a - b]];
      if (before && a < 1) result.push([before, 1 - a]);
      if (after && b > 0) result.push([after, b]);
      return result.filter(([, w]) => w > 0.0001);
    };
    const region = (s: number) =>
      typeof options.region === 'function' ? options.region(s, length) : options.region;
    const frame = (tangent: THREE.Vector3) => {
      const n = options.up.clone().addScaledVector(tangent, -options.up.dot(tangent));
      if (n.lengthSq() < 1e-6) n.set(1, 0, 0).addScaledVector(tangent, -tangent.x);
      n.normalize();
      return [n, tangent.clone().cross(n).normalize()] as const;
    };
    const ring = (
      centre: THREE.Vector3,
      r: number[],
      tangent: THREE.Vector3,
      weights: Weights,
      reg: Region,
    ) => {
      const [n, b] = frame(tangent);
      return Array.from({ length: sides }, (_, k) => {
        const angle = (k / sides) * Math.PI * 2;
        const p = centre
          .clone()
          .addScaledVector(n, Math.cos(angle) * r[0]!)
          .addScaledVector(b, Math.sin(angle) * r[1]!);
        return this.vertex(p, weights, reg, centre);
      });
    };
    const rings: number[][] = [];
    const samples: ReturnType<typeof ringAt>[] = [];
    for (let span = 0; span + 1 < nodes.length; span++)
      for (let k = span === 0 ? 0 : 1; k <= steps; k++) samples.push(ringAt(span, k / steps));
    for (const sample of samples)
      rings.push(
        ring(
          sample.centre,
          sample.r,
          sample.tangent,
          weightsAt(sample.span, sample.s),
          region(sample.s),
        ),
      );
    for (let i = 0; i + 1 < rings.length; i++) {
      const [a, b] = [samples[i]!, samples[i + 1]!];
      if (region(a.s) === region(b.s)) this.stitch(rings[i]!, rings[i + 1]!);
      else {
        // A seam: the band ends on a copy of the next ring in its own colour, so the
        // colours meet at an edge instead of blending across the band.
        const seam = ring(b.centre, b.r, b.tangent, weightsAt(b.span, b.s), region(a.s));
        this.stitch(rings[i]!, seam);
      }
    }
    const cap = (sample: (typeof samples)[number], ringIds: number[], end: boolean) => {
      const direction = sample.tangent.clone().multiplyScalar(end ? 1 : -1);
      const weights = weightsAt(sample.span, sample.s);
      let previous = ringIds;
      for (const f of [0.55, 0.85]) {
        const angle = (f * Math.PI) / 2;
        const centre = sample.centre
          .clone()
          .addScaledVector(direction, Math.sin(angle) * sample.r[0]!);
        const next = ring(
          centre,
          sample.r.map((r) => r * Math.cos(angle)),
          sample.tangent,
          weights,
          region(sample.s),
        );
        if (end) this.stitch(previous, next);
        else this.stitch(next, previous);
        previous = next;
      }
      const pole = this.vertex(
        sample.centre.clone().addScaledVector(direction, sample.r[0]!),
        weights,
        region(sample.s),
        sample.centre,
      );
      // Wind the pole like a ring beyond the last one: outward-facing at either end.
      this.fan(previous, pole, end);
    };
    if (options.capStart) cap(samples[0]!, rings[0]!, false);
    if (options.capEnd) cap(samples.at(-1)!, rings.at(-1)!, true);
  }

  /** A closed ellipsoid; `weights` maps each vertex position to its bone weights. */
  ellipsoid(
    centre: THREE.Vector3,
    radii: [number, number, number],
    weights: Weights | ((p: THREE.Vector3) => Weights),
    region: Region | ((p: THREE.Vector3) => Region),
    detail: [number, number] = [12, 8],
    rotation?: THREE.Euler,
    shape?: (unit: THREE.Vector3) => THREE.Vector3,
  ) {
    const [wide, high] = detail;
    const rows: number[][] = [];
    const q = new THREE.Quaternion().setFromEuler(rotation ?? new THREE.Euler());
    for (let j = 1; j < high; j++) {
      const v = (j / high) * Math.PI;
      rows.push(
        Array.from({ length: wide }, (_, i) => {
          const u = (i / wide) * Math.PI * 2;
          let unit = V(Math.sin(v) * Math.sin(u), Math.cos(v), Math.sin(v) * Math.cos(u));
          if (shape) unit = shape(unit);
          const p = V(unit.x * radii[0], unit.y * radii[1], unit.z * radii[2])
            .applyQuaternion(q)
            .add(centre);
          return this.vertex(
            p,
            typeof weights === 'function' ? weights(p) : weights,
            typeof region === 'function' ? region(p) : region,
            centre,
          );
        }),
      );
    }
    for (let j = 0; j + 1 < rows.length; j++) this.stitch(rows[j]!, rows[j + 1]!);
    const poleAt = (y: number) => {
      let unit = V(0, y, 0);
      if (shape) unit = shape(unit);
      const p = V(unit.x * radii[0], unit.y * radii[1], unit.z * radii[2])
        .applyQuaternion(q)
        .add(centre);
      return this.vertex(
        p,
        typeof weights === 'function' ? weights(p) : weights,
        typeof region === 'function' ? region(p) : region,
        centre,
      );
    };
    this.fan(rows[0]!, poleAt(1), true);
    this.fan(rows.at(-1)!, poleAt(-1));
  }

  /** A ring-shaped roll (an elliptical torus) about `axis`, such as a collar. */
  torus(
    centre: THREE.Vector3,
    major: [number, number],
    minor: number,
    weights: Weights,
    region: Region,
    detail: [number, number] = [32, 8],
  ) {
    const [around, tube] = detail;
    const rows = Array.from({ length: around }, (_, i) => {
      const u = (i / around) * Math.PI * 2;
      const middle = centre.clone().add(V(Math.sin(u) * major[0], 0, Math.cos(u) * major[1]));
      const out = V(Math.sin(u) * major[1], 0, Math.cos(u) * major[0]).normalize();
      return Array.from({ length: tube }, (_, j) => {
        const v = (j / tube) * Math.PI * 2;
        const p = middle
          .clone()
          .addScaledVector(out, Math.cos(v) * minor)
          .add(V(0, Math.sin(v) * minor, 0));
        return this.vertex(p, weights, region, middle);
      });
    });
    for (let i = 0; i < around; i++) this.stitch(rows[i]!, rows[(i + 1) % around]!);
  }

  /** Flip any triangle whose normal points into the solid it belongs to. */
  private faceOutward() {
    const p = (i: number) =>
      V(this.positions[i * 3], this.positions[i * 3 + 1], this.positions[i * 3 + 2]);
    for (let t = 0; t < this.indices.length; t += 3) {
      const [a, b, c] = [this.indices[t]!, this.indices[t + 1]!, this.indices[t + 2]!];
      const normal = p(b)
        .sub(p(a))
        .cross(p(c).sub(p(a)));
      const outward = p(a)
        .add(p(b))
        .add(p(c))
        .sub(this.inside[a]!)
        .sub(this.inside[b]!)
        .sub(this.inside[c]!);
      if (normal.dot(outward) < 0) {
        this.indices[t + 1] = c;
        this.indices[t + 2] = b;
      }
    }
  }

  mesh(name: string, bones: Map<string, THREE.Bone>, skeleton: THREE.Skeleton, look: Appearance) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    const index: number[] = [];
    const weight: number[] = [];
    const order = [...bones.keys()];
    for (const list of this.weights) {
      const top = [...list].sort((a, b) => b[1] - a[1]).slice(0, 4);
      const total = top.reduce((sum, [, w]) => sum + w, 0);
      for (let k = 0; k < 4; k++) {
        const entry = top[k];
        index.push(entry ? order.indexOf(entry[0]) : 0);
        weight.push(entry ? entry[1] / total : 0);
      }
    }
    if (index.some((i) => i < 0)) throw new Error(`${name} weights a bone outside the skeleton`);
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(index, 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weight, 4));
    geometry.setAttribute('_region', new THREE.Float32BufferAttribute(this.regions, 1));
    geometry.setAttribute(
      'color',
      new THREE.Float32BufferAttribute(new Float32Array(this.regions.length * 3), 3),
    );
    this.faceOutward();
    geometry.setIndex(this.indices);
    geometry.computeVertexNormals();
    paint(geometry, look);
    const mesh = new THREE.SkinnedMesh(geometry, characterMaterial());
    mesh.name = name;
    mesh.bind(skeleton, new THREE.Matrix4());
    return mesh;
  }
}

export function characterMaterial() {
  return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, name: 'character' });
}

/** Recolour every region of a character geometry for an appearance. */
export function paint(geometry: THREE.BufferGeometry, look: Appearance) {
  const colors = regionColors(look);
  const region = geometry.getAttribute('_region');
  const color = geometry.getAttribute('color') as THREE.BufferAttribute;
  for (let i = 0; i < region.count; i++) {
    const c = colors[REGIONS[Math.round(region.getX(i))]!];
    // Vertex colours are linear; Color stores linear values already.
    color.setXYZ(i, c.r, c.g, c.b);
  }
  color.needsUpdate = true;
}

const at = (name: string) => bindPosition(name);

function addArm(body: Builder, side: Side) {
  const sign = side === 'R' ? 1 : -1;
  const s = (n: string) => `${n}${side}`;
  const wrist = at(s('Hand'));
  const elbow = at(s('LowerArm'));
  const along = wrist.clone().sub(elbow).normalize();
  // The sleeve ends in a cuff five centimetres short of the wrist, a little wider than it.
  const cuff = wrist.clone().addScaledVector(along, -0.05);
  body.tube(
    [
      { at: at(s('UpperArm')).add(V(sign * 0.01, 0.005, 0)), r: 0.048, bone: s('UpperArm') },
      { at: elbow, r: 0.039, bone: s('LowerArm') },
      { at: cuff, r: [0.031, 0.034], bone: s('LowerArm') },
    ],
    {
      region: 'shirt',
      up: V(0, 1, 0),
      parent: s('Shoulder'),
      sides: 18,
      steps: 6,
      band: 1.2,
      capStart: true,
    },
  );
  // The cuff's rim closes the sleeve around the wrist.
  const rimUp = V(0, 1, 0).addScaledVector(along, -along.y).normalize();
  const rimSide = along.clone().cross(rimUp).normalize();
  const rim = (radius: [number, number], offset: number) =>
    Array.from({ length: 18 }, (_, k) => {
      const angle = (k / 18) * Math.PI * 2;
      const p = cuff
        .clone()
        .addScaledVector(along, offset)
        .addScaledVector(rimUp, Math.cos(angle) * radius[0])
        .addScaledVector(rimSide, Math.sin(angle) * radius[1]);
      return body.vertex(
        p,
        [[s('LowerArm'), 1]],
        'shirt',
        cuff.clone().addScaledVector(along, -0.02),
      );
    });
  body.stitch(rim([0.0305, 0.0335], -0.0008), rim([0.0235, 0.0285], -0.0008));
  // Bare wrist from inside the sleeve to the hand.
  body.tube(
    [
      { at: cuff.clone().addScaledVector(along, -0.02), r: [0.023, 0.028], bone: s('LowerArm') },
      { at: wrist.clone().add(V(0, 0, 0.006)), r: [0.022, 0.027], bone: s('Hand') },
    ],
    { region: 'skin', up: V(0, 1, 0), parent: s('LowerArm'), sides: 14, steps: 3, band: 1 },
  );
  // Palm: a rounded slab from the wrist to the knuckles, thin across (X).
  const palmCentre = wrist.clone().add(V(0, 0, HAND.palm * 0.5));
  body.ellipsoid(
    palmCentre,
    [HAND.palmThickness / 2, HAND.palmWidth / 2, HAND.palm * 0.56],
    (p) => {
      // The heel of the hand follows the forearm slightly.
      const t = THREE.MathUtils.clamp((p.z - wrist.z) / 0.02, 0, 1);
      return t >= 1
        ? [[s('Hand'), 1]]
        : [
            [s('Hand'), 0.6 + 0.4 * t],
            [s('LowerArm'), 0.4 * (1 - t)],
          ];
    },
    'skin',
    [12, 10],
    undefined,
    (u) => {
      // Square the slab off a little so knuckles line up.
      const k = 0.35;
      return V(
        u.x,
        Math.sign(u.y) * Math.abs(u.y) ** (1 - k),
        Math.sign(u.z) * Math.abs(u.z) ** (1 - k),
      );
    },
  );
  for (const finger of FINGERS) {
    const joints = [1, 2, 3].map((i) => s(`${finger}${i}`));
    const r = HAND.fingerRadius * (finger === 'Pinky' ? 0.85 : finger === 'Middle' ? 1.05 : 1);
    body.tube(
      [
        { at: at(joints[0]!).add(V(0, 0, -0.016)), r, bone: joints[0]! },
        { at: at(joints[1]!), r: r * 0.92, bone: joints[1]! },
        { at: at(joints[2]!), r: r * 0.85, bone: joints[2]! },
        { at: at(s(`${finger}Tip`)).add(V(0, 0, -r * 0.7)), r: r * 0.78, bone: joints[2]! },
      ],
      {
        region: 'skin',
        up: V(0, 1, 0),
        parent: s('Hand'),
        sides: 8,
        steps: 2,
        band: 1,
        capEnd: true,
      },
    );
  }
  // Thumb from deep in the heel of the palm, so the web stays thin and low.
  const thumb = [1, 2, 3].map((i) => s(`Thumb${i}`));
  const tip = at(s('ThumbTip'));
  const r = HAND.thumbRadius;
  body.tube(
    [
      { at: at(thumb[0]!), r: r * 1.25, bone: thumb[0]! },
      { at: at(thumb[1]!), r: r * 1.05, bone: thumb[1]! },
      { at: at(thumb[2]!), r: r * 0.95, bone: thumb[2]! },
      {
        at: tip.clone().addScaledVector(tip.clone().sub(at(thumb[2]!)).normalize(), -r * 0.7),
        r: r * 0.85,
        bone: thumb[2]!,
      },
    ],
    {
      region: 'skin',
      up: V(sign, 0, 0),
      parent: s('Hand'),
      sides: 8,
      steps: 2,
      band: 1,
      capStart: true,
      capEnd: true,
    },
  );
}

function addLegs(body: Builder, side: Side) {
  const s = (n: string) => `${n}${side}`;
  body.tube(
    [
      { at: at(s('UpperLeg')).add(V(0, 0, -0.03)), r: 0.078, bone: s('UpperLeg') },
      { at: at(s('LowerLeg')), r: 0.052, bone: s('LowerLeg') },
      { at: at(s('Foot')).add(V(0, 0.03, 0)), r: 0.038, bone: s('Foot') },
    ],
    { region: 'trousers', up: V(1, 0, 0), parent: 'Hips', sides: 16, steps: 6, capStart: true },
  );
  const foot = at(s('Foot'));
  const toe = at(s('Toe'));
  body.ellipsoid(
    foot
      .clone()
      .lerp(toe, 0.4)
      .add(V(0, -0.025, 0)),
    [0.045, 0.04, 0.13],
    [[s('Foot'), 1]],
    'shoes',
    [16, 10],
  );
}

function addTorso(body: Builder) {
  // Half-widths up the body: hips 33 cm, waist, chest, 36 cm across the shoulders.
  const profile: [number, number][] = [
    [0.0, 0.455],
    [0.15, 0.46],
    [0.175, 0.52],
    [0.168, 0.6],
    [0.152, 0.7],
    [0.16, 0.82],
    [0.175, 0.93],
    [0.18, 1.0],
    [0.15, 1.055],
    [0.08, 1.095],
    [0.055, 1.115],
  ];
  const sides = 32;
  const centre = -0.005;
  // Waistband between the trousers and the shirt.
  const BELT = [0.553, 0.585] as const;
  const regionAt = (y: number): Region =>
    y < BELT[0] ? 'trousers' : y < BELT[1] ? 'belt' : 'shirt';
  const weights = (p: THREE.Vector3): Weights => {
    const spine: Weights =
      p.y < 0.66
        ? [
            ['Hips', 1 - smooth((p.y - 0.62) / 0.04)],
            ['Abdomen', smooth((p.y - 0.62) / 0.04)],
          ]
        : p.y < 0.86
          ? [
              ['Abdomen', 1 - smooth((p.y - 0.8) / 0.06)],
              ['Chest', smooth((p.y - 0.8) / 0.06)],
            ]
          : [['Chest', 1]];
    // The tops of the shoulders follow the collarbones.
    const shoulder = smooth((Math.abs(p.x) - 0.08) / 0.05) * smooth((p.y - 0.95) / 0.05);
    if (shoulder > 0.01)
      return [
        ...spine.map(([b, w]) => [b, w * (1 - shoulder)] as [string, number]),
        [p.x < 0 ? 'ShoulderR' : 'ShoulderL', shoulder],
      ];
    return spine;
  };
  // A smooth curve through the profile, with rings at the waistband's edges.
  const curve: [number, number][] = [];
  for (let i = 0; i + 1 < profile.length; i++)
    for (let k = 0; k < 3; k++) {
      const t = k / 3;
      const [p0, p1, p2, p3] = [-1, 0, 1, 2].map(
        (d) => profile[THREE.MathUtils.clamp(i + d, 0, profile.length - 1)]!,
      );
      const point = (c: 0 | 1) =>
        0.5 *
        (2 * p1![c] +
          (p2![c] - p0![c]) * t +
          (2 * p0![c] - 5 * p1![c] + 4 * p2![c] - p3![c]) * t * t +
          (3 * p1![c] - p0![c] - 3 * p2![c] + p3![c]) * t * t * t);
      curve.push([point(0), point(1)]);
    }
  curve.push(profile.at(-1)!);
  for (const y of BELT) {
    const i = curve.findIndex(([, cy]) => cy > y);
    const [a, b] = [curve[i - 1]!, curve[i]!];
    const t = (y - a[1]) / (b[1] - a[1]);
    curve.splice(i, 0, [THREE.MathUtils.lerp(a[0], b[0], t), y]);
  }
  const ringAt = (r: number, y: number, region: Region) =>
    Array.from({ length: sides }, (_, k) => {
      const a = (k / sides) * Math.PI * 2;
      // About 22 cm deep through the chest; the waistband stands a little proud.
      const radius = r + (region === 'belt' ? 0.005 : 0);
      const p = V(Math.sin(a) * radius, y, Math.cos(a) * radius * 0.62 + centre);
      return body.vertex(p, weights(p), region, V(0, y, centre));
    });
  // A ring belongs to the band above it; a band of another colour starts on a copy.
  const bandRegion = (i: number) => regionAt((curve[i]![1] + curve[i + 1]![1]) / 2);
  const rings = curve.map(([r, y], i) => ringAt(r, y, bandRegion(Math.min(i, curve.length - 2))));
  for (let i = 0; i + 1 < curve.length; i++) {
    const own = bandRegion(i);
    const next = bandRegion(Math.min(i + 1, curve.length - 2));
    const top =
      own === next || i + 2 === curve.length ? rings[i + 1]! : ringAt(...curve[i + 1]!, own);
    body.stitch(rings[i]!, top);
  }
  body.fan(
    rings[0]!,
    body.vertex(V(0, 0.45, centre), [['Hips', 1]], 'trousers', V(0, 0.52, centre)),
  );
  const top = V(0, 1.12, centre);
  body.fan(rings.at(-1)!, body.vertex(top, weights(top), 'shirt', V(0, 1.05, centre)));
  body.tube(
    [
      { at: V(0, 1.04, -0.02), r: [0.06, 0.055], bone: 'Neck' },
      { at: at('Head').add(V(0, 0.03, 0)), r: [0.055, 0.05], bone: 'Head' },
    ],
    { region: 'skin', up: V(0, 0, 1), parent: 'Chest', sides: 18, steps: 4 },
  );
  // A rolled collar around the base of the neck.
  body.torus(
    V(0, 1.098, -0.014),
    [0.066, 0.06],
    0.0105,
    [
      ['Chest', 0.7],
      ['Neck', 0.3],
    ],
    'shirt',
  );
}

/** Face landmarks follow the sockets; the skull is the contract's ellipsoid. */
function addHead(head: Builder) {
  const pivot = at('Head');
  const w: Weights = [['Head', 1]];
  const socket = (name: string) => V(...SOCKETS[name]!.at).add(pivot);
  head.ellipsoid(
    V(...SKULL.centre).add(pivot),
    SKULL.radii,
    w,
    'skin',
    [32, 22],
    undefined,
    (u) => {
      // A narrower jaw below the cheekbones.
      const jaw = u.y < -0.2 ? THREE.MathUtils.lerp(0.74, 1, (u.y + 1) / 0.8) : 1;
      return V(
        u.x * jaw,
        u.y,
        u.z * (u.y < -0.2 ? THREE.MathUtils.lerp(0.9, 1, (u.y + 1) / 0.8) : 1),
      );
    },
  );
  const face = (side: Side, [x, y, z]: [number, number, number]) =>
    V(side === 'L' ? x : -x, y, z).add(pivot);
  for (const side of SIDES) {
    // The eye: the iris and pupil slide over the eyeball as it looks.
    const centre = face(side, FACE.eye);
    const eye: Weights = [[`Eye${side}`, 1]];
    head.ellipsoid(centre, FACE.eyeRadii, w, 'eyeWhite', [14, 9]);
    head.ellipsoid(
      centre.clone().add(V(0, 0, 0.008)),
      [0.0068, 0.0076, 0.003],
      eye,
      'iris',
      [12, 7],
    );
    head.ellipsoid(
      centre.clone().add(V(0, 0, 0.0104)),
      [0.0031, 0.0035, 0.0012],
      eye,
      'pupil',
      [10, 6],
    );
    // The upper lid: a skin dome over the top of the eye, tipped back so its edge arcs
    // above the iris; it rolls forward and down over the eye to blink.
    head.ellipsoid(
      centre,
      [0.0165, 0.0128, 0.0128],
      [[`Lid${side}`, 1]],
      'skin',
      [12, 6],
      new THREE.Euler(-LID_OPEN, 0, 0),
      (u) => (u.y < 0 ? V(u.x, u.y * 0.05, u.z) : u),
    );
    head.ellipsoid(
      face(side, FACE.brow),
      [0.017, 0.0035, 0.005],
      [[`Brow${side}`, 1]],
      'hair',
      [10, 5],
      new THREE.Euler(0, 0, side === 'L' ? -0.1 : 0.1),
    );
  }
  const nose = socket('Nose');
  head.ellipsoid(nose.clone().add(V(0, 0.004, -0.012)), [0.011, 0.017, 0.013], w, 'skin', [12, 9]);
  // The lips meet at the corners, which follow the mouth's corner joints; the upper lip
  // stays with the head and the lower lip goes with the jaw, so the mouth parts.
  const mouth = V(...FACE.mouth).add(pivot);
  const lips =
    (lower: (p: THREE.Vector3) => number) =>
    (p: THREE.Vector3): Weights => {
      const across = (p.x - mouth.x) / FACE.mouthHalfWidth;
      const corner = THREE.MathUtils.clamp((Math.abs(across) - 0.25) / 0.75, 0, 1) ** 1.5;
      return [
        [across > 0 ? 'MouthL' : 'MouthR', corner],
        ['Jaw', (1 - corner) * lower(p)],
        ['Head', (1 - corner) * (1 - lower(p))],
      ];
    };
  head.ellipsoid(
    mouth.clone().add(V(0, 0.0018, 0)),
    [FACE.mouthHalfWidth, 0.0026, 0.006],
    lips(() => 0),
    'lip',
    [14, 5],
  );
  head.ellipsoid(
    mouth.clone().add(V(0, -0.0019, 0)),
    [FACE.mouthHalfWidth * 0.94, 0.0029, 0.006],
    lips(() => 1),
    'lip',
    [14, 5],
  );
  // Inside the mouth, hidden by the closed lips; it shows as the jaw drops.
  head.ellipsoid(
    mouth.clone().add(V(0, 0, -0.004)),
    [0.013, 0.0035, 0.004],
    lips((p) => THREE.MathUtils.clamp((mouth.y - p.y) / 0.0035 + 0.5, 0, 1)),
    'mouth',
    [10, 4],
  );
  for (const ear of ['EarL', 'EarR']) {
    const centre = socket(ear).add(V(ear === 'EarL' ? -0.004 : 0.004, -0.004, -0.004));
    head.ellipsoid(centre, [0.009, 0.03, 0.016], w, 'skin', [12, 9]);
  }
}

/** Hair styles from the original procedural presets, fitted to the skull per axis. */
function addHair(hair: Builder, style: number) {
  const pivot = at('Head');
  const w: Weights = [['Head', 1]];
  const centre = V(...SKULL.centre).add(pivot);
  // The presets were drawn on a head of radii (0.43, 0.53, 0.38) centred at y = 0.35.
  const scale = V(SKULL.radii[0] / 0.43, SKULL.radii[1] / 0.53, SKULL.radii[2] / 0.38);
  const map = (x: number, y: number, z: number) =>
    V(x * scale.x, (y - 0.35) * scale.y, z * scale.z).add(centre);
  const size = (r: [number, number, number]): [number, number, number] => [
    r[0] * scale.x,
    r[1] * scale.y,
    r[2] * scale.z,
  ];
  // Cap: the upper skull, lifted at the front so the forehead stays clear.
  hair.ellipsoid(
    map(0, 0.48, -0.025),
    size([0.445 * 1.07, 0.43 * 1.12, 0.395 * 1.1]),
    w,
    'hair',
    [26, 15],
    undefined,
    (u) => (u.y < 0 ? V(u.x, u.y * 0.15, u.z) : u),
  );
  const ball = (p: [number, number, number], r: [number, number, number], rz = 0) =>
    hair.ellipsoid(map(...p), size(r), w, 'hair', [14, 9], new THREE.Euler(0, 0, rz));
  if (style === 0) ball([-0.07, 0.83, 0.12], [0.33, 0.12, 0.26], -0.14);
  if (style === 1) {
    ball([0, 0.35, -0.28], [0.435, 0.46, 0.17]);
    for (const x of [-1, 1]) ball([x * 0.39, 0.34, -0.06], [0.095, 0.33, 0.2]);
  }
  if (style === 2)
    for (let i = 0; i < 10; i++)
      ball(
        [Math.sin(i * 2.4) * 0.3, 0.77 + (i % 3) * 0.045, Math.cos(i * 2.4) * 0.24],
        [0.135, 0.14, 0.13],
      );
  if (style === 3) ball([0.13, 0.82, 0.1], [0.28, 0.13, 0.27], 0.16);
  if (style === 4)
    for (let i = 0; i < 7; i++)
      ball(
        [(i - 3) * 0.11, 0.86 + (i % 2) * 0.03, 0.1 - Math.abs(i - 3) * 0.03],
        [0.1, 0.12, 0.16],
        (i - 3) * 0.12,
      );
  // Long, straight hair past the shoulders, framing the face, with a side-swept fringe.
  if (style === 5) {
    ball([0, 0.1, -0.25], [0.45, 0.72, 0.17]);
    for (const x of [-1, 1]) ball([x * 0.4, 0.15, 0], [0.1, 0.55, 0.2]);
    ball([-0.06, 0.76, 0.24], [0.3, 0.09, 0.14], -0.18);
  }
  // Drawn back into a ponytail, with a light fringe.
  if (style === 6) {
    ball([0, 0.62, -0.38], [0.11, 0.11, 0.1]);
    ball([0, 0.3, -0.47], [0.1, 0.32, 0.1]);
    ball([0, -0.02, -0.45], [0.075, 0.2, 0.075]);
    ball([0.1, 0.78, 0.22], [0.26, 0.08, 0.13], 0.25);
  }
  // Two pigtails tied behind the ears, with a straight fringe.
  if (style === 7) {
    for (const x of [-1, 1]) {
      ball([x * 0.42, 0.45, -0.15], [0.09, 0.09, 0.09]);
      ball([x * 0.5, 0.18, -0.17], [0.09, 0.26, 0.09], x * 0.25);
    }
    ball([0, 0.76, 0.25], [0.34, 0.09, 0.13]);
  }
  // The women's styles have lashes along each upper lid's edge; they close with the lid.
  if (style >= 5)
    for (const side of SIDES) {
      const out = side === 'L' ? 1 : -1;
      const eye = V(out * FACE.eye[0], FACE.eye[1], FACE.eye[2]).add(pivot);
      for (const t of [-0.6, -0.3, 0, 0.3, 0.6, 0.85]) {
        const depth = 0.0128 * Math.sqrt(1 - t * t);
        hair.ellipsoid(
          eye
            .clone()
            .add(
              V(
                out * t * 0.0165,
                depth * Math.sin(LID_OPEN) + 0.0006 + (t > 0.7 ? 0.001 : 0),
                depth * Math.cos(LID_OPEN) + 0.0008,
              ),
            ),
          [0.0042, 0.0011, 0.0026],
          [[`Lid${side}`, 1]],
          'hair',
          [6, 3],
          new THREE.Euler(-LID_OPEN * 0.5, 0, out * t * 0.4),
        );
      }
    }
}

/** The complete character: bones, sockets and meshes, in the seated bind pose. */
export function generateCharacter(look: Appearance = DEFAULT_APPEARANCE) {
  const root = new THREE.Group();
  root.name = 'Character';
  const bones = new Map<string, THREE.Bone>();
  for (const joint of SKELETON) {
    const bone = new THREE.Bone();
    bone.name = joint.name;
    const parent = joint.parent ? bones.get(joint.parent)! : undefined;
    bone.position.set(...joint.at);
    if (parent) {
      bone.position.sub(bindPosition(joint.parent));
      parent.add(bone);
    } else root.add(bone);
    bones.set(joint.name, bone);
  }
  for (const [name, socket] of Object.entries(SOCKETS)) {
    const node = new THREE.Object3D();
    node.name = `Socket${name}`;
    node.position.set(...socket.at);
    bones.get(socket.bone)!.add(node);
  }
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton([...bones.values()]);

  const body = new Builder();
  addTorso(body);
  for (const side of SIDES) {
    addArm(body, side);
    addLegs(body, side);
  }
  const head = new Builder();
  addHead(head);
  root.add(body.mesh('BodyMesh', bones, skeleton, look));
  root.add(head.mesh('HeadMesh', bones, skeleton, look));
  for (let style = 0; style < HAIR_STYLES; style++) {
    const hair = new Builder();
    addHair(hair, style);
    const mesh = hair.mesh(`Hair${style}`, bones, skeleton, look);
    mesh.visible = style === look.hairStyle;
    root.add(mesh);
  }
  return root;
}
