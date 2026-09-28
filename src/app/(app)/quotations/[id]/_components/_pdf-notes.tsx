// Notes and bank details for the quotation PDF — the left half of the
// block beside the total (see totalRow in _pdf-styles.ts).
//
// Owner request, 2026-09-28: tick notes such as "Transportation extra" or
// the delivery period on a quotation, and print the studio's bank account
// the way the paper quotations do ("Company's Bank Details", Bank Name,
// A/c No., Branch & IFS Code). Kept out of QuotePdf.tsx so that file stays
// the arrangement rather than the detail.

import { View, Text } from "@react-pdf/renderer";
import type { Narration } from "@/modules/quotations/narrations";
import { hasBankDetails, branchAndIfsc, type BankDetails } from "@/modules/admin/bank-details";
import { pdfStyles as s } from "./_pdf-styles";

export function PdfNotesAndBank({
  narrations, bank,
}: { narrations: Narration[]; bank: BankDetails | null | undefined }) {
  const showBank = hasBankDetails(bank);
  if (narrations.length === 0 && !showBank) return null;

  return (
    <View>
      {narrations.length > 0 && (
        <View style={{ marginBottom: showBank ? 6 : 0 }}>
          <Text style={s.notesHead}>NOTE</Text>
          {narrations.map((n) => (
            <View key={n.key} style={s.noteRow} wrap={false}>
              <Text style={s.noteBullet}>•</Text>
              <Text style={s.noteText}>
                {n.label ? <Text style={s.noteLabel}>{n.label}: </Text> : null}
                {n.text}
              </Text>
            </View>
          ))}
        </View>
      )}

      {showBank && (
        <View style={s.bankBox} wrap={false}>
          <Text style={s.notesHead}>{"COMPANY'S BANK DETAILS"}</Text>
          {bank.accountName !== "" && <BankRow k="Account Name" v={bank.accountName} />}
          <BankRow k="Bank Name" v={bank.bankName} />
          <BankRow k="A/c No." v={bank.accountNumber} />
          {branchAndIfsc(bank) !== "" && <BankRow k="Branch & IFS Code" v={branchAndIfsc(bank)} />}
        </View>
      )}
    </View>
  );
}

function BankRow({ k, v }: { k: string; v: string }) {
  return (
    <View style={s.bankRow}>
      <Text style={s.bankKey}>{k}</Text>
      <Text style={s.bankValue}>{v}</Text>
    </View>
  );
}
