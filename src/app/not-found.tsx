import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Compass } from "lucide-react";

export default async function NotFound() {
  const t = await getTranslations("errors");
  return (
    <div className="container-page grid min-h-[60vh] place-items-center py-16 text-center">
      <div>
        <Compass className="mx-auto h-14 w-14 text-sage-400" aria-hidden="true" />
        <h1 className="mt-4 text-3xl font-bold">{t("notFoundTitle")}</h1>
        <p className="mt-2 muted">{t("notFoundBody")}</p>
        <Link href="/" className="btn btn-primary mt-6">
          {t("goHome")}
        </Link>
      </div>
    </div>
  );
}
