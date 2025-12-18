import { useState } from 'react'
import {
  AlignmentType,
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  ExternalHyperlink,
  LineRuleType,
  Table,
  TableRow,
  TableCell,
  BorderStyle,
  WidthType,
  UnderlineType,
  VerticalAlign,
} from 'docx'
import type { IParagraphOptions } from 'docx'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import type { Manuscript } from '../types.ts'
import type { ManuscriptLanguage } from '../types.ts'
import type { Candidate } from '../../projects/types.ts'
import type { ExtractionData } from '../../phase5_extraction/types.ts'

interface ExportToolbarProps {
  manuscript: Manuscript
  projectName: string
  reportTitle: string
  keywords?: string[]
  keywordsEn?: string[]
  matrixRowCount?: number
  matrixRows?: Array<{ study: Candidate; extraction?: ExtractionData }>
  onRegenerate?: (language: ManuscriptLanguage) => Promise<void>
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

const captureElementCanvas = async (elementId: string) => {
  const element = document.getElementById(elementId)
  if (!element) return null
  return html2canvas(element, { backgroundColor: '#ffffff', scale: 2, useCORS: true })
}

const sliceCanvas = (canvas: HTMLCanvasElement, sliceHeightPx: number) => {
  const slices: Array<{ dataUrl: string; width: number; height: number }> = []
  const totalHeight = canvas.height
  const width = canvas.width
  for (let y = 0; y < totalHeight; y += sliceHeightPx) {
    const height = Math.min(sliceHeightPx, totalHeight - y)
    const slice = document.createElement('canvas')
    slice.width = width
    slice.height = height
    const ctx = slice.getContext('2d')
    if (!ctx) break
    ctx.drawImage(canvas, 0, y, width, height, 0, 0, width, height)
    slices.push({ dataUrl: slice.toDataURL('image/png'), width, height })
  }
  return slices
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

export const ExportToolbar = ({
  manuscript,
  projectName,
  reportTitle,
  keywords,
  keywordsEn,
  matrixRowCount,
  matrixRows,
  onRegenerate,
  regenerating,
}: ExportToolbarProps) => {
  const [downloading, setDownloading] = useState(false)
  const [showLanguageModal, setShowLanguageModal] = useState(false)
  const [pendingLanguage, setPendingLanguage] = useState<ManuscriptLanguage>('es')

  const isEnglish = manuscript.language === 'en'

  const safeName = projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase()
  const baseName = `${safeName || 'manuscrito'}`

  const keywordsLine = ((manuscript.keywords?.length ? manuscript.keywords : keywords) ?? []).filter(Boolean).join(', ')
  const keywordsLineEn =
    ((manuscript.keywordsEn?.length ? manuscript.keywordsEn : keywordsEn) ?? []).filter(Boolean).join(', ')

  const keywordsForEnglish = keywordsLineEn || keywordsLine

  const authorName = (manuscript.authorName ?? '').trim()
  const rawOrcid = (manuscript.authorOrcid ?? '').trim()
  const orcidUrl = rawOrcid
    ? rawOrcid.startsWith('http')
      ? rawOrcid
      : `https://orcid.org/${rawOrcid.replace(/^orcid\.org\//i, '')}`
    : ''

  const fig1Label = isEnglish ? 'Figure 1: PRISMA 2020 flow diagram' : 'Figura 1: Diagrama PRISMA 2020'
  const table1Label = isEnglish ? 'Table 1: Comparative matrix (summary)' : 'Tabla 1: Matriz comparativa (resumen)'
  const fig2Label = isEnglish ? 'Figure 2: Distribution by year' : 'Figura 2: Distribución por año'
  const fig3Label = isEnglish ? 'Figure 3: Distribution by country' : 'Figura 3: Distribución por país'
  const sourceText = isEnglish ? "Source: Authors' elaboration" : 'Fuente: Elaboración propia'

  const hasMatrixRows = Array.isArray(matrixRows) && matrixRows.length > 0

  const handleWordExport = async () => {
    setDownloading(true)
    try {
      const fontName = 'Arial'
      const fontSize = 22

      const resultsImages = {
        prisma: await captureElementPng('phase7-fig-prisma'),
        byYear: await captureElementPng('phase7-fig-by-year'),
        byCountry: await captureElementPng('phase7-fig-by-country'),
      }

      const matrixCanvas = !hasMatrixRows && matrixRowCount ? await captureElementCanvas('phase7-table-matrix') : null
      const matrixSlices = matrixCanvas
        ? sliceCanvas(matrixCanvas, Math.floor((650 * matrixCanvas.width) / 560))
        : []

      const sections: Array<{ title: string; field: keyof Manuscript; keywordsLabel?: string; keywordsValue?: string }> =
        isEnglish
          ? [
              { title: 'Abstract', field: 'abstract', keywordsLabel: 'Keywords', keywordsValue: keywordsForEnglish },
              { title: 'Introduction', field: 'introduction' },
              { title: 'Methods', field: 'methods' },
              { title: 'Results', field: 'results' },
              { title: 'Discussion', field: 'discussion' },
              { title: 'Conclusions', field: 'conclusions' },
            ]
          : [
              { title: 'Resumen', field: 'abstract', keywordsLabel: 'Palabras clave', keywordsValue: keywordsLine },
              { title: 'Abstract', field: 'abstractEn', keywordsLabel: 'Keywords', keywordsValue: keywordsForEnglish },
              { title: 'Introducción', field: 'introduction' },
              { title: 'Métodos', field: 'methods' },
              { title: 'Resultados', field: 'results' },
              { title: 'Discusión', field: 'discussion' },
              { title: 'Conclusiones', field: 'conclusions' },
            ]

      const toParagraphs = (content: string, alignment?: IParagraphOptions['alignment']) =>
        content
          .split(/\n{2,}/)
          .map((chunk) =>
            new Paragraph({
              children: [new TextRun({ text: chunk, font: fontName, size: fontSize })],
              spacing: { after: 200, line: 480, lineRule: LineRuleType.AUTO },
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
          children: [new TextRun({ text: label, bold: true, italics: true, font: fontName, size: fontSize })],
          spacing: { after: 80 },
        })

      const sourceParagraph = () =>
        new Paragraph({
          children: [new TextRun({ text: sourceText, bold: true, italics: true, font: fontName, size: fontSize })],
          spacing: { after: 200 },
        })

      const pageBreakParagraph = () =>
        new Paragraph({
          children: [],
          pageBreakBefore: true,
        })

      const toImageParagraphsPaged = (images: Array<{ dataUrl: string; width: number; height: number }>) => {
        if (!images.length) return []
        const paragraphs: Paragraph[] = []
        images.forEach((img, index) => {
          if (index > 0) paragraphs.push(pageBreakParagraph())
          paragraphs.push(...toImageParagraphs(img))
        })
        return paragraphs
      }

      const surnameParticles = new Set(['de', 'del', 'la', 'las', 'los', 'da', 'do', 'dos', 'das', 'van', 'von'])

      const extractSurnameForCitation = (raw: string) => {
        const cleaned = String(raw ?? '').replace(/\s+/g, ' ').trim()
        if (!cleaned) return ''

        const commaIndex = cleaned.indexOf(',')
        if (commaIndex > 0) return cleaned.slice(0, commaIndex).trim()

        const tokens = cleaned.split(' ').filter(Boolean)
        if (!tokens.length) return ''

        const looksLikeInitial = (token: string) => {
          const t = String(token ?? '').trim()
          if (!t) return false
          if (t.endsWith('.') && t.replace(/\./g, '').length <= 3) return true
          if (/^[A-Z]$/.test(t)) return true
          return false
        }

        let end = tokens.length - 1
        while (end > 0 && looksLikeInitial(tokens[end])) end -= 1
        let start = end
        while (start - 1 >= 0 && surnameParticles.has(tokens[start - 1].toLowerCase())) start -= 1
        if (start < end - 2) start = end - 2
        if (start < 0) start = 0
        return tokens.slice(start, end + 1).join(' ').trim()
      }

      const buildAuthorYearCitation = (authors: unknown, year: unknown) => {
        const yearText = year ? String(year) : 'n.d.'
        const list = Array.isArray(authors) ? authors.map((name) => String(name ?? '').trim()).filter(Boolean) : []
        if (!list.length) return `(${yearText})`
        if (list.length === 1) {
          const a = extractSurnameForCitation(list[0]) || list[0]
          return `(${a}, ${yearText})`
        }
        if (list.length === 2) {
          const a = extractSurnameForCitation(list[0]) || list[0]
          const b = extractSurnameForCitation(list[1]) || list[1]
          return `(${a} & ${b}, ${yearText})`
        }
        const a = extractSurnameForCitation(list[0]) || list[0]
        return `(${a}, et al., ${yearText})`
      }

      const buildMatrixDocxTable = () => {
        if (!hasMatrixRows) return null

        const widths = [420, 1700, 1100, 1700, 1450, 2990]

        const headerCell = (text: string, width: number, alignment: IParagraphOptions['alignment'] = AlignmentType.LEFT) =>
          new TableCell({
            width: { size: width, type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                children: [new TextRun({ text, bold: true, font: fontName, size: fontSize })],
                alignment,
                spacing: { after: 0, line: 480, lineRule: LineRuleType.AUTO },
              }),
            ],
          })

        const bodyCell = (text: string, width: number, alignment: IParagraphOptions['alignment'] = AlignmentType.LEFT) =>
          new TableCell({
            width: { size: width, type: WidthType.DXA },
            verticalAlign: VerticalAlign.TOP,
            children: [
              new Paragraph({
                children: [new TextRun({ text, font: fontName, size: fontSize })],
                alignment,
                spacing: { after: 0, line: 480, lineRule: LineRuleType.AUTO },
              }),
            ],
          })

        const bodyCellWithTitle = (citation: string, title: string, width: number) =>
          new TableCell({
            width: { size: width, type: WidthType.DXA },
            verticalAlign: VerticalAlign.TOP,
            children: [
              new Paragraph({
                children: [new TextRun({ text: citation, bold: true, font: fontName, size: fontSize })],
                spacing: { after: 0, line: 480, lineRule: LineRuleType.AUTO },
              }),
              new Paragraph({
                children: [new TextRun({ text: title, font: fontName, size: 20, color: '444444' })],
                spacing: { after: 0, line: 480, lineRule: LineRuleType.AUTO },
              }),
            ],
          })

        const header = new TableRow({
          tableHeader: true,
          cantSplit: true,
          children: [
            headerCell('#', widths[0], AlignmentType.CENTER),
            headerCell(isEnglish ? 'Author/Year' : 'Autor/Año', widths[1]),
            headerCell(isEnglish ? 'Study type' : 'Tipo de estudio', widths[2]),
            headerCell(isEnglish ? 'Population' : 'Población', widths[3]),
            headerCell(isEnglish ? 'Variables' : 'Variables', widths[4]),
            headerCell(isEnglish ? 'Results' : 'Resultados', widths[5]),
          ],
        })

        const body = matrixRows!.map(({ study, extraction }, idx) => {
          const studyType = String(study?.studyType ?? '—') || '—'
          const population = extraction?.sample?.description?.trim() ? extraction.sample.description.trim() : '—'
          const variables = extraction?.variables?.length ? extraction.variables.join(', ') : '—'
          const results = extraction?.outcomes?.results?.trim() ? extraction.outcomes.results.trim() : '—'
          const year = (study as any)?.year || (extraction as any)?.context?.year || ''
          const citation = buildAuthorYearCitation((study as any)?.authors, year)
          const title = String((study as any)?.title ?? '').trim().slice(0, 220) || '—'

          return new TableRow({
            cantSplit: true,
            children: [
              bodyCell(String(idx + 1), widths[0], AlignmentType.CENTER),
              bodyCellWithTitle(citation, title, widths[1]),
              bodyCell(studyType, widths[2]),
              bodyCell(population, widths[3]),
              bodyCell(variables, widths[4]),
              bodyCell(results, widths[5]),
            ],
          })
        })

        return new Table({
          rows: [header, ...body],
          width: { size: 9360, type: WidthType.DXA },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
            bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
            left: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
            right: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
            insideVertical: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
          },
        })
      }

      const buildReferenceChildren = (reference: string) => {
        const text = String(reference ?? '')
        const urlRegex = /(https?:\/\/[^\s)]+)([).,;:]?)/gi
        const children: Array<TextRun | ExternalHyperlink> = []

        let lastIndex = 0
        for (const match of text.matchAll(urlRegex)) {
          const index = match.index ?? 0
          const url = match[1] ?? ''
          const suffix = match[2] ?? ''

          if (index > lastIndex) {
            children.push(new TextRun({ text: text.slice(lastIndex, index), font: fontName, size: fontSize }))
          }

          const cleanUrl = String(url).replace(/[).,;:]+$/g, '')
          children.push(
            new ExternalHyperlink({
              link: cleanUrl,
              children: [
                new TextRun({
                  text: cleanUrl,
                  font: fontName,
                  size: fontSize,
                  color: '0563C1',
                  underline: { type: UnderlineType.SINGLE },
                }),
              ],
            }),
          )

          if (suffix) {
            children.push(new TextRun({ text: suffix, font: fontName, size: fontSize }))
          }

          lastIndex = index + String(match[0] ?? '').length
        }

