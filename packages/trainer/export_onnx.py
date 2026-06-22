"""
Export a trained PolicyNet checkpoint to ONNX for Node.js inference.

Usage:
  python export_onnx.py [--ckpt checkpoints/best_model.pt] [--out ../server/ml/durak_bot.onnx]

Inputs:
  obs   : float32 [1, 176]
  mask  : bool    [1, 44]

Output:
  logits : float32 [1, 44]
"""

import argparse
import os
import torch
import onnx
import onnxruntime as ort
import numpy as np

from policy_net import PolicyNet, OBS_DIM, ACTION_DIM, export_to_onnx

DEFAULT_OUT = os.path.join(os.path.dirname(__file__), '..', 'server', 'ml', 'durak_bot.onnx')


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--ckpt', default='checkpoints/best_model.pt')
    p.add_argument('--out',  default=DEFAULT_OUT)
    args = p.parse_args()

    net = PolicyNet(OBS_DIM, ACTION_DIM)
    state = torch.load(args.ckpt, map_location='cpu')
    # Support both raw state_dict and wrapped checkpoints
    if isinstance(state, dict) and 'model' in state:
        state = state['model']
    net.load_state_dict(state)

    out_path = os.path.normpath(args.out)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    export_to_onnx(net, out_path)

    # Validate
    onnx.checker.check_model(onnx.load(out_path))
    print('ONNX check passed.')

    sess = ort.InferenceSession(out_path, providers=['CPUExecutionProvider'])
    obs_np  = np.zeros((1, OBS_DIM), dtype=np.float32)
    mask_np = np.ones((1, ACTION_DIM), dtype=bool)
    (logits,) = sess.run(None, {'obs': obs_np, 'mask': mask_np})
    print(f'Test inference — logits shape: {logits.shape}, max: {logits.max():.4f}')
    print('Export complete.')


if __name__ == '__main__':
    main()
