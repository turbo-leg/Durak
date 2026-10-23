import { useEffect, useId, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export function RoomDialog({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const node = ref.current;
    node?.showModal();
    return () => node?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="room-dialog"
      aria-labelledby={titleId}
      onCancel={close}
      onClick={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.target === event.currentTarget &&
          (event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom)
        )
          close();
      }}
    >
      <div className="dialog-heading">
        <h2 id={titleId}>{title}</h2>
        <button aria-label="Close" className="icon-button" onClick={close}>
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}

export function AccountPanel({ playerName, close }: { playerName: string; close: () => void }) {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [register, setRegister] = useState(false);
  return (
    <RoomDialog title={auth.user ? 'Your seat.' : 'Make it your seat.'} close={close}>
      {auth.user ? (
        <>
          <p>
            Signed in as <strong>{playerName}</strong>. Your identity and equipped card back carry
            into your matches.
          </p>
          <button
            className="secondary-button"
            onClick={() => {
              auth.logout();
              close();
            }}
          >
            Sign out
          </button>
        </>
      ) : (
        <>
          <p>Guests can play immediately. Sign in to keep your profile and rated results.</p>
          <form
            className="account-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (register) void auth.register(email, password, playerName).catch(() => {});
              else void auth.loginWithEmail(email, password).catch(() => {});
            }}
          >
            <label className="field">
              Email
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="field">
              Password
              <input
                type="password"
                required
                minLength={8}
                autoComplete={register ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {auth.error && <p role="alert">{auth.error}</p>}
            <button className="primary-button" disabled={auth.isLoading}>
              {auth.isLoading ? 'Please wait…' : register ? 'Create account' : 'Sign in'}
            </button>
          </form>
          <button className="quiet-button full-width" onClick={() => setRegister(!register)}>
            {register ? 'Already have an account? Sign in' : 'New here? Create an account'}
          </button>
          <button className="secondary-button full-width" onClick={auth.loginWithDiscord}>
            Continue with Discord
          </button>
        </>
      )}
    </RoomDialog>
  );
}

export function RulesPanel({ close }: { close: () => void }) {
  return (
    <RoomDialog title="A seat at the table." close={close}>
      <p>
        Play your hand. Beat the cards coming your way. Once the deck is empty, the first player out
        of cards wins. In teams, their whole team wins.
      </p>
      <div className="rules-grid">
        <div>
          <h3>A different deck</h3>
          <p>
            42 cards. Ranks rise from 7 through King, then 3, 2, Ace, Black Joker and Red Joker.
          </p>
        </div>
        <div>
          <h3>Beat it or pick up</h3>
          <p>
            Use a higher card of the same suit or a trump. Jokers beat ordinary cards; Red Joker
            beats Black Joker.
          </p>
        </div>
        <div>
          <h3>Keep it moving</h3>
          <p>
            Your successful defense becomes the next clockwise player’s attack. Pick up the whole
            table if you can’t defend.
          </p>
        </div>
        <div>
          <h3>Make a mass</h3>
          <p>
            Masses contain 3, 5 or 7 cards under our pairing rules. Select all your cards before
            confirming. The table checks legality.
          </p>
        </div>
        <div>
          <h3>Huzur</h3>
          <p>
            Swap a seven of trump while the deck remains. A Joker Huzur requires the Ace of Spades
            instead. A picked-up swap card cannot be used.
          </p>
        </div>
        <div>
          <h3>Out clean</h3>
          <p>
            Hands refill to five or seven. When the deck is empty, the first to shed their last card
            wins the game.
          </p>
        </div>
      </div>
      <button className="primary-button" onClick={close}>
        Got it. Let’s play.
      </button>
    </RoomDialog>
  );
}
