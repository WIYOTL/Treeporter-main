import { useEffect, useRef, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'

// Enregistre le service worker manuellement (registerType: 'prompt' dans vite.config.ts)
// pour ne jamais recharger la page pendant un envoi en cours — voir A1 dans la roadmap V2.0.0.
// Une mise à jour détectée reste "en attente" (updateReady) jusqu'à ce que l'app appelle
// explicitement applyUpdateNow(), une fois qu'il n'y a plus d'envoi actif.
export function usePwaUpdate() {
  const [updateReady, setUpdateReady] = useState(false)
  const updateFnRef = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null)

  useEffect(() => {
    const updateSW = registerSW({
      onNeedRefresh() {
        setUpdateReady(true)
      },
    })
    updateFnRef.current = updateSW
  }, [])

  function applyUpdateNow() {
    if (updateFnRef.current) {
      updateFnRef.current(true)
      setUpdateReady(false)
    }
  }

  return { updateReady, applyUpdateNow }
}
