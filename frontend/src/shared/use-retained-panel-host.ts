import { useLayoutEffect, useRef, useState, type RefObject } from 'react'

/** Keeps the portal target stable while a consumer moves its panel between surfaces. */
export function useRetainedPanelHost(hostClassName: string): {
  host: HTMLDivElement | null
  hostRef: RefObject<HTMLDivElement | null>
  parkingRef: RefObject<HTMLDivElement | null>
} {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const parkingRef = useRef<HTMLDivElement | null>(null)
  const [host, setHost] = useState<HTMLDivElement | null>(null)

  useLayoutEffect(() => {
    const node = document.createElement('div')
    node.className = hostClassName
    hostRef.current = node
    parkingRef.current?.appendChild(node)
    setHost(node)
    return () => { hostRef.current = null; node.remove() }
    // The portal target must not change when its presentation class changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useLayoutEffect(() => {
    if (hostRef.current) hostRef.current.className = hostClassName
  }, [hostClassName])

  return { host, hostRef, parkingRef }
}
