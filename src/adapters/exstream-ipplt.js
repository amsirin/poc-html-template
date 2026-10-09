// Migration boundary only. The native platform does not import this adapter.
import { validateIppltInput } from "../ipplt/contract.js";
const stringFields = [
  "U_Agent_Full_Name",
  "IL_DRV_AgentbranchCode",
  "IL_DRV_Agentbranchname",
  "U_Print_Date",
  "U_Owner_Name",
  "U_Addrs1",
  "U_Addrs2",
  "U_Addrs3",
  "U_Addrs4",
  "U_Province_Long_Des",
  "U_PostCode",
  "IL_DRV_ProductLine",
  "U_Payment_Amount_INT",
  "IL_DRV_PaymentMethodStr",
  "U_Payment_Amount_Draft",
  "IL_DRV_ApplicationNumber",
  "U_Insure_Name",
  "U_Plan_Name",
  "IL_U_LoanReferenceNumber",
  "U_Payment_Method_One_TemplateShow",
  "V_FWD_PhoneNumber",
];
const arrayFields = [
  "IL_DRV_PaymentDetail_PaymentMethod",
  "IL_DRV_No_List",
  "U_Payment_Method_One_Template_List",
];

function requireValue(condition, message) {
  if (!condition) throw new TypeError(`IPPLT: ${message}`);
}

export function validateSource(s) {
  requireValue(
    s && typeof s === "object" && !Array.isArray(s),
    "source must be an object",
  );
  for (const field of stringFields) {
    requireValue(
      typeof s[field] === "string",
      `${field} must be a string (empty is allowed)`,
    );
  }
  requireValue(
    Number.isSafeInteger(s.IL_DRV_Check_Multi_Payment) &&
      s.IL_DRV_Check_Multi_Payment >= 0,
    "payment count must be a nonnegative safe integer",
  );
  // Demo contract: decimal strings with exactly two digits, not JS floating-point money.
  // Source mask/rounding equivalence is not yet verified; this contract performs no rounding.
  requireValue(
    typeof s.U_Payment_Amount === "string" &&
      /^-?(?:0|[1-9]\d{0,14})\.\d{2}$/.test(s.U_Payment_Amount),
    'U_Payment_Amount must be a decimal string such as "12500.00"',
  );
  for (const field of arrayFields)
    requireValue(Array.isArray(s[field]), `${field} must be an array`);
  const length = s.IL_DRV_PaymentDetail_PaymentMethod.length;
  requireValue(
    arrayFields.every((field) => s[field].length === length),
    "payment arrays must align",
  );
  requireValue(
    s.IL_DRV_PaymentDetail_PaymentMethod.every((v) => typeof v === "string") &&
      s.U_Payment_Method_One_Template_List.every((v) => typeof v === "string"),
    "payment array values must be strings",
  );
  requireValue(
    s.IL_DRV_No_List.every((v) => Number.isSafeInteger(v) && v > 0),
    "row numbers must be positive integers",
  );
  // Intentionally do NOT equate IL_DRV_Check_Multi_Payment with array length.
}

export function adaptExstreamIpplt(input) {
  const s = input?.source;
  validateSource(s);
  const p = input.presentation;
  requireValue(
    p && typeof p === "object" && !Array.isArray(p),
    "presentation must be an object",
  );
  const result = {
    schemaVersion: "1.0",
    document: {
      dateText: s.U_Print_Date,
      reference: p.footerReference,
      barcodeValue: p.barcodeValue,
    },
    recipient: {
      fullName: s.U_Owner_Name,
      address: {
        lines: [
          ...(s.U_Addrs1 !== "" && s.U_Addrs1 !== "-" ? [s.U_Addrs1] : []),
          ...(s.U_Addrs2 !== "" && s.U_Addrs2 !== "-" ? [s.U_Addrs2] : []),
          // Preserve source suppression and displayed whitespace at this boundary.
          ...(s.U_Addrs3.split("-").join("") !== "" ||
          s.U_Addrs4.split("-").join("") !== ""
            ? [`${s.U_Addrs3} ${s.U_Addrs4}`]
            : []),
          ...(s.U_Province_Long_Des !== "" || s.U_PostCode !== ""
            ? [`${s.U_Province_Long_Des} ${s.U_PostCode}`]
            : []),
        ],
      },
    },
    application: {
      number: s.IL_DRV_ApplicationNumber,
      insuredName: s.U_Insure_Name,
      planName: s.U_Plan_Name,
      loanAccountNumber: s.IL_U_LoanReferenceNumber,
    },
    agent: {
      fullName: s.U_Agent_Full_Name,
      branch: {
        code: s.IL_DRV_AgentbranchCode,
        name: s.IL_DRV_Agentbranchname,
      },
    },
    refund: {
      totalAmount: s.U_Payment_Amount,
      paymentCount: s.IL_DRV_Check_Multi_Payment,
      methodCode: s.IL_DRV_PaymentMethodStr,
      references: {
        single: `NB_${s.IL_DRV_ProductLine}D${s.U_Payment_Amount_INT}`,
        // Empty source fragment means no batch reference; do not manufacture one.
        batch:
          s.U_Payment_Amount_Draft !== ""
            ? `NB_${s.IL_DRV_ProductLine}D${s.U_Payment_Amount_Draft}`
            : "",
      },
      description: s.U_Payment_Method_One_TemplateShow,
      items: s.IL_DRV_PaymentDetail_PaymentMethod.map((methodCode, i) => ({
        sequence: s.IL_DRV_No_List[i],
        methodCode,
        description: s.U_Payment_Method_One_Template_List[i],
      })),
    },
    contact: { phoneNumber: s.V_FWD_PhoneNumber },
  };
  validateIppltInput(result);
  return result;
}
