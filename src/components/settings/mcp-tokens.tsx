'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { getMcpConnectorUrl } from '@/lib/base-url'
import { Plus, Trash2, Copy, Key, ExternalLink, AlertTriangle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

import { createMCPToken, deleteMCPToken, type MCPToken } from '@/actions/mcp-tokens'

interface MCPTokensProps {
  tokens: MCPToken[]
}

export function MCPTokens({ tokens: initialTokens }: MCPTokensProps) {
  const [tokens, setTokens] = useState(initialTokens)
  const [isCreating, setIsCreating] = useState(false)
  const [newTokenName, setNewTokenName] = useState('')
  const [generatedToken, setGeneratedToken] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  // URL du connecteur MCP (source unique : src/lib/base-url.ts — le handler vit sur /mcp).
  const mcpUrl = getMcpConnectorUrl()

  const handleCreate = async () => {
    if (!newTokenName.trim()) {
      toast.error('Veuillez entrer un nom pour le token')
      return
    }

    setIsCreating(true)
    try {
      const result = await createMCPToken(newTokenName.trim())
      if (result.success && result.token) {
        setGeneratedToken(result.token)
        setTokens((prev) => [
          {
            id: crypto.randomUUID(),
            name: newTokenName.trim(),
            created_at: new Date().toISOString(),
            last_used_at: null,
            expires_at: null,
          },
          ...prev,
        ])
        setNewTokenName('')
        toast.success('Token créé avec succès')
      } else {
        toast.error(result.error || 'Erreur lors de la création')
      }
    } catch (error) {
      console.error('Création du token MCP échouée', error)
      toast.error('Erreur lors de la création du token')
    } finally {
      setIsCreating(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return

    setIsDeleting(true)
    try {
      const result = await deleteMCPToken(deleteId)
      if (result.success) {
        setTokens((prev) => prev.filter((t) => t.id !== deleteId))
        toast.success('Token supprimé')
      } else {
        toast.error(result.error || 'Erreur lors de la suppression')
      }
    } catch (error) {
      console.error('Suppression du token MCP échouée', error)
      toast.error('Erreur lors de la suppression')
    } finally {
      setIsDeleting(false)
      setDeleteId(null)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copié dans le presse-papier')
  }

  const formatDate = (date: string | null) => {
    if (!date) return 'Jamais'
    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(date))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          Intégration Claude &amp; ChatGPT (MCP)
        </CardTitle>
        <CardDescription>
          Pilotez vos factures, devis et clients depuis votre assistant : collez l&apos;URL du
          connecteur, connectez-vous avec votre compte Factur-IA, c&apos;est tout.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Instructions */}
        <div className="rounded-lg bg-muted p-4 text-sm space-y-2">
          <p className="font-medium">Comment connecter votre assistant à Factur-IA :</p>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
            <li>Copiez l&apos;URL du connecteur ci-dessous</li>
            <li>
              Claude : Paramètres → Connecteurs → Ajouter un connecteur personnalisé ·
              ChatGPT : Paramètres → Apps et connecteurs → Créer (activez d&apos;abord le mode
              développeur dans Paramètres avancés)
            </li>
            <li>Collez l&apos;URL : votre assistant vous redirige vers Factur-IA pour vous connecter</li>
            <li>Autorisez l&apos;accès : aucun token à saisir, vous retrouvez vos données</li>
          </ol>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 bg-background px-2 py-1 rounded text-xs break-all">
              {mcpUrl}
            </code>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => copyToClipboard(mcpUrl)}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Token généré (affiché une seule fois) */}
        {generatedToken && (
          <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="space-y-2">
              <p className="font-medium text-yellow-800 dark:text-yellow-200">
                Copiez ce token maintenant ! Il ne sera plus affiché.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-background px-2 py-1 rounded text-xs break-all font-mono">
                  {generatedToken}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    copyToClipboard(generatedToken)
                    setGeneratedToken(null)
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => setGeneratedToken(null)}
              >
                J&apos;ai copié le token
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Liste des tokens */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium">Option avancée : tokens API ({tokens.length}/5)</h4>
              <p className="text-xs text-muted-foreground">
                Pour les clients MCP sans OAuth (scripts, intégrations) : token à passer en Bearer.
              </p>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" disabled={tokens.length >= 5}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nouveau token
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Créer un token API</DialogTitle>
                  <DialogDescription>
                    Donnez un nom à ce token pour l&apos;identifier (ex: &quot;Mon Claude Desktop&quot;)
                  </DialogDescription>
                </DialogHeader>
                <Input
                  placeholder="Nom du token"
                  value={newTokenName}
                  onChange={(e) => setNewTokenName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCreate()
                      setDialogOpen(false)
                    }
                  }}
                />
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Annuler
                  </Button>
                  <Button
                    onClick={() => {
                      handleCreate()
                      setDialogOpen(false)
                    }}
                    disabled={isCreating || !newTokenName.trim()}
                  >
                    {isCreating ? 'Création...' : 'Créer'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {tokens.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucun token API : la connexion Claude/ChatGPT ci-dessus n&apos;en a pas besoin.
            </p>
          ) : (
            <div className="space-y-2">
              {tokens.map((token) => (
                <div
                  key={token.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <div className="space-y-1">
                    <p className="font-medium text-sm">{token.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Créé le {formatDate(token.created_at)}
                      {token.last_used_at && ` • Dernière utilisation: ${formatDate(token.last_used_at)}`}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteId(token.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Lien vers la documentation */}
        <div className="pt-2 border-t">
          <a
            href="https://modelcontextprotocol.io/docs/concepts/tools"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <ExternalLink className="h-3 w-3" />
            En savoir plus sur MCP
          </a>
        </div>
      </CardContent>

      {/* Dialog de confirmation de suppression */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce token ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Les applications utilisant ce token ne pourront plus se connecter.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Suppression...' : 'Supprimer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
