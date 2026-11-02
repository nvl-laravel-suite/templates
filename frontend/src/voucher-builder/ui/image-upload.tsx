import { useEffect, useRef, useState } from 'react'
import { ImageUpload as ThemeliaImageUpload } from 'themelia-react-ui/base/upload'
import { Input } from 'themelia-react-ui/base/text-inputs'
import { FormField } from 'themelia-react-ui/base/forms'
import { Stack } from 'themelia-react-ui/base/structure'
import { Text } from 'themelia-react-ui/typography'
interface ImageUploadProps {
  value: string
  disabled?: boolean
  onChange: (url: string) => void
}
export function ImageUpload({ value, onChange, disabled }: ImageUploadProps) {
  const reader = useRef<FileReader | null>(null)
  const [file, setFile] = useState<File>()
  const [error, setError] = useState('')
  useEffect(() => {
    reader.current?.abort()
    reader.current = null
    setFile(undefined)
  }, [value])
  useEffect(() => () => reader.current?.abort(), [])
  return (
    <Stack gap="lg">
      <FormField label="Image URL" error={error || undefined} hint="Paste a URL or choose a local image.">
        <Input
          aria-label="Image URL"
          disabled={disabled}
          value={value}
          clearable
          placeholder="https://example.com/image.jpg"
          onChange={(event) => {
            reader.current?.abort()
            setError('')
            onChange(event.target.value)
          }}
        />
      </FormField>
      <ThemeliaImageUpload
        disabled={disabled}
        value={file}
        initialPreviewUrl={value || undefined}
        fit="contain"
        accept="image/*"
        strings={{ select: 'Choose image', previewAlt: 'Selected document image' }}
        onValueChange={(file) => {
          reader.current?.abort()
          setError('')
          setFile(file)
          if (!file) {
            onChange('')
            return
          }
          const next = new FileReader()
          reader.current = next
          next.onload = () => {
            if (reader.current === next && typeof next.result === 'string') onChange(next.result)
          }
          next.onerror = () => {
            if (reader.current === next) setError('Unable to read this image. Choose it again or use a URL.')
          }
          next.readAsDataURL(file)
        }}
      />
      <Text type="secondary" size="xs">
        Local images are stored in this document. Your application controls production asset storage.
      </Text>
    </Stack>
  )
}
