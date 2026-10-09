// Platform input contract v1. No source-system field names or presentation flags.
export function requireValue(condition, message) {
  if (!condition) throw new TypeError(`IPPLT: ${message}`);
}
function object(value, path, keys) {
  requireValue(
    value && typeof value === "object" && !Array.isArray(value),
    `${path} must be an object`,
  );
  for (const key of Object.keys(value))
    requireValue(keys.includes(key), `${path}.${key} is not supported`);
}
function strings(value, path, keys) {
  for (const key of keys)
    requireValue(
      typeof value[key] === "string",
      `${path}.${key} must be a string`,
    );
}
export function validateIppltInput(input) {
  object(input, "input", [
    "schemaVersion",
    "_note",
    "document",
    "recipient",
    "application",
    "agent",
    "refund",
    "contact",
  ]);
  requireValue(input.schemaVersion === "1.0", 'schemaVersion must be "1.0"');
  if ("_note" in input)
    requireValue(typeof input._note === "string", "_note must be a string");
  object(input.document, "document", ["dateText", "reference", "barcodeValue"]);
  strings(input.document, "document", [
    "dateText",
    "reference",
    "barcodeValue",
  ]);
  requireValue(
    /^[A-Z0-9-]{1,24}$/.test(input.document.barcodeValue),
    "document.barcodeValue must contain 1-24 uppercase letters, digits or hyphens",
  );
  object(input.recipient, "recipient", ["fullName", "address"]);
  strings(input.recipient, "recipient", ["fullName"]);
  object(input.recipient.address, "recipient.address", ["lines"]);
  requireValue(
    Array.isArray(input.recipient.address.lines) &&
      input.recipient.address.lines.every((line) => typeof line === "string"),
    "recipient.address.lines must be an array of strings",
  );
  const applicationFields = [
    "number",
    "insuredName",
    "planName",
    "loanAccountNumber",
  ];
  object(input.application, "application", applicationFields);
  strings(input.application, "application", applicationFields);
  object(input.agent, "agent", ["fullName", "branch"]);
  strings(input.agent, "agent", ["fullName"]);
  object(input.agent.branch, "agent.branch", ["code", "name"]);
  strings(input.agent.branch, "agent.branch", ["code", "name"]);
  object(input.contact, "contact", ["phoneNumber"]);
  strings(input.contact, "contact", ["phoneNumber"]);
  const refund = input.refund;
  object(refund, "refund", [
    "totalAmount",
    "paymentCount",
    "methodCode",
    "references",
    "description",
    "items",
  ]);
  strings(refund, "refund", ["totalAmount", "methodCode", "description"]);
  requireValue(
    /^-?(?:0|[1-9]\d{0,14})\.\d{2}$/.test(refund.totalAmount),
    'refund.totalAmount must be a decimal string such as "12500.00"',
  );
  requireValue(
    Number.isSafeInteger(refund.paymentCount) && refund.paymentCount >= 0,
    "refund.paymentCount must be a nonnegative safe integer",
  );
  object(refund.references, "refund.references", ["single", "batch"]);
  strings(refund.references, "refund.references", ["single", "batch"]);
  requireValue(Array.isArray(refund.items), "refund.items must be an array");
  refund.items.forEach((item, i) => {
    const path = `refund.items[${i}]`;
    object(item, path, ["sequence", "methodCode", "description"]);
    strings(item, path, ["methodCode", "description"]);
    requireValue(
      Number.isSafeInteger(item.sequence) && item.sequence > 0,
      `${path}.sequence must be a positive integer`,
    );
  });
  // paymentCount is a supplied business value, not inferred from items.length.
}
