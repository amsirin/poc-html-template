// Node 16-compatible contract, rules, migration-boundary and template tests.
import assert from "assert/strict";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import Handlebars from "handlebars";
import {
  buildIppltViewModel,
  evaluateIppltRules,
} from "../src/ipplt/view-model.js";
import { adaptExstreamIpplt } from "../src/adapters/exstream-ipplt.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const fixture = (name) => JSON.parse(read(`data-samples/ipplt/${name}.json`));
const legacy = (name) =>
  JSON.parse(read(`data-samples/legacy/exstream/ipplt/${name}.json`));
const rules = (overrides) => {
  const input = fixture("single");
  Object.assign(input.refund, overrides);
  return evaluateIppltRules(input);
};
let passed = 0;
function test(name, check) {
  check();
  passed++;
  console.log(`PASS ${name}`);
}

test("all five native fixtures equal adapted legacy inputs", () => {
  for (const name of ["single", "multiple", "no-refund", "loan", "many-rows"]) {
    const { _note, ...native } = fixture(name);
    assert.deepEqual(native, adaptExstreamIpplt(legacy(name)));
  }
});
test("primary cases select expected sections", () => {
  const expected = {
    single: [true, false, false, false, false, true],
    multiple: [false, true, false, true, false, true],
    "no-refund": [false, false, false, false, false, false],
    loan: [true, false, true, false, true, true],
  };
  for (const [name, expectedFlags] of Object.entries(expected)) {
    const f = evaluateIppltRules(fixture(name));
    assert.deepEqual(
      [
        f.showSinglePayment,
        f.showMultiplePayments,
        f.showSingleCode,
        f.showMultipleCode,
        f.showLoan,
        f.showAgent,
      ],
      expectedFlags,
    );
  }
});
test("agent and loan rules retain exact empty-string behavior", () => {
  for (const text of ["", " "]) {
    const input = fixture("single");
    input.agent.fullName = text;
    input.application.loanAccountNumber = text;
    const flags = evaluateIppltRules(input);
    assert.equal(flags.showAgent, text !== "");
    assert.equal(flags.showLoan, text !== "");
  }
});
test("legacy address suppression stays in adapter; native lines pass through", () => {
  const input = legacy("single");
  Object.assign(input.source, {
    U_Addrs1: "-",
    U_Addrs2: "",
    U_Addrs3: "--",
    U_Addrs4: "-",
    U_Province_Long_Des: "",
    U_PostCode: "",
  });
  assert.deepEqual(adaptExstreamIpplt(input).recipient.address.lines, []);
  Object.assign(input.source, {
    U_Addrs1: " ",
    U_Addrs2: "A-B",
    U_Addrs3: "A-B",
    U_Addrs4: "",
    U_PostCode: "10000",
  });
  assert.deepEqual(adaptExstreamIpplt(input).recipient.address.lines, [
    " ",
    "A-B",
    "A-B ",
    " 10000",
  ]);
  const native = fixture("single");
  native.recipient.address.lines = ["-", "New line"];
  assert.deepEqual(buildIppltViewModel(native).recipient.addressLines, [
    "-",
    "New line",
  ]);
});
test("single reference eligibility retains method-code and count rules", () => {
  for (const methodCode of ["1", "B", "6"]) {
    assert.equal(
      rules({ methodCode, totalAmount: "0.00" }).showSingleCode,
      true,
    );
  }
  for (const methodCode of ["", "4", "b"])
    assert.equal(rules({ methodCode }).showSingleCode, false);
  assert.equal(
    rules({ methodCode: "1", paymentCount: 2 }).showSingleCode,
    false,
  );
});
test("batch reference needs count above one and a complete supplied reference", () => {
  assert.equal(
    rules({ paymentCount: 2, references: { single: "", batch: "" } })
      .showMultipleCode,
    false,
  );
  assert.equal(
    rules({
      paymentCount: 2,
      totalAmount: "0.00",
      references: { single: "", batch: "REF-1" },
    }).showMultipleCode,
    true,
  );
  const input = fixture("multiple");
  input.refund.references.batch = "PLATFORM-REF-001";
  assert.equal(buildIppltViewModel(input).multipleCode, "PLATFORM-REF-001");
});
test("refund branches distinguish zero, negative, positive and count zero", () => {
  for (const totalAmount of ["0.00", "-0.00", "-1.00"])
    for (const paymentCount of [0, 1, 2]) {
      const f = rules({ totalAmount, paymentCount });
      assert.deepEqual(
        [f.showSinglePayment, f.showMultiplePayments, f.showPaymentSpacing],
        [false, false, false],
      );
    }
  const f = rules({ totalAmount: "0.01", paymentCount: 0 });
  assert.deepEqual(
    [f.showSinglePayment, f.showMultiplePayments, f.showPaymentSpacing],
    [false, false, true],
  );
});
test("item objects preserve supplied numbering/order independently of count", () => {
  const input = fixture("multiple");
  input.refund.paymentCount = 3;
  input.refund.items[0].sequence = 7;
  input.refund.items[1].sequence = 3;
  const vm = buildIppltViewModel(input);
  assert.equal(vm.flags.showMultiplePayments, true);
  assert.deepEqual(
    vm.payment.rows.map((row) => row.number),
    [7, 3],
  );
  input.refund.items[0].description = undefined;
  assert.throws(() => buildIppltViewModel(input), /items\[0\].description/);
});
test("legacy adapter rejects misaligned arrays and invalid resolved values", () => {
  const input = legacy("multiple");
  input.source.U_Payment_Method_One_Template_List.pop();
  assert.throws(() => adaptExstreamIpplt(input), /arrays must align/);
  const invalid = legacy("single");
  invalid.source.U_Payment_Amount = 100;
  assert.throws(() => adaptExstreamIpplt(invalid), /decimal string/);
  const missing = legacy("single");
  delete missing.source.U_Addrs1;
  assert.throws(() => adaptExstreamIpplt(missing), /U_Addrs1/);
});
test("decimal formatting preserves precision without floating-point rounding", () => {
  const input = fixture("single");
  input.refund.totalAmount = "123456789012345.67";
  assert.equal(
    buildIppltViewModel(input).payment.amount,
    "123,456,789,012,345.67",
  );
});
test("native contract rejects invalid types, old envelopes and unknown fields", () => {
  for (const totalAmount of [null, 100, "", "1.234", "1e3", "1,000.00"]) {
    assert.throws(() => rules({ totalAmount }), /totalAmount/);
  }
  for (const paymentCount of [-1, 1.5, "1", NaN])
    assert.throws(() => rules({ paymentCount }), /paymentCount/);
  assert.throws(() => buildIppltViewModel(legacy("single")), /not supported/);
  for (const version of [undefined, "2.0"]) {
    const input = fixture("single");
    input.schemaVersion = version;
    assert.throws(() => buildIppltViewModel(input), /schemaVersion/);
  }
  const extra = fixture("single");
  extra.refund.ammount = "1.00";
  assert.throws(() => buildIppltViewModel(extra), /ammount is not supported/);
  const barcode = fixture("single");
  barcode.document.barcodeValue = "<script>";
  assert.throws(() => buildIppltViewModel(barcode), /barcodeValue/);
});

