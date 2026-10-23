import { afterEach, describe, expect, it, vi } from 'vitest';
import { TableRenderer } from '../components/three/TableRenderer';

const mocks = vi.hoisted(() => ({ dispose: vi.fn(), loseContext: vi.fn() }));
vi.mock('three', async (original) => {
  const three = await original<typeof import('three')>();
  return {
    ...three,
    WebGLRenderer: class {
      domElement = document.createElement('canvas');
      shadowMap = {};
      capabilities = { getMaxAnisotropy: () => 16 };
      setPixelRatio() {}
      getContext() {
        return { isContextLost: () => false };
      }
      dispose = mocks.dispose;
      forceContextLoss = mocks.loseContext;
    },
  };
});
afterEach(() => vi.restoreAllMocks());

describe('renderer setup failure cleanup', () => {
  it('releases the renderer, canvas and context if initial card texture creation fails', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false, removeEventListener: vi.fn() }));
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const host = document.createElement('div');
    expect(() => new TableRenderer(host, vi.fn(), vi.fn(), null)).toThrow(
      'Card textures unavailable',
    );
    expect(host.querySelector('canvas')).toBeNull();
    expect(mocks.dispose).toHaveBeenCalledOnce();
    expect(mocks.loseContext).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });
});
