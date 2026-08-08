import Link from "next/link";

import {
  createCategory,
  createSop,
  deleteCategory,
  deleteSop,
  updateSop,
} from "@/app/actions/sops";
import { DangerButton } from "@/components/DangerButton";
import { Nav } from "@/components/Nav";
import {
  EmptyNote,
  ghostButtonClass,
  inputClass,
  primaryButtonClass,
} from "@/components/ui";
import { requireSession } from "@/lib/access";
import { sessionCanEdit } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { safeHref } from "@/lib/links";

export const dynamic = "force-dynamic";

/**
 * The SOP directory.
 *
 * The board this replaces used tabs, which meant eight of nine categories were always
 * hidden and nobody could see how thin one of them had got. Everything is on one page
 * here, with the category picked by a link that scrolls to it — the count beside each
 * heading is the point: an empty category is a gap in the playbook.
 */
export default async function SopsPage() {
  const session = await requireSession();
  const editable = sessionCanEdit(session);

  const categories = await prisma.sopCategory.findMany({
    orderBy: [{ position: "asc" }, { name: "asc" }],
    include: {
      sops: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] },
    },
  });

  const total = categories.reduce((sum, c) => sum + c.sops.length, 0);

  return (
    <>
      <Nav session={session} />

      <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-6">
        <div className="mb-5">
          <h1 className="text-[22px] font-bold tracking-tight">SOPs</h1>
          <p className="mt-0.5 text-[13px] text-ink-secondary tabular">
            {total} {total === 1 ? "procedure" : "procedures"} across{" "}
            {categories.length} {categories.length === 1 ? "area" : "areas"}.
          </p>
        </div>

        {categories.length > 1 && (
          <nav className="scroll-x mb-6 flex gap-1.5 pb-1">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`#${category.id}`}
                className="shrink-0 rounded-full border border-subtle px-2.5 py-1 text-[12px] font-semibold text-ink-secondary transition-colors hover:border-strong hover:text-ink"
              >
                {category.name}
                <span className="ml-1 text-ink-muted tabular">
                  {category.sops.length}
                </span>
              </Link>
            ))}
          </nav>
        )}

        <div className="space-y-8">
          {categories.map((category) => (
            <section key={category.id} id={category.id} className="scroll-mt-20">
              <div className="mb-2 flex items-end justify-between gap-3">
                <h2 className="text-[15px] font-bold tracking-tight">
                  {category.name}
                  <span className="ml-2 text-[13px] font-semibold text-ink-muted tabular">
                    {category.sops.length}
                  </span>
                </h2>

                {editable && (
                  <form action={deleteCategory}>
                    <input type="hidden" name="id" value={category.id} />
                    <DangerButton
                      confirm={`Delete "${category.name}" and its ${category.sops.length} SOPs? This cannot be undone.`}
                      className="text-[12px] font-semibold text-ink-muted transition-colors hover:text-critical"
                    >
                      Delete area
                    </DangerButton>
                  </form>
                )}
              </div>

              <div className="overflow-hidden rounded-xl border border-subtle bg-surface">
                {category.sops.length === 0 && !editable && (
                  <div className="px-3">
                    <EmptyNote>Nothing documented here yet.</EmptyNote>
                  </div>
                )}

                {category.sops.map((sop) => {
                  const href = sop.url ? safeHref(sop.url) : null;

                  return (
                    <div
                      key={sop.id}
                      className="border-t border-subtle first:border-t-0"
                    >
                      <div className="flex items-center gap-2 px-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold">
                            {sop.title}
                          </p>
                          {sop.objective && sop.objective !== sop.title && (
                            <p className="truncate text-[12px] text-ink-muted">
                              {sop.objective}
                            </p>
                          )}
                        </div>

                        {href ? (
                          <a
                            href={href}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="shrink-0 text-[12px] font-semibold text-accent underline-offset-2 hover:underline"
                          >
                            Open ↗
                          </a>
                        ) : (
                          <span className="shrink-0 text-[12px] text-ink-muted">
                            No doc linked
                          </span>
                        )}
                      </div>

                      {sop.summary && (
                        <p className="px-3 pb-2.5 text-[12px] text-ink-secondary">
                          {sop.summary}
                        </p>
                      )}

                      {editable && (
                        <details className="group px-3 pb-2.5">
                          <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-[12px] font-semibold text-ink-muted transition-colors hover:text-ink">
                            <span className="transition-transform group-open:rotate-90">
                              ›
                            </span>
                            Edit
                          </summary>

                          <form action={updateSop} className="mt-2 space-y-2">
                            <input type="hidden" name="id" value={sop.id} />
                            <input
                              type="hidden"
                              name="categoryId"
                              value={category.id}
                            />
                            <div className="flex flex-wrap gap-2">
                              <input
                                name="title"
                                defaultValue={sop.title}
                                required
                                aria-label="Title"
                                className={`${inputClass} flex-1`}
                              />
                              <input
                                name="objective"
                                defaultValue={sop.objective ?? ""}
                                placeholder="Objective"
                                aria-label="Objective"
                                className={`${inputClass} flex-1`}
                              />
                            </div>
                            <input
                              name="url"
                              defaultValue={sop.url ?? ""}
                              placeholder="https://… link to the document"
                              aria-label="Document link"
                              className={inputClass}
                            />
                            <textarea
                              name="summary"
                              defaultValue={sop.summary ?? ""}
                              rows={2}
                              placeholder="What this covers"
                              aria-label="Summary"
                              className={inputClass}
                            />
                            <div className="flex gap-2">
                              <button type="submit" className={ghostButtonClass}>
                                Save
                              </button>
                              <button
                                type="submit"
                                formAction={deleteSop}
                                className="rounded-full px-3 py-2 text-[13px] font-semibold text-ink-muted transition-colors hover:text-critical"
                              >
                                Delete
                              </button>
                            </div>
                          </form>
                        </details>
                      )}
                    </div>
                  );
                })}

                {editable && (
                  <form
                    action={createSop}
                    className="flex flex-wrap items-center gap-2 border-t border-subtle p-2"
                  >
                    <input type="hidden" name="categoryId" value={category.id} />
                    <input
                      name="title"
                      required
                      placeholder="New SOP title"
                      aria-label="New SOP title"
                      className={`${inputClass} min-w-40 flex-1`}
                    />
                    <input
                      name="url"
                      placeholder="Link (optional)"
                      aria-label="Link"
                      className={`${inputClass} min-w-40 flex-1`}
                    />
                    <button type="submit" className={ghostButtonClass}>
                      Add
                    </button>
                  </form>
                )}
              </div>
            </section>
          ))}
        </div>

        {editable && (
          <form
            action={createCategory}
            className="mt-8 flex flex-wrap items-center gap-2"
          >
            <input
              name="name"
              required
              maxLength={60}
              placeholder="New area — e.g. Email, Partnerships"
              aria-label="New area"
              className={`${inputClass} max-w-xs flex-1`}
            />
            <button type="submit" className={primaryButtonClass}>
              Add area
            </button>
          </form>
        )}
      </main>
    </>
  );
}
