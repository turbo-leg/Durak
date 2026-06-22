"""
Policy + Value network for Durak RL.

Architecture:
  Input (153) → Linear(256) → LayerNorm → ReLU
              → Linear(256) → LayerNorm → ReLU
              → Linear(128) → ReLU
              ↓                        ↓
  Policy head: Linear(44) + mask    Value head: Linear(1) + tanh

The mask zeroes out illegal actions before softmax so the agent
never needs to learn which moves are structurally impossible.

Trained with REINFORCE + baseline (value network as baseline).
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
from durak_env import OBS_DIM, ACTION_DIM


class DurakNet(nn.Module):
    def __init__(self, obs_dim: int = OBS_DIM, act_dim: int = ACTION_DIM, hidden: int = 256):
        super().__init__()
        self.trunk = nn.Sequential(
            nn.Linear(obs_dim, hidden),
            nn.LayerNorm(hidden),
            nn.ReLU(),
            nn.Linear(hidden, hidden),
            nn.LayerNorm(hidden),
            nn.ReLU(),
            nn.Linear(hidden, 128),
            nn.ReLU(),
        )
        self.policy_head = nn.Linear(128, act_dim)
        self.value_head  = nn.Linear(128, 1)

    def forward(self, obs: torch.Tensor, legal_mask: torch.Tensor):
        """
        Args:
            obs:         (B, OBS_DIM) float tensor
            legal_mask:  (B, ACTION_DIM) bool tensor — True = legal
        Returns:
            log_probs:   (B, ACTION_DIM) log-softmax over legal actions
            value:       (B,) tanh-squashed value estimate
        """
        x = self.trunk(obs)
        logits = self.policy_head(x)
        # Mask illegal actions with -inf before softmax
        logits = logits.masked_fill(~legal_mask, float('-inf'))
        log_probs = F.log_softmax(logits, dim=-1)
        value = torch.tanh(self.value_head(x)).squeeze(-1)
        return log_probs, value

    def act(self, obs: torch.Tensor, legal_mask: torch.Tensor,
            greedy: bool = False) -> torch.Tensor:
        """
        Sample (or argmax) an action for each item in the batch.
        Returns action indices (B,).
        """
        with torch.no_grad():
            log_probs, _ = self.forward(obs, legal_mask)
            if greedy:
                return log_probs.argmax(dim=-1)
            probs = log_probs.exp()
            return torch.multinomial(probs, num_samples=1).squeeze(-1)


def build_mask(legal_actions: list, device: torch.device) -> torch.Tensor:
    """Convert list of legal action indices → boolean mask tensor (ACTION_DIM,)."""
    mask = torch.zeros(ACTION_DIM, dtype=torch.bool, device=device)
    for a in legal_actions:
        mask[a] = True
    return mask


def obs_to_tensor(obs: dict, device: torch.device) -> tuple:
    """Convert a single env observation dict → (obs_tensor, mask_tensor)."""
    feat = torch.tensor(obs['features'], dtype=torch.float32, device=device).unsqueeze(0)
    mask = build_mask(obs['legal'], device).unsqueeze(0)
    return feat, mask
