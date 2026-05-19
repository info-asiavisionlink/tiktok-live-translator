import type { Comment } from "@/lib/types";

interface CommentPanelProps {
  comments: Comment[];
}

export function CommentPanel({ comments }: CommentPanelProps) {
  return (
    <section className="flex h-full max-h-[420px] flex-col rounded-2xl bg-white p-6 shadow-md shadow-slate-200/60 ring-1 ring-slate-100">
      <h2 className="text-xl font-bold tracking-tight text-slate-900">
        Comments
      </h2>
      <ul className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
        {comments.length === 0 ? (
          <li className="py-8 text-center text-slate-400">No comments yet</li>
        ) : (
          comments.map((comment) => (
            <li
              key={comment.id}
              className="rounded-xl border border-slate-100 bg-slate-50/80 p-4"
            >
              <p className="text-sm font-semibold text-rose-600">
                @{comment.username}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-800">
                {comment.original}
              </p>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
