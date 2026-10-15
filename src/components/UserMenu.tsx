import { ROLE_LABEL, type User } from "../lib/auth";

type Props = {
  user: User | null;
  onLogin?: () => void;
  onLogout?: () => void;
};

// Pravá část hlavičky: kdo je přihlášený a „Odhlásit“, nebo „Přihlásit se“.
export default function UserMenu({ user, onLogin, onLogout }: Props) {
  if (!user) {
    return onLogin ? (
      <button className="btn small" onClick={onLogin}>
        Přihlásit se
      </button>
    ) : null;
  }
  return (
    <div className="user-menu">
      <span className="user-avatar" aria-hidden="true">
        {user.email.slice(0, 1).toUpperCase()}
      </span>
      <span className="user-id">
        <b title={user.email}>{user.email}</b>
        <small>{ROLE_LABEL[user.role]}</small>
      </span>
      {onLogout && (
        <button className="btn small" onClick={onLogout}>
          Odhlásit
        </button>
      )}
    </div>
  );
}
