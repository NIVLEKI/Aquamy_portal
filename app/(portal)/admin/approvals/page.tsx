// app/(portal)/admin/approvals/page.tsx
// Changes from original:
//   - Removed redundant handleApprove wrapper — revalidatePath now lives in approveMember()
//   - Removed member.middleName (not in schema) from the select query
//   - Added createdAt "Requested" date to each card
//   - Fixed type: pendingMembers is now properly typed, not `any`

import {
  getPendingMembers,
  approveMember,
} from "../../../actions/auth-actions";
import {
  CheckCircle2,
  Mail,
  Phone,
  Hash,
  UserPlus,
  Clock,
  CalendarDays,
} from "lucide-react";

export default async function AdminApprovalsPage() {
  const pendingMembers = await getPendingMembers();

  return (
    <div className="min-h-screen bg-[#F7F5F0] font-sans">
      <header className="bg-white border-b border-stone-200 px-6 lg:px-10 py-6 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-stone-900 tracking-tight">
              Pending Approvals
            </h1>
            <p className="text-sm text-stone-500 mt-1">
              Review and onboard new members requesting access to AQUAMY.
            </p>
          </div>
          {pendingMembers.length > 0 && (
            <span className="bg-amber-50 text-amber-700 border border-amber-200 text-sm font-bold px-3 py-1.5 rounded-full">
              {pendingMembers.length} pending
            </span>
          )}
        </div>
      </header>

      <main className="px-6 lg:px-10 py-8 max-w-5xl mx-auto">
        {pendingMembers.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-xl p-12 text-center flex flex-col items-center shadow-sm">
            <CheckCircle2 size={48} className="text-emerald-500 mb-4" />
            <h2 className="text-xl font-black text-stone-900">All Caught Up!</h2>
            <p className="text-sm text-stone-500 mt-2 max-w-sm">
              There are currently no pending membership requests.
              All members are verified and active.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {pendingMembers.map((member) => {
              // firstName/lastName come from the new schema columns.
              // Falls back to splitting `name` for members registered
              // before the migration added firstName/lastName columns.
              const displayFirst = member.firstName || member.name.split(" ")[0];
              const displayLast  = member.lastName  || member.name.split(" ").slice(-1)[0];
              const fullName     = member.firstName
                ? [member.firstName, member.lastName].filter(Boolean).join(" ")
                : member.name;

              const initials = `${displayFirst[0] ?? ""}${displayLast[0] ?? ""}`.toUpperCase();

              return (
                <div
                  key={member.id}
                  className="bg-white p-5 rounded-xl shadow-sm border border-stone-200 flex flex-col sm:flex-row justify-between sm:items-center gap-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className="w-12 h-12 rounded-full bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-600 font-bold text-sm flex-shrink-0">
                      {initials}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-lg text-stone-900 leading-none">
                          {fullName}
                        </h3>
                        <span className="flex items-center gap-1 bg-amber-50 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-200">
                          <Clock size={10} />
                          PENDING
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs text-stone-500">
                        {member.email && (
                          <div className="flex items-center gap-1.5">
                            <Mail size={13} className="text-stone-400" />
                            <span>{member.email}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <Phone size={13} className="text-stone-400" />
                          <span>{member.phone}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Hash size={13} className="text-stone-400" />
                          <span className="font-mono">{member.memberNumber}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <CalendarDays size={13} className="text-stone-400" />
                          <span>
                            Requested{" "}
                            {new Date(member.createdAt).toLocaleDateString("en-KE", {
                              day:   "numeric",
                              month: "short",
                              year:  "numeric",
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Approve form — action calls server action directly.
                      revalidatePath is handled inside approveMember(). */}
                  <form
                    action={async (formData) => {
                      "use server";
                      const userId = formData.get("userId") as string;
                      await approveMember(userId);
                    }}
                    className="sm:ml-auto w-full sm:w-auto"
                  >
                    <input type="hidden" name="userId" value={member.id} />
                    <button
                      type="submit"
                      className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#1C4A2E] hover:bg-[#153822] text-white px-6 py-2.5 rounded-lg text-sm font-bold transition-colors"
                    >
                      <UserPlus size={16} />
                      Approve Member
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}