const hbs = Handlebars.create();
for (const name of ["page-header", "address-with-barcode"])
  hbs.registerPartial(name, read(`components/${name}.hbs`));
hbs.registerHelper(
  "barcode",
  () => new hbs.SafeString('<svg aria-label="test barcode"></svg>'),
);
const template = read("templates/ipplt.hbs");
const render = hbs.compile(template, { strict: true });
test("template uses semantic decisions and rows without source IDs or scripts", () => {
  const single = render(buildIppltViewModel(fixture("single")));
  const multi = render(buildIppltViewModel(fixture("multiple")));
  const zero = render(buildIppltViewModel(fixture("no-refund")));
  assert.ok(single.includes('data-rule="showSinglePayment"'));
  assert.ok(!single.includes('data-rule="showMultiplePayments"'));
  assert.equal((multi.match(/class="payment-row"/g) || []).length, 2);
  assert.ok(
    !zero.includes('data-rule="showSinglePayment"') &&
      !zero.includes('data-rule="showMultiplePayments"'),
  );
  assert.ok(!zero.includes('data-rule="showAgent"'));
  for (const html of [single, multi, zero])
    assert.ok(!/<script\b|data-rule="\d+"/i.test(html));
});
test("customer text is escaped and native/legacy inputs are not mutated", () => {
  const input = fixture("single");
  input.refund.description = '<img src=x onerror="alert(1)"> & text';
  const before = JSON.stringify(input);
  const html = render(buildIppltViewModel(input));
  assert.ok(html.includes("&lt;img"));
  assert.ok(!html.includes("<img src=x"));
  assert.equal(JSON.stringify(input), before);
  const old = legacy("single");
  const oldBefore = JSON.stringify(old);
  adaptExstreamIpplt(old);
  assert.equal(JSON.stringify(old), oldBefore);
});
test("forty native items render without script or pre-chunked pages", () => {
  const html = render(buildIppltViewModel(fixture("many-rows")));
  assert.equal((html.match(/class="payment-row"/g) || []).length, 40);
});
test("native runtime and fixtures have no legacy field names or adapter dependency", () => {
  for (const path of [
    "src/ipplt/contract.js",
    "src/ipplt/rules.js",
    "src/shared/formatters.js",
    "src/ipplt/view-model.js",
    "src/ipplt/run-example.js",
    "templates/ipplt.hbs",
    ...["single", "multiple", "loan", "no-refund", "many-rows"].map(
      (name) => `data-samples/ipplt/${name}.json`,
    ),
  ]) {
    assert.ok(
      !/\b(?:IL_DRV_|IL_U_|U_|V_FWD_)\w*|from ['"][^'"]*adapters\//.test(
        read(path),
      ),
      path,
    );
  }
  const vm = buildIppltViewModel(fixture("single"));
  assert.deepEqual(vm.ruleTrace, vm.flags);
});
console.log(
  `\n${passed} test groups passed (synthetic inputs; not Exstream equivalence).`,
);
