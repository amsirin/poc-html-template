// Standard platform input -> business decisions -> template presentation model.
import { evaluateIppltRules } from './rules.js';
import { formatAmount } from '../shared/formatters.js';
export { evaluateIppltRules } from './rules.js';


export function buildIppltViewModel(input) {
  const flags = evaluateIppltRules(input);
  return {
    subject: 'แจ้งเลื่อนการพิจารณาใบคำขอเอาประกันชีวิต',
    company: {
      name: 'บริษัท เอฟดับบลิวดี ประกันชีวิต จำกัด (มหาชน)',
      headerImagePath: '../assets/pos-zlbnchg/header-banner.png',
    },
    printDate: input.document.dateText,
    recipient: {
      title: '', postcode: '',
      name: input.recipient.fullName,
      addressLines: [...input.recipient.address.lines],
    },
    barcode: { value: input.document.barcodeValue, displayText: `*${input.document.barcodeValue}*` },
    flags,
    singleCode: input.refund.references.single,
    multipleCode: input.refund.references.batch,
    application: {
      number: input.application.number, insured: input.application.insuredName,
      plan: input.application.planName, loanReference: input.application.loanAccountNumber,
    },
    payment: {
      amount: formatAmount(input.refund.totalAmount), detail: input.refund.description,
      rows: input.refund.items.map(item => ({ number: item.sequence, detail: item.description })),
    },
    agent: { name: input.agent.fullName, branchCode: input.agent.branch.code, branchName: input.agent.branch.name },
    phoneNumber: input.contact.phoneNumber,
    footerReference: input.document.reference,
    ruleTrace: { ...flags },
  };
}
