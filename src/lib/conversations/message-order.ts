export function orderConversationMessagesByNewestTurn<T extends { role: string }>(
  chronologicalMessages: T[],
) {
  const turns: T[][] = []
  let currentTurn: T[] | null = null

  for (const message of chronologicalMessages) {
    if (message.role === 'user') {
      if (currentTurn?.length) turns.push(currentTurn)
      currentTurn = [message]
      continue
    }

    if (currentTurn) {
      currentTurn.push(message)
    } else {
      turns.push([message])
    }
  }

  if (currentTurn?.length) turns.push(currentTurn)
  return turns.reverse().flat()
}
