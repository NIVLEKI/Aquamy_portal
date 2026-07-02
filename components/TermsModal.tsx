// components/TermsModal.tsx
// Reusable terms-and-conditions modal. Opens on link click,
// scrollable body, closes on backdrop click or X button.
"use client";

import { useState } from "react";
import { X, ScrollText } from "lucide-react";

export default function TermsModal() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Trigger link — placed inline next to the checkbox in the register form */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[#1C4A2E] font-bold hover:underline underline-offset-2"
      >
        Terms and Conditions
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-xl w-full max-h-[85vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-stone-100 bg-stone-50/60 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <ScrollText size={16} className="text-stone-400" />
                <span className="text-sm font-black text-stone-800">
                  AQUAMY Membership Terms &amp; Conditions
                </span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-stone-400 hover:text-stone-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="px-6 py-5 overflow-y-auto flex-1 text-sm text-stone-600 leading-relaxed space-y-4">

              <section>
                <h3 className="font-bold text-stone-800 mb-1">1. Membership</h3>
                <p>
                  Membership in the Agricultural and Aquatic Muirungi Youth Self-Help Group
                  ("AQUAMY", "the Group") is open to individuals aged 18 to 35 who provide
                  accurate personal information, including a valid National Identification
                  number, at the point of registration. Membership is subject to approval by
                  the management committee and is not transferable.
                </p>
              </section>

              <section>
                <h3 className="font-bold text-stone-800 mb-1">2. Member Obligations</h3>
                <p>
                  Members agree to pay the registration fee, maintenance fee, and monthly
                  contributions as set by the Group's constitution and communicated through
                  the member portal. Late payments attract a penalty as defined in the current
                  fee schedule. Members are responsible for keeping their contact information
                  and National ID details accurate and up to date.
                </p>
              </section>

              <section>
                <h3 className="font-bold text-stone-800 mb-1">3. Loans and Guarantorship</h3>
                <p>
                  Members may apply for loans subject to the active loan policy, including
                  minimum membership duration, maximum loan amount, and required number of
                  guarantors. By accepting a guarantor request for another member's loan, a
                  member assumes personal liability for that loan's outstanding balance,
                  including any late penalties, in the event the borrower defaults.
                  Guarantor consent is binding once accepted through the portal.
                </p>
              </section>

              <section>
                <h3 className="font-bold text-stone-800 mb-1">4. Shares</h3>
                <p>
                  Members may purchase shares in the Group at the prevailing share price set
                  by the Treasurer. Share value may fluctuate based on the Group's financial
                  performance and is not guaranteed.
                </p>
              </section>

              <section>
                <h3 className="font-bold text-stone-800 mb-1">5. Discipline, Suspension, and Expulsion</h3>
                <p>
                  Members who breach the Group's constitution, including persistent default on
                  loan repayments or contributions, may be suspended or expelled following a
                  formal resolution by the management committee. Suspended or expelled members
                  forfeit access to the member portal but retain their right to recover any
                  vested shares per the constitution's exit procedure.
                </p>
              </section>

              <section>
                <h3 className="font-bold text-stone-800 mb-1">6. Data Privacy</h3>
                <p>
                  Personal information, including National ID numbers and phone numbers, is
                  collected solely for the purposes of member verification, financial record
                  keeping, and M-Pesa payment processing. This information will not be shared
                  with third parties outside of the Group's official financial and regulatory
                  obligations.
                </p>
              </section>

              <section>
                <h3 className="font-bold text-stone-800 mb-1">7. Amendments</h3>
                <p>
                  These terms may be amended from time to time by resolution of the management
                  committee. Continued use of the member portal after an amendment constitutes
                  acceptance of the updated terms.
                </p>
              </section>

              <p className="text-xs text-stone-400 pt-2 border-t border-stone-100">
                By checking the box on the registration form, you confirm that you have read,
                understood, and agree to be bound by these terms as a member of AQUAMY.
              </p>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-stone-100 flex-shrink-0">
              <button
                onClick={() => setOpen(false)}
                className="w-full bg-[#1C4A2E] hover:bg-[#153822] text-white font-bold py-2.5 rounded-lg transition-colors text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}