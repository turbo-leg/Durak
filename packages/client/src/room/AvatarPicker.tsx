import { AVATAR_PRESETS } from '@durak/shared';

export function AvatarPicker({
  value,
  change,
}: {
  value: string;
  change: (value: string) => void;
}) {
  return (
    <fieldset className="avatar-picker">
      <legend>Your character</legend>
      <div>
        {AVATAR_PRESETS.map((preset) => (
          <button
            type="button"
            key={preset.id}
            aria-label={`Choose ${preset.name} avatar`}
            aria-pressed={value === preset.id}
            onClick={() => change(preset.id)}
          >
            {preset.id === 'casual' ? (
              <img src="/models/casual/portrait.png" alt="" width="64" height="64" />
            ) : (
              <svg viewBox="0 0 64 64" aria-hidden="true">
                <rect width="64" height="64" rx="12" fill="#102330" />
                <ellipse cx="32" cy="65" rx="26" ry="25" fill={preset.shirt} />
                <rect x="27" y="37" width="10" height="15" rx="4" fill={preset.skin} />
                <ellipse cx="32" cy="27" rx="16" ry="20" fill={preset.skin} />
                <path
                  d={
                    preset.hairStyle === 1
                      ? 'M15 35V24C10 0 54 0 49 24V42L44 36V19L21 21V37Z'
                      : preset.hairStyle === 2
                        ? 'M14 23C7 12 19 5 24 8C29 0 39 5 40 8C53 6 58 21 47 25L43 16L21 18Z'
                        : 'M15 24C9 0 55 0 49 24L41 16L20 21Z'
                  }
                  fill={preset.hair}
                />
                <circle cx="26" cy="28" r="2" fill="#25303a" />
                <circle cx="38" cy="28" r="2" fill="#25303a" />
                <path d="M28 37Q32 40 36 37" fill="none" stroke="#885349" strokeWidth="1.5" />
              </svg>
            )}
            <span>{preset.name}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
