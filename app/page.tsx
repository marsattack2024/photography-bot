import { Suspense } from 'react'
import ChatInterface from '@/components/ChatInterface'

export default function Home() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Photography Marketing Assistant</h1>
      <Suspense fallback={<div>Loading chat interface...</div>}>
        <ChatInterface />
      </Suspense>
    </div>
  )
} 