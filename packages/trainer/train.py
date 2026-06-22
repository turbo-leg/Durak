"""
REINFORCE training loop with snapshot-pool self-play.

Algorithm:
  1. Collect a game between learner (seat 0) and pool opponent (seat 1).
  2. Compute REINFORCE loss on seat-0 trajectory with entropy bonus.
  3. Every SNAPSHOT_EVERY iters: freeze a copy into the pool.
  4. Every EVAL_EVERY iters: eval win-rate vs oldest pool snapshot.
"""

import copy
import os
import torch
import torch.nn.functional as F
from policy_net import PolicyNet, build_mask, OBS_DIM, ACTION_DIM
from self_play import rollout, compute_returns, POOL_MAX

# ── Hyperparameters ───────────────────────────────────────────────────────────
N_ITERS        = 5000
LR             = 3e-4
ENTROPY_COEFF  = 0.01
SNAPSHOT_EVERY = 200
EVAL_EVERY     = 500
EVAL_GAMES     = 100
CHECKPOINT_DIR = os.path.join(os.path.dirname(__file__), 'checkpoints')
os.makedirs(CHECKPOINT_DIR, exist_ok=True)

device = torch.device('cpu')


def _traj_loss(policy: PolicyNet, traj: list, returns: list) -> tuple:
    if not traj:
        return torch.tensor(0.0), torch.tensor(0.0)

    obs_batch  = torch.tensor([t[0] for t in traj], dtype=torch.float32, device=device)
    act_batch  = torch.tensor([t[1] for t in traj], dtype=torch.long, device=device)
    mask_batch = torch.stack([build_mask(t[2], device) for t in traj])
    ret_batch  = torch.tensor(returns, dtype=torch.float32, device=device)

    log_p, entropy = policy.log_probs_and_entropy(obs_batch, mask_batch)
    chosen_log_p = log_p.gather(1, act_batch.unsqueeze(1)).squeeze(1)

    # Baseline: mean return over this episode
    baseline = ret_batch.mean()
    pg_loss = -(chosen_log_p * (ret_batch - baseline)).mean()
    return pg_loss, entropy.mean()


def evaluate(policy: PolicyNet, opponent: PolicyNet, n: int = EVAL_GAMES) -> float:
    wins = 0
    for _ in range(n):
        _, winner = rollout(policy, [opponent], device=device, max_steps=2000)
        if winner == 0:
            wins += 1
    return wins / n


def main():
    policy = PolicyNet().to(device)
    optimizer = torch.optim.Adam(policy.parameters(), lr=LR)
    pool: list = []

    best_win_rate = 0.0

    for it in range(1, N_ITERS + 1):
        policy.train()
        traj, winner = rollout(policy, pool, device=device)
        returns = compute_returns(traj, winner)

        pg_loss, entropy = _traj_loss(policy, traj, returns)
        loss = pg_loss - ENTROPY_COEFF * entropy

        optimizer.zero_grad()
        loss.backward()
        torch.nn.utils.clip_grad_norm_(policy.parameters(), 1.0)
        optimizer.step()

        if it % 100 == 0:
            print(f'iter {it:5d} | loss={loss.item():.4f} | pg={pg_loss.item():.4f} | '
                  f'ent={entropy.item():.4f} | winner={winner} | pool={len(pool)}')

        if it % SNAPSHOT_EVERY == 0:
            snap = copy.deepcopy(policy).eval()
            pool.append(snap)
            if len(pool) > POOL_MAX:
                pool.pop(0)
            print(f'  [snapshot] pool size = {len(pool)}')

        if it % EVAL_EVERY == 0 and pool:
            policy.eval()
            wr = evaluate(policy, pool[0])
            policy.train()
            print(f'  [eval] iter {it} win_rate_vs_oldest = {wr:.3f}')
            if wr > best_win_rate:
                best_win_rate = wr
                path = os.path.join(CHECKPOINT_DIR, 'best_model.pt')
                torch.save(policy.state_dict(), path)
                print(f'  [checkpoint] saved best_model.pt (wr={wr:.3f})')

    # Save final model
    final_path = os.path.join(CHECKPOINT_DIR, 'final_model.pt')
    torch.save(policy.state_dict(), final_path)
    print(f'Training complete. Saved {final_path}')


if __name__ == '__main__':
    main()
