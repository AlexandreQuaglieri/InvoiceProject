import { z } from 'zod'

// Capture d'email marketing (quiz réforme). Public : toujours revalidé serveur.
export const leadSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  quizWho: z.enum(['indep', 'tpe', 'grande']).optional(),
  quizBilling: z.enum(['b2b', 'b2c', 'mix']).optional(),
  locale: z.enum(['fr', 'en']).optional(),
})

export type LeadInput = z.infer<typeof leadSchema>
