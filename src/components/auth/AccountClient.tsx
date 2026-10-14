"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useActionState, useEffect, useState } from "react";
import { BadgeCheck, BookMarked, Heart, Loader2, LogOut, Route, ShieldAlert, Trash2, UserRound } from "lucide-react";
import { useTravelStore } from "@/components/providers/TravelStoreProvider";
import { deleteAccountAction, updateProfileAction, type AuthResult } from "@/lib/auth/actions";

interface ProfileView {
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  email: string | null;
  emailConfirmed: boolean;
  providers: string[];
  memberSince: string;
}

export function AccountClient({ profile }: { profile: ProfileView }) {
  const t = useTranslations("auth");
  const store = useTravelStore();
  const [saveState, saveAction, saving] = useActionState<AuthResult | null, FormData>(updateProfileAction, null);
  const [delState, delAction, deleting] = useActionState<AuthResult | null, FormData>(deleteAccountAction, null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const saveFields = saveState && !saveState.ok ? saveState.fields ?? {} : {};

  useEffect(() => {
    if (delState?.ok && delState.redirectTo) window.location.assign(delState.redirectTo);
  }, [delState]);

  const counts = {
    trips: store.state.trips.length,
    wishlist: Object.keys(store.state.wishlist).length,
    visited: Object.keys(store.state.visits).length,
  };

  return (
    <div className="space-y-6">
      <section className="card flex flex-wrap items-center gap-4 p-6" aria-label={t("account")}>
        {profile.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.avatarUrl} alt="" width={64} height={64} className="h-16 w-16 rounded-full" referrerPolicy="no-referrer" />
        ) : (
          <span className="grid h-16 w-16 place-items-center rounded-full bg-forest-100 text-forest-700">
            <UserRound className="h-8 w-8" aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xl font-bold">{profile.displayName || profile.username || profile.email}</p>
          {profile.username && <p className="text-sm muted">@{profile.username}</p>}
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
            <span>{profile.email}</span>
            {profile.emailConfirmed ? (
              <span className="badge">
                <BadgeCheck className="h-3 w-3" aria-hidden="true" /> {t("emailVerified")}
              </span>
            ) : (
              <span className="badge bg-gold-soft text-[#6b4f12]">{t("emailNotVerified")}</span>
            )}
          </p>
          <p className="mt-1 text-xs muted">
            {t("signInMethods")}: {profile.providers.map((p) => (p === "google" ? "Google" : t("password"))).join(", ")} ·{" "}
            {t("memberSince", { date: profile.memberSince })}
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={store.signOut}>
          <LogOut className="h-4 w-4" aria-hidden="true" /> {t("signOut")}
        </button>
      </section>

      <section className="grid gap-3 sm:grid-cols-3" aria-label={t("myData")}>
        {(
          [
            ["/trips", t("myTrips"), counts.trips, Route],
            ["/wishlist", t("myWishlist"), counts.wishlist, Heart],
            ["/passport", t("myPassport"), counts.visited, BookMarked],
          ] as const
        ).map(([href, label, n, Icon]) => (
          <Link key={href} href={href} className="card flex items-center gap-3 p-4 hover:bg-forest-50">
            <Icon className="h-6 w-6 text-forest-600" aria-hidden="true" />
            <span className="flex-1 font-semibold">{label}</span>
            <span className="text-lg font-bold text-forest-800">{n}</span>
          </Link>
        ))}
      </section>

      <form action={saveAction} className="card space-y-4 p-6" noValidate>
        <h2 className="text-lg font-bold">{t("editProfile")}</h2>
        <div>
          <label htmlFor="username" className="label">
            {t("username")}
          </label>
          <input
            id="username"
            name="username"
            defaultValue={profile.username ?? ""}
            maxLength={20}
            autoCapitalize="none"
            className="input"
            aria-invalid={Boolean(saveFields.username)}
          />
          <p className="mt-1 text-xs muted">{profile.username ? t("usernameRules") : t("usernamePick")}</p>
          {saveFields.username && (
            <p className="mt-1 text-sm text-clay" role="alert">
              {t(`errors.${saveFields.username}`)}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="displayName" className="label">
            {t("displayName")}
          </label>
          <input id="displayName" name="displayName" defaultValue={profile.displayName ?? ""} maxLength={60} className="input" />
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {t("saveProfile")}
          </button>
          {saveState?.ok && (
            <span role="status" className="text-sm text-forest-700">
              {t("profileSaved")}
            </span>
          )}
          {saveState && !saveState.ok && saveState.error !== "invalid" && (
            <span role="alert" className="text-sm text-clay">
              {t(`errors.${saveState.error}`)}
            </span>
          )}
        </div>
      </form>

      <section className="card space-y-3 border-clay/30 p-6" aria-labelledby="danger">
        <h2 id="danger" className="flex items-center gap-2 text-lg font-bold text-clay">
          <ShieldAlert className="h-5 w-5" aria-hidden="true" /> {t("deleteAccount")}
        </h2>
        <p className="text-sm muted">{t("deleteAccountBody")}</p>
        {!confirmOpen ? (
          <button type="button" className="btn btn-secondary text-clay" onClick={() => setConfirmOpen(true)}>
            <Trash2 className="h-4 w-4" aria-hidden="true" /> {t("deleteAccount")}
          </button>
        ) : (
          <form action={delAction} className="space-y-3" role="alertdialog" aria-labelledby="danger">
            <label htmlFor="confirm" className="label">
              {t("deleteConfirmLabel")}
            </label>
            <input id="confirm" name="confirm" autoComplete="off" className="input" placeholder="DELETE" />
            {delState && !delState.ok && (
              <p role="alert" className="text-sm text-clay">
                {t(`errors.${delState.error === "invalid" ? "confirmDelete" : delState.error}`)}
              </p>
            )}
            <div className="flex gap-2">
              <button type="submit" className="btn btn-accent" disabled={deleting}>
                {deleting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {t("deleteForever")}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmOpen(false)}>
                {t("cancel")}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
