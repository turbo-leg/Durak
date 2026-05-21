"""
Load a trained PolicyNet checkpoint and export it to ONNX.
Usage: python export_onnx.py [--weights durak_policy.pt] [--out ../../server/ml/durak_bot.onnx]
"""
import argparse
import os
import torch
from policy_net import PolicyNet, export_to_onnx

DEFAULT_WEIGHTS = "durak_policy.pt"
DEFAULT_OUT     = os.path.join(os.path.dirname(__file__), "../server/ml/durak_bot.onnx")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--weights", default=DEFAULT_WEIGHTS)
    parser.add_argument("--out",     default=DEFAULT_OUT)
    args = parser.parse_args()

    net = PolicyNet()
    if os.path.exists(args.weights):
        net.load_state_dict(torch.load(args.weights, map_location="cpu"))
        print(f"Loaded weights from {args.weights}")
    else:
        print(f"Warning: {args.weights} not found — exporting untrained (random) model")

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    export_to_onnx(net, args.out)


if __name__ == "__main__":
    main()
