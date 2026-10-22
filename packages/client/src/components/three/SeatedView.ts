import * as THREE from 'three';
import { LOOK_INTERVAL_MS, LOOK_YAW_LIMIT, LOOK_PITCH_MIN, LOOK_PITCH_MAX } from '@durak/shared';
import { NEUTRAL_LOOK_DOWN, seatedEyes } from './CharacterSpace';

/** A stationary chair: looking rotates the eyes, never the table or the seat. */
export class SeatedView {
  private yaw = 0;
  private pitch = 0;
  private spectator = false;
  private eyeSource?: (
    yaw: number,
    pitch: number,
  ) => { position: THREE.Vector3; quaternion: THREE.Quaternion } | undefined;
  private pointer: { id: number; x: number; y: number } | null = null;
  private sentAt = -Infinity;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private camera: THREE.PerspectiveCamera,
    private canvas: HTMLCanvasElement,
    private changed: () => void,
    private look: (yaw: number, pitch: number) => void,
    private canDrag: (event: PointerEvent) => boolean,
  ) {
    canvas.tabIndex = 0;
    canvas.addEventListener('pointerdown', this.down);
    canvas.addEventListener('pointermove', this.move);
    canvas.addEventListener('pointerup', this.up);
    canvas.addEventListener('pointercancel', this.up);
    canvas.addEventListener('keydown', this.key);
    document.addEventListener('visibilitychange', this.visibility);
    this.apply();
  }
  setSpectator(spectator: boolean) {
    if (spectator !== this.spectator) {
      this.spectator = spectator;
      this.recenter();
    }
  }
  getLook() {
    return { yaw: this.yaw, pitch: this.pitch };
  }
  setEyeSource(source?: typeof this.eyeSource) {
    this.eyeSource = source;
    this.apply();
  }
  recenter = () => {
    this.yaw = 0;
    this.pitch = 0;
    this.apply();
    this.schedule();
  };
  private apply() {
    if (this.spectator) {
      this.camera.position.set(
        Math.sin(this.yaw) * 11.5,
        9 + this.pitch * 4,
        Math.cos(this.yaw) * 11.5,
      );
      this.camera.lookAt(0, 0, 0);
    } else {
      this.camera.position.copy(seatedEyes(this.yaw, this.pitch));
      this.camera.rotation.order = 'YXZ';
      this.camera.rotation.set(-NEUTRAL_LOOK_DOWN + this.pitch, this.yaw, 0);
      const view = this.eyeSource?.(this.yaw, this.pitch);
      if (view) {
        this.camera.position.copy(view.position);
        this.camera.quaternion.copy(view.quaternion);
      }
    }
    this.camera.updateMatrixWorld(true);
    this.changed();
  }
  private down = (event: PointerEvent) => {
    if (event.button !== 0 || !this.canDrag(event)) return;
    this.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    this.canvas.setPointerCapture(event.pointerId);
  };
  private move = (event: PointerEvent) => {
    if (!this.pointer || this.pointer.id !== event.pointerId) return;
    this.yaw = THREE.MathUtils.clamp(
      this.yaw - (event.clientX - this.pointer.x) * 0.004,
      -LOOK_YAW_LIMIT,
      LOOK_YAW_LIMIT,
    );
    this.pitch = THREE.MathUtils.clamp(
      this.pitch - (event.clientY - this.pointer.y) * 0.003,
      LOOK_PITCH_MIN,
      LOOK_PITCH_MAX,
    );
    this.pointer.x = event.clientX;
    this.pointer.y = event.clientY;
    this.apply();
    this.schedule();
  };
  private up = () => {
    this.pointer = null;
  };
  private key = (event: KeyboardEvent) => {
    if (event.key === 'Home') {
      event.preventDefault();
      this.recenter();
      return;
    }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    this.yaw = THREE.MathUtils.clamp(
      this.yaw + (event.key === 'ArrowLeft' ? 0.09 : event.key === 'ArrowRight' ? -0.09 : 0),
      -LOOK_YAW_LIMIT,
      LOOK_YAW_LIMIT,
    );
    this.pitch = THREE.MathUtils.clamp(
      this.pitch + (event.key === 'ArrowUp' ? 0.06 : event.key === 'ArrowDown' ? -0.06 : 0),
      LOOK_PITCH_MIN,
      LOOK_PITCH_MAX,
    );
    this.apply();
    this.schedule();
  };
  private schedule() {
    if (this.spectator || document.hidden) return;
    clearTimeout(this.timer);
    const delay = Math.max(0, LOOK_INTERVAL_MS + 10 - (performance.now() - this.sentAt));
    this.timer = setTimeout(() => {
      if (!document.hidden) {
        this.look(this.yaw, this.pitch);
        this.sentAt = performance.now();
      }
    }, delay);
  }
  private visibility = () => {
    if (document.hidden) {
      clearTimeout(this.timer);
      this.pointer = null;
    }
  };
  dispose() {
    clearTimeout(this.timer);
    this.canvas.removeEventListener('pointerdown', this.down);
    this.canvas.removeEventListener('pointermove', this.move);
    this.canvas.removeEventListener('pointerup', this.up);
    this.canvas.removeEventListener('pointercancel', this.up);
    this.canvas.removeEventListener('keydown', this.key);
    document.removeEventListener('visibilitychange', this.visibility);
  }
}
