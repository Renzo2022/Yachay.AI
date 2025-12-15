import { useState } from 'react'
import { Document, HeadingLevel, Packer, Paragraph, TextRun, ImageRun } from 'docx'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import type { Manuscript, AnnexesData } from '../types.ts'

interface ExportToolbarProps {
  manuscript: Manuscript
  projectName: string
  annexes?: AnnexesData | null
  onRegenerate?: () => Promise<void>
  regenerating?: boolean
}

const downloadFile = (content: BlobPart, filename: string, type: string) => {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

const captureElementPng = async (elementId: string) => {
  const element = document.getElementById(elementId)
  if (!element) return null
  const canvas = await html2canvas(element, { backgroundColor: '#ffffff', scale: 2, useCORS: true })
  return {
    dataUrl: canvas.toDataURL('image/png'),
    width: canvas.width,
    height: canvas.height,
  }
}

const dataUrlToUint8Array = (dataUrl: string) => {
  const base64 = dataUrl.split(',')[1] ?? ''
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

export const ExportToolbar = ({ manuscript, projectName, annexes, onRegenerate, regenerating }: ExportToolbarProps) => {
  const [downloading, setDownloading] = useState(false)

  const safeName = projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase()
  const baseName = `${safeName || 'manuscrito'}`

  const handleMarkdownExport = () => {
    const md = [
      `# Abstract\n${manuscript.abstract}`,
      `# Introduction\n${manuscript.introduction}`,
      `# Methods\n${manuscript.methods}`,
      `# Results\n${manuscript.results}`,
      `# Discussion\n${manuscript.discussion}`,
      `# Conclusions\n${manuscript.conclusions}`,
      `# References\n${manuscript.references.map((ref, idx) => `${idx + 1}. ${ref}`).join('\n')}`,
      annexes
        ? [
            `# Annexes`,
            `## PRISMA 2020`,
            `- Identificados: ${annexes.prisma.identified}`,
            `- Duplicados: ${annexes.prisma.duplicates}`,
            `- Sin resumen: ${annexes.prisma.withoutAbstract}`,
            `- Cribados: ${annexes.prisma.screened}`,
            `- Incluidos: ${annexes.prisma.included}`,
            ``,
            `## Distribución por año`,
            ...(annexes.byYear.length ? annexes.byYear.map((row) => `- ${row.name}: ${row.count ?? 0}`) : ['- (Sin datos)']),
            ``,
            `## Distribución por país`,
            ...(annexes.byCountry.length
              ? annexes.byCountry.map((row) => `- ${row.name}: ${row.value ?? 0}`)
              : ['- (Sin datos)']),
          ].join('\n')
        : '',
    ].join('\n\n')
    downloadFile(md, `${baseName}.md`, 'text/markdown')
  }

  const handleWordExport = async () => {
    setDownloading(true)
    try {
      const annexImages = annexes
        ? {
            prisma: await captureElementPng('phase7-annex-prisma'),
            byYear: await captureElementPng('phase7-annex-by-year'),
            byCountry: await captureElementPng('phase7-annex-by-country'),
          }
        : null

      const sections = [
        { title: 'Abstract', content: manuscript.abstract },
        { title: 'Introduction', content: manuscript.introduction },
        { title: 'Methods', content: manuscript.methods },
        { title: 'Results', content: manuscript.results },
        { title: 'Discussion', content: manuscript.discussion },
        { title: 'Conclusions', content: manuscript.conclusions },
      ]

      const toParagraphs = (content: string) =>
        content
          .split(/\n{2,}/)
          .map((chunk) =>
            new Paragraph({
              children: [new TextRun(chunk)],
              spacing: { after: 200 },
            }),
          )

      const toImageParagraphs = (image: { dataUrl: string; width: number; height: number } | null) => {
        if (!image) return []
        const maxWidth = 560
        const ratio = image.height / image.width
        const width = Math.min(maxWidth, image.width)
        const height = Math.round(width * ratio)
        return [
          new Paragraph({
            children: [
              new ImageRun({
                data: dataUrlToUint8Array(image.dataUrl),
                transformation: { width, height },
              }),
            ],
            spacing: { after: 200 },
          }),
        ]
      }

      const doc = new Document({
        sections: [
          {
            properties: {},
            children: [
              new Paragraph({
                text: projectName,
                heading: HeadingLevel.TITLE,
              }),
              ...sections.flatMap((section) => [
                new Paragraph({
                  text: section.title,
                  heading: HeadingLevel.HEADING_1,
                }),
                ...toParagraphs(section.content),
              ]),
              new Paragraph({
                text: 'References',
                heading: HeadingLevel.HEADING_1,
              }),
              ...manuscript.references.map(
                (reference, index) =>
                  new Paragraph({
                    children: [new TextRun(`${index + 1}. ${reference}`)],
                    spacing: { after: 100 },
                  }),
              ),
              ...(annexes
                ? [
                    new Paragraph({
                      text: 'Annexes',
                      heading: HeadingLevel.HEADING_1,
                    }),
                    new Paragraph({
                      text: 'PRISMA 2020',
                      heading: HeadingLevel.HEADING_2,
                    }),
                    ...(annexImages ? toImageParagraphs(annexImages.prisma) : []),
                    new Paragraph({
                      children: [
                        new TextRun(
                          `Identificados: ${annexes.prisma.identified} · Duplicados: ${annexes.prisma.duplicates} · Sin resumen: ${annexes.prisma.withoutAbstract} · Cribados: ${annexes.prisma.screened} · Incluidos: ${annexes.prisma.included}`,
                        ),
                      ],
                      spacing: { after: 200 },
                    }),
                    new Paragraph({
                      text: 'Distribución por año',
                      heading: HeadingLevel.HEADING_2,
                    }),
                    ...(annexImages ? toImageParagraphs(annexImages.byYear) : []),
                    ...(annexes.byYear.length
                      ? annexes.byYear.map(
                          (row) =>
                            new Paragraph({
                              children: [new TextRun(`- ${row.name}: ${row.count ?? 0}`)],
                              spacing: { after: 80 },
                            }),
                        )
                      : [
                          new Paragraph({
                            children: [new TextRun('- (Sin datos)')],
                            spacing: { after: 80 },
                          }),
                        ]),
                    new Paragraph({
                      text: 'Distribución por país',
                      heading: HeadingLevel.HEADING_2,
                    }),
                    ...(annexImages ? toImageParagraphs(annexImages.byCountry) : []),
                    ...(annexes.byCountry.length
                      ? annexes.byCountry.map(
                          (row) =>
                            new Paragraph({
                              children: [new TextRun(`- ${row.name}: ${row.value ?? 0}`)],
                              spacing: { after: 80 },
                            }),
                        )
                      : [
                          new Paragraph({
                            children: [new TextRun('- (Sin datos)')],
                            spacing: { after: 80 },
                          }),
                        ]),
                  ]
                : []),
            ],
          },
        ],
      })

      const blob = await Packer.toBlob(doc)
      downloadFile(blob, `${baseName}.docx`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    } finally {
      setDownloading(false)
    }
  }

  const handlePdfExport = async () => {
    const pdf = new jsPDF({
      unit: 'pt',
      format: 'a4',
    })

    let cursorY = 60
    const marginX = 50
    const maxWidth = 500

    const ensureSpace = (height = 20) => {
      if (cursorY + height > 780) {
        pdf.addPage()
        cursorY = 60
      }
    }

    const addHeading = (text: string) => {
      ensureSpace(30)
      pdf.setFont('Times', 'bold')
      pdf.setFontSize(18)
      pdf.text(text, marginX, cursorY)
      cursorY += 24
    }

    const addParagraph = (text: string) => {
      pdf.setFont('Times', 'normal')
      pdf.setFontSize(12)
      const lines = pdf.splitTextToSize(text, maxWidth)
      lines.forEach((line: string) => {
        ensureSpace(16)
        pdf.text(line, marginX, cursorY)
        cursorY += 16
      })
      cursorY += 8
    }

    pdf.setFont('Times', 'bold')
    pdf.setFontSize(22)
    pdf.text(projectName, marginX, cursorY)
    cursorY += 30

    const sections = [
      { title: 'Abstract', content: manuscript.abstract },
      { title: 'Introduction', content: manuscript.introduction },
      { title: 'Methods', content: manuscript.methods },
      { title: 'Results', content: manuscript.results },
      { title: 'Discussion', content: manuscript.discussion },
      { title: 'Conclusions', content: manuscript.conclusions },
    ]

    sections.forEach((section) => {
      addHeading(section.title)
      section.content.split(/\n{2,}/).forEach((chunk) => addParagraph(chunk))
    })

    addHeading('References')
    manuscript.references.forEach((reference, index) => addParagraph(`${index + 1}. ${reference}`))

    if (annexes) {
      addHeading('Annexes')
      addHeading('PRISMA 2020')
      const prismaImage = await captureElementPng('phase7-annex-prisma')
      if (prismaImage?.dataUrl) {
        pdf.addPage()
        const pageWidth = pdf.internal.pageSize.getWidth()
        const margin = 40
        const usableWidth = pageWidth - margin * 2
        const ratio = prismaImage.height / prismaImage.width
        const height = usableWidth * ratio
        pdf.addImage(prismaImage.dataUrl, 'PNG', margin, 80, usableWidth, height)
      }
      addParagraph(
        `Identificados: ${annexes.prisma.identified}. Duplicados: ${annexes.prisma.duplicates}. Sin resumen: ${annexes.prisma.withoutAbstract}. Cribados: ${annexes.prisma.screened}. Incluidos: ${annexes.prisma.included}.`,
      )

      addHeading('Distribución por año')
      const byYearImage = await captureElementPng('phase7-annex-by-year')
      if (byYearImage?.dataUrl) {
        pdf.addPage()
        const pageWidth = pdf.internal.pageSize.getWidth()
        const margin = 40
        const usableWidth = pageWidth - margin * 2
        const ratio = byYearImage.height / byYearImage.width
        const height = usableWidth * ratio
        pdf.addImage(byYearImage.dataUrl, 'PNG', margin, 80, usableWidth, height)
      }
      if (annexes.byYear.length === 0) addParagraph('(Sin datos)')
      annexes.byYear.forEach((row) => addParagraph(`- ${row.name}: ${row.count ?? 0}`))

      addHeading('Distribución por país')
      const byCountryImage = await captureElementPng('phase7-annex-by-country')
      if (byCountryImage?.dataUrl) {
        pdf.addPage()
        const pageWidth = pdf.internal.pageSize.getWidth()
        const margin = 40
        const usableWidth = pageWidth - margin * 2
        const ratio = byCountryImage.height / byCountryImage.width
        const height = usableWidth * ratio
        pdf.addImage(byCountryImage.dataUrl, 'PNG', margin, 80, usableWidth, height)
      }
      if (annexes.byCountry.length === 0) addParagraph('(Sin datos)')
      annexes.byCountry.forEach((row) => addParagraph(`- ${row.name}: ${row.value ?? 0}`))
    }

    pdf.save(`${baseName}.pdf`)
  }

  return (
    <div className="border-4 border-black bg-white shadow-[10px_10px_0_0_#111] px-4 py-3 flex flex-wrap gap-3 font-mono text-sm text-black">
      {onRegenerate ? (
        <button
          type="button"
          className="border-3 border-black px-4 py-2 bg-black text-white disabled:opacity-60"
          onClick={onRegenerate}
          disabled={Boolean(regenerating) || downloading}
        >
          {regenerating ? '🤖 Regenerando…' : '🤖 Regenerar con IA (sobrescribir)'}
        </button>
      ) : null}
      <button
        type="button"
        className="border-3 border-black px-4 py-2 bg-[#EF4444] text-white disabled:opacity-60"
        onClick={handleWordExport}
        disabled={downloading}
      >
        📥 Exportar a Word (.docx)
      </button>
      <button type="button" className="border-3 border-black px-4 py-2 bg-white text-black" onClick={handleMarkdownExport}>
        📥 Exportar a Markdown (.md)
      </button>
      <button type="button" className="border-3 border-black px-4 py-2 bg-white text-black" onClick={handlePdfExport}>
        📥 Exportar a PDF
      </button>
    </div>
  )
}
