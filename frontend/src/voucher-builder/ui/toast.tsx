import { Alert, AlertDescription } from 'themelia-react-ui/base/feedback'
import { Stack } from 'themelia-react-ui/base/structure'
import { Button } from 'themelia-react-ui/base/buttons'
import { X } from 'lucide-react'
import { useDismissToast, useToasts } from '../hooks/use-toast'
export function ToastContainer() {
  const items = useToasts()
  const dismiss = useDismissToast()
  if (!items.length) return null
  return (
    <Stack gap="sm" className="nc-notifications" aria-label="Workspace notifications">
      {items.map((item) => (
        <Alert
          key={item.id}
          tone={item.variant === 'error' ? 'destructive' : item.variant}
          role={item.variant === 'error' ? 'alert' : 'status'}
          className="pointer-events-auto"
        >
          <Stack direction="horizontal" align="center" gap="md" justify="between" wrap={false}>
            <AlertDescription>{item.message}</AlertDescription>
            <Button
              buttonStyle="ghost"
              size="sm"
              iconOnly
              aria-label="Dismiss notification"
              onClick={() => dismiss(item.id)}
            >
              <X />
            </Button>
          </Stack>
        </Alert>
      ))}
    </Stack>
  )
}
