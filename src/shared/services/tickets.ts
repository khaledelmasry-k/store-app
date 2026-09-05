import { httpsCallable, getFunctions } from 'firebase/functions'

const fns = () => getFunctions()

export function createTicket(data: { storeId: string; subject: string; description: string; priority?: string }) {
  return httpsCallable(fns(), 'createTicket')(data)
}
export function getTicket(ticketId: string) {
  return httpsCallable(fns(), 'getTicket')({ ticketId })
}
export function listTickets(params: { storeId?: string; status?: string; priority?: string; query?: string }) {
  return httpsCallable(fns(), 'listTickets')(params)
}
export function replyTicket(ticketId: string, body: string) {
  return httpsCallable(fns(), 'replyTicket')({ ticketId, body })
}
export function updateTicketStatus(ticketId: string, status: string) {
  return httpsCallable(fns(), 'updateTicketStatus')({ ticketId, status })
}
export function assignTicket(ticketId: string, assignedTo: string | null) {
  return httpsCallable(fns(), 'assignTicket')({ ticketId, assignedTo })
}
export function closeTicket(ticketId: string) {
  return httpsCallable(fns(), 'closeTicket')({ ticketId })
}
export function reopenTicket(ticketId: string) {
  return httpsCallable(fns(), 'reopenTicket')({ ticketId })
}
