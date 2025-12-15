import { useState } from 'react'
import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun, ImageRun } from 'docx'
import type { IParagraphOptions } from 'docx'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import type { Manuscript } from '../types.ts'

interface ExportToolbarProps {
  manuscript: Manuscript
  projectName: string
  reportTitle: string
  keywords?: string[]
  matrixRowCount?: number
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

export const ExportToolbar = ({ manuscript, projectName, reportTitle, keywords, matrixRowCount, onRegenerate, regenerating }: ExportToolbarProps) => {
  const [downloading, setDownloading] = useState(false)

  const safeName = projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase()
  const baseName = `${safeName || 'manuscrito'}`

  const keywordsLine = (keywords ?? []).filter(Boolean).join(', ')

  const handleMarkdownExport = () => {
    const md = [
      `# ${reportTitle || projectName}`,
      `## Resumen\n${manuscript.abstract}`,
      `**Palabras clave:** ${keywordsLine || '—'}`,
      `## Introducción\n${manuscript.introduction}`,
      `## Métodos\n${manuscript.methods}`,
      `## Resultados\n${manuscript.results}`,
      `### Figura 1. Diagrama PRISMA 2020\nFuente: Elaboración propia`,
      `### Tabla 1. Matriz comparativa\nFuente: Elaboración propia`,
      `### Figura 2. Distribución por año\nFuente: Elaboración propia`,
      `### Figura 3. Distribución por país\nFuente: Elaboración propia`,
      `## Discusión\n${manuscript.discussion}`,
      `## Conclusiones\n${manuscript.conclusions}`,
      `## Referencias\n${manuscript.references.map((ref, idx) => `${idx + 1}. ${ref}`).join('\n')}`,
    ].join('\n\n')
    downloadFile(md, `${baseName}.md`, 'text/markdown')
  }

  const handleWordExport = async () => {
    setDownloading(true)
    try {
      const resultsImages = {
        prisma: await captureElementPng('phase7-fig-prisma'),
        byYear: await captureElementPng('phase7-fig-by-year'),
        byCountry: await captureElementPng('phase7-fig-by-country'),
        matrix: matrixRowCount ? await captureElementPng('phase7-table-matrix') : null,
      }

      const sections = [
        { title: 'Resumen', field: 'abstract' as const },
        { title: 'Introducción', field: 'introduction' as const },
        { title: 'Métodos', field: 'methods' as const },
        { title: 'Resultados', field: 'results' as const },
        { title: 'Discusión', field: 'discussion' as const },
        { title: 'Conclusiones', field: 'conclusions' as const },
      ]

      const toParagraphs = (content: string, alignment?: IParagraphOptions['alignment']) =>
        content
          .split(/\n{2,}/)
          .map((chunk) =>
            new Paragraph({
              children: [new TextRun(chunk)],
              spacing: { after: 200 },
              alignment,
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

      const captionTitleParagraph = (label: string) =>
        new Paragraph({
          children: [new TextRun({ text: label, bold: true })],
          spacing: { after: 80 },
        })

      const sourceParagraph = () =>
        new Paragraph({
          children: [new TextRun('Fuente: Elaboración propia')],
          spacing: { after: 200 },
        })

      const buildResultsAssets = () => {
        const children: Paragraph[] = []

        children.push(captionTitleParagraph('Figura 1: Diagrama PRISMA 2020'))
        children.push(...toImageParagraphs(resultsImages.prisma))
        children.push(sourceParagraph())

        children.push(captionTitleParagraph('Tabla 1: Matriz comparativa'))
        if (resultsImages.matrix) {
          children.push(...toImageParagraphs(resultsImages.matrix))
        } else {
          children.push(
            new Paragraph({
              children: [new TextRun('(Sin datos)')],
              spacing: { after: 200 },
            }),
          )
        }
        children.push(sourceParagraph())

        children.push(captionTitleParagraph('Figura 2: Distribución por año'))
        children.push(...toImageParagraphs(resultsImages.byYear))
        children.push(sourceParagraph())

        children.push(captionTitleParagraph('Figura 3: Distribución por país'))
        children.push(...toImageParagraphs(resultsImages.byCountry))
        children.push(sourceParagraph())

        return children
      }

      const doc = new Document({
        sections: [
          {
            properties: {},
            children: [
              new Paragraph({
                text: reportTitle || projectName,
                heading: HeadingLevel.TITLE,
                alignment: AlignmentType.CENTER,
              }),
              ...sections.flatMap((section) => {
                const content = manuscript[section.field] as string
                if (section.field === 'abstract') {
                  return [
                    new Paragraph({
                      text: section.title,
                      heading: HeadingLevel.HEADING_1,
                    }),
                    ...toParagraphs(content, AlignmentType.CENTER),
                    new Paragraph({
                      children: [new TextRun({ text: `Palabras clave: ${keywordsLine || '—'}` })],
                      spacing: { after: 200 },
                    }),
                  ]
                }

                if (section.field === 'results') {
                  return [
                    new Paragraph({
                      text: section.title,
                      heading: HeadingLevel.HEADING_1,
                    }),
                    ...toParagraphs(content),
                    ...buildResultsAssets(),
                  ]
                }

                return [
                  new Paragraph({
                    text: section.title,
                    heading: HeadingLevel.HEADING_1,
                  }),
                  ...toParagraphs(content),
                ]
              }),
              new Paragraph({
                text: 'Referencias',
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

    const addCenteredHeading = (text: string) => {
      ensureSpace(30)
      pdf.setFont('Times', 'bold')
      pdf.setFontSize(22)
      const pageWidth = pdf.internal.pageSize.getWidth()
      pdf.text(text, pageWidth / 2, cursorY, { align: 'center' })
      cursorY += 34
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

    const addCenteredParagraph = (text: string) => {
      pdf.setFont('Times', 'normal')
      pdf.setFontSize(12)
      const pageWidth = pdf.internal.pageSize.getWidth()
      const lines = pdf.splitTextToSize(text, maxWidth)
      lines.forEach((line: string) => {
        ensureSpace(16)
        pdf.text(line, pageWidth / 2, cursorY, { align: 'center' })
        cursorY += 16
      })
      cursorY += 8
    }

    const addImageFromElement = async (elementId: string) => {
      const image = await captureElementPng(elementId)
      if (!image?.dataUrl) return
      const pageWidth = pdf.internal.pageSize.getWidth()
      const margin = 40
      const usableWidth = pageWidth - margin * 2
      const ratio = image.height / image.width
      const height = usableWidth * ratio
      if (cursorY + height > 780) {
        pdf.addPage()
        cursorY = 60
      }
      pdf.addImage(image.dataUrl, 'PNG', margin, cursorY, usableWidth, height)
      cursorY += height + 12
    }

    addCenteredHeading(reportTitle || projectName)

    const sections = [
      { title: 'Resumen', field: 'abstract' as const },
      { title: 'Introducción', field: 'introduction' as const },
      { title: 'Métodos', field: 'methods' as const },
      { title: 'Resultados', field: 'results' as const },
      { title: 'Discusión', field: 'discussion' as const },
      { title: 'Conclusiones', field: 'conclusions' as const },
    ]

    for (const section of sections) {
      const content = manuscript[section.field] as string
      addHeading(section.title)

      if (section.field === 'abstract') {
        content.split(/\n{2,}/).forEach((chunk) => addCenteredParagraph(chunk))
        addParagraph(`Palabras clave: ${keywordsLine || '—'}`)
        continue
      }

      content.split(/\n{2,}/).forEach((chunk) => addParagraph(chunk))

      if (section.field === 'results') {
        addParagraph('Figura 1: Diagrama PRISMA 2020')
        await addImageFromElement('phase7-fig-prisma')
        addParagraph('Fuente: Elaboración propia')

        addParagraph('Tabla 1: Matriz comparativa')
        if (matrixRowCount) {
          await addImageFromElement('phase7-table-matrix')
        } else {
          addParagraph('(Sin datos)')
        }
        addParagraph('Fuente: Elaboración propia')

        addParagraph('Figura 2: Distribución por año')
        await addImageFromElement('phase7-fig-by-year')
        addParagraph('Fuente: Elaboración propia')

        addParagraph('Figura 3: Distribución por país')
        await addImageFromElement('phase7-fig-by-country')
        addParagraph('Fuente: Elaboración propia')
      }
    }

    addHeading('Referencias')
    manuscript.references.forEach((reference, index) => addParagraph(`${index + 1}. ${reference}`))

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
