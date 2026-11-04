'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export function useStudyFocus(eligible: boolean) {
  const [active, setActive] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const activeRef = useRef(false)
  const ownedFullscreen = useRef(false)
  const requesting = useRef(false)

  const leave = useCallback(() => {
    activeRef.current = false
    setActive(false)
    setNotice(null)
    const shouldExit =
      ownedFullscreen.current && document.fullscreenElement === document.documentElement
    ownedFullscreen.current = false
    if (shouldExit) void document.exitFullscreen().catch(() => undefined)
    requestAnimationFrame(() => buttonRef.current?.focus({ preventScroll: true }))
  }, [])

  useEffect(() => {
    if (!eligible && activeRef.current) leave()
  }, [eligible, leave])

  useEffect(() => {
    function fullscreenChanged() {
      if (document.fullscreenElement === document.documentElement && requesting.current) {
        if (activeRef.current) ownedFullscreen.current = true
        else void document.exitFullscreen().catch(() => undefined)
      } else if (
        ownedFullscreen.current &&
        document.fullscreenElement !== document.documentElement
      ) {
        ownedFullscreen.current = false
        leave()
      }
    }
    function escape(event: KeyboardEvent) {
      // A source reader or other modal gets its own Escape key first.
      if (
        event.key === 'Escape' &&
        !event.defaultPrevented &&
        activeRef.current &&
        !document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]')
      )
        leave()
    }
    document.addEventListener('fullscreenchange', fullscreenChanged)
    window.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('fullscreenchange', fullscreenChanged)
      window.removeEventListener('keydown', escape)
      activeRef.current = false
      if (ownedFullscreen.current && document.fullscreenElement === document.documentElement)
        void document.exitFullscreen().catch(() => undefined)
    }
  }, [leave])

  function enter() {
    if (!eligible) return
    activeRef.current = true
    setActive(true)
    setNotice(null)
    const root = document.documentElement
    if (document.fullscreenElement === root) return
    const fallback = () => {
      if (activeRef.current)
        setNotice(
          'Browser fullscreen is unavailable here. Focus mode is still on and app navigation is hidden.',
        )
    }
    if (!root.requestFullscreen || document.fullscreenEnabled === false) {
      fallback()
      return
    }
    // Called directly by the button click, while browser user activation is still available.
    requesting.current = true
    try {
      void root
        .requestFullscreen({ navigationUI: 'hide' })
        .then(() => {
          requesting.current = false
          if (document.fullscreenElement !== root) return
          if (activeRef.current) ownedFullscreen.current = true
          else void document.exitFullscreen().catch(() => undefined)
        })
        .catch(() => {
          requesting.current = false
          fallback()
        })
    } catch {
      requesting.current = false
      fallback()
    }
  }

  return {
    active: eligible && active,
    notice,
    buttonRef,
    toggle: () => (activeRef.current ? leave() : enter()),
  }
}
