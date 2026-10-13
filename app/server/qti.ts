import JSZip from "jszip";
import sanitize from "sanitize-html";
import path from "node:path";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import {
  newQuestion,
  errorsFor,
  type Question,
  type TestDoc,
} from "../src/domain.js";
import { cleanRichText } from "./content.js";
import type { ImportReport } from "./interchange.js";
type Node = Record<string, unknown>;
const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  parseTagValue: false,
  parseAttributeValue: false,
});
const array = <T>(v: T | T[] | undefined): T[] =>
  v === undefined ? [] : Array.isArray(v) ? v : [v];
const node = (v: unknown): Node =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Node) : {};
const text = (v: unknown): string =>
  typeof v === "string"
    ? v
    : typeof v === "number"
      ? String(v)
      : Array.isArray(v)
        ? v.map(text).join(" ")
        : Object.entries(node(v))
            .filter(([k]) => !k.startsWith("@_"))
            .map(([, v]) => text(v))
            .join(" ")
            .trim();
function find(v: unknown, key: string): unknown[] {
  if (Array.isArray(v)) return v.flatMap((x) => find(x, key));
  if (!v || typeof v !== "object") return [];
  return Object.entries(v).flatMap(([k, x]) =>
    k === key ? array(x) : k.startsWith("@_") ? [] : find(x, key),
  );
}
function publicBody(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(publicBody);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !["rubricBlock", "modalFeedback"].includes(key))
      .map(([key, v]) => [key, publicBody(v)]),
  );
}
function xml(source: string) {
  if (
    /<!DOCTYPE|<!ENTITY/i.test(source) ||
    XMLValidator.validate(source) !== true
  )
    throw new Error("Invalid or unsafe QTI XML.");
  return parser.parse(source) as Node;
}
const escape = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
const namespace = "http://www.imsglobal.org/xsd/imsqti_v2p1";
function processing(marks: number) {
  return `<responseProcessing><responseCondition><responseIf><match><variable identifier="RESPONSE"/><correct identifier="RESPONSE"/></match><setOutcomeValue identifier="SCORE"><baseValue baseType="float">${marks}</baseValue></setOutcomeValue></responseIf><responseElse><setOutcomeValue identifier="SCORE"><baseValue baseType="float">0</baseValue></setOutcomeValue></responseElse></responseCondition></responseProcessing>`;
}
function supportedScore(item: Node): number | null {
  const p = node(item.responseProcessing);
  const template = String(p["@_template"] || "");
  if (
    [
      "http://www.imsglobal.org/question/qti_v2p1/rptemplates/match_correct",
      "https://www.imsglobal.org/question/qti_v2p1/rptemplates/match_correct",
    ].includes(template)
  )
    return 1;
  if (!Object.keys(p).length) return null;
  const condition = node(p.responseCondition),
    yes = node(condition.responseIf),
    setter = node(yes.setOutcomeValue),
    base = node(setter.baseValue);
  const score = Number(base["#text"]);
  if (!Number.isFinite(score) || score < 0 || score > 1000) return null;
  const expected = xml(`<root>${processing(score)}</root>`);
  if (
    JSON.stringify(p) !== JSON.stringify(node(expected.root).responseProcessing)
  )
    return null;
  return score;
}
export async function readQtiItem(
  source: string,
  zip?: JSZip,
  filename = "item.xml",
): Promise<ImportReport> {
  const r: ImportReport = { questions: [], warnings: [], errors: [] };
  const root = xml(source);
  const item = node(root.assessmentItem);
  if (!("assessmentItem" in root))
    throw new Error("Expected a QTI assessmentItem.");
  const unstripped = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: false,
  }).parse(source);
  const rootKey =
    Object.keys(unstripped).find(
      (k) => k === "assessmentItem" || k.endsWith(":assessmentItem"),
    ) || "";
  const prefix = rootKey.includes(":") ? rootKey.split(":")[0] : "";
  const declared = node(unstripped[rootKey])[
    prefix ? "@_xmlns:" + prefix : "@_xmlns"
  ];
  if (declared !== namespace)
    throw new Error("Only the QTI 2.1 namespace is supported in this release.");
  if (item["@_adaptive"] === "true")
    throw new Error("Adaptive QTI items are not supported.");
  const body = node(item.itemBody);
  const interactions = Object.keys(body)
    .filter((k) => k.endsWith("Interaction"))
    .flatMap((k) =>
      array(body[k]).map((value) => ({ kind: k, value: node(value) })),
    );
  for (const k of ["inlineChoiceInteraction", "textEntryInteraction"])
    if (!interactions.some((x) => x.kind === k))
      find(body, k).forEach((value) =>
        interactions.push({ kind: k, value: node(value) }),
      );
  if (interactions.length !== 1)
    throw new Error(
      "This QTI adapter requires one interaction per item. Composite/custom interactions are not supported.",
    );
  const interaction = interactions[0],
    declarations = array(item.responseDeclaration).map(node);
  if (
    declarations.length !== 1 ||
    interaction.value["@_responseIdentifier"] !==
      declarations[0]["@_identifier"]
  )
    throw new Error("Ambiguous QTI response declarations.");
  const declaration = declarations[0];
  if (declaration.mapping || declaration.areaMapping)
    throw new Error("Mapped or partial-credit QTI scoring is not supported.");
  const correct = array(node(declaration.correctResponse).value).map(text);
  const q = newQuestion();
  r.warnings.push(
    "QTI formatting is converted to plain text on import; review paragraph and list formatting.",
  );
  q.category = "";
  const safeBody = node(publicBody(body));
  const stem = Object.entries(safeBody)
    .filter(
      ([key]) =>
        !key.startsWith("@_") &&
        !key.endsWith("Interaction") &&
        key !== "rubricBlock",
    )
    .map(([, v]) => text(v))
    .join(" ")
    .trim();
  q.text = [stem, text(interaction.value.prompt)].filter(Boolean).join("\n");
  const kind = interaction.kind;
  const score = supportedScore(item);
  if (kind !== "extendedTextInteraction" && score === null)
    throw new Error(
      "This QTI scoring rule is not a supported all-or-nothing rule.",
    );
  q.marks =
    score ??
    Number(
      node(
        array(item.outcomeDeclaration).find(
          (v) => node(v)["@_identifier"] === "SCORE",
        ),
      )["@_normalMaximum"] || 1,
    );
  if (["choiceInteraction", "inlineChoiceInteraction"].includes(kind)) {
    const choices = array(
      interaction.value[
        kind === "choiceInteraction" ? "simpleChoice" : "inlineChoice"
      ],
    ).map(node);
    q.type = kind === "inlineChoiceInteraction" ? "selection" : "multiple";
    q.choices = choices.map((c) => ({
      id: crypto.randomUUID(),
      text: text(
        Object.fromEntries(
          Object.entries(c).filter(([key]) => !key.startsWith("@_")),
        ),
      ),
      correct: correct.includes(String(c["@_identifier"])),
      locked: c["@_fixed"] === "true",
    }));
    if (kind === "inlineChoiceInteraction") {
      q.text = stem + " ___";
      r.warnings.push(
        `${item["@_title"]}: the inline choice is placed at the end of the prompt; check its position.`,
      );
    }
    if (
      declaration["@_cardinality"] === "single" &&
      q.choices.filter((c) => c.correct).length !== 1
    )
      throw new Error("Invalid single-answer QTI key.");
  } else if (kind === "orderInteraction") {
    q.type = "ordering";
    const choices = array(interaction.value.simpleChoice).map(node);
    q.pairs = correct.map((id) => {
      const c = choices.find((c) => c["@_identifier"] === id);
      if (!c) throw new Error("Missing order choice.");
      return {
        id: crypto.randomUUID(),
        left: text(
          Object.fromEntries(
            Object.entries(c).filter(([key]) => !key.startsWith("@_")),
          ),
        ),
        right: "",
      };
    });
  } else if (kind === "extendedTextInteraction") {
    q.type = "essay";
    q.answer = find(body, "rubricBlock")
      .filter((x) =>
        String(node(x)["@_view"] || "")
          .split(/\s+/)
          .includes("scorer"),
      )
      .map(text)
      .join("\n");
    if (item.responseProcessing)
      throw new Error("Automatic extended-text QTI scoring is not supported.");
  } else if (kind === "textEntryInteraction") {
    if (declaration["@_baseType"] !== "string" || correct.length !== 1)
      throw new Error(
        "Only a single accepted string text-entry response is supported.",
      );
    q.type = "short";
    q.manual = false;
    q.answer = correct[0];
    q.text = stem + " ___";
    r.warnings.push(
      "Text-entry grading is case-insensitive after import; review this change.",
    );
  } else
    throw new Error(
      `QTI interaction ${kind} is not supported by this adapter yet.`,
    );
  if (find(body, "modalFeedback").length || item.modalFeedback)
    r.warnings.push("QTI conditional feedback is not imported.");
  const images = [
    ...find(safeBody, "img").map(node),
    ...find(safeBody, "object")
      .map(node)
      .filter((n) => String(n["@_type"]).startsWith("image/")),
  ];
  for (const [i, img] of images.entries()) {
    const href = String(img["@_src"] || img["@_data"] || "");
    if (i > 0) {
      r.warnings.push("Only the first QTI picture is imported.");
      break;
    }
    const relative = path.posix.normalize(
      path.posix.join(path.posix.dirname(filename), href),
    );
    if (/^(https?:|data:|\/)/i.test(href) || relative.startsWith("../")) {
      r.warnings.push("External QTI picture was not fetched.");
      continue;
    }
    const file = zip?.file(relative);
    if (!file) {
      r.warnings.push(`Missing picture: ${href}.`);
      continue;
    }
    const extension = relative.split(".").at(-1)?.toLowerCase();
    const mime = extension === "jpg" ? "jpeg" : extension;
    if (!["png", "jpeg", "gif", "webp"].includes(mime || "")) {
      r.warnings.push(`Unsupported picture: ${href}.`);
      continue;
    }
    const bytes = await file.async("nodebuffer");
    if (bytes.length > 2500000) throw new Error("QTI image exceeds 2.5 MB.");
    q.image = `data:image/${mime};base64,${bytes.toString("base64")}`;
    q.imageAlt = String(img["@_alt"] || "");
  }
  if (item["@_title"])
    r.warnings.push(
      `QTI title “${item["@_title"]}” is not stored as a separate question title.`,
    );
  const problems = errorsFor(q);
  if (problems.length) r.errors.push(...problems);
  else r.questions.push(q);
  return r;
}
export async function readQtiPackage(zip: JSZip): Promise<ImportReport> {
  const manifest = zip.file("imsmanifest.xml");
  if (!manifest)
    throw new Error("Expected imsmanifest.xml in this QTI package.");
  const root = xml(await manifest.async("string"));
  const resources = array(node(node(root.manifest).resources).resource).map(
    node,
  );
  const r: ImportReport = {
    questions: [],
    warnings: [
      "QTI 2.1 subset: review imported text, pictures, scoring and skipped interactions. Test layout and delivery settings are not imported.",
    ],
    errors: [],
  };
  let itemFiles = resources
    .filter((resource) => resource["@_type"] === "imsqti_item_xmlv2p1")
    .map((resource) => String(resource["@_href"] || ""));
  const testResource = resources.find(
    (resource) => resource["@_type"] === "imsqti_test_xmlv2p1",
  );
  if (testResource) {
    const href = String(testResource["@_href"]);
    const file = zip.file(href);
    if (!file) throw new Error("Missing QTI test resource.");
    const test = xml(await file.async("string"));
    const refs = find(test, "assessmentItemRef").map(node);
    itemFiles = refs.map((ref) =>
      path.posix.normalize(
        path.posix.join(path.posix.dirname(href), String(ref["@_href"])),
      ),
    );
    r.title = String(
      node(test.assessmentTest)["@_title"] || "Imported QTI test",
    );
  }
  if (!itemFiles.length)
    throw new Error("No QTI 2.1 item resources were found.");
  for (const href of itemFiles) {
    try {
      if (/^(https?:|\/)/i.test(href) || href.startsWith("../"))
        throw new Error("Unsafe or remote resource reference.");
      const item = zip.file(href);
      if (!item) throw new Error("Missing item file.");
      const result = await readQtiItem(await item.async("string"), zip, href);
      r.questions.push(...result.questions);
      r.warnings.push(...result.warnings);
      r.errors.push(...result.errors.map((e) => `${href}: ${e}`));
    } catch (e) {
      r.errors.push(`${href}: ${(e as Error).message}`);
    }
  }
  return r;
}
export async function qtiPackage(
  test: Pick<TestDoc, "title" | "questions">,
): Promise<{ buffer: Buffer; warnings: string[] }> {
  const zip = new JSZip(),
    warnings: string[] = [],
    resources: string[] = [],
    refs: string[] = [];
  for (const [i, q] of test.questions.entries()) {
    if (
      ![
        "multiple",
        "truefalse",
        "checklist",
        "ordering",
        "essay",
        "short",
      ].includes(q.type) ||
      (q.type === "short" && !q.manual)
    ) {
      warnings.push(
        `Question ${i + 1} (${q.type}): this QTI adapter cannot preserve its scoring; omitted. Use the native package.`,
      );
      continue;
    }
    const id = `cp_${i + 1}`,
      file = `items/${id}.xml`;
    let image = "";
    const assets: string[] = [];
    if (q.image) {
      const m = q.image.match(/^data:image\/(png|jpeg|gif|webp);base64,(.*)$/s);
      if (m) {
        const asset = `assets/${id}.${m[1]}`;
        zip.file(asset, m[2], { base64: true });
        assets.push(asset);
        image = `<p><img src="../${asset}" alt="${escape(q.imageAlt || "Question illustration")}"/></p>`;
      }
    }
    if (q.group || q.category || q.notes || q.choiceLimit)
      warnings.push(
        `Question ${i + 1}: category, grouping, notes and random choice limits are not carried by this QTI export.`,
      );
    const essay = q.type === "essay" || q.type === "short";
    const multi = q.choices.filter((c) => c.correct).length > 1;
    const order = q.type === "ordering";
    const values = essay
      ? ""
      : order
        ? q.pairs.map((_p, j) => `<value>C${j}</value>`).join("")
        : q.choices
            .map((c, j) => (c.correct ? `<value>C${j}</value>` : ""))
            .join("");
    const declaration = `<responseDeclaration identifier="RESPONSE" cardinality="${order ? "ordered" : multi ? "multiple" : "single"}" baseType="${essay ? "string" : "identifier"}">${values ? `<correctResponse>${values}</correctResponse>` : ""}</responseDeclaration>`;
    let interaction = "";
    if (essay)
      interaction = '<extendedTextInteraction responseIdentifier="RESPONSE"/>';
    else if (order)
      interaction = `<orderInteraction responseIdentifier="RESPONSE" shuffle="true">${q.pairs.map((p, j) => `<simpleChoice identifier="C${j}">${escape(p.left)}</simpleChoice>`).join("")}</orderInteraction>`;
    else
      interaction = `<choiceInteraction responseIdentifier="RESPONSE" shuffle="true" maxChoices="${multi ? q.choices.length : 1}">${q.choices.map((c, j) => `<simpleChoice identifier="C${j}" fixed="${c.locked}">${escape(c.text)}</simpleChoice>`).join("")}</choiceInteraction>`;
    if (q.richText && /\s(style|type|start|dir)=/.test(q.richText))
      warnings.push(
        `Question ${i + 1}: alignment and list numbering styles are removed to meet the QTI 2.1 XML schema; text and list structure remain.`,
      );
    const rich = q.richText
      ? sanitize(cleanRichText(q.richText), {
          allowedTags: [
            "p",
            "br",
            "strong",
            "em",
            "sup",
            "sub",
            "ul",
            "ol",
            "li",
            "blockquote",
            "h2",
            "h3",
          ],
          allowedAttributes: {},
        })
          .replace(/<br\s*\/?\s*>/g, "<br/>")
          .replace(/&nbsp;/g, "&#160;")
      : `<p>${escape(q.text)}</p>`;
    const rubric =
      essay && q.answer
        ? `<rubricBlock view="scorer"><p>${escape(q.answer)}</p></rubricBlock>`
        : "";
    const content = `<?xml version="1.0" encoding="UTF-8"?><assessmentItem xmlns="${namespace}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="${namespace} http://www.imsglobal.org/xsd/qti/qtiv2p1/imsqti_v2p1.xsd" identifier="${id}" title="Question ${i + 1}" adaptive="false" timeDependent="false">${declaration}<outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float" normalMaximum="${q.marks}"><defaultValue><value>0</value></defaultValue></outcomeDeclaration><itemBody>${rich}${image}${interaction}${rubric}</itemBody>${essay ? "" : processing(q.marks)}</assessmentItem>`;
    if (XMLValidator.validate(content) !== true)
      throw new Error(
        `Question ${i + 1}: formatting cannot be represented as QTI XML.`,
      );
    zip.file(file, content);
    resources.push(
      `<resource identifier="${id}" type="imsqti_item_xmlv2p1" href="${file}"><file href="${file}"/>${assets.map((asset) => `<file href="${asset}"/>`).join("")}</resource>`,
    );
    refs.push(`<assessmentItemRef identifier="ref_${id}" href="${file}"/>`);
  }
  if (!refs.length)
    throw new Error("No questions can be exported by this QTI adapter.");
  zip.file(
    "test.xml",
    `<?xml version="1.0" encoding="UTF-8"?><assessmentTest xmlns="${namespace}" identifier="classpaper_test" title="${escape(test.title)}"><testPart identifier="part" navigationMode="nonlinear" submissionMode="individual"><assessmentSection identifier="section" title="Questions" visible="true">${refs.join("")}</assessmentSection></testPart></assessmentTest>`,
  );
  zip.file(
    "imsmanifest.xml",
    `<?xml version="1.0" encoding="UTF-8"?><manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1" identifier="classpaper_package"><metadata><schema>QTIv2.1 Package</schema><schemaversion>1.0.0</schemaversion></metadata><organizations/><resources><resource identifier="test" type="imsqti_test_xmlv2p1" href="test.xml"><file href="test.xml"/>${refs.map((_ref, i) => `<dependency identifierref="${resources[i].match(/identifier="([^"]+)"/)![1]}"/>`).join("")}</resource>${resources.join("")}</resources></manifest>`,
  );
  return {
    buffer: await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
    }),
    warnings,
  };
}
