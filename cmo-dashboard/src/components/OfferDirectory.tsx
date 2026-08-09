import { saveClientAssets } from "@/app/actions/sops";
import { isTileColor } from "@/lib/options";
import { parseSopContent } from "@/lib/sops";

import { BlockLibrary } from "./BlockLibrary";
import { LoginsDirectory, type LoginRow } from "./LoginsDirectory";
import { EmptyNote } from "./ui";

export type OfferEntry = {
  id: string;
  name: string;
  slug: string;
  color: string;
  assetsContent: unknown;
  logins: LoginRow[];
};

/**
 * The asset and login directories, on the main board.
 *
 * They belong to an offer, but making that mean "go into the client page" put two
 * clicks in front of the thing people open the board to find. So they sit here too, and
 * follow the board's existing client filter: pick an offer at the top and these narrow
 * to it, leave it on Everything and each offer gets its own labelled block.
 *
 * The client board renders the very same components — this is a different arrangement of
 * the same directory, not a second copy of it, so editing in either place is editing the
 * same rows.
 */
export function OfferDirectory({
  offers,
  kind,
  dashboardSlug,
  editable,
  presets = [],
}: {
  offers: OfferEntry[];
  kind: "assets" | "logins";
  dashboardSlug: string;
  editable: boolean;
  presets?: { service: string; url: string | null }[];
}) {
  if (offers.length === 0) {
    return (
      <EmptyNote>
        No offers yet — add a client and their {kind} live here.
      </EmptyNote>
    );
  }

  // With one offer on screen the heading is noise: the filter chip above already says
  // which one you are looking at.
  const labelled = offers.length > 1;

  return (
    <div className={labelled ? "space-y-5" : undefined}>
      {offers.map((offer) => (
        <section key={offer.id}>
          {labelled && (
            <h3 className="mb-2 flex items-center gap-2 text-[13px] font-bold tracking-tight">
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-full"
                style={{
                  background: isTileColor(offer.color)
                    ? `var(--tile-${offer.color})`
                    : "var(--border-subtle)",
                }}
              />
              {offer.name}
            </h3>
          )}

          {kind === "assets" ? (
            <BlockLibrary
              content={parseSopContent(offer.assetsContent)}
              save={saveClientAssets.bind(null, dashboardSlug, offer.slug)}
              canEdit={editable}
              canDelete={editable}
              emptyNote={`No assets filed for ${offer.name} yet.`}
            />
          ) : (
            <LoginsDirectory
              logins={offer.logins}
              clientId={offer.id}
              clientName={offer.name}
              dashboardSlug={dashboardSlug}
              editable={editable}
              presets={presets}
              offers={offers.map((o) => ({ id: o.id, name: o.name }))}
            />
          )}
        </section>
      ))}
    </div>
  );
}
