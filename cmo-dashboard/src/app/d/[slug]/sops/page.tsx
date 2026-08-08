import { Nav } from "@/components/Nav";
import { SopLibrary } from "@/components/SopLibrary";
import { resolveDashboard } from "@/lib/access";
import { allBlocks, countLinks, parseSopContent } from "@/lib/sops";

export const dynamic = "force-dynamic";

/**
 * The SOP library.
 *
 * The board this replaces was a flat list of title + link under a category, which meant
 * an SOP could only ever point somewhere else. Most of them are not a link — they are a
 * walkthrough with a video, the written steps beside it and a checklist you work
 * through — so the library is now the same block model the sales rep hub uses: sections
 * hold pages, pages hold blocks.
 *
 * Everything is on one page rather than behind tabs, with the section picked by a link
 * that scrolls to it. The count beside each heading is the point: an empty section is a
 * gap in the playbook, and tabs hid that.
 */
export default async function SopsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const context = await resolveDashboard(slug);
  const { dashboard, session } = context;

  const content = parseSopContent(dashboard.sopContent);
  const fill = countLinks(content);
  const blocks = allBlocks(content).length;

  return (
    <>
      <Nav session={session} dashboard={dashboard} context={context} />

      <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-6">
        <div className="mb-5">
          <h1 className="text-[22px] font-bold tracking-tight">SOPs</h1>
          <p className="mt-0.5 text-[13px] text-ink-secondary tabular">
            {blocks} {blocks === 1 ? "entry" : "entries"} across{" "}
            {content.sections.length}{" "}
            {content.sections.length === 1 ? "area" : "areas"}
            {fill.total > 0 && ` · ${fill.done}/${fill.total} links filled`}
          </p>
        </div>

        <SopLibrary
          content={content}
          dashboardSlug={slug}
          canEdit={context.canManage}
        />
      </main>
    </>
  );
}
