'use client'

interface MessageProps {
  message: {
    role: 'user' | 'assistant'
    content: string
    timestamp: Date
  }
}

export default function ChatMessage({ message }: MessageProps) {
  const isUser = message.role === 'user'
  const time = new Date(message.timestamp).toLocaleTimeString()

  return (
    <div
      className={`flex ${
        isUser ? 'justify-end' : 'justify-start'
      } mb-4`}
    >
      <div
        className={`max-w-[70%] rounded-lg p-3 ${
          isUser
            ? 'bg-blue-500 text-white'
            : 'bg-gray-100 text-gray-800'
        }`}
      >
        <div className="text-sm mb-1">{message.content}</div>
        <div
          className={`text-xs ${
            isUser ? 'text-blue-100' : 'text-gray-500'
          }`}
        >
          {time}
        </div>
      </div>
    </div>
  )
} 