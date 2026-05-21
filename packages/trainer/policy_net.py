import torch
import torch.nn as nn
from durak_env import OBS_DIM, ACTION_DIM


class PolicyNet(nn.Module):
    def __init__(self, obs_dim: int = OBS_DIM, act_dim: int = ACTION_DIM, hidden: int = 256):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(obs_dim, hidden), nn.ReLU(),
            nn.Linear(hidden, hidden),  nn.ReLU(),
            nn.Linear(hidden, 128),     nn.ReLU(),
        )
        self.policy_head = nn.Linear(128, act_dim)

    def forward(
        self,
        obs: torch.Tensor,
        mask: torch.Tensor | None = None,
    ) -> torch.Tensor:
        """Returns raw logits (illegal actions masked to -1e9)."""
        logits = self.policy_head(self.net(obs))
        if mask is not None:
            logits = logits.masked_fill(~mask, -1e9)
        return logits


def export_to_onnx(net: PolicyNet, path: str) -> None:
    net.eval()
    dummy_obs = torch.zeros(1, OBS_DIM)
    dummy_mask = torch.ones(1, ACTION_DIM, dtype=torch.bool)
    torch.onnx.export(
        net,
        (dummy_obs, dummy_mask),
        path,
        opset_version=18,
        input_names=["obs", "mask"],
        output_names=["logits"],
        dynamic_axes={
            "obs":    {0: "batch"},
            "mask":   {0: "batch"},
            "logits": {0: "batch"},
        },
    )
    print(f"Exported ONNX model → {path}")
