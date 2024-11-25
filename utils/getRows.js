import xlsx from 'xlsx'

export const getRows = ({ fileBuffer, sheet }) => {
  const workbook = xlsx.read(fileBuffer, { type: 'buffer' })

  const sheetName = workbook.SheetNames[sheet]

  const sheetSelected = workbook.Sheets[sheetName]

  const rows = xlsx.utils.sheet_to_json(sheetSelected)

  return rows
}