        if (lastIndex < text.length) {
          children.push(new TextRun({ text: text.slice(lastIndex), font: fontName, size: fontSize }))
        }

        if (!children.length) {
          children.push(new TextRun({ text, font: fontName, size: fontSize }))
        }

        return children
      }

      const buildResultsAssets = () => {
        const children: Array<Paragraph | Table> = []

        children.push(captionTitleParagraph(fig1Label))
        children.push(...toImageParagraphs(resultsImages.prisma))
        children.push(sourceParagraph())

        children.push(captionTitleParagraph(table1Label))
        const matrixTable = buildMatrixDocxTable()
        if (matrixTable) {
          children.push(matrixTable)
          children.push(
            new Paragraph({
              children: [],
              spacing: { after: 200 },
            }),
          )
        } else if (matrixSlices.length) {
          children.push(...toImageParagraphsPaged(matrixSlices))
        } else {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: '(Sin datos)', font: fontName, size: fontSize })],
              spacing: { after: 200 },
            }),
          )
        }
        children.push(sourceParagraph())

        children.push(captionTitleParagraph(fig2Label))
        children.push(...toImageParagraphs(resultsImages.byYear))
        children.push(sourceParagraph())

        children.push(captionTitleParagraph(fig3Label))
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
                children: [new TextRun({ text: reportTitle || projectName, bold: true, font: fontName, size: fontSize })],
                alignment: AlignmentType.CENTER,
              }),
              ...(authorName
                ? [
                    new Paragraph({
                      children: [
                        new TextRun({ text: authorName, font: fontName, size: fontSize }),
                        ...(orcidUrl
                          ? [
                              new TextRun({ text: ' ', font: fontName, size: fontSize }),
                              new ExternalHyperlink({
                                link: orcidUrl,
                                children: [
                                  new TextRun({
                                    text: 'iD',
                                    bold: true,
                                    color: 'A6CE39',
                                    font: fontName,
                                    size: fontSize,
                                  }),
                                ],
                              }),
                            ]
                          : []),
                      ],
                      alignment: AlignmentType.CENTER,
                      spacing: { after: 200 },
                    }),
                  ]
                : []),
              ...sections.flatMap((section) => {
                const content = String((manuscript as any)[section.field] ?? '')
                const titleParagraph = new Paragraph({
                  children: [new TextRun({ text: section.title, bold: true, font: fontName, size: fontSize })],
                  spacing: { after: 120 },
                  pageBreakBefore: section.field === 'introduction',
                })

                const contentAlignment =
                  section.field === 'abstract' || section.field === 'abstractEn' ? AlignmentType.CENTER : AlignmentType.JUSTIFIED

                if (section.keywordsLabel) {
                  return [
                    titleParagraph,
                    ...toParagraphs(content, contentAlignment),
                    new Paragraph({
                      children: [
                        new TextRun({ text: `${section.keywordsLabel}: `, bold: true, font: fontName, size: fontSize }),
                        new TextRun({ text: section.keywordsValue || '—', font: fontName, size: fontSize }),
                      ],
                      spacing: { after: 200, line: 480, lineRule: LineRuleType.AUTO },
                      alignment: contentAlignment,
                    }),
                  ]
                }

                if (section.field === 'results') {
                  return [
                    titleParagraph,
                    ...toParagraphs(content, contentAlignment),
                    ...buildResultsAssets(),
                  ]
                }

                return [
                  titleParagraph,
                  ...toParagraphs(content, contentAlignment),
                ]
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: isEnglish ? 'References' : 'Referencias bibliográficas',
                    bold: true,
                    font: fontName,
                    size: fontSize,
                  }),
                ],
                pageBreakBefore: true,
                alignment: AlignmentType.LEFT,
                spacing: { after: 120 },
              }),
              ...manuscript.references.map(
                (reference) =>
                  new Paragraph({
                    children: buildReferenceChildren(reference),
                    spacing: { line: 480, lineRule: LineRuleType.AUTO },
                    indent: { left: 720, hanging: 720 },
                    alignment: AlignmentType.JUSTIFIED,
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

    const pageWidth = pdf.internal.pageSize.getWidth()
    const setFont = (style: 'normal' | 'bold' | 'italic' | 'bolditalic') => {
      pdf.setFont('helvetica', style)
      pdf.setFontSize(11)
    }

    const addCenteredHeading = (text: string) => {
      setFont('bold')
      const pageWidth = pdf.internal.pageSize.getWidth()
      const lines = pdf.splitTextToSize(text, maxWidth)
      lines.forEach((line: string) => {
        ensureSpace(30)
        pdf.text(line, pageWidth / 2, cursorY, { align: 'center' })
        cursorY += 16
      })
      cursorY += 10
    }

    const addHeading = (text: string) => {
      ensureSpace(18)
      setFont('bold')
      pdf.text(text, marginX, cursorY)
      cursorY += 18
    }

    const addPageBreak = () => {
      pdf.addPage()
      cursorY = 60
    }

    const surnameParticles = new Set(['de', 'del', 'la', 'las', 'los', 'da', 'do', 'dos', 'das', 'van', 'von'])

    const extractSurnameForCitation = (raw: string) => {
      const cleaned = String(raw ?? '').replace(/\s+/g, ' ').trim()
      if (!cleaned) return ''
      const commaIndex = cleaned.indexOf(',')
      if (commaIndex > 0) return cleaned.slice(0, commaIndex).trim()
      const tokens = cleaned.split(' ').filter(Boolean)
      if (!tokens.length) return ''

      const looksLikeInitial = (token: string) => {
        const t = String(token ?? '').trim()
        if (!t) return false
        if (t.endsWith('.') && t.replace(/\./g, '').length <= 3) return true
        if (/^[A-Z]$/.test(t)) return true
        return false
      }

      let end = tokens.length - 1
      while (end > 0 && looksLikeInitial(tokens[end])) end -= 1
      let start = end
      while (start - 1 >= 0 && surnameParticles.has(tokens[start - 1].toLowerCase())) start -= 1
      if (start < end - 2) start = end - 2
      if (start < 0) start = 0
      return tokens.slice(start, end + 1).join(' ').trim()
    }

    const buildAuthorYearCitation = (authors: unknown, year: unknown) => {
      const yearText = year ? String(year) : 'n.d.'
      const list = Array.isArray(authors) ? authors.map((name) => String(name ?? '').trim()).filter(Boolean) : []
      if (!list.length) return `(${yearText})`
      if (list.length === 1) {
        const a = extractSurnameForCitation(list[0]) || list[0]
        return `(${a}, ${yearText})`
      }
      if (list.length === 2) {
        const a = extractSurnameForCitation(list[0]) || list[0]
        const b = extractSurnameForCitation(list[1]) || list[1]
        return `(${a} & ${b}, ${yearText})`
      }
      const a = extractSurnameForCitation(list[0]) || list[0]
      return `(${a}, et al., ${yearText})`
    }

    const addMatrixFromRows = () => {
      if (!hasMatrixRows) {
        addJustifiedParagraph('(Sin datos)')
        return
      }

      const tableWidths = [28, 118, 80, 110, 80, maxWidth - (28 + 118 + 80 + 110 + 80)]
      const lineHeight = 14
      const padX = 3
      const padY = 4

      const drawRow = (cells: Array<Array<{ text: string; style: 'normal' | 'bold' }>>, isHeader: boolean) => {
        const maxLines = cells.reduce((max, cell) => Math.max(max, cell.length), 1)
        const rowHeight = padY * 2 + maxLines * lineHeight

        if (cursorY + rowHeight > 780) {
          addPageBreak()
          drawHeader()
        }

        let x = marginX
        const yTop = cursorY

        pdf.setDrawColor(0, 0, 0)
        pdf.setLineWidth(0.6)

        for (let col = 0; col < cells.length; col += 1) {
          const width = tableWidths[col] ?? 60
          pdf.rect(x, yTop, width, rowHeight)
          const lines = cells[col]
          let yText = yTop + padY + lineHeight
          for (let i = 0; i < lines.length; i += 1) {
            const line = lines[i]
            setFont(isHeader || line.style === 'bold' ? 'bold' : 'normal')
            pdf.setTextColor(0, 0, 0)
            pdf.text(line.text, x + padX, yText)
            yText += lineHeight
          }
          x += width
        }

        cursorY += rowHeight
      }

      const wrap = (text: string, width: number) =>
        pdf
          .splitTextToSize(String(text ?? ''), Math.max(10, width - padX * 2))
          .map((line: string) => String(line))

      const drawHeader = () => {
        const headerCells: Array<Array<{ text: string; style: 'normal' | 'bold' }>> = [
          [{ text: '#', style: 'bold' }],
          [{ text: isEnglish ? 'Author/Year' : 'Autor/Año', style: 'bold' }],
          [{ text: isEnglish ? 'Study type' : 'Tipo de estudio', style: 'bold' }],
          [{ text: isEnglish ? 'Population' : 'Población', style: 'bold' }],
          [{ text: isEnglish ? 'Variables' : 'Variables', style: 'bold' }],
          [{ text: isEnglish ? 'Results' : 'Resultados', style: 'bold' }],
        ]
        drawRow(headerCells, true)
      }

      drawHeader()

      for (let idx = 0; idx < matrixRows!.length; idx += 1) {
        const row = matrixRows![idx]
        const year = (row.study as any)?.year || (row.extraction as any)?.context?.year || ''
        const citation = buildAuthorYearCitation((row.study as any)?.authors, year)
        const title = String((row.study as any)?.title ?? '').trim().slice(0, 220) || '—'
        const authorLines: Array<{ text: string; style: 'normal' | 'bold' }> = [
          { text: citation, style: 'bold' },
          ...wrap(title, tableWidths[1] ?? 120).slice(0, 3).map((t: string) => ({ text: t, style: 'normal' as const })),
        ]

        const studyType = String(row.study?.studyType ?? '—') || '—'
        const population = row.extraction?.sample?.description?.trim() ? row.extraction.sample.description.trim() : '—'
        const variables = row.extraction?.variables?.length ? row.extraction.variables.join(', ') : '—'
        const results = row.extraction?.outcomes?.results?.trim() ? row.extraction.outcomes.results.trim() : '—'

        const cells: Array<Array<{ text: string; style: 'normal' | 'bold' }>> = [
          [{ text: String(idx + 1), style: 'normal' }],
          authorLines,
          wrap(studyType, tableWidths[2] ?? 80).slice(0, 4).map((t: string) => ({ text: t, style: 'normal' as const })),
          wrap(population, tableWidths[3] ?? 110).slice(0, 4).map((t: string) => ({ text: t, style: 'normal' as const })),
          wrap(variables, tableWidths[4] ?? 80).slice(0, 4).map((t: string) => ({ text: t, style: 'normal' as const })),
          wrap(results, tableWidths[5] ?? 120).slice(0, 6).map((t: string) => ({ text: t, style: 'normal' as const })),
        ]

        drawRow(cells, false)
      }

      cursorY += 10
    }

    const addJustifiedParagraph = (text: string) => {
      setFont('normal')
      const paragraphs = String(text ?? '')
        .split(/\n{2,}/)
        .map((chunk) => chunk.trim())
        .filter(Boolean)

      const lineHeight = 22

      for (const para of paragraphs) {
        const words = para.split(/\s+/).filter(Boolean)
        let lineWords: string[] = []

        const flushLine = (justify: boolean) => {
          if (!lineWords.length) return
          ensureSpace(lineHeight)
          if (!justify || lineWords.length === 1) {
            pdf.text(lineWords.join(' '), marginX, cursorY)
            cursorY += lineHeight
            lineWords = []
            return
          }

          const joined = lineWords.join(' ')
          const joinedWidth = pdf.getTextWidth(joined)
          const gaps = lineWords.length - 1
          const extra = Math.max(0, maxWidth - joinedWidth)
          const extraPerGap = extra / gaps

          let x = marginX
          for (let idx = 0; idx < lineWords.length; idx += 1) {
            const word = lineWords[idx]
            pdf.text(word, x, cursorY)
            x += pdf.getTextWidth(word)
            if (idx < lineWords.length - 1) {
              x += pdf.getTextWidth(' ') + extraPerGap
            }
          }
          cursorY += lineHeight
          lineWords = []
        }

        for (const word of words) {
          const candidate = lineWords.length ? `${lineWords.join(' ')} ${word}` : word
          const candidateWidth = pdf.getTextWidth(candidate)
          if (candidateWidth <= maxWidth) {
            lineWords.push(word)
          } else {
            flushLine(true)
            lineWords.push(word)
          }
        }
        flushLine(false)
        cursorY += 6
      }
    }

    const addCenteredParagraph = (text: string) => {
      setFont('normal')
      const paragraphs = String(text ?? '')
        .split(/\n{2,}/)
        .map((chunk) => chunk.trim())
        .filter(Boolean)

      const lineHeight = 22

      for (const para of paragraphs) {
        const lines = pdf.splitTextToSize(para, maxWidth)
        for (const line of lines) {
          ensureSpace(lineHeight)
          pdf.text(String(line), pageWidth / 2, cursorY, { align: 'center' })
          cursorY += lineHeight
        }
        cursorY += 6
      }
    }

    const addCaption = (text: string) => {
      setFont('bolditalic')
      ensureSpace(16)
      pdf.text(text, marginX, cursorY)
      cursorY += 18
    }

    const addSource = () => {
      setFont('bolditalic')
      ensureSpace(16)
      pdf.text(sourceText, marginX, cursorY)
      cursorY += 20
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

    const addMatrixFromElementPaged = async (elementId: string) => {
      const canvas = await captureElementCanvas(elementId)
      if (!canvas) return
      const pageWidth = pdf.internal.pageSize.getWidth()
      const margin = 40
      const usableWidth = pageWidth - margin * 2

      const slicePx = Math.floor((700 * canvas.width) / usableWidth)
      const slices = sliceCanvas(canvas, slicePx)

      for (const slice of slices) {
        const ratio = slice.height / slice.width
        const height = usableWidth * ratio
        if (cursorY + height > 780) {
          pdf.addPage()
          cursorY = 60
        }
        pdf.addImage(slice.dataUrl, 'PNG', margin, cursorY, usableWidth, height)
        cursorY += height + 12
      }
    }

    addCenteredHeading(reportTitle || projectName)

    if (authorName) {
      setFont('normal')
      pdf.setTextColor(0, 0, 0)
      const display = orcidUrl ? `${authorName} iD` : authorName
      const displayWidth = pdf.getTextWidth(display)
      const startX = pageWidth / 2 - displayWidth / 2
      ensureSpace(16)
      pdf.text(authorName, startX, cursorY)
      if (orcidUrl) {
        const iconX = startX + pdf.getTextWidth(`${authorName} `)
        pdf.setTextColor(0xa6, 0xce, 0x39)
        setFont('bold')
        pdf.text('iD', iconX, cursorY)
        pdf.link(iconX, cursorY - 11, pdf.getTextWidth('iD'), 14, { url: orcidUrl })
        pdf.setTextColor(0, 0, 0)
      }
      cursorY += 22
    }

    const sections: Array<{ title: string; field: keyof Manuscript; keywordsLabel?: string; keywordsValue?: string }> =
      isEnglish
        ? [
            { title: 'Abstract', field: 'abstract', keywordsLabel: 'Keywords', keywordsValue: keywordsForEnglish },
            { title: 'Introduction', field: 'introduction' },
            { title: 'Methods', field: 'methods' },
            { title: 'Results', field: 'results' },
            { title: 'Discussion', field: 'discussion' },
            { title: 'Conclusions', field: 'conclusions' },
          ]
        : [
            { title: 'Resumen', field: 'abstract', keywordsLabel: 'Palabras clave', keywordsValue: keywordsLine },
            { title: 'Abstract', field: 'abstractEn', keywordsLabel: 'Keywords', keywordsValue: keywordsForEnglish },
            { title: 'Introducción', field: 'introduction' },
            { title: 'Métodos', field: 'methods' },
            { title: 'Resultados', field: 'results' },
            { title: 'Discusión', field: 'discussion' },
            { title: 'Conclusiones', field: 'conclusions' },
          ]

    for (const section of sections) {
      const content = String((manuscript as any)[section.field] ?? '')
      if (section.field === 'introduction') {
        addPageBreak()
      }
      addHeading(section.title)
      if (section.field === 'abstract' || section.field === 'abstractEn') {
        addCenteredParagraph(content)
      } else {
        addJustifiedParagraph(content)
      }

      if (section.keywordsLabel) {
        setFont('bold')
        ensureSpace(16)
        pdf.text(`${section.keywordsLabel}:`, marginX, cursorY)
        cursorY += 16
        addJustifiedParagraph(section.keywordsValue || '—')
      }

      if (section.field === 'results') {
        addCaption(fig1Label)
        await addImageFromElement('phase7-fig-prisma')
        addSource()

        addCaption(table1Label)
        if (hasMatrixRows) {
          addMatrixFromRows()
        } else if (matrixRowCount) {
          await addMatrixFromElementPaged('phase7-table-matrix')
        } else {
          addJustifiedParagraph('(Sin datos)')
        }
        addSource()

        addCaption(fig2Label)
        await addImageFromElement('phase7-fig-by-year')
        addSource()

        addCaption(fig3Label)
        await addImageFromElement('phase7-fig-by-country')
        addSource()
      }
    }

    addPageBreak()
    addHeading(isEnglish ? 'References' : 'Referencias bibliográficas')

    const addHangingReference = (text: string) => {
      setFont('normal')
      const lines = pdf.splitTextToSize(String(text ?? ''), maxWidth)
      const lineHeight = 22
      const urlRegex = /(https?:\/\/[^\s)]+)([).,;:]?)/gi

      const drawJustifiedPlainLine = (line: string, x: number, width: number) => {
        const words = String(line ?? '')
          .trim()
          .split(/\s+/)
          .filter(Boolean)
        if (words.length <= 1) {
          pdf.text(String(line), x, cursorY)
          return
        }

        const joined = words.join(' ')
        const joinedWidth = pdf.getTextWidth(joined)
        const gaps = words.length - 1
        const extra = Math.max(0, width - joinedWidth)
        const extraPerGap = extra / gaps

        let xCursor = x
        for (let w = 0; w < words.length; w += 1) {
          const word = words[w]
          pdf.text(word, xCursor, cursorY)
          xCursor += pdf.getTextWidth(word)
          if (w < words.length - 1) {
            xCursor += pdf.getTextWidth(' ') + extraPerGap
          }
        }
      }

      const drawLineWithLinks = (line: string, x: number) => {
        let xCursor = x
        let lastIndex = 0
        for (const match of String(line ?? '').matchAll(urlRegex)) {
          const index = match.index ?? 0
          const url = match[1] ?? ''
          const suffix = match[2] ?? ''
          const before = String(line).slice(lastIndex, index)
          if (before) {
            pdf.setTextColor(0, 0, 0)
            pdf.text(before, xCursor, cursorY)
            xCursor += pdf.getTextWidth(before)
          }

          const cleanUrl = String(url).replace(/[).,;:]+$/g, '')
          pdf.setTextColor(0x05, 0x63, 0xc1)
          pdf.text(cleanUrl, xCursor, cursorY)
          const urlWidth = pdf.getTextWidth(cleanUrl)
          pdf.link(xCursor, cursorY - 11, urlWidth, 14, { url: cleanUrl })
          pdf.setDrawColor(0x05, 0x63, 0xc1)
          pdf.line(xCursor, cursorY + 2, xCursor + urlWidth, cursorY + 2)
          xCursor += urlWidth

          if (suffix) {
            pdf.setTextColor(0, 0, 0)
            pdf.text(suffix, xCursor, cursorY)
            xCursor += pdf.getTextWidth(suffix)
          }

          lastIndex = index + String(match[0] ?? '').length
        }

        const tail = String(line ?? '').slice(lastIndex)
        if (tail) {
          pdf.setTextColor(0, 0, 0)
          pdf.text(tail, xCursor, cursorY)
        }
        pdf.setTextColor(0, 0, 0)
      }

      lines.forEach((line: string, idx: number) => {
        ensureSpace(lineHeight)
        const indent = idx === 0 ? 0 : 18
        const x = marginX + indent
        const width = maxWidth - indent

        const isLastLine = idx === lines.length - 1
        const hasUrl = urlRegex.test(String(line))
        urlRegex.lastIndex = 0

        if (!hasUrl && !isLastLine) {
          pdf.setTextColor(0, 0, 0)
          setFont('normal')
          drawJustifiedPlainLine(String(line), x, width)
        } else {
          drawLineWithLinks(String(line), x)
        }

        cursorY += lineHeight
      })
      cursorY += 4
    }

    manuscript.references.forEach((reference) => addHangingReference(reference))

    pdf.save(`${baseName}.pdf`)
  }

  return (
    <>
      <div className="border-4 border-black bg-white shadow-[10px_10px_0_0_#111] px-4 py-3 flex flex-wrap gap-3 font-mono text-sm text-black">
        {onRegenerate ? (
          <button
            type="button"
            className="border-3 border-black px-4 py-2 bg-black text-white disabled:opacity-60"
            onClick={() => {
              setPendingLanguage('es')
              setShowLanguageModal(true)
            }}
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
        <button
          type="button"
          className="border-3 border-black px-4 py-2 bg-white text-black"
          onClick={handlePdfExport}
        >
          📥 Exportar a PDF
        </button>
      </div>

      {showLanguageModal ? (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center px-4">
          <div className="bg-white border-4 border-black p-6 md:p-8 shadow-[10px_10px_0_0_rgba(0,0,0,1)] max-w-lg w-full space-y-4">
            <p className="text-xs font-mono uppercase tracking-[0.4em] text-black">Idioma de la investigación</p>
            <h3 className="text-2xl font-black uppercase text-main">¿En qué idioma generar el informe?</h3>
            <p className="text-sm text-neutral-900 leading-relaxed">
              Esto sobrescribirá el contenido del manuscrito con IA. Las referencias no se modifican.
            </p>

            <div className="grid gap-3">
              <button
                type="button"
                className={`border-3 border-black px-4 py-3 font-mono text-sm text-left ${
                  pendingLanguage === 'es' ? 'bg-neutral-900 text-white' : 'bg-white text-black'
                }`}
                onClick={() => setPendingLanguage('es')}
              >
                Español (incluye también Abstract + Keywords en inglés)
              </button>
              <button
                type="button"
                className={`border-3 border-black px-4 py-3 font-mono text-sm text-left ${
                  pendingLanguage === 'en' ? 'bg-neutral-900 text-white' : 'bg-white text-black'
                }`}
                onClick={() => setPendingLanguage('en')}
              >
                English (full report in English)
              </button>
            </div>

            <div className="flex flex-col gap-3 md:flex-row pt-2">
              <button
                type="button"
                className="border-3 border-black px-4 py-2 bg-white text-black flex-1"
                onClick={() => setShowLanguageModal(false)}
                disabled={Boolean(regenerating)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="border-3 border-black px-4 py-2 bg-black text-white flex-1 disabled:opacity-60"
                onClick={async () => {
                  if (!onRegenerate) return
                  setShowLanguageModal(false)
                  await onRegenerate(pendingLanguage)
                }}
                disabled={Boolean(regenerating)}
              >
                {regenerating ? 'Regenerando…' : 'Continuar'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
