import { useState } from 'react'
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx'
import { jsPDF } from 'jspdf'
import type { Manuscript } from '../types.ts'

interface ExportToolbarProps {
  manuscript: Manuscript
  projectName: string
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

export const ExportToolbar = ({ manuscript, projectName }: ExportToolbarProps) => {
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
    ].join('\n\n')
    downloadFile(md, `${baseName}.md`, 'text/markdown')
  }

  const handleWordExport = async () => {
    setDownloading(true)
    try {
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

  const handlePdfExport = () => {
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

    pdf.save(`${baseName}.pdf`)
  }

  return (
    <div className="border-4 border-black bg-white shadow-[10px_10px_0_0_#111] px-4 py-3 flex flex-wrap gap-3 font-mono text-sm">
      <button
        type="button"
        className="border-3 border-black px-4 py-2 bg-[#EF4444] text-white disabled:opacity-60"
        onClick={handleWordExport}
        disabled={downloading}
      >
        📥 Exportar a Word (.docx)
      </button>
      <button type="button" className="border-3 border-black px-4 py-2 bg-white" onClick={handleMarkdownExport}>
        📥 Exportar a Markdown (.md)
      </button>
      <button type="button" className="border-3 border-black px-4 py-2 bg-white" onClick={handlePdfExport}>
        📥 Exportar a PDF
      </button>
    </div>
  )
}
