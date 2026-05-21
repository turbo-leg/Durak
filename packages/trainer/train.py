import copy
import torch
import torch.nn.functional as F
from policy_net import PolicyNet
from self_play import rollout, build_mask

SNAPSHOT_EVERY = 200
EVAL_EVERY     = 500
N_ITERS        = 5000
ENTROPY_COEFF  = 0.01
LR             = 3e-4
POOL_MAX       = 20


def compute_loss(
    policy: PolicyNet,
    traj: list[tuple],
    reward: float,
) -> torch.Tensor:
    """REINFORCE loss with entropy bonus for one episode trajectory."""
    policy_loss = torch.tensor(0.0)
    entropy_sum = torch.tensor(0.0)

    for obs, action, mask in traj:
        obs_t  = torch.tensor(obs, dtype=torch.float32).unsqueeze(0)
        mask_t = mask.unsqueeze(0)
        logits = policy(obs_t, mask_t)
        log_probs = F.log_softmax(logits.squeeze(0), dim=0)
        policy_loss = policy_loss - log_probs[action] * reward

        probs = F.softmax(logits.squeeze(0), dim=0)
        entropy_sum = entropy_sum - (probs * log_probs).sum()

    n = max(len(traj), 1)
    return policy_loss / n - ENTROPY_COEFF * (entropy_sum / n)


def evaluate(policy: PolicyNet, opponent: PolicyNet, n: int = 100) -> float:
    wins = 0
    for _ in range(n):
        _, _, winner = rollout(policy, [opponent])
        if winner == 0:
            wins += 1
    return wins / n


def main() -> None:
    policy    = PolicyNet()
    optimizer = torch.optim.Adam(policy.parameters(), lr=LR)
    pool: list[PolicyNet] = []

    for it in range(1, N_ITERS + 1):
        policy.train()
        traj0, _traj1, winner = rollout(policy, pool)
        seat0_reward = 1.0 if winner == 0 else -1.0

        loss = compute_loss(policy, traj0, seat0_reward)
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()

        if it % 100 == 0:
            print(f"iter {it:5d}  loss={loss.item():.4f}  seat0_won={winner==0}")

        if it % SNAPSHOT_EVERY == 0:
            snap = copy.deepcopy(policy).eval()
            pool.append(snap)
            if len(pool) > POOL_MAX:
                pool.pop(0)
            print(f"  → snapshot added (pool size={len(pool)})")

        if it % EVAL_EVERY == 0 and pool:
            policy.eval()
            wr = evaluate(policy, pool[0], n=100)
            policy.train()
            print(f"  → eval vs oldest snapshot: win_rate={wr:.2f}")

    torch.save(policy.state_dict(), "durak_policy.pt")
    print("Training complete. Weights saved to durak_policy.pt")
    print("Run  python export_onnx.py  to produce durak_bot.onnx")


if __name__ == "__main__":
    main()
