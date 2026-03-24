export const generateSessionTitle = (text: string) => {
  const cleaned = text.replace(/\s+/g, ' ').trim()

  if (!cleaned) {
    return '新会话'
  }

  return cleaned.length > 24 ? `${cleaned.slice(0, 24)}...` : cleaned
}
