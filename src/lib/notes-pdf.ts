import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import {
  consultationRecordSchema,
  type ConsultationRecord,
} from "./consultation";
import { savedDate } from "./downloads";
import { noteSectionTitles } from "./languages";

// Coverage shared by pdfmake 0.3.11's regular/bold Roboto fonts, plus line breaks.
// Regenerate from bundled font character maps when changing the PDF fonts.
const unsupportedPdfCharacter =
  // eslint-disable-next-line no-control-regex, no-misleading-character-class -- Font maps include whitespace and standalone combining glyphs.
  /[^\u{0}\u{2}\u{9}-\u{a}\u{d}\u{20}-\u{7e}\u{a0}-\u{17f}\u{18f}\u{192}\u{1a0}-\u{1a1}\u{1af}-\u{1b0}\u{1f0}\u{1fa}-\u{1ff}\u{218}-\u{21b}\u{237}\u{259}\u{2bc}\u{2c6}-\u{2c7}\u{2c9}\u{2d8}-\u{2dd}\u{2f3}\u{300}-\u{301}\u{303}\u{309}\u{30f}\u{323}\u{384}-\u{38a}\u{38c}\u{38e}-\u{3a1}\u{3a3}-\u{3ce}\u{3d1}-\u{3d2}\u{3d6}\u{400}-\u{486}\u{488}-\u{513}\u{1e00}-\u{1e01}\u{1e3e}-\u{1e3f}\u{1e80}-\u{1e85}\u{1e9e}\u{1ea0}-\u{1ef9}\u{1f4d}\u{2000}-\u{200b}\u{2010}-\u{2011}\u{2013}-\u{2015}\u{2017}-\u{201e}\u{2020}-\u{2022}\u{2025}-\u{2027}\u{2030}\u{2032}-\u{2033}\u{2039}-\u{203a}\u{203c}\u{2044}\u{2070}\u{2074}-\u{208e}\u{20a3}-\u{20a4}\u{20a6}-\u{20ac}\u{20b1}\u{20b9}-\u{20ba}\u{20bc}-\u{20bd}\u{20c1}\u{2105}\u{2113}\u{2116}\u{2122}\u{2126}\u{212e}\u{215b}-\u{215e}\u{2202}\u{2206}\u{220f}\u{2211}-\u{2212}\u{221a}\u{221e}\u{222b}\u{2248}\u{2260}\u{2264}-\u{2265}\u{25a0}\u{25ca}-\u{25cb}\u{25cf}\u{ee01}-\u{ee02}\u{f6c3}\u{fb01}-\u{fb04}\u{feff}\u{fffc}-\u{fffd}]/u;

export async function createNotesPdf(input: ConsultationRecord): Promise<Blob> {
  const record = consultationRecordSchema.parse(input);
  const text = [
    record.title,
    ...record.notesResult.notes.sections.flatMap((section) =>
      section.items.map((item) => item.text),
    ),
  ].join("\n");
  if (unsupportedPdfCharacter.test(text))
    throw new Error("UNSUPPORTED_PDF_CHARACTERS");
  const [{ default: pdfMake }, { default: fonts }] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts"),
  ]);
  pdfMake.addVirtualFileSystem(fonts);
  const content: Content[] = [
    {
      text: "ConsultNote",
      fontSize: 12,
      bold: true,
      color: "#0f766e",
      margin: [0, 0, 0, 20],
    },
    {
      text: "CONSULTATION NOTES",
      fontSize: 9,
      characterSpacing: 1.4,
      color: "#64748b",
      margin: [0, 0, 0, 8],
    },
    {
      text: record.title,
      fontSize: 23,
      bold: true,
      lineHeight: 1.15,
      margin: [0, 0, 0, 10],
    },
    {
      text: `Last saved: ${savedDate(record)}`,
      fontSize: 10,
      color: "#64748b",
      margin: [0, 0, 0, 18],
    },
    {
      canvas: [
        {
          type: "line",
          x1: 0,
          y1: 0,
          x2: 499.28,
          y2: 0,
          lineWidth: 1,
          lineColor: "#cbd5e1",
        },
      ],
      margin: [0, 0, 0, 8],
    },
  ];
  if (record.promptVersion.startsWith("sample-v1"))
    content.push({
      text: "Prepared fictional sample — no new audio was transcribed.",
      fontSize: 10,
      color: "#92400e",
      margin: [0, 8, 0, 4],
    });
  for (const section of record.notesResult.notes.sections) {
    content.push(
      {
        text: noteSectionTitles[section.kind],
        headlineLevel: 1,
        fontSize: 13,
        bold: true,
        color: "#0f766e",
        margin: [0, 18, 0, 9],
      },
      {
        ul: section.items.map((item) => ({
          text: item.text,
          margin: [0, 0, 0, 8],
        })),
        margin: [12, 0, 0, 0],
      },
    );
  }
  const definition: TDocumentDefinitions = {
    info: {
      title: record.title,
      creator: "ConsultNote",
      subject: "Consultation notes",
    },
    pageSize: "A4",
    pageMargins: [48, 48, 48, 58],
    defaultStyle: {
      font: "Roboto",
      fontSize: 11,
      color: "#1e293b",
      lineHeight: 1.3,
    },
    content,
    pageBreakBefore: (node, queries) =>
      node.headlineLevel === 1 &&
      queries.getFollowingNodesOnPage().length === 0,
    footer: (page, total) => ({
      columns: [
        {
          text: "AI-assisted notes · Verify against the conversation.",
          width: "*",
        },
        { text: `${page} / ${total}`, width: 45, alignment: "right" },
      ],
      fontSize: 8,
      color: "#64748b",
      margin: [48, 18, 48, 0],
    }),
  };
  return pdfMake.createPdf(definition).getBlob();
}
