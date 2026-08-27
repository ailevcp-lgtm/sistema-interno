interface LibroAsociadoRow {
  numero: number
  apellidoNombre: string
  dni: string
  categoria: string
  fechaIngreso: string
  origen: string
  cuotasPagadas: string
  sanciones: string
  estado: string
  fechaBaja?: string | null
  causaBaja?: string | null
}
interface LibroPdfInput {
  periodo: string
  libroNumero: number
  folioDesde: number
  cuit?: string | null
  generadoEl: Date
  hashAnterior?: string | null
  rows: LibroAsociadoRow[]
}

const PAGE_WIDTH = 841.89
const PAGE_HEIGHT = 595.28
const ROWS_PER_PAGE = 6

function normalizePdfText(value: string) {
  return value
    .replace(/[–—]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, '...')
}

function winAnsiHex(value: string) {
  const normalized = normalizePdfText(value)
  const bytes: number[] = []
  for (const char of normalized) {
    const code = char.codePointAt(0) || 32
    bytes.push(code <= 255 ? code : 63)
  }
  return `<${bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('')}>`
}

function truncate(value: string, max: number) {
  if (value.length <= max) return value
  return `${value.slice(0, Math.max(0, max - 3))}...`
}

function text(x: number, y: number, value: string, size = 8, font = 'F1') {
  return `BT /${font} ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td ${winAnsiHex(value)} Tj ET\n`
}

function line(x1: number, y1: number, x2: number, y2: number, width = 0.5) {
  return `${width} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S\n`
}

function fillRect(x: number, y: number, width: number, height: number, gray: number) {
  return `${gray} g ${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f 0 g\n`
}

function formatDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(`${value.slice(0, 10)}T12:00:00`)
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

function buildPageContent(input: LibroPdfInput, pageRows: LibroAsociadoRow[], pageIndex: number, pageCount: number) {
  const margin = 32
  const folio = input.folioDesde + pageIndex
  const columns = [32, 65, 224, 292, 360, 431, 528, 650, 742, 810]
  let output = ''

  output += text(margin, 559, 'ASOCIACIÓN CIVIL AILE', 15, 'F2')
  output += text(margin, 542, 'REGISTRO DE PERSONAS ASOCIADAS - ACTUALIZACIÓN MENSUAL', 10, 'F2')
  output += text(650, 559, `Libro N.º ${input.libroNumero}`, 9, 'F2')
  output += text(650, 543, `Folio N.º ${folio}`, 9, 'F2')
  output += text(margin, 523, `Período: ${input.periodo}   |   CUIT: ${input.cuit || 'pendiente de configuración'}   |   Emitido: ${formatDate(input.generadoEl)}`, 8)
  output += line(margin, 515, PAGE_WIDTH - margin, 515, 1)

  const tableTop = 492
  const headerHeight = 28
  const rowHeight = 56
  output += fillRect(margin, tableTop - headerHeight, PAGE_WIDTH - margin * 2, headerHeight, 0.92)
  const headers = ['N.º', 'Apellido y nombres', 'DNI', 'Categoría', 'Ingreso', 'Origen', 'Cuotas pagadas', 'Sanciones', 'Estado']
  const headerLimits = [4, 27, 12, 10, 11, 16, 18, 13, 10]
  headers.forEach((header, index) => {
    output += text(columns[index] + 3, tableTop - 18, truncate(header, headerLimits[index]), 6.8, 'F2')
  })

  const tableBottom = tableTop - headerHeight - rowHeight * ROWS_PER_PAGE
  for (const x of columns) output += line(x, tableTop, x, tableBottom)
  output += line(columns[columns.length - 1], tableTop, columns[columns.length - 1], tableBottom)
  output += line(margin, tableTop, columns[columns.length - 1], tableTop)
  output += line(margin, tableTop - headerHeight, columns[columns.length - 1], tableTop - headerHeight)

  pageRows.forEach((row, index) => {
    const rowTop = tableTop - headerHeight - rowHeight * index
    const baseline = rowTop - 18
    const values = [
      String(row.numero), truncate(row.apellidoNombre, 29), row.dni, row.categoria,
      formatDate(row.fechaIngreso), truncate(row.origen, 17), truncate(row.cuotasPagadas, 20),
      truncate(row.sanciones || 'Sin sanciones', 15), row.estado,
    ]
    values.forEach((value, columnIndex) => {
      output += text(columns[columnIndex] + 3, baseline, value, 7)
    })
    if (row.fechaBaja || row.causaBaja) {
      output += text(columns[1] + 3, baseline - 15, truncate(`Baja: ${row.fechaBaja ? formatDate(row.fechaBaja) : '-'} - ${row.causaBaja || 'sin causa informada'}`, 70), 6.5)
    }
    output += line(margin, rowTop - rowHeight, columns[columns.length - 1], rowTop - rowHeight)
  })

  for (let index = pageRows.length; index < ROWS_PER_PAGE; index += 1) {
    const rowBottom = tableTop - headerHeight - rowHeight * (index + 1)
    output += line(margin, rowBottom, columns[columns.length - 1], rowBottom)
  }

  output += text(margin, 93, 'Se deja constancia de que el presente registro refleja la situación asentada al cierre del período indicado.', 7)
  if (input.hashAnterior) {
    output += text(margin, 80, `Huella SHA-256 del cierre anterior: ${input.hashAnterior}`, 6.5)
  }
  output += line(86, 48, 270, 48)
  output += line(570, 48, 754, 48)
  output += text(128, 35, 'Presidencia - firma y aclaración', 7)
  output += text(608, 35, 'Secretaría - firma y aclaración', 7)
  output += text(371, 18, `Página ${pageIndex + 1} de ${pageCount}`, 6.5)
  return output
}

export function getLibroAsociadosPageCount(rowCount: number) {
  return Math.max(1, Math.ceil(rowCount / ROWS_PER_PAGE))
}

export function buildLibroAsociadosPdf(input: LibroPdfInput): Uint8Array {
  const pageCount = getLibroAsociadosPageCount(input.rows.length)
  const objects: string[] = []
  const addObject = (body: string) => {
    objects.push(body)
    return objects.length
  }

  const catalogId = addObject('')
  const pagesId = addObject('')
  const fontRegularId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
  const fontBoldId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')
  const pageIds: number[] = []

  for (let index = 0; index < pageCount; index += 1) {
    const pageRows = input.rows.slice(index * ROWS_PER_PAGE, (index + 1) * ROWS_PER_PAGE)
    const content = buildPageContent(input, pageRows, index, pageCount)
    const contentId = addObject(`<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}endstream`)
    const pageId = addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`)
    pageIds.push(pageId)
  }

  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`

  let pdf = '%PDF-1.7\n%âãÏÓ\n'
  const offsets = [0]
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'))
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`
  })
  const xrefOffset = Buffer.byteLength(pdf, 'latin1')
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  return new Uint8Array(Buffer.from(pdf, 'latin1'))
}
