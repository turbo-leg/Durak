import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { PublicGesture } from '@durak/shared';
import { SeatedCharacter, disposeCharacter } from '../../character/CharacterRig';

/** A small mirror makes nose and ear contact visible to the person making it. */
export default function GesturePreview({
  gesture,
  offset,
  preset,
}: {
  gesture: PublicGesture;
  offset: number;
  preset: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef({ gesture, offset });
  useEffect(() => {
    latest.current = { gesture, offset };
  });
  useEffect(() => {
    if (!host.current) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    } catch {
      return;
    }
    const node = host.current;
    renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio));
    renderer.setSize(144, 188);
    node.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight('#fff1dc', '#65707a', 2.5));
    const light = new THREE.DirectionalLight('#ffdfb8', 2.5);
    light.position.set(-2, 5, 4);
    scene.add(light);
    const camera = new THREE.PerspectiveCamera(32, 144 / 188, 0.1, 20);
    // The character stands at the origin in metres: frame the head, hands and cards.
    camera.position.set(0, 1.12, 1.75);
    camera.lookAt(0, 1.06, 0);
    let timer: ReturnType<typeof setTimeout>;
    let disposed = false;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const draw = () => {
      if (disposed) return;
      clearTimeout(timer);
      avatar.setGesture(latest.current.gesture, latest.current.offset);
      const moving = avatar.animate(performance.now() / 1000, reduced.matches);
      renderer.render(scene, camera);
      timer = setTimeout(draw, moving ? 33 : 125);
    };
    const avatar = new SeatedCharacter(preset, () => draw());
    scene.add(avatar.root);
    const cards = new THREE.Group();
    const geometry = new THREE.BoxGeometry(0.82, 1.2, 0.015);
    const material = new THREE.MeshStandardMaterial({ color: '#527b90', roughness: 0.9 });
    for (let i = 0; i < 5; i++) {
      const card = new THREE.Mesh(geometry, material);
      const angle = (i - 2) * 0.25;
      card.position.set(
        Math.sin(angle) * 1.35 * 0.8,
        (Math.cos(angle) * 1.35 - 1.35) * 0.8,
        (i - 2) * 0.018,
      );
      card.rotation.z = -angle;
      card.scale.setScalar(0.8);
      cards.add(card);
    }
    avatar.fan.add(cards);
    draw();
    return () => {
      disposed = true;
      clearTimeout(timer);
      avatar.dispose();
      disposeCharacter(cards);
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [preset]);
  return (
    <div
      ref={host}
      className="gesture-preview"
      role="img"
      aria-label="Your character, viewed from the front"
    />
  );
}
