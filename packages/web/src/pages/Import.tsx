import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function Import() {
  const { t } = useTranslation()
  const [service, setService] = useState('')
  const [branch, setBranch] = useState('main')
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<{ endpointCount: number; wasConverted: boolean; warnings: string[] } | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) setFile(f)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) { setError(t('import.noFile')); return }
    setLoading(true)
    setError('')
    setResult(null)

    const formData = new FormData()
    formData.append('service', service)
    formData.append('branch', branch)
    formData.append('file', file)

    try {
      const data = await api.upload(formData)
      if (data.error) throw new Error(data.error)
      setResult(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('import.uploadFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('import.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('import.subtitle')}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="service">{t('import.serviceNameLabel')}</Label>
          <Input
            id="service"
            value={service}
            onChange={e => setService(e.target.value)}
            required
            placeholder="user-service"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="branch">{t('import.branchLabel')}</Label>
          <Input
            id="branch"
            value={branch}
            onChange={e => setBranch(e.target.value)}
            required
            placeholder="main"
          />
        </div>

        <div
          onDrop={onDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => fileInput.current?.click()}
          className="cursor-pointer rounded-xl border-2 border-dashed border-border p-10 text-center transition-colors hover:border-violet-500"
        >
          <input
            ref={fileInput}
            type="file"
            accept=".yaml,.yml,.json"
            className="hidden"
            onChange={e => setFile(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <p className="text-sm text-violet-400">{file.name}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t('import.dropHint')}
              <br />{t('import.dropHintClick')}
            </p>
          )}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {result && (
          <Alert className="border-green-700 bg-green-950/50 text-green-400">
            <AlertDescription>
              {t('import.uploadedSuccess', { count: result.endpointCount })}
              {result.wasConverted ? t('import.convertedNote') : ''}
              {result.warnings.length > 0 && (
                <span className="block mt-1 text-yellow-400">{result.warnings.join(', ')}</span>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={() => navigate('/')} className="flex-1">
            {t('import.cancel')}
          </Button>
          <Button type="submit" disabled={loading} className="flex-1">
            {loading ? t('import.uploading') : t('import.upload')}
          </Button>
        </div>
      </form>
    </div>
  )
}
