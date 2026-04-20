'use client'
import { useRef } from 'react'
import { useStore } from '@/store'

interface Props {
  onImage: (img: HTMLImageElement) => void
}

export function UploadZone({ onImage }: Props) {
  const lang = useStore(s => s.lang)
  const fileRef = useRef<HTMLInputElement>(null)

  const label = lang === 'sv'
    ? 'Släpp en bild här eller klicka för att välja'
    : 'Drop an image here or click to select'

  function loadFile(file: File) {
    if (!/^image\/(png|jpe?g)$/.test(file.type)) {
      alert(lang === 'sv' ? 'Endast PNG/JPEG stöds.' : 'Only PNG/JPEG supported.')
      return
    }
    const reader = new FileReader()
    reader.onload = ev => {
      const img = new Image()
      img.onload = () => onImage(img)
      img.src = ev.target!.result as string
    }
    reader.readAsDataURL(file)
  }

  return (
    <div
      className="dropzone"
      onClick={() => fileRef.current?.click()}
      onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('dragover') }}
      onDragLeave={e => e.currentTarget.classList.remove('dragover')}
      onDrop={e => {
        e.preventDefault()
        e.currentTarget.classList.remove('dragover')
        if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0])
      }}
    >
      <p>{label}</p>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg"
        hidden
        onChange={e => { if (e.target.files?.[0]) loadFile(e.target.files[0]) }}
      />
    </div>
  )
}
