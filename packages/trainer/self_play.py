"""
Snapshot-pool self-play rollout runner.

seat 0 = learner (gradient flows through its trajectory)
seat 1 = opponent sampled from snapshot pool (no_grad)

Returns trajectories of (obs, action, mask) tuples and the winner seat.
"""

import random
import torch
from durak_env import DurakEnv, ACTION_PASS, ACTION_DIM
from policy_net import PolicyNet, build_mask

POOL_MAX = 20


def _sample_action(logits: torch.Tensor, mask: torch.Tensor) -> int:
    probs = torch.softmax(logits, dim=-1).squeeze(0)
    legal_idx = mask.squeeze(0).nonzero(as_tuple=True)[0]
    if len(legal_idx) == 0:
        return ACTION_PASS
    legal_probs = probs[legal_idx]
    total = legal_probs.sum()
    if total < 1e-9:
        chosen = legal_idx[random.randrange(len(legal_idx))].item()
    else:
        chosen = legal_idx[torch.multinomial(legal_probs / total, 1).item()].item()
    return int(chosen)


def rollout(
    policy: PolicyNet,
    pool: list,
    device: torch.device = torch.device('cpu'),
    max_steps: int = 2000,
) -> tuple:
    """
    Returns:
        seat0_traj: list of (obs_list, action, legal_list)
        winner_seat: int (0 or 1, -1 if draw/timeout)
    """
    env = DurakEnv()
    obs = env.reset()
    seat0_traj = []
    done = False
    steps = 0

    opponent = random.choice(pool) if pool else policy

    while not done and steps < max_steps:
        steps += 1
        seat = env.current_seat
        legal = env.legal_actions(seat)
        mask = build_mask(legal, device).unsqueeze(0)
        obs_t = torch.tensor(obs, dtype=torch.float32, device=device).unsqueeze(0)

        if seat == 0:
            logits = policy(obs_t, mask)
            action = _sample_action(logits, mask)
            seat0_traj.append((obs[:], action, legal[:]))
        else:
            with torch.no_grad():
                logits = opponent(obs_t, mask)
            action = _sample_action(logits, mask)

        obs, _reward, done, info = env.step(action)

    winner = info.get('winner_seat', -1)
    return seat0_traj, winner


def compute_returns(traj: list, winner_seat: int, gamma: float = 1.0) -> list:
    """Assign +1 to winner's steps, -1 to loser's. γ=1 binary terminal reward."""
    if not traj:
        return []
    reward = 1.0 if winner_seat == 0 else -1.0
    returns = []
    running = 0.0
    for i in range(len(traj) - 1, -1, -1):
        r = reward if i == len(traj) - 1 else 0.0
        running = r + gamma * running
        returns.append(running)
    returns.reverse()
    return returns
