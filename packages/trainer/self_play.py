import random
import torch
import torch.nn.functional as F
from durak_env import DurakEnv, ACTION_DIM
from policy_net import PolicyNet


def build_mask(legal: list[int]) -> torch.Tensor:
    mask = torch.zeros(ACTION_DIM, dtype=torch.bool)
    for a in legal:
        mask[a] = True
    return mask


def sample_action(logits: torch.Tensor) -> int:
    probs = F.softmax(logits.squeeze(0), dim=0)
    return int(torch.multinomial(probs, 1).item())


def rollout(
    policy: PolicyNet,
    pool: list[PolicyNet],
) -> tuple[list[tuple], list[tuple], int]:
    """
    Runs one episode of 2-player self-play.

    Seat 0 is always controlled by `policy` (the learning agent).
    Seat 1 is controlled by a random snapshot from `pool`
    (or `policy` itself if pool is empty).

    Returns:
        seat0_traj: list of (obs, action, mask_tensor) for seat 0
        seat1_traj: list of (obs, action, mask_tensor) for seat 1 (unused for training)
        winner_seat: 0 or 1
    """
    env = DurakEnv()
    obs = env.reset()
    seat0_traj: list[tuple] = []
    seat1_traj: list[tuple] = []

    opponent: PolicyNet = random.choice(pool) if pool else policy

    done = False
    while not done:
        seat = env.current_seat
        legal = env.legal_actions(seat)
        mask = build_mask(legal)
        obs_t = torch.tensor(obs, dtype=torch.float32).unsqueeze(0)
        mask_t = mask.unsqueeze(0)

        if seat == 0:
            logits = policy(obs_t, mask_t)
            action = sample_action(logits)
            seat0_traj.append((obs, action, mask))
        else:
            with torch.no_grad():
                logits = opponent(obs_t, mask_t)
            action = sample_action(logits)
            seat1_traj.append((obs, action, mask))

        obs, _reward, done, info = env.step(action)

    winner_seat: int = info.get("winner_seat", -1)
    return seat0_traj, seat1_traj, winner_seat
