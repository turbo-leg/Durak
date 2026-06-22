"""
Policy network for Durak RL.

Architecture: 176 → 256 → ReLU → 256 → ReLU → 128 → ReLU → 44 (logits)

Mask zeroes illegal actions before softmax so the agent never samples invalid moves.
"""

import torch
import torch.nn as nn
import torch.nn.functional as F

OBS_DIM = 176
ACTION_DIM = 44


class PolicyNet(nn.Module):
    def __init__(self, obs_dim: int = OBS_DIM, act_dim: int = ACTION_DIM, hidden: int = 256):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(obs_dim, hidden), nn.ReLU(),
            nn.Linear(hidden, hidden),  nn.ReLU(),
            nn.Linear(hidden, 128),     nn.ReLU(),
        )
        self.policy_head = nn.Linear(128, act_dim)

    def forward(self, obs: torch.Tensor, mask: torch.Tensor = None) -> torch.Tensor:
        """
        Args:
            obs:  (B, 176) float
            mask: (B, 44) bool — True = legal (optional)
        Returns:
            logits: (B, 44) — masked if mask provided
        """
        logits = self.policy_head(self.net(obs))
        if mask is not None:
            logits = logits.masked_fill(~mask, -1e9)
        return logits

    def log_probs_and_entropy(self, obs: torch.Tensor, mask: torch.Tensor) -> tuple:
        logits = self.forward(obs, mask)
        log_p = F.log_softmax(logits, dim=-1)
        # Safe entropy: only over legal actions
        p = log_p.exp()
        safe_log = torch.where(mask, log_p, torch.zeros_like(log_p))
        entropy = -(p * safe_log).sum(dim=-1)
        return log_p, entropy


def build_mask(legal_actions: list, device=None) -> torch.Tensor:
    mask = torch.zeros(ACTION_DIM, dtype=torch.bool)
    for a in legal_actions:
        if 0 <= a < ACTION_DIM:
            mask[a] = True
    if device:
        mask = mask.to(device)
    return mask


def export_to_onnx(net: PolicyNet, path: str):
    """Export PolicyNet to ONNX opset 11 with obs and mask as inputs."""
    net.eval()
    dummy_obs = torch.zeros(1, OBS_DIM)
    dummy_mask = torch.ones(1, ACTION_DIM, dtype=torch.bool)
    torch.onnx.export(
        net,
        (dummy_obs, dummy_mask),
        path,
        input_names=['obs', 'mask'],
        output_names=['logits'],
        dynamic_axes={'obs': {0: 'batch'}, 'mask': {0: 'batch'}, 'logits': {0: 'batch'}},
        opset_version=11,
    )
    print(f'Exported to {path}')
