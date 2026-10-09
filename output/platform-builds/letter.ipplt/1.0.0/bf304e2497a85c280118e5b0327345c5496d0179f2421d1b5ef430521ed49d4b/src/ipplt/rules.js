// Business decisions for IPPLT. Rendering and formatting are separate.
import { validateIppltInput } from './contract.js';

export function evaluateIppltRules(input) {
  validateIppltInput(input);
  const refund = input.refund;
  const positive = BigInt(refund.totalAmount.replace('.', '')) > 0n;
  // Method codes remain the existing business code set. Do not invent enum
  // meanings where a complete code dictionary has not been supplied.
  return {
    showAgent: input.agent.fullName !== '',
    showSingleCode: refund.paymentCount === 1 && ['1', 'B', '6'].includes(refund.methodCode),
    showMultipleCode: refund.paymentCount > 1 && refund.references.batch !== '',
    showLoan: input.application.loanAccountNumber !== '',
    showSinglePayment: positive && refund.paymentCount === 1,
    showMultiplePayments: positive && refund.paymentCount > 1,
    showPaymentSpacing: positive,
  };
